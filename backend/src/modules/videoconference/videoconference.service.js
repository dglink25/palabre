'use strict';

/**
 * VideoConference Service — Palabre
 *
 * Ce service gère toutes les opérations sur les vidéoconférences.
 * RÈGLE ABSOLUE : jitsi_room_name ne doit JAMAIS être retourné
 * dans une réponse API cliente. Il est exclusivement utilisé en
 * interne pour générer les tokens JaaS/Jitsi côté serveur.
 */

const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { pool }  = require('../../config/db');
const { redis } = require('../../config/redis');

// ── TTL des tokens de session ──────────────────────────────────────────────
const SESSION_TOKEN_TTL  = parseInt(process.env.VIDEO_SESSION_JWT_TTL_SECONDS || '86400', 10);
const INVITATION_TTL_DAYS = 30;

// ── Audit logging ─────────────────────────────────────────────────────────
async function auditLog({ orgId, actorUserId, action, roomId, metadata = {} }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, 'video_room', $4, $5)`,
      [orgId || null, actorUserId, action, roomId, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('[videoconference] audit_log error:', err.message);
  }
}

// ── Notification persistante ──────────────────────────────────────────────
async function insertNotification({ userId, type, payload }) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, payload) VALUES ($1, $2, $3)`,
      [userId, type, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('[videoconference] notification error:', err.message);
  }
}

// ── Génération du nom de salle Jitsi interne (opaque) ────────────────────
function generateJitsiRoomName() {
  // Préfixe 'pb_' + 32 hex chars — jamais exposé au client
  return 'pb_' + crypto.randomBytes(16).toString('hex');
}

// ── Génération JWT de session Palabre (retourné au client) ─────────────────
// Ce token identifie l'utilisateur pour une room spécifique.
// Il ne contient AUCUNE référence Jitsi.
function generateSessionToken({ userId, roomId }) {
  return jwt.sign(
    { sub: userId, roomId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: SESSION_TOKEN_TTL }
  );
}

// ── Validation JWT de session Palabre ─────────────────────────────────────
function verifySessionToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return null;
  }
}

// ── Génération JWT JaaS/Jitsi (USAGE SERVEUR UNIQUEMENT) ──────────────────
// Ce token est transmis à Jitsi, jamais au client.
function generateJaaSToken({ jitsiRoomName, user, isModerator }) {
  const now = Math.floor(Date.now() / 1000);

  // Mode self-hosted Jitsi avec secret HMAC (HS256)
  if (process.env.JITSI_JWT_SECRET && !process.env.JAAS_PRIVATE_KEY) {
    const payload = {
      iss: 'palabre',
      sub: process.env.JITSI_DOMAIN || 'meet.palabre.app',
      aud: 'jitsi',
      iat: now,
      exp: now + SESSION_TOKEN_TTL,
      room: jitsiRoomName,
      context: {
        user: {
          id:        user.id,
          name:      user.full_name || user.fullName || 'Utilisateur',
          email:     user.email || '',
          moderator: isModerator,
        },
        features: {
          recording:        isModerator,
          'live-streaming': false,
          outbound:         false,
        },
      },
    };
    return jwt.sign(payload, process.env.JITSI_JWT_SECRET, { algorithm: 'HS256' });
  }

  // Mode JaaS 8x8 avec clé RSA (RS256)
  const payload = {
    iss: process.env.JAAS_APP_ID,
    sub: process.env.JAAS_APP_ID,
    aud: 'jitsi',
    iat: now,
    exp: now + SESSION_TOKEN_TTL,
    room: jitsiRoomName,
    context: {
      user: {
        id:        user.id,
        name:      user.full_name || user.fullName || 'Utilisateur',
        email:     user.email || '',
        moderator: isModerator,
      },
      features: {
        recording:        isModerator,
        'live-streaming': false,
        outbound:         false,
      },
    },
  };
  return jwt.sign(payload, process.env.JAAS_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: process.env.JAAS_KEY_ID,
  });
}

