'use strict';

/**
 * Report Service - Génération automatique de rapports de sessions
 *
 * Déclenché automatiquement à la fin de :
 *   - Toute vidéoconférence (video_room status = 'ended')
 *   - Tout appel P2P terminé (p2p_calls status = 'ended')
 *   - Tout appel support terminé (support_calls status = 'ended')
 *
 * Pour chaque session, le service :
 *   1. Construit les métadonnées (titre, participants, durée)
 *   2. Génère un PDF institutionnel professionnel via le service AI
 *   3. Optionnellement génère un résumé audio via TTS
 *   4. Enregistre en base de données
 *   5. Envoie le rapport par email à chaque participant
 *
 * Scope : serveur central uniquement (pas les tenants).
 */

const path        = require('path');
const fs          = require('fs');
const http        = require('http');
const https       = require('https');
const { pool }    = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { redis }   = require('../../config/redis');

const AI_BASE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const AI_API_KEY  = process.env.AI_API_KEY || '';
const REPORTS_DIR = process.env.REPORTS_DIR || '/data/reports';

// ── Client HTTP minimal vers l'AI ─────────────────────────────────────────────

function _aiRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url      = new URL(AI_BASE_URL + urlPath);
    const protocol = url.protocol === 'https:' ? https : http;
    const payload  = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    AI_API_KEY,
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { resolve({}); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('AI timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Télécharger un fichier binaire depuis l'AI ────────────────────────────────

function _downloadFile(urlPath, destPath) {
  return new Promise((resolve, reject) => {
    const url      = new URL(AI_BASE_URL + urlPath);
    const protocol = url.protocol === 'https:' ? https : http;

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);

    const req = protocol.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'GET',
      headers:  { 'X-API-Key': AI_API_KEY },
    }, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`AI file download failed: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    });
    req.on('error', err => { file.close(); fs.unlink(destPath, () => {}); reject(err); });
    req.setTimeout(120000, () => req.destroy(new Error('Download timeout')));
    req.end();
  });
}

// ── Créer l'entrée de rapport en BDD ──────────────────────────────────────────

async function _createReportRecord(sessionType, sourceId, { title, startedAt, endedAt, durationSeconds, participantCount, participants }) {
  const { rows } = await pool.query(
    `INSERT INTO session_reports
       (session_type, source_id, title, started_at, ended_at,
        duration_seconds, participant_count, participants, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     RETURNING id`,
    [sessionType, sourceId, title, startedAt || null, endedAt || null,
     durationSeconds || null, participantCount || 0, JSON.stringify(participants || [])]
  );
  return rows[0].id;
}

async function _updateReport(reportId, fields) {
  const sets  = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`);
  const vals  = Object.values(fields);
  await pool.query(
    `UPDATE session_reports SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`,
    [reportId, ...vals]
  );
}

// ── Récupérer les participants avec emails ─────────────────────────────────────

async function _getParticipantsWithEmails(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id, full_name, email FROM users WHERE id = ANY($1::uuid[])`,
    [userIds]
  );
  return rows;
}

// ── Formater la durée ─────────────────────────────────────────────────────────

function _formatDuration(seconds) {
  if (!seconds) return 'Non disponible';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

// ── Formater une date ─────────────────────────────────────────────────────────

function _formatDate(dateStr) {
  if (!dateStr) return 'Non disponible';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Porto-Novo',
  });
}

// ── Générer le rapport via l'AI ───────────────────────────────────────────────

async function _generateViaAI(reportId, { title, startedAt, endedAt, participants, durationSeconds, sessionType }) {
  const date      = startedAt ? new Date(startedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
  const pNames    = participants.map(p => p.full_name || p.email || 'Participant').filter(Boolean);
  const transcript = `Session Palabre - ${title}\nDate : ${_formatDate(startedAt)}\nDurée : ${_formatDuration(durationSeconds)}\nParticipants : ${pNames.join(', ')}\nType : ${sessionType === 'p2p_call' ? 'Appel P2P' : sessionType === 'support_call' ? 'Appel service client' : 'Vidéoconférence'}`;

  try {
    // Créer la réunion dans l'AI pour générer le PDF
    const meeting = await _aiRequest('POST', '/meetings', {
      room:         title,
      title:        title,
      participants: pNames,
      transcript,
    });

    if (!meeting.meeting_id) return null;

    const meetingId = meeting.meeting_id;

    // Attendre le traitement (polling simple, max 2 minutes)
    let status = 'queued';
    let attempt = 0;
    while (['queued', 'summarizing', 'synthesizing'].includes(status) && attempt < 24) {
      await new Promise(r => setTimeout(r, 5000));
      const info = await _aiRequest('GET', `/meetings/${meetingId}`);
      status = info.status;
      attempt++;
      if (status === 'done' || status === 'error') break;
    }

    if (status !== 'done') return null;

    // Récupérer les infos finales
    const info = await _aiRequest('GET', `/meetings/${meetingId}`);
    return { meetingId, downloads: info.downloads || {} };
  } catch (err) {
    console.error('[report] AI generation error:', err.message);
    return null;
  }
}

// ── Télécharger les fichiers générés ─────────────────────────────────────────

async function _downloadGeneratedFiles(reportId, downloads) {
  const result = { pdfPath: null, audioPath: null };

  const dir = path.join(REPORTS_DIR, reportId);
  fs.mkdirSync(dir, { recursive: true });

  if (downloads.pdf) {
    try {
      const dest = path.join(dir, 'rapport.pdf');
      await _downloadFile(downloads.pdf, dest);
      result.pdfPath = dest;
    } catch (err) {
      console.error('[report] PDF download error:', err.message);
    }
  }

  if (downloads.audio) {
    try {
      const dest = path.join(dir, 'resume.wav');
      await _downloadFile(downloads.audio, dest);
      result.audioPath = dest;
    } catch (err) {
      console.error('[report] Audio download error:', err.message);
    }
  }

  return result;
}

// ── Construire l'email institutionnel ─────────────────────────────────────────

function _buildEmailHtml({ title, sessionType, startedAt, endedAt, durationSeconds, participants, hasPdf, hasAudio }) {
  const typeLabel = {
    video_room:   'Compte rendu de vidéoconférence',
    p2p_call:     'Rapport d\'appel',
    support_call: 'Compte rendu de session de support',
  }[sessionType] || 'Rapport de session';

  const pList = participants
    .map(p => `<li style="margin: 2px 0; color: #202124;">${p.full_name || p.email || 'Participant'}</li>`)
    .join('');

  const attachmentNote = hasPdf
    ? '<p style="margin: 12px 0; color: #5F6368; font-size: 13px;">Le rapport complet est joint en pièce jointe au format PDF.</p>'
    : '';
  const audioNote = hasAudio
    ? '<p style="margin: 4px 0; color: #5F6368; font-size: 13px;">Un résumé audio est également joint.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#F8F9FA; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA; padding: 32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#FFFFFF; border: 1px solid #E0E0E0;">

        <!-- En-tête institutionnel -->
        <tr>
          <td style="background: #1F3A5F; padding: 24px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 style="margin:0; color:#FFFFFF; font-size:20px; font-weight:700; letter-spacing:0.5px;">PALABRE</h1>
                  <p style="margin: 4px 0 0; color: rgba(255,255,255,0.75); font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">Plateforme de communication professionnelle</p>
                </td>
                <td align="right">
                  <p style="margin:0; color: rgba(255,255,255,0.60); font-size: 11px;">Document officiel</p>
                  <p style="margin: 2px 0 0; color: rgba(255,255,255,0.60); font-size: 11px;">${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Titre du document -->
        <tr>
          <td style="padding: 28px 32px 16px; border-bottom: 2px solid #1F3A5F;">
            <h2 style="margin:0; color:#1F3A5F; font-size:18px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${typeLabel}</h2>
            <h3 style="margin: 6px 0 0; color:#202124; font-size:15px; font-weight:600;">${title}</h3>
          </td>
        </tr>

        <!-- Métadonnées -->
        <tr>
          <td style="padding: 20px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #F1F3F4; width: 40%;">
                  <span style="font-size:12px; color:#5F6368; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Date de début</span>
                </td>
                <td style="padding: 6px 0; border-bottom: 1px solid #F1F3F4;">
                  <span style="font-size:13px; color:#202124;">${_formatDate(startedAt)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #F1F3F4;">
                  <span style="font-size:12px; color:#5F6368; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Date de fin</span>
                </td>
                <td style="padding: 6px 0; border-bottom: 1px solid #F1F3F4;">
                  <span style="font-size:13px; color:#202124;">${_formatDate(endedAt)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #F1F3F4;">
                  <span style="font-size:12px; color:#5F6368; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Durée</span>
                </td>
                <td style="padding: 6px 0; border-bottom: 1px solid #F1F3F4;">
                  <span style="font-size:13px; color:#202124;">${_formatDuration(durationSeconds)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0;">
                  <span style="font-size:12px; color:#5F6368; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Participants (${participants.length})</span>
                </td>
                <td style="padding: 6px 0;">
                  <ul style="margin:0; padding-left:16px; font-size:13px;">
                    ${pList}
                  </ul>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Note pièces jointes -->
        ${attachmentNote || audioNote ? `
        <tr>
          <td style="padding: 0 32px 20px;">
            <div style="padding: 12px 16px; background: #E8F0FE; border-left: 3px solid #1A73E8;">
              ${attachmentNote}${audioNote}
            </div>
          </td>
        </tr>` : ''}

        <!-- Tampon / Pied institutionnel -->
        <tr>
          <td style="padding: 20px 32px; background: #F8F9FA; border-top: 2px solid #1F3A5F;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0; font-size:11px; color:#5F6368;">
                    Ce document a été généré automatiquement par la plateforme <strong>Palabre</strong>.<br>
                    Il constitue un compte rendu officiel de la session et ne doit pas être modifié.<br>
                    Toute modification invalide le caractère officiel de ce document.
                  </p>
                </td>
                <td align="right" style="white-space: nowrap; padding-left: 16px;">
                  <div style="border: 2px solid #1F3A5F; padding: 8px 14px; display: inline-block;">
                    <p style="margin:0; font-size:11px; color:#1F3A5F; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Palabre</p>
                    <p style="margin: 2px 0 0; font-size:10px; color:#5F6368;">Document certifié</p>
                    <p style="margin: 2px 0 0; font-size:10px; color:#9AA0A6;">${new Date().getFullYear()}</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Envoyer les emails ────────────────────────────────────────────────────────

async function _sendReportEmails(reportId, participants, emailData) {
  const { title, sessionType, startedAt, endedAt, durationSeconds, pdfPath, audioPath } = emailData;

  const typeLabel = {
    video_room:   'Compte rendu de vidéoconférence',
    p2p_call:     'Rapport d\'appel',
    support_call: 'Compte rendu de session de support',
  }[sessionType] || 'Rapport de session';

  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({ filename: 'rapport_palabre.pdf', path: pdfPath, contentType: 'application/pdf' });
  }
  if (audioPath && fs.existsSync(audioPath)) {
    attachments.push({ filename: 'resume_audio.wav', path: audioPath, contentType: 'audio/wav' });
  }

  const html = _buildEmailHtml({
    title,
    sessionType,
    startedAt,
    endedAt,
    durationSeconds,
    participants,
    hasPdf:   attachments.some(a => a.contentType === 'application/pdf'),
    hasAudio: attachments.some(a => a.contentType === 'audio/wav'),
  });

  const recipientsWithEmail = participants.filter(p => p.email);

  for (const participant of recipientsWithEmail) {
    try {
      const mailer = require('../../config/mailer');
      const transporter = mailer.getTransporter ? mailer.getTransporter() : null;

      if (transporter && typeof transporter.sendMail === 'function') {
        await transporter.sendMail({
          from:        process.env.MAIL_FROM || 'Palabre <no-reply@palabre.app>',
          to:          participant.email,
          subject:     `${typeLabel} - ${title}`,
          html,
          attachments,
        });
      } else {
        // Fallback sans pièces jointes via sendMail simplifié
        await sendMail({
          to:      participant.email,
          subject: `${typeLabel} - ${title}`,
          html,
        });
      }

      console.log(`[report] Email envoyé à ${participant.email} pour le rapport ${reportId}`);
    } catch (err) {
      console.error(`[report] Echec email pour ${participant.email}:`, err.message);
    }
  }

  // Marquer l'envoi
  await _updateReport(reportId, { emails_sent_at: new Date().toISOString() });
}

// ═════════════════════════════════════════════════════════════════════════════
// API PUBLIQUE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Génère et envoie le rapport pour une vidéoconférence terminée.
 * À appeler après endRoom().
 */
async function generateVideoRoomReport(roomId) {
  // Dépiler si un rapport est déjà en cours pour cette room
  const lockKey = `report:lock:video_room:${roomId}`;
  const locked = await redis.set(lockKey, '1', 'EX', 300, 'NX');
  if (!locked) return;

  try {
    // Récupérer les données de la room
    const { rows: roomRows } = await pool.query(
      `SELECT r.id, r.title, r.started_at, r.ended_at,
              r.actual_participant_count, r.org_id,
              EXTRACT(EPOCH FROM (r.ended_at - r.started_at))::int AS duration_seconds
       FROM video_rooms r
       WHERE r.id = $1 AND r.status = 'ended'`,
      [roomId]
    );
    if (!roomRows[0]) return;
    const room = roomRows[0];

    // Récupérer les participants
    const { rows: partRows } = await pool.query(
      `SELECT p.user_id FROM video_room_participants p
       WHERE p.room_id = $1 AND p.status IN ('active','left')`,
      [roomId]
    );
    const userIds     = partRows.map(r => r.user_id);
    const participants = await _getParticipantsWithEmails(userIds);

    if (participants.length === 0) return;

    // Créer l'entrée rapport
    const reportId = await _createReportRecord('video_room', roomId, {
      title:            room.title,
      startedAt:        room.started_at,
      endedAt:          room.ended_at,
      durationSeconds:  room.duration_seconds,
      participantCount: room.actual_participant_count || userIds.length,
      participants:     participants.map(p => ({ id: p.id, name: p.full_name, email: p.email })),
    });

    await _updateReport(reportId, { status: 'generating' });

    // Générer via AI
    const aiResult = await _generateViaAI(reportId, {
      title:           room.title,
      startedAt:       room.started_at,
      endedAt:         room.ended_at,
      participants,
      durationSeconds: room.duration_seconds,
      sessionType:     'video_room',
    });

    let pdfPath = null, audioPath = null;

    if (aiResult) {
      const files = await _downloadGeneratedFiles(reportId, aiResult.downloads);
      pdfPath   = files.pdfPath;
      audioPath = files.audioPath;
    }

    await _updateReport(reportId, { status: 'done', pdf_path: pdfPath, audio_path: audioPath });

    // Envoyer les emails
    await _sendReportEmails(reportId, participants, {
      title:           room.title,
      sessionType:     'video_room',
      startedAt:       room.started_at,
      endedAt:         room.ended_at,
      durationSeconds: room.duration_seconds,
      pdfPath,
      audioPath,
    });

  } catch (err) {
    console.error('[report] generateVideoRoomReport error:', err.message);
    try {
      const { rows } = await pool.query(
        `SELECT id FROM session_reports WHERE source_id = $1 AND session_type = 'video_room'`,
        [roomId]
      );
      if (rows[0]) await _updateReport(rows[0].id, { status: 'error', error: err.message.slice(0, 500) });
    } catch {}
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Génère et envoie le rapport pour un appel P2P terminé.
 */
async function generateP2PCallReport(callId) {
  const lockKey = `report:lock:p2p_call:${callId}`;
  const locked = await redis.set(lockKey, '1', 'EX', 300, 'NX');
  if (!locked) return;

  try {
    const { rows: callRows } = await pool.query(
      `SELECT c.id, c.call_type, c.started_at, c.ended_at, c.duration_seconds,
              c.caller_id, c.callee_id,
              uc.full_name AS caller_name, uc.email AS caller_email,
              ul.full_name AS callee_name, ul.email AS callee_email
       FROM p2p_calls c
       JOIN users uc ON uc.id = c.caller_id
       JOIN users ul ON ul.id = c.callee_id
       WHERE c.id = $1 AND c.status = 'ended'`,
      [callId]
    );
    if (!callRows[0]) return;
    const call = callRows[0];

    const callTypeLabel = call.call_type === 'video' ? 'Appel video' : 'Appel audio';
    const title = `${callTypeLabel} - ${call.caller_name} / ${call.callee_name}`;

    const participants = [
      { id: call.caller_id, full_name: call.caller_name, email: call.caller_email },
      { id: call.callee_id, full_name: call.callee_name, email: call.callee_email },
    ];

    const reportId = await _createReportRecord('p2p_call', callId, {
      title,
      startedAt:        call.started_at,
      endedAt:          call.ended_at,
      durationSeconds:  call.duration_seconds,
      participantCount: 2,
      participants:     participants.map(p => ({ id: p.id, name: p.full_name, email: p.email })),
    });

    await _updateReport(reportId, { status: 'generating' });

    // Pour les appels courts, on génère un rapport minimal sans AI
    const aiResult = await _generateViaAI(reportId, {
      title,
      startedAt:       call.started_at,
      endedAt:         call.ended_at,
      participants,
      durationSeconds: call.duration_seconds,
      sessionType:     'p2p_call',
    });

    let pdfPath = null, audioPath = null;
    if (aiResult) {
      const files = await _downloadGeneratedFiles(reportId, aiResult.downloads);
      pdfPath   = files.pdfPath;
      audioPath = files.audioPath;
    }

    await _updateReport(reportId, { status: 'done', pdf_path: pdfPath, audio_path: audioPath });

    await _sendReportEmails(reportId, participants, {
      title,
      sessionType:     'p2p_call',
      startedAt:       call.started_at,
      endedAt:         call.ended_at,
      durationSeconds: call.duration_seconds,
      pdfPath,
      audioPath,
    });

  } catch (err) {
    console.error('[report] generateP2PCallReport error:', err.message);
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Génère et envoie le rapport pour un appel support terminé.
 */
async function generateSupportCallReport(callId) {
  const lockKey = `report:lock:support_call:${callId}`;
  const locked = await redis.set(lockKey, '1', 'EX', 300, 'NX');
  if (!locked) return;

  try {
    const { rows: callRows } = await pool.query(
      `SELECT sc.id, sc.session_id, sc.user_id, sc.answered_at,
              sc.ended_at, sc.duration_seconds,
              u.full_name AS user_name, u.email AS user_email
       FROM support_calls sc
       JOIN users u ON u.id = sc.user_id
       WHERE sc.id = $1 AND sc.status = 'ended'`,
      [callId]
    );
    if (!callRows[0]) return;
    const call = callRows[0];

    // Récupérer l'email du super-admin (pour l'inclure dans le rapport)
    const { rows: adminRows } = await pool.query(
      `SELECT id, full_name, email FROM users WHERE is_super_admin = true LIMIT 1`
    );
    const admin = adminRows[0];

    const title = `Session de support - ${call.user_name}`;
    const participants = [
      { id: call.user_id, full_name: call.user_name, email: call.user_email },
      ...(admin ? [{ id: admin.id, full_name: admin.full_name || 'Support Palabre', email: admin.email }] : []),
    ];

    const reportId = await _createReportRecord('support_call', callId, {
      title,
      startedAt:        call.answered_at,
      endedAt:          call.ended_at,
      durationSeconds:  call.duration_seconds,
      participantCount: participants.length,
      participants:     participants.map(p => ({ id: p.id, name: p.full_name, email: p.email })),
    });

    await _updateReport(reportId, { status: 'generating' });

    const aiResult = await _generateViaAI(reportId, {
      title,
      startedAt:       call.answered_at,
      endedAt:         call.ended_at,
      participants,
      durationSeconds: call.duration_seconds,
      sessionType:     'support_call',
    });

    let pdfPath = null, audioPath = null;
    if (aiResult) {
      const files = await _downloadGeneratedFiles(reportId, aiResult.downloads);
      pdfPath   = files.pdfPath;
      audioPath = files.audioPath;
    }

    await _updateReport(reportId, { status: 'done', pdf_path: pdfPath, audio_path: audioPath });

    await _sendReportEmails(reportId, participants, {
      title,
      sessionType:     'support_call',
      startedAt:       call.answered_at,
      endedAt:         call.ended_at,
      durationSeconds: call.duration_seconds,
      pdfPath,
      audioPath,
    });

  } catch (err) {
    console.error('[report] generateSupportCallReport error:', err.message);
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Retourne la liste des rapports (super-admin).
 */
async function listReports({ sessionType, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params     = [];
  let idx = 1;
  if (sessionType) { conditions.push(`session_type = $${idx}`); params.push(sessionType); idx++; }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT id, session_type, source_id, title, started_at, ended_at,
            duration_seconds, participant_count, status, emails_sent_at, created_at
     FROM session_reports ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );
  return rows;
}

module.exports = {
  generateVideoRoomReport,
  generateP2PCallReport,
  generateSupportCallReport,
  listReports,
};
