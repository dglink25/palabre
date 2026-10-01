'use strict';

/**
 * Support Service — Palabre Service Client
 *
 * Gère les Support_Sessions et Support_Messages.
 * RÈGLE : le contenu des messages (ciphertext) est persisté et relayé
 * sans jamais être déchiffré côté serveur.
 */

const { pool } = require('../../config/db');

// ── Audit ────────────────────────────────────────────────────────────────────

async function auditLog({ sessionId, userId, action, metadata = {} }) {
  try {
    await pool.query(
      `INSERT INTO support_audit_logs (session_id, user_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [sessionId || null, userId || null, action, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('[support] audit_log error:', err.message);
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * Récupère la session "open" existante ou en crée une nouvelle.
 * Si une session précédente est "resolved", elle est conservée en historique
 * et une nouvelle session "open" est créée.
 */
async function getOrCreateSession(userId) {
  // Chercher une session active
  const { rows: existing } = await pool.query(
    `SELECT id, user_id, status, channel, created_at, updated_at
     FROM support_sessions
     WHERE user_id = $1 AND status = 'open'
     LIMIT 1`,
    [userId]
  );

  if (existing[0]) return existing[0];

  // Créer une nouvelle session
  const { rows } = await pool.query(
    `INSERT INTO support_sessions (user_id, status)
     VALUES ($1, 'open')
     RETURNING id, user_id, status, channel, created_at, updated_at`,
    [userId]
  );

  await auditLog({ sessionId: rows[0].id, userId, action: 'SESSION_CREATED' });

  return rows[0];
}

/**
 * Résout (ferme) une session. Seul le super-admin peut résoudre.
 */
async function resolveSession(sessionId, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE support_sessions
     SET status = 'resolved', resolved_at = now(), resolved_by = $2, updated_at = now()
     WHERE id = $1 AND status = 'open'
     RETURNING id, user_id, status, resolved_at`,
    [sessionId, adminUserId]
  );

  if (!rows[0]) {
    const err = new Error('Session introuvable ou déjà résolue.');
    err.code = 'SESSION_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }

  await auditLog({ sessionId, userId: adminUserId, action: 'SESSION_RESOLVED', metadata: { sessionId } });

  return rows[0];
}

/**
 * Récupère une session par ID. Vérifie que l'utilisateur est bien
 * le propriétaire ou le super-admin.
 */
async function getSessionById(sessionId, requestUserId, isSuperAdmin = false) {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.status, s.channel, s.created_at, s.updated_at,
            s.resolved_at, s.resolved_by,
            u.full_name AS user_name, u.photo_url AS user_photo
     FROM support_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [sessionId]
  );

  if (!rows[0]) {
    const err = new Error('Session introuvable.');
    err.code = 'SESSION_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }

  // Isolation : un utilisateur ne peut voir que sa propre session
  if (!isSuperAdmin && rows[0].user_id !== requestUserId) {
    const err = new Error('Accès refusé.');
    err.code = 'CROSS_TENANT_ACCESS_DENIED';
    err.httpStatus = 403;
    throw err;
  }

  return rows[0];
}

/**
 * Liste toutes les sessions actives (super-admin uniquement).
 */
async function listActiveSessions() {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.status, s.channel, s.created_at, s.updated_at,
            u.full_name AS user_name, u.photo_url AS user_photo,
            -- Appel actif ou en hold associé
            (SELECT sc.id FROM support_calls sc
             WHERE sc.session_id = s.id
               AND sc.status IN ('active', 'hold', 'queued')
             ORDER BY sc.initiated_at DESC LIMIT 1) AS active_call_id,
            (SELECT sc.status FROM support_calls sc
             WHERE sc.session_id = s.id
               AND sc.status IN ('active', 'hold', 'queued')
             ORDER BY sc.initiated_at DESC LIMIT 1) AS call_status,
            (SELECT sc.queue_position FROM support_calls sc
             WHERE sc.session_id = s.id
               AND sc.status = 'queued'
             ORDER BY sc.initiated_at DESC LIMIT 1) AS queue_position
     FROM support_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'open'
     ORDER BY s.created_at ASC`
  );

  return rows;
}

/**
 * Recherche dans l'historique des sessions résolues.
 * Filtres : userId, plage de dates, canal.
 */
async function searchHistory({ userId, fromDate, toDate, channel, limit = 50, offset = 0 }) {
  const conditions = [`s.status = 'resolved'`];
  const params = [];
  let paramIdx = 1;

  if (userId) {
    conditions.push(`s.user_id = $${paramIdx}`);
    params.push(userId);
    paramIdx++;
  }
  if (fromDate) {
    conditions.push(`s.resolved_at >= $${paramIdx}`);
    params.push(fromDate);
    paramIdx++;
  }
  if (toDate) {
    conditions.push(`s.resolved_at <= $${paramIdx}`);
    params.push(toDate);
    paramIdx++;
  }
  if (channel) {
    conditions.push(`s.channel = $${paramIdx}`);
    params.push(channel);
    paramIdx++;
  }

  params.push(limit, offset);
  const where = conditions.join(' AND ');

  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.status, s.channel, s.created_at, s.resolved_at,
            u.full_name AS user_name, u.photo_url AS user_photo
     FROM support_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE ${where}
     ORDER BY s.resolved_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    params
  );

  return rows;
}

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Persiste un message chiffré E2E.
 * Le serveur ne déchiffre JAMAIS le ciphertext.
 */
async function saveMessage({ sessionId, senderId, senderType, ciphertext, senderKeyId, type = 'text', videoRoomId = null, clientTs }) {
  const messageId = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const serverTs  = Date.now();

  const { rows } = await pool.query(
    `INSERT INTO support_messages
       (id, session_id, sender_id, sender_type, ciphertext, sender_key_id,
        type, status, video_room_id, client_ts, server_ts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8, $9, $10)
     RETURNING id, session_id, sender_id, sender_type, ciphertext, sender_key_id,
               type, status, video_room_id, client_ts, server_ts, created_at`,
    [messageId, sessionId, senderId, senderType, ciphertext, senderKeyId || null,
     type, videoRoomId || null, clientTs, serverTs]
  );

  // Mettre à jour le canal de la session si c'est le premier message
  await pool.query(
    `UPDATE support_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId]
  );

  await auditLog({ sessionId, userId: senderId, action: 'MESSAGE_SENT', metadata: { type } });

  return rows[0];
}

