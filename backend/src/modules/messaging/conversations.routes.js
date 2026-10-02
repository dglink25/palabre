'use strict';

/**
 * Routes de messagerie - conversations et messages REST
 * Ces routes complètent le message-router WebSocket pour :
 *   - Créer et lister les conversations
 *   - Charger l'historique des messages (pagination)
 *   - Lister les contacts de l'organisation
 */

const express = require('express');
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

// ── GET /conversations - liste les conversations de l'utilisateur ─────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.user.org_id;

    const { rows } = await pool.query(
      `SELECT
         c.id,
         c.org_id,
         -- nom de l'autre participant
         CASE
           WHEN c.user_a_id = $1 THEN ub.full_name
           ELSE ua.full_name
         END AS name,
         CASE
           WHEN c.user_a_id = $1 THEN ub.photo_url
           ELSE ua.photo_url
         END AS photo_url,
         CASE
           WHEN c.user_a_id = $1 THEN c.user_b_id
           ELSE c.user_a_id
         END AS peer_id,
         -- dernier message
         (SELECT ciphertext FROM messages m
          WHERE (m.to_user_id = c.user_a_id OR m.to_user_id = c.user_b_id)
            AND (m.from_user_id = c.user_a_id OR m.from_user_id = c.user_b_id)
            AND m.org_id = c.org_id
          ORDER BY m.server_ts DESC LIMIT 1) AS last_message,
         -- messages non lus
         (SELECT COUNT(*) FROM messages m
          WHERE m.to_user_id = $1
            AND m.org_id = c.org_id
            AND (m.to_user_id = c.user_a_id OR m.to_user_id = c.user_b_id)
            AND (m.from_user_id = c.user_a_id OR m.from_user_id = c.user_b_id)
            AND m.status != 'read') AS unread,
         c.last_message_at,
         c.created_at
       FROM conversations c
       JOIN users ua ON ua.id = c.user_a_id
       JOIN users ub ON ub.id = c.user_b_id
       WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
         AND c.org_id = $2
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
       LIMIT 50`,
      [userId, orgId]
    );

    res.json(rows.map(r => ({
      id:            r.id,
      name:          r.name || 'Utilisateur',
      photoUrl:      r.photo_url,
      peerId:        r.peer_id,
      lastMessage:   r.last_message,
      unread:        parseInt(r.unread, 10) || 0,
      lastMessageAt: r.last_message_at,
    })));
  } catch (err) { next(err); }
});

// ── POST /conversations - créer ou retrouver une conversation 1:1 ────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.user.org_id;
    const { participants, name, isGroup } = req.body;

    if (!participants || participants.length === 0) {
      return res.status(400).json({ error: { code: 'MISSING_PARTICIPANTS', message: 'Au moins un participant est requis.' } });
    }

    if (!isGroup) {
      // Conversation 1:1 - retrouver ou créer
      const otherId = participants[0];
      const [userA, userB] = userId < otherId ? [userId, otherId] : [otherId, userId];

      const { rows: existing } = await pool.query(
        'SELECT * FROM conversations WHERE org_id = $1 AND user_a_id = $2 AND user_b_id = $3',
        [orgId, userA, userB]
      );
      if (existing[0]) {
        return res.json({ id: existing[0].id, exists: true });
      }

      const { rows } = await pool.query(
        'INSERT INTO conversations (org_id, user_a_id, user_b_id) VALUES ($1,$2,$3) RETURNING *',
        [orgId, userA, userB]
      );
      return res.status(201).json({ id: rows[0].id, exists: false });
    }

    // Groupe - pas encore implémenté
    return res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Les groupes arrivent bientot.' } });
  } catch (err) { next(err); }
});

// ── GET /conversations/:id - détails d'une conversation ──────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.user.org_id;

    const { rows } = await pool.query(
      `SELECT
         c.*,
         CASE WHEN c.user_a_id = $1 THEN ub.full_name ELSE ua.full_name END AS name,
         CASE WHEN c.user_a_id = $1 THEN ub.photo_url ELSE ua.photo_url END AS photo_url,
         CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS peer_id
       FROM conversations c
       JOIN users ua ON ua.id = c.user_a_id
       JOIN users ub ON ub.id = c.user_b_id
       WHERE c.id = $2 AND c.org_id = $3
         AND (c.user_a_id = $1 OR c.user_b_id = $1)`,
      [userId, req.params.id, orgId]
    );

    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation introuvable.' } });
    const c = rows[0];
    res.json({ id: c.id, name: c.name, photoUrl: c.photo_url, peerId: c.peer_id });
  } catch (err) { next(err); }
});

