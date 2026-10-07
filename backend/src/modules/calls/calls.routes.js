'use strict';

/**
 * Routes appels P2P (audio/vidéo WebRTC 1:1).
 * Le signaling (offer/answer/ICE) passe par le message-router Phoenix.
 * Ces routes gèrent uniquement l'historique et les credentials TURN.
 */

const express = require('express');
const crypto  = require('crypto');
const fetch   = require('node-fetch');
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');
const { sendPushNotification } = require('../users/fcm.service');
const webhookService = require('../developer/webhook.service');

const router = express.Router();

const TURN_SECRET   = process.env.TURN_SECRET   || 'change_me_turn_secret';
const TURN_HOST     = process.env.TURN_HOST     || 'localhost';
const TURN_PORT     = process.env.TURN_PORT     || '3478';
const TURN_TLS_PORT = process.env.TURN_TLS_PORT || '5349';
const TTL_SECONDS   = 3600;

const MESSAGE_ROUTER_URL = process.env.MESSAGE_ROUTER_INTERNAL_URL || 'http://localhost:4020';
const INTERNAL_SECRET    = process.env.INTERNAL_SERVICES_SECRET    || 'dev_internal_secret';

// ── GET /calls/turn-credentials ──────────────────────────────────────────────
router.get('/turn-credentials', requireAuth, (req, res) => {
  const expiry   = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const username = `${expiry}:${req.user.id}`;
  const password = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');

  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: `stun:${TURN_HOST}:${TURN_PORT}` },
      { urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`, username, credential: password },
      { urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`, username, credential: password },
      { urls: `turns:${TURN_HOST}:${TURN_TLS_PORT}`,         username, credential: password },
    ],
    ttl: TTL_SECONDS,
  });
});

// ── POST /calls - initier un appel (créer l'entrée historique + notifier l'appelé) ─
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const callerId = req.user.id;
    const orgId    = req.user.org_id;
    const { calleeId, callType = 'audio' } = req.body;

    if (!calleeId) return res.status(400).json({ error: { code: 'MISSING_CALLEE', message: 'calleeId requis.' } });
    if (!orgId)   return res.status(403).json({ error: { code: 'NO_ORG', message: 'Organisation requise.' } });

    // Vérifier que l'appelé est membre de la même organisation
    const { rows: memberRows } = await pool.query(
      `SELECT u.id, u.full_name FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE u.id = $1 AND m.organization_id = $2 AND m.status = 'active'`,
      [calleeId, orgId]
    );
    if (!memberRows[0]) return res.status(404).json({ error: { code: 'CALLEE_NOT_FOUND', message: 'Appelé introuvable.' } });

    const { rows } = await pool.query(
      `INSERT INTO p2p_calls (org_id, caller_id, callee_id, call_type, status)
       VALUES ($1,$2,$3,$4,'ringing') RETURNING id, created_at`,
      [orgId, callerId, calleeId, callType]
    );
    const call = rows[0];

    // Informations de l'appelant pour afficher côté appelé
    const { rows: callerRows } = await pool.query(
      'SELECT full_name, photo_url FROM users WHERE id = $1',
      [callerId]
    );
    const caller = callerRows[0] || {};

    // Notifier l'appelé via le message-router Phoenix (call_signal)
    await _notifyCallSignal(calleeId, {
      signal_type: 'call:incoming',
      call_id:     call.id,
      call_type:   callType,
      caller_id:   callerId,
      caller_name: caller.full_name || 'Utilisateur',
      caller_photo: caller.photo_url || null,
    });

    // Notification push FCM pour sonnerie si l'appelé est hors ligne
    sendPushNotification(calleeId, {
      title: caller.full_name || 'Appel entrant',
      body:  callType === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant',
      data:  {
        callId:   call.id,
        callType,
        callerId,
        callerName: caller.full_name || 'Utilisateur',
        url:      '/app/calls',
      },
    });

    res.status(201).json({ callId: call.id, status: 'ringing' });
  } catch (err) { next(err); }
});