/**
 * Récupère les messages d'une session, paginés par curseur (server_ts DESC).
 */
async function getMessages(sessionId, { limit = 50, before = null } = {}) {
  const params = [sessionId, limit];
  let cursor = '';

  if (before) {
    cursor = `AND server_ts < $3`;
    params.push(before);
  }

  const { rows } = await pool.query(
    `SELECT id, session_id, sender_id, sender_type, ciphertext, sender_key_id,
            type, status, video_room_id, client_ts, server_ts, created_at
     FROM support_messages
     WHERE session_id = $1 ${cursor}
     ORDER BY server_ts DESC
     LIMIT $2`,
    params
  );

  return rows.reverse(); // Ordre chronologique
}

/**
 * Met à jour le statut de livraison des messages non lus pour un destinataire.
 */
async function markMessagesDelivered(sessionId, recipientType) {
  await pool.query(
    `UPDATE support_messages
     SET status = 'delivered', updated_at = now()
     WHERE session_id = $1
       AND sender_type != $2
       AND status = 'sent'`,
    [sessionId, recipientType]
  );
}

/**
 * Marque les messages comme lus jusqu'à un timestamp donné.
 */
async function markMessagesRead(sessionId, recipientType, upToServerTs) {
  await pool.query(
    `UPDATE support_messages
     SET status = 'read', updated_at = now()
     WHERE session_id = $1
       AND sender_type != $2
       AND status IN ('sent', 'delivered')
       AND server_ts <= $3`,
    [sessionId, recipientType, upToServerTs]
  );
}

module.exports = {
  getOrCreateSession,
  resolveSession,
  getSessionById,
  listActiveSessions,
  searchHistory,
  saveMessage,
  getMessages,
  markMessagesDelivered,
  markMessagesRead,
  auditLog,
};
