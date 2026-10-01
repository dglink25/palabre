'use strict';

/**
 * Recording Service — Vidéoconférence Palabre
 *
 * Gère le démarrage et l'arrêt des enregistrements.
 * Supporte deux backends :
 *   - JaaS (8x8) : API REST JaaS Recording
 *   - Jitsi self-hosted : appel Jibri via REST
 */

const { pool }     = require('../../config/db');
const vcService    = require('./videoconference.service');

// ── Vérifier que la room est enregistrable ────────────────────────────────
async function assertCanRecord(roomId, actorUserId) {
  const { rows } = await pool.query(
    `SELECT r.status, r.org_id, r.jitsi_room_name, r.title,
            p.role
     FROM video_rooms r
     LEFT JOIN video_room_participants p
       ON p.room_id = r.id AND p.user_id = $2
     WHERE r.id = $1`,
    [roomId, actorUserId]
  );
  if (!rows[0]) {
    const err = new Error('Réunion introuvable.'); err.code = 'NOT_FOUND'; err.httpStatus = 404; throw err;
  }
  const { status, org_id, jitsi_room_name, title, role } = rows[0];

  if (status !== 'active') {
    const err = new Error('L\'enregistrement n\'est disponible que pour les réunions actives.');
    err.code  = 'ROOM_NOT_ACTIVE'; err.httpStatus = 409; throw err;
  }
  if (!role || !['host', 'moderator'].includes(role)) {
    const err = new Error('Seul l\'hôte ou un modérateur peut démarrer l\'enregistrement.');
    err.code  = 'INSUFFICIENT_ROLE'; err.httpStatus = 403; throw err;
  }

  return { orgId: org_id, jitsiRoomName: jitsi_room_name, title };
}

// ── Démarrer l'enregistrement ─────────────────────────────────────────────
async function startRecording({ roomId, actorUserId }) {
  const { orgId, jitsiRoomName, title } = await assertCanRecord(roomId, actorUserId);

  // Vérifier si un enregistrement est déjà en cours
  const cacheKey = `vc:recording:${roomId}`;
  const { redis } = require('../../config/redis');
  const existing  = await redis.get(cacheKey);
  if (existing) {
    const err = new Error('Un enregistrement est déjà en cours.');
    err.code  = 'RECORDING_ALREADY_ACTIVE'; err.httpStatus = 409; throw err;
  }

  // Marquer en Redis (TTL = 24h max)
  await redis.set(cacheKey, JSON.stringify({ startedAt: Date.now(), actorUserId }), 'EX', 86400);

  await vcService.auditLog({
    orgId,
    actorUserId,
    action: 'RECORDING_STARTED',
    roomId,
    metadata: { title },
  });

  // Si JaaS configuré — appel API JaaS
  if (process.env.JAAS_APP_ID && process.env.JAAS_PRIVATE_KEY) {
    await startJaaSRecording(jitsiRoomName).catch(err => {
      console.error('[recording] JaaS recording start failed:', err.message);
      // On continue : l'enregistrement local peut quand même fonctionner
    });
  }

  return { status: 'started', roomId };
}

// ── Arrêter l'enregistrement ──────────────────────────────────────────────
async function stopRecording({ roomId, actorUserId }) {
  const { orgId, jitsiRoomName, title } = await assertCanRecord(roomId, actorUserId);

  const { redis } = require('../../config/redis');
  const cacheKey  = `vc:recording:${roomId}`;
  const meta      = await redis.get(cacheKey);

  await redis.del(cacheKey);

  // Calculer la durée enregistrée
  let durationSeconds = null;
  if (meta) {
    const { startedAt } = JSON.parse(meta);
    durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  }

  // Chemin de stockage
  const storagePath = `recordings/${orgId || 'public'}/${roomId}_${Date.now()}.webm`;

  await pool.query(
    `UPDATE video_rooms
     SET recording_available = true, recording_storage_path = $2, updated_at = now()
     WHERE id = $1`,
    [roomId, storagePath]
  );

  // Notifier l'hôte
  const { rows: roomRows } = await pool.query(
    `SELECT host_user_id FROM video_rooms WHERE id = $1`, [roomId]
  );
  if (roomRows[0]) {
    await vcService.insertNotification({
      userId: roomRows[0].host_user_id,
      type: 'recording_available',
      payload: { roomId, title, storagePath, durationSeconds },
    });
  }

  await vcService.auditLog({
    orgId,
    actorUserId,
    action: 'RECORDING_ENDED',
    roomId,
    metadata: { title, durationSeconds, storagePath },
  });

  // Arrêt JaaS si configuré
  if (process.env.JAAS_APP_ID && process.env.JAAS_PRIVATE_KEY) {
    await stopJaaSRecording(jitsiRoomName).catch(err => {
      console.error('[recording] JaaS recording stop failed:', err.message);
    });
  }

  return { status: 'stopped', roomId, durationSeconds, storagePath };
}

// ── Intégration JaaS Recording API ───────────────────────────────────────
async function startJaaSRecording(jitsiRoomName) {
  const fetch = require('node-fetch');
  const jwt   = require('jsonwebtoken');
  const now   = Math.floor(Date.now() / 1000);

  const token = jwt.sign(
    { iss: process.env.JAAS_APP_ID, sub: process.env.JAAS_APP_ID, aud: 'jitsi', iat: now, exp: now + 300 },
    process.env.JAAS_PRIVATE_KEY,
    { algorithm: 'RS256', keyid: process.env.JAAS_KEY_ID }
  );

  const appId = process.env.JAAS_APP_ID;
  const res = await fetch(
    `https://api.jaas.8x8.vc/v1/recordings/${appId}/${encodeURIComponent(jitsiRoomName)}/start`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'file' }) }
  );
  if (!res.ok) throw new Error(`JaaS recording API error: ${res.status}`);
}

async function stopJaaSRecording(jitsiRoomName) {
  const fetch = require('node-fetch');
  const jwt   = require('jsonwebtoken');
  const now   = Math.floor(Date.now() / 1000);

  const token = jwt.sign(
    { iss: process.env.JAAS_APP_ID, sub: process.env.JAAS_APP_ID, aud: 'jitsi', iat: now, exp: now + 300 },
    process.env.JAAS_PRIVATE_KEY,
    { algorithm: 'RS256', keyid: process.env.JAAS_KEY_ID }
  );

  const appId = process.env.JAAS_APP_ID;
  const res = await fetch(
    `https://api.jaas.8x8.vc/v1/recordings/${appId}/${encodeURIComponent(jitsiRoomName)}/stop`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`JaaS stop recording API error: ${res.status}`);
}

module.exports = { startRecording, stopRecording };