// ── Compter les participants actifs ───────────────────────────────────────
async function countActiveParticipants(roomId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM video_room_participants
     WHERE room_id = $1 AND status = 'active'`,
    [roomId]
  );
  return parseInt(rows[0].cnt, 10);
}

// ── Vérifier l'invitation valide ──────────────────────────────────────────
async function findValidInvitation(roomId, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM video_room_invitations
     WHERE room_id = $1
       AND invitee_user_id = $2
       AND revoked_at IS NULL
       AND consumed_at IS NULL
       AND expires_at > now()`,
    [roomId, userId]
  );
  return rows[0] || null;
}

// ── Vérifier appartenance tenant ───────────────────────────────────────────
async function assertTenantMember(userId, orgId) {
  const { rows } = await pool.query(
    `SELECT id FROM memberships
     WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
    [userId, orgId]
  );
  if (!rows[0]) {
    const err = new Error('Accès refusé : vous n\'êtes pas membre de cette organisation.');
    err.code  = 'UNAUTHORIZED_TENANT';
    err.httpStatus = 403;
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// CRÉATION DE ROOM
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crée une vidéoconférence (immédiate ou planifiée).
 * isPublic=true → pas de org_id (vidéoconférence depuis la page d'accueil).
 */
async function createRoom({ user, orgId, title, accessPolicy = 'closed', immediate = true, scheduledAt = null, estimatedDurationMin = null, inviteeIds = [], isPublic = false }) {
  // Validation planification
  if (!immediate && scheduledAt) {
    const minDate = new Date(Date.now() + 5 * 60 * 1000); // +5 min
    if (new Date(scheduledAt) < minDate) {
      const err = new Error('La date de début doit être au moins 5 minutes dans le futur.');
      err.code  = 'INVALID_SCHEDULE_TIME';
      err.httpStatus = 400;
      throw err;
    }
  }

  const jitsiRoomName = generateJitsiRoomName();
  const status        = immediate ? 'active' : 'scheduled';
  const startedAt     = immediate ? new Date() : null;
  const effectiveOrgId = isPublic ? null : (orgId || null);

  const { rows } = await pool.query(
    `INSERT INTO video_rooms
       (org_id, host_user_id, title, status, access_policy, jitsi_room_name,
        scheduled_at, started_at, estimated_duration_min)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, org_id, host_user_id, title, status, access_policy,
               scheduled_at, started_at, estimated_duration_min,
               max_participants, created_at`,
    [effectiveOrgId, user.id, title, status, accessPolicy, jitsiRoomName,
     scheduledAt || null, startedAt, estimatedDurationMin || null]
  );
  const room = rows[0];

  // Host enregistré comme participant actif
  await pool.query(
    `INSERT INTO video_room_participants (room_id, user_id, role, status, joined_at)
     VALUES ($1, $2, 'host', 'active', now())
     ON CONFLICT (room_id, user_id) DO UPDATE SET status='active', role='host', joined_at=now()`,
    [room.id, user.id]
  );

  // Invitations
  if (inviteeIds && inviteeIds.length > 0) {
    await createInvitations({ roomId: room.id, inviteeIds, invitedBy: user.id, room, hostName: user.full_name || user.fullName || 'Hôte', effectiveOrgId });
  }

  // Audit
  await auditLog({
    orgId: effectiveOrgId,
    actorUserId: user.id,
    action: immediate ? 'VIDEO_ROOM_CREATED' : 'VIDEO_ROOM_SCHEDULED',
    roomId: room.id,
    metadata: { title, status, accessPolicy },
  });

  // Résultat sans jitsi_room_name
  return formatRoom(room);
}

// ── Créer les invitations + notifications ─────────────────────────────────
async function createInvitations({ roomId, inviteeIds, invitedBy, room, hostName, effectiveOrgId }) {
  for (const inviteeId of inviteeIds) {
    try {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO video_room_invitations
           (room_id, invitee_user_id, invited_by, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (room_id, invitee_user_id) DO UPDATE
           SET token_hash=$4, expires_at=$5, revoked_at=NULL, consumed_at=NULL`,
        [roomId, inviteeId, invitedBy, tokenHash, expiresAt]
      );

      await pool.query(
        `INSERT INTO video_room_participants (room_id, user_id, role, status)
         VALUES ($1, $2, 'participant', 'invited')
         ON CONFLICT (room_id, user_id) DO NOTHING`,
        [roomId, inviteeId]
      );

      // Notification persistante (expirée après 30 jours)
      await insertNotification({
        userId: inviteeId,
        type: 'video_invitation',
        payload: {
          roomId,
          title: room.title,
          hostName,
          invitationToken: rawToken, // token en clair pour le lien de rejoindre
          scheduledAt: room.scheduled_at,
          orgId: effectiveOrgId,
        },
      });
    } catch (err) {
      console.error(`[videoconference] invitation error for user ${inviteeId}:`, err.message);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// LECTURE / LISTE
// ═════════════════════════════════════════════════════════════════════════

async function getRoomById(roomId, userId, orgId) {
  const { rows } = await pool.query(
    `SELECT r.*,
            u.full_name AS host_name, u.photo_url AS host_photo,
            (SELECT COUNT(*) FROM video_room_participants
             WHERE room_id = r.id AND status = 'active') AS participant_count,
            (SELECT status FROM video_room_participants
             WHERE room_id = r.id AND user_id = $2 LIMIT 1) AS my_status,
            (SELECT role FROM video_room_participants
             WHERE room_id = r.id AND user_id = $2 LIMIT 1) AS my_role
     FROM video_rooms r
     JOIN users u ON u.id = r.host_user_id
     WHERE r.id = $1`,
    [roomId, userId]
  );
  if (!rows[0]) {
    const err = new Error('Vidéoconférence introuvable.');
    err.code  = 'NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  const room = rows[0];

  // Isolation tenant
  if (orgId && room.org_id && room.org_id !== orgId) {
    const err = new Error('Accès refusé.');
    err.code  = 'CROSS_TENANT_ACCESS_DENIED';
    err.httpStatus = 403;
    throw err;
  }

  return formatRoom(room);
}

async function listRooms({ orgId, userId, isAdmin = false, page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;

  // Statuts à afficher selon le rôle
  const statusFilter = isAdmin
    ? "r.status IN ('active','scheduled','ended')"
    : "r.status IN ('active','scheduled')";

  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.status, r.access_policy, r.scheduled_at,
            r.started_at, r.ended_at, r.estimated_duration_min,
            r.actual_participant_count, r.host_user_id, r.created_at,
            u.full_name AS host_name,
            (SELECT COUNT(*) FROM video_room_participants
             WHERE room_id = r.id AND status = 'active') AS participant_count,
            (SELECT status FROM video_room_participants
             WHERE room_id = r.id AND user_id = $2 LIMIT 1) AS my_status,
            (SELECT role FROM video_room_participants
             WHERE room_id = r.id AND user_id = $2 LIMIT 1) AS my_role
     FROM video_rooms r
     JOIN users u ON u.id = r.host_user_id
     WHERE r.org_id = $1
       AND ${statusFilter}
     ORDER BY
       CASE r.status WHEN 'active' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END ASC,
       COALESCE(r.started_at, r.scheduled_at, r.created_at) DESC
     LIMIT $3 OFFSET $4`,
    [orgId, userId, limit, offset]
  );

  return rows.map(formatRoom);
}

async function listHistory({ orgId, limit = 100 }) {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.status, r.started_at, r.ended_at,
            r.actual_participant_count, r.host_user_id, r.created_at,
            r.recording_available,
            u.full_name AS host_name,
            EXTRACT(EPOCH FROM (r.ended_at - r.started_at)) / 60 AS duration_min
     FROM video_rooms r
     JOIN users u ON u.id = r.host_user_id
     WHERE r.org_id = $1
       AND r.status = 'ended'
       AND r.created_at > now() - INTERVAL '12 months'
     ORDER BY r.ended_at DESC NULLS LAST
     LIMIT $2`,
    [orgId, Math.min(limit, 1000)]
  );
  return rows.map(r => ({
    id:               r.id,
    title:            r.title,
    hostName:         r.host_name,
    startedAt:        r.started_at,
    endedAt:          r.ended_at,
    durationMin:      r.duration_min ? Math.round(r.duration_min) : null,
    participantCount: r.actual_participant_count,
    recordingAvailable: r.recording_available,
  }));
}

// ═════════════════════════════════════════════════════════════════════════
// MISE À JOUR / ANNULATION
// ═════════════════════════════════════════════════════════════════════════

async function updateRoom({ roomId, userId, orgId, title, scheduledAt, estimatedDurationMin, accessPolicy, addInviteeIds = [], removeInviteeIds = [] }) {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name FROM video_rooms r
     JOIN users u ON u.id = r.host_user_id
     WHERE r.id = $1`,
    [roomId]
  );
  if (!rows[0]) throw notFound();
  const room = rows[0];

  if (room.org_id && room.org_id !== orgId) throw crossTenantDenied();
  if (room.host_user_id !== userId) throw forbidden('Seul l\'hôte peut modifier cette réunion.');
  if (room.status !== 'scheduled') throw badRequest('Seules les réunions planifiées peuvent être modifiées.', 'ROOM_NOT_SCHEDULED');

  // Validation date
  if (scheduledAt) {
    const minDate = new Date(Date.now() + 5 * 60 * 1000);
    if (new Date(scheduledAt) < minDate) throw badRequest('La date doit être au moins 5 minutes dans le futur.', 'INVALID_SCHEDULE_TIME');
  }

  await pool.query(
    `UPDATE video_rooms
     SET title = COALESCE($2, title),
         scheduled_at = COALESCE($3, scheduled_at),
         estimated_duration_min = COALESCE($4, estimated_duration_min),
         access_policy = COALESCE($5, access_policy),
         updated_at = now()
     WHERE id = $1`,
    [roomId, title || null, scheduledAt || null, estimatedDurationMin || null, accessPolicy || null]
  );

  // Retirer des invités
  for (const uid of removeInviteeIds) {
    await pool.query(
      `UPDATE video_room_invitations SET revoked_at = now()
       WHERE room_id = $1 AND invitee_user_id = $2`,
      [roomId, uid]
    );
    await pool.query(
      `UPDATE video_room_participants SET status = 'left'
       WHERE room_id = $1 AND user_id = $2 AND status = 'invited'`,
      [roomId, uid]
    );
    await insertNotification({
      userId: uid,
      type: 'video_invitation_revoked',
      payload: { roomId, title: title || room.title },
    });
  }

  // Ajouter des invités
  if (addInviteeIds.length > 0) {
    await createInvitations({
      roomId, inviteeIds: addInviteeIds, invitedBy: userId,
      room: { ...room, title: title || room.title },
      hostName: rows[0].full_name,
      effectiveOrgId: orgId,
    });
  }

  return getRoomById(roomId, userId, orgId);
}

async function cancelRoom({ roomId, userId, orgId }) {
  const { rows } = await pool.query(
    `SELECT * FROM video_rooms WHERE id = $1`,
    [roomId]
  );
  if (!rows[0]) throw notFound();
  const room = rows[0];

  if (room.org_id && room.org_id !== orgId) throw crossTenantDenied();
  if (room.host_user_id !== userId) throw forbidden('Seul l\'hôte peut annuler cette réunion.');
  if (!['scheduled', 'active'].includes(room.status)) throw badRequest('Cette réunion ne peut pas être annulée.', 'ROOM_ALREADY_ENDED');

  await pool.query(
    `UPDATE video_rooms SET status = 'cancelled', updated_at = now() WHERE id = $1`,
    [roomId]
  );

  // Notifier tous les invités
  const { rows: participants } = await pool.query(
    `SELECT user_id FROM video_room_participants
     WHERE room_id = $1 AND user_id != $2`,
    [roomId, userId]
  );
  for (const p of participants) {
    await insertNotification({
      userId: p.user_id,
      type: 'video_room_cancelled',
      payload: { roomId, title: room.title },
    });
  }

  await auditLog({ orgId: room.org_id, actorUserId: userId, action: 'VIDEO_ROOM_CANCELLED', roomId, metadata: { title: room.title } });
}

// ═════════════════════════════════════════════════════════════════════════
// REJOINDRE / QUITTER
// ═════════════════════════════════════════════════════════════════════════

/**
 * Rejoindre une room. Retourne :
 * - { status: 'waiting' }  → salle d'attente
 * - { status: 'admitted', sessionToken, roomTitle } → accès accordé
 */
async function joinRoom({ roomId, userId, orgId, invitationToken = null }) {
  const { rows } = await pool.query(
    `SELECT * FROM video_rooms WHERE id = $1`,
    [roomId]
  );
  if (!rows[0]) throw notFound();
  const room = rows[0];

  // Isolation tenant
  if (room.org_id) {
    if (orgId && room.org_id !== orgId) throw crossTenantDenied();
    // Vérifier membership si la room appartient à un tenant
    await assertTenantMember(userId, room.org_id);
  }

  if (!['active', 'scheduled'].includes(room.status)) {
    throw badRequest('Cette réunion est terminée ou annulée.', 'ROOM_NOT_ACTIVE');
  }

  // Vérifier exclusion
  const { rows: partRows } = await pool.query(
    `SELECT * FROM video_room_participants WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );
  const existing = partRows[0];

  if (existing && existing.status === 'excluded') {
    throw forbidden('Vous avez été exclu de cette réunion.', 'PARTICIPANT_EXCLUDED');
  }

  // Vérifier capacité
  const activeCount = await countActiveParticipants(roomId);
  if (activeCount >= room.max_participants) {
    throw { message: 'La réunion est pleine.', code: 'ROOM_FULL', httpStatus: 409 };
  }

  // Vérifier invitation si access_policy = closed
  if (room.access_policy === 'closed') {
    // L'hôte entre toujours
    const isHost = room.host_user_id === userId;
    let hasValidInvitation = isHost;

    if (!isHost && invitationToken) {
      const tokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
      const { rows: invRows } = await pool.query(
        `SELECT * FROM video_room_invitations
         WHERE token_hash = $1 AND room_id = $2
           AND invitee_user_id = $3
           AND revoked_at IS NULL
           AND consumed_at IS NULL
           AND expires_at > now()`,
        [tokenHash, roomId, userId]
      );
      if (invRows[0]) {
        hasValidInvitation = true;
        // Marquer consommée
        await pool.query(
          `UPDATE video_room_invitations SET consumed_at = now() WHERE id = $1`,
          [invRows[0].id]
        );
      }
    }

    if (!isHost && !hasValidInvitation) {
      // Placer en salle d'attente
      await pool.query(
        `INSERT INTO video_room_participants (room_id, user_id, role, status)
         VALUES ($1, $2, 'participant', 'waiting')
         ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'waiting'`,
        [roomId, userId]
      );

      // Notifier le host
      await insertNotification({
        userId: room.host_user_id,
        type: 'waiting_room_knock',
        payload: { roomId, title: room.title, userId },
      });

      // Pub/sub Redis pour notification temps réel au host
      await redis.publish('video:waiting', JSON.stringify({
        roomId, userId, roomTitle: room.title, hostId: room.host_user_id,
      })).catch(() => {});

      return { status: 'waiting', message: 'En attente d\'admission par l\'hôte.' };
    }
  }

  // Accès accordé
  const sessionToken = generateSessionToken({ userId, roomId });
  const tokenHash    = crypto.createHash('sha256').update(sessionToken).digest('hex');

  await pool.query(
    `INSERT INTO video_room_participants (room_id, user_id, role, status, joined_at, session_token_hash)
     VALUES ($1, $2, 'participant', 'active', now(), $3)
     ON CONFLICT (room_id, user_id) DO UPDATE
       SET status = 'active', joined_at = now(), session_token_hash = $3`,
    [roomId, userId, tokenHash]
  );

  // Si la room était encore 'scheduled', l'activer
  if (room.status === 'scheduled' && room.host_user_id === userId) {
    await pool.query(
      `UPDATE video_rooms SET status = 'active', started_at = now(), updated_at = now() WHERE id = $1`,
      [roomId]
    );
  }

  await auditLog({ orgId: room.org_id, actorUserId: userId, action: 'PARTICIPANT_JOINED', roomId });

  return { status: 'admitted', sessionToken, roomTitle: room.title };
}

async function leaveRoom({ roomId, userId }) {
  const { rows } = await pool.query(
    `SELECT * FROM video_rooms WHERE id = $1`, [roomId]
  );
  if (!rows[0]) return;
  const room = rows[0];

  await pool.query(
    `UPDATE video_room_participants
     SET status = 'left', left_at = now()
     WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [roomId, userId]
  );

  // Si l'hôte quitte et plus personne → terminer la session
  if (room.host_user_id === userId) {
    const remaining = await countActiveParticipants(roomId);
    if (remaining === 0) {
      await endRoom(roomId, userId, room);
    }
  }
}

async function endRoom(roomId, actorUserId, roomData) {
  const room = roomData || (await pool.query(`SELECT * FROM video_rooms WHERE id = $1`, [roomId])).rows[0];
  if (!room) return;

  const { rows: [countRow] } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM video_room_participants WHERE room_id = $1`,
    [roomId]
  );

  await pool.query(
    `UPDATE video_rooms
     SET status = 'ended', ended_at = now(),
         actual_participant_count = $2, updated_at = now()
     WHERE id = $1`,
    [roomId, parseInt(countRow.cnt, 10)]
  );

  await auditLog({ orgId: room.org_id, actorUserId, action: 'VIDEO_SESSION_ENDED', roomId, metadata: { title: room.title } });
}

// ═════════════════════════════════════════════════════════════════════════
// SESSION TOKEN → CONFIG JITSI (usage serveur uniquement)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Génère la configuration Jitsi pour le composant VideoConferenceGateway.
 * Cette fonction s'exécute côté serveur uniquement.
 * La réponse ne contient JAMAIS le jitsi_room_name ni aucun identifiant Jitsi.
 */
async function resolveJitsiConfig({ roomId, sessionToken, user }) {
  const payload = verifySessionToken(sessionToken);
  if (!payload || payload.roomId !== roomId || payload.sub !== user.id) {
    throw forbidden('Token de session invalide.', 'TOKEN_INVALID');
  }

  // Récupérer le jitsi_room_name — USAGE INTERNE UNIQUEMENT
  const { rows } = await pool.query(
    `SELECT r.jitsi_room_name, r.title, r.org_id, r.host_user_id,
            p.role
     FROM video_rooms r
     LEFT JOIN video_room_participants p ON p.room_id = r.id AND p.user_id = $2
     WHERE r.id = $1`,
    [roomId, user.id]
  );
  if (!rows[0]) throw notFound();
  const { jitsi_room_name, title, host_user_id, role } = rows[0];

  const isModerator = host_user_id === user.id || role === 'host' || role === 'moderator';

  // Générer le JWT JaaS (RS256 ou HS256 selon config) — jamais transmis au client
  const jaasToken = generateJaaSToken({ jitsiRoomName: jitsi_room_name, user, isModerator });

  const domain = process.env.JITSI_DOMAIN || 'meet.palabre.app';

  // Retourner domain + roomToken (JWT JaaS) — le client ne peut pas en extraire le room name
  // car il est encodé dans le JWT signé côté serveur
  return {
    domain,
    roomToken: jaasToken,       // JWT JaaS opaque pour le client
    displayName: title,         // Titre Palabre affiché
    isModerator,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// MODÉRATION
// ═════════════════════════════════════════════════════════════════════════

async function admitParticipant({ roomId, targetUserId, actorUserId }) {
  await assertIsModeratorOrHost(roomId, actorUserId);

  // Vérifier que la cible est bien en attente
  const { rows } = await pool.query(
    `SELECT * FROM video_room_participants WHERE room_id = $1 AND user_id = $2`,
    [roomId, targetUserId]
  );
  if (!rows[0] || rows[0].status !== 'waiting') {
    throw badRequest('Ce participant n\'est pas en salle d\'attente.', 'PARTICIPANT_NOT_WAITING');
  }

  const sessionToken = generateSessionToken({ userId: targetUserId, roomId });
  const tokenHash    = crypto.createHash('sha256').update(sessionToken).digest('hex');

  await pool.query(
    `UPDATE video_room_participants
     SET status = 'active', joined_at = now(), session_token_hash = $3
     WHERE room_id = $1 AND user_id = $2`,
    [roomId, targetUserId, tokenHash]
  );

  // Notifier le participant admis via Redis pub/sub
  await redis.publish('video:admitted', JSON.stringify({
    roomId, userId: targetUserId, sessionToken,
  })).catch(() => {});

  await auditLog({ actorUserId, action: 'PARTICIPANT_ADMITTED', roomId, metadata: { targetUserId } });

  return { sessionToken };
}

async function kickParticipant({ roomId, targetUserId, actorUserId }) {
  await assertIsModeratorOrHost(roomId, actorUserId);

  await pool.query(
    `UPDATE video_room_participants
     SET status = 'excluded', left_at = now()
     WHERE room_id = $1 AND user_id = $2`,
    [roomId, targetUserId]
  );

  // Notifier l'exclu via Redis pub/sub
  await redis.publish('video:kicked', JSON.stringify({
    roomId, userId: targetUserId,
  })).catch(() => {});

  await auditLog({ actorUserId, action: 'PARTICIPANT_EXCLUDED', roomId, metadata: { targetUserId } });
}

// ═════════════════════════════════════════════════════════════════════════
// INVITATIONS
// ═════════════════════════════════════════════════════════════════════════

async function inviteUsers({ roomId, inviteeIdentifiers, actorUser, orgId }) {
  const { rows: roomRows } = await pool.query(
    `SELECT * FROM video_rooms WHERE id = $1`, [roomId]
  );
  if (!roomRows[0]) throw notFound();
  const room = roomRows[0];

  if (room.org_id && room.org_id !== orgId) throw crossTenantDenied();

  const resolvedIds = [];
  const notFound_ = [];

  for (const identifier of inviteeIdentifiers) {
    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE LOWER(email) = LOWER($1) OR full_name = $1`,
      [identifier]
    );
    if (rows[0]) resolvedIds.push(rows[0].id);
    else notFound_.push(identifier);
  }

  if (resolvedIds.length > 0) {
    await createInvitations({
      roomId,
      inviteeIds: resolvedIds,
      invitedBy: actorUser.id,
      room,
      hostName: actorUser.full_name || actorUser.fullName || 'Hôte',
      effectiveOrgId: orgId || null,
    });
  }

  return { invited: resolvedIds.length, notFound: notFound_ };
}

async function resolveInvitationToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await pool.query(
    `SELECT i.*, r.title, r.status, r.org_id, r.host_user_id,
            u.full_name AS host_name
     FROM video_room_invitations i
     JOIN video_rooms r ON r.id = i.room_id
     JOIN users u ON u.id = r.host_user_id
     WHERE i.token_hash = $1
       AND i.revoked_at IS NULL
       AND i.expires_at > now()`,
    [tokenHash]
  );
  if (!rows[0]) {
    throw { message: 'Invitation invalide ou expirée.', code: 'INVITATION_INVALID', httpStatus: 404 };
  }
  const inv = rows[0];
  return {
    roomId:    inv.room_id,
    title:     inv.title,
    hostName:  inv.host_name,
    orgId:     inv.org_id,
    status:    inv.status,
    inviteeId: inv.invitee_user_id,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═════════════════════════════════════════════════════════════════════════

async function getParticipants(roomId) {
  const { rows } = await pool.query(
    `SELECT p.user_id, p.role, p.status, p.joined_at,
            u.full_name, u.photo_url
     FROM video_room_participants p
     JOIN users u ON u.id = p.user_id
     WHERE p.room_id = $1
       AND p.status IN ('active','waiting')
     ORDER BY
       CASE p.role WHEN 'host' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
       p.joined_at ASC`,
    [roomId]
  );
  return rows.map(r => ({
    userId:    r.user_id,
    fullName:  r.full_name,
    photoUrl:  r.photo_url,
    role:      r.role,
    status:    r.status,
    joinedAt:  r.joined_at,
  }));
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

async function assertIsModeratorOrHost(roomId, userId) {
  const { rows } = await pool.query(
    `SELECT role FROM video_room_participants
     WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [roomId, userId]
  );
  if (!rows[0] || !['host', 'moderator'].includes(rows[0].role)) {
    throw forbidden('Réservé à l\'hôte ou aux modérateurs.', 'INSUFFICIENT_ROLE');
  }
}

function formatRoom(row) {
  // RÈGLE : on n'inclut JAMAIS jitsi_room_name dans la réponse
  return {
    id:                  row.id,
    title:               row.title,
    status:              row.status,
    accessPolicy:        row.access_policy,
    orgId:               row.org_id,
    hostUserId:          row.host_user_id,
    hostName:            row.host_name || undefined,
    scheduledAt:         row.scheduled_at,
    startedAt:           row.started_at,
    endedAt:             row.ended_at,
    estimatedDurationMin: row.estimated_duration_min,
    maxParticipants:     row.max_participants || 300,
    participantCount:    parseInt(row.participant_count || 0, 10),
    myStatus:            row.my_status || null,
    myRole:              row.my_role || null,
    recordingAvailable:  row.recording_available || false,
    createdAt:           row.created_at,
  };
}

function notFound() {
  const err = new Error('Ressource introuvable.'); err.code = 'NOT_FOUND'; err.httpStatus = 404; return err;
}
function crossTenantDenied() {
  const err = new Error('Accès refusé.'); err.code = 'CROSS_TENANT_ACCESS_DENIED'; err.httpStatus = 403; return err;
}
function forbidden(msg, code = 'FORBIDDEN') {
  const err = new Error(msg); err.code = code; err.httpStatus = 403; return err;
}
function badRequest(msg, code = 'BAD_REQUEST') {
  const err = new Error(msg); err.code = code; err.httpStatus = 400; return err;
}

module.exports = {
  createRoom,
  getRoomById,
  listRooms,
  listHistory,
  updateRoom,
  cancelRoom,
  joinRoom,
  leaveRoom,
  endRoom,
  resolveJitsiConfig,
  admitParticipant,
  kickParticipant,
  inviteUsers,
  resolveInvitationToken,
  getParticipants,
  generateSessionToken,
  auditLog,
  insertNotification,
};