// ── PATCH /calls/:id - mettre à jour le statut (répondre, raccrocher, rejeter) ─
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status } = req.body;
    const validStatuses = ['active', 'ended', 'rejected', 'missed', 'busy'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: { code: 'INVALID_STATUS' } });
    }

    const { rows } = await pool.query(
      `SELECT * FROM p2p_calls WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)`,
      [req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const call = rows[0];

    const updates = { status };
    if (status === 'active') updates.started_at = new Date();
    if (['ended', 'rejected', 'missed', 'busy'].includes(status)) {
      updates.ended_at = new Date();
      if (call.started_at) {
        updates.duration_seconds = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
      }
    }

    await pool.query(
      `UPDATE p2p_calls SET status = $1, started_at = COALESCE($2, started_at),
       ended_at = COALESCE($3, ended_at), duration_seconds = COALESCE($4, duration_seconds)
       WHERE id = $5`,
      [updates.status, updates.started_at || null, updates.ended_at || null,
       updates.duration_seconds || null, req.params.id]
    );

    // Notifier l'autre partie du changement de statut
    const otherId = call.caller_id === userId ? call.callee_id : call.caller_id;
    await _notifyCallSignal(otherId, {
      signal_type: `call:${status}`,
      call_id:     call.id,
    });

    // ── Rapport automatique à la fin d'un appel ──────────────────────────────
    if (status === 'ended') {
      setImmediate(async () => {
        try {
          const reportService = require('../reports/report.service');
          await reportService.generateP2PCallReport(call.id);
        } catch (err) {
          console.error('[calls] report generation error:', err.message);
        }
      });
    }

    // ── Webhook developer : fireEvent call.{status} (non bloquant) ───────────
    const callEventType = `call.${status}`; // call.started, call.ended, call.missed, etc.
    const orgId = req.user.org_id;
    if (orgId) {
      try {
        const { rows: devProjects } = await pool.query(
          `SELECT dp.id AS project_id
           FROM developer_projects dp
           JOIN developer_accounts da ON da.id = dp.account_id
           JOIN memberships m ON m.user_id = da.user_id
           WHERE m.organization_id = $1
             AND dp.status = 'active'
           LIMIT 10`,
          [orgId]
        );
        for (const { project_id } of devProjects) {
          webhookService.fireEvent(project_id, callEventType, {
            call_id:    call.id,
            call_type:  call.call_type,
            status,
            caller_id:  call.caller_id,
            callee_id:  call.callee_id,
            started_at: updates.started_at ?? call.started_at,
            ended_at:   updates.ended_at ?? null,
          }).catch(() => {}); // non bloquant
        }
      } catch (_) {} // ne jamais interrompre le flux principal
    }

    res.json({ callId: call.id, status });
  } catch (err) { next(err); }
});

// ── POST /calls/:id/signal - relayer un signal WebRTC (offer/answer/ICE) ─────
// Utilisé en fallback REST si le WebSocket Phoenix n'est pas disponible.
// En temps normal, le signaling passe directement par le message-router WS.
router.post('/:id/signal', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { signal, targetUserId } = req.body;

    if (!signal || !targetUserId) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS' } });
    }

    // Vérifier que l'utilisateur est partie à cet appel
    const { rows } = await pool.query(
      `SELECT id FROM p2p_calls WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)`,
      [req.params.id, userId]
    );
    if (!rows[0]) return res.status(403).json({ error: { code: 'FORBIDDEN' } });

    await _notifyCallSignal(targetUserId, {
      signal_type: 'call:signal',
      call_id:     req.params.id,
      signal,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /calls/history - historique des appels ────────────────────────────────
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.user.org_id;
    const limit  = Math.min(parseInt(req.query.limit || '30', 10), 100);

    const { rows } = await pool.query(
      `SELECT
         c.id, c.call_type, c.status, c.duration_seconds,
         c.started_at, c.ended_at, c.created_at,
         CASE WHEN c.caller_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
         CASE WHEN c.caller_id = $1 THEN c.callee_id  ELSE c.caller_id  END AS peer_id,
         CASE WHEN c.caller_id = $1 THEN uc.full_name ELSE ul.full_name END AS peer_name,
         CASE WHEN c.caller_id = $1 THEN uc.photo_url ELSE ul.photo_url END AS peer_photo
       FROM p2p_calls c
       JOIN users ul ON ul.id = c.caller_id
       JOIN users uc ON uc.id = c.callee_id
       WHERE (c.caller_id = $1 OR c.callee_id = $1)
         AND c.org_id = $2
       ORDER BY c.created_at DESC
       LIMIT $3`,
      [userId, orgId, limit]
    );

    res.json(rows.map(r => ({
      id:              r.id,
      callType:        r.call_type,
      status:          r.status,
      direction:       r.direction,
      durationSeconds: r.duration_seconds,
      startedAt:       r.started_at,
      endedAt:         r.ended_at,
      createdAt:       r.created_at,
      peerId:          r.peer_id,
      peerName:        r.peer_name || 'Utilisateur',
      peerPhoto:       r.peer_photo,
    })));
  } catch (err) { next(err); }
});

// ── Helper : envoyer un signal d'appel via le message-router ─────────────────
async function _notifyCallSignal(toUserId, payload) {
  try {
    await fetch(`${MESSAGE_ROUTER_URL}/internal/messages/deliver`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({
        id:         `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        to:         toUserId,
        ciphertext: JSON.stringify(payload),
        type:       'call_signal',
      }),
      timeout: 3000,
    });
  } catch (err) {
    console.warn('[calls] message-router unreachable for signal:', err.message);
  }
}

module.exports = router;