// ── GET /conversations/:id/messages - historique paginé ──────────────────────
router.get('/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const orgId   = req.user.org_id;
    const convId  = req.params.id;
    const before  = req.query.before; // server_ts pour pagination
    const limit   = Math.min(parseInt(req.query.limit || '50', 10), 100);

    // Vérifier que l'utilisateur fait partie de la conversation
    const { rows: convRows } = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND org_id = $2 AND (user_a_id = $3 OR user_b_id = $3)',
      [convId, orgId, userId]
    );
    if (!convRows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation introuvable.' } });

    const conv = convRows[0];
    const otherId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id;

    const params = [userId, otherId, orgId, limit];
    let where = 'WHERE ((m.from_user_id = $1 AND m.to_user_id = $2) OR (m.from_user_id = $2 AND m.to_user_id = $1)) AND m.org_id = $3';
    if (before) {
      params.push(before);
      where += ` AND m.server_ts < $${params.length}`;
    }

    const { rows: msgs } = await pool.query(
      `SELECT m.id, m.from_user_id, m.to_user_id, m.ciphertext AS content,
              m.type, m.status, m.client_ts, m.server_ts,
              m.created_at AS sent_at,
              (m.from_user_id = $1) AS is_mine
       FROM messages m
       ${where}
       ORDER BY m.server_ts DESC
       LIMIT $4`,
      params
    );

    // Marquer comme livré
    await pool.query(
      "UPDATE messages SET status = 'delivered' WHERE to_user_id = $1 AND from_user_id = $2 AND status = 'sent'",
      [userId, otherId]
    ).catch(() => {});

    res.json(msgs.reverse().map(m => ({
      id:        m.id,
      from:      m.from_user_id,
      to:        m.to_user_id,
      content:   m.content,
      type:      m.type,
      status:    m.status,
      isMine:    m.is_mine,
      sentAt:    m.sent_at,
      serverTs:  m.server_ts,
      clientTs:  m.client_ts,
    })));
  } catch (err) { next(err); }
});

// ── POST /conversations/:id/messages - envoyer un message ────────────────────
router.post('/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.user.org_id;
    const convId = req.params.id;
    const { content, type = 'text' } = req.body;

    if (!content) return res.status(400).json({ error: { code: 'EMPTY_MESSAGE', message: 'Contenu obligatoire.' } });

    // Vérifier la conversation
    const { rows: convRows } = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND org_id = $2 AND (user_a_id = $3 OR user_b_id = $3)',
      [convId, orgId, userId]
    );
    if (!convRows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation introuvable.' } });

    const conv   = convRows[0];
    const toId   = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id;
    const now    = Date.now();
    const msgId  = `msg_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const { rows } = await pool.query(
      `INSERT INTO messages (id, org_id, from_user_id, to_user_id, ciphertext, type, status, client_ts, server_ts)
       VALUES ($1,$2,$3,$4,$5,$6,'sent',$7,$7) RETURNING *`,
      [msgId, orgId, userId, toId, content, type, now]
    );

    // Mettre à jour last_message_at
    await pool.query(
      'UPDATE conversations SET last_message_at = now() WHERE id = $1',
      [convId]
    );

    const m = rows[0];
    res.status(201).json({
      id:       m.id,
      from:     m.from_user_id,
      to:       m.to_user_id,
      content:  m.ciphertext,
      type:     m.type,
      status:   m.status,
      sentAt:   m.created_at,
      serverTs: m.server_ts,
      isMine:   true,
    });
  } catch (err) { next(err); }
});

// ── GET /contacts - membres de l'organisation ────────────────────────────────
router.get('/contacts/list', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.user.org_id;

    if (!orgId) return res.json([]);

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.photo_url, u.phone_e164
       FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE m.organization_id = $1
         AND m.status = 'active'
         AND u.id != $2
       ORDER BY u.full_name ASC
       LIMIT 200`,
      [orgId, userId]
    );

    res.json(rows.map(u => ({
      id:       u.id,
      fullName: u.full_name || u.email || 'Utilisateur',
      email:    u.email,
      phone:    u.phone_e164,
      photoUrl: u.photo_url,
      presence: 'offline', // sera mis à jour par le service presence
    })));
  } catch (err) { next(err); }
});

module.exports = router;
