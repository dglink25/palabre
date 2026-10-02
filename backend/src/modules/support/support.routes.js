'use strict';

/**
 * Support Routes - /api/v1/support
 *
 * Routes utilisateur   : requièrent requireAuth
 * Routes super-admin   : requièrent requireAuth + requireSuperAdmin
 */

const express        = require('express');
const { requireAuth }       = require('../../middleware/authMiddleware');
const { requireSuperAdmin } = require('../../middleware/rbac');
const supportService = require('./support.service');
const callService    = require('./support.call.service');
const queueService   = require('./support.queue.service');
const vcService      = require('../videoconference/videoconference.service');
const { sendToUser, sendToAdmin } = require('./support.gateway');

const router = express.Router();

// ── Middleware cross-tenant ───────────────────────────────────────────────────
// Les appels au service client depuis un tenant local doivent être rejetés
// s'ils ne passent pas par le Central_Server (le middleware requireAuth
// établit déjà que l'utilisateur est bien authentifié ; ici on s'assure
// que les données d'une session ne sont jamais accessibles cross-tenant).
function rejectCrossTenantAccess(req, res, next) {
  // req.user.org_id est set uniquement si l'utilisateur est membre d'un tenant.
  // Les appels support DOIVENT toujours passer par le Central_Server.
  // On interdit ici les requêtes portant l'en-tête interne X-Tenant-Origin.
  if (req.headers['x-tenant-origin']) {
    return res.status(403).json({
      error: { code: 'CROSS_TENANT_ACCESS_DENIED', message: 'Les requêtes du service client doivent passer par le serveur central.' },
    });
  }
  next();
}

router.use(requireAuth);
router.use(rejectCrossTenantAccess);

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES UTILISATEUR
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/v1/support/status - Statut du service client (disponibilité, file)
router.get('/status', async (req, res, next) => {
  try {
    const status = await queueService.getQueueStatus();
    res.json(status);
  } catch (err) { next(err); }
});

// POST /api/v1/support/sessions - Obtenir ou créer la session active
router.post('/sessions', async (req, res, next) => {
  try {
    const session = await supportService.getOrCreateSession(req.user.id);
    res.status(201).json(session);
  } catch (err) { next(err); }
});

// GET /api/v1/support/sessions/me - Session active + messages récents
router.get('/sessions/me', async (req, res, next) => {
  try {
    const session = await supportService.getOrCreateSession(req.user.id);
    const messages = await supportService.getMessages(session.id, { limit: 50 });
    const activeCall = await callService.getActiveCallForSession(session.id);

    let queuePosition = null;
    if (activeCall && activeCall.status === 'queued') {
      queuePosition = await queueService.getQueuePosition(activeCall.id);
    }

    res.json({ session, messages, activeCall, queuePosition });
  } catch (err) { next(err); }
});

// GET /api/v1/support/sessions/me/messages - Messages paginés
router.get('/sessions/me/messages', async (req, res, next) => {
  try {
    const session  = await supportService.getOrCreateSession(req.user.id);
    const limit    = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const before   = req.query.before ? parseInt(req.query.before, 10) : null;
    const messages = await supportService.getMessages(session.id, { limit, before });
    res.json({ messages, sessionId: session.id });
  } catch (err) { next(err); }
});

// POST /api/v1/support/sessions/me/calls - Initier un appel audio
router.post('/sessions/me/calls', async (req, res, next) => {
  try {
    const session = await supportService.getOrCreateSession(req.user.id);
    const result  = await callService.initiateCall(session.id, req.user.id);

    if (result.unavailable) {
      return res.status(503).json({ error: { code: 'ADMIN_OFFLINE', message: result.message } });
    }

    res.status(201).json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/support/sessions/me/calls/:callId/hangup - Raccrocher
router.post('/sessions/me/calls/:callId/hangup', async (req, res, next) => {
  try {
    const result = await callService.endCall(req.params.callId, req.user.id, 'user_hangup');
    res.json(result);
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES SUPER-ADMIN
// ═════════════════════════════════════════════════════════════════════════════

router.use('/admin', requireSuperAdmin);

// GET /api/v1/support/admin/sessions - Toutes les sessions actives
router.get('/admin/sessions', async (req, res, next) => {
  try {
    const sessions  = await supportService.listActiveSessions();
    const queueStatus = await queueService.getQueueStatus();
    const holdCalls   = await queueService.getHoldCalls();
    res.json({ sessions, queueStatus, holdCalls });
  } catch (err) { next(err); }
});

// GET /api/v1/support/admin/sessions/history - Historique des sessions
router.get('/admin/sessions/history', async (req, res, next) => {
  try {
    const { userId, fromDate, toDate, channel } = req.query;
    const limit   = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset  = parseInt(req.query.offset || '0', 10);
    const history = await supportService.searchHistory({ userId, fromDate, toDate, channel, limit, offset });
    res.json({ history });
  } catch (err) { next(err); }
});

// GET /api/v1/support/admin/sessions/:id - Détail session + messages
router.get('/admin/sessions/:id', async (req, res, next) => {
  try {
    const session  = await supportService.getSessionById(req.params.id, req.user.id, true);
    const messages = await supportService.getMessages(session.id, { limit: 100 });
    const activeCall = await callService.getActiveCallForSession(session.id);
    res.json({ session, messages, activeCall });
  } catch (err) { next(err); }
});

// POST /api/v1/support/admin/sessions/:id/calls/:callId/answer - Décrocher
router.post('/admin/sessions/:id/calls/:callId/answer', async (req, res, next) => {
  try {
    const result = await callService.answerCall(req.params.callId, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/support/admin/sessions/:id/calls/:callId/hold - Mettre en attente
router.post('/admin/sessions/:id/calls/:callId/hold', async (req, res, next) => {
  try {
    const result = await callService.holdCall(req.params.callId, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/support/admin/sessions/:id/calls/:callId/resume - Reprendre
router.post('/admin/sessions/:id/calls/:callId/resume', async (req, res, next) => {
  try {
    const result = await callService.resumeCall(req.params.callId, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/support/admin/sessions/:id/calls/:callId/hangup - Terminer
router.post('/admin/sessions/:id/calls/:callId/hangup', async (req, res, next) => {
  try {
    const result = await callService.endCall(req.params.callId, req.user.id, 'admin_hangup');
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/support/admin/sessions/:id/videoconference - Lancer une vidéo depuis le chat
router.post('/admin/sessions/:id/videoconference', async (req, res, next) => {
  try {
    const session = await supportService.getSessionById(req.params.id, req.user.id, true);

    // Créer la room via le VideoConference_Service existant
    const room = await vcService.createRoom({
      user:         req.user,
      orgId:        null,          // Pas de tenant - vidéo publique support
      title:        `Support - ${session.user_name || 'Client'}`,
      accessPolicy: 'closed',
      immediate:    true,
      inviteeIds:   [session.user_id],
      isPublic:     true,
    });

    // Insérer le message video_invite dans le chat (ciphertext JSON pour le client)
    const inviteMsg = await supportService.saveMessage({
      sessionId:  session.id,
      senderId:   req.user.id,
      senderType: 'super_admin',
      ciphertext: JSON.stringify({
        type:    'video_invite',
        roomId:  room.id,
        title:   room.title,
      }),
      type:      'video_invite',
      videoRoomId: room.id,
      clientTs:  Date.now(),
    });

    // Notifier le client via WebSocket
    sendToUser(session.user_id, {
      type:    'support:video:invite',
      payload: { message: inviteMsg, room: { id: room.id, title: room.title } },
    });

    await supportService.auditLog({
      sessionId: session.id,
      userId:    req.user.id,
      action:    'VIDEO_INVITE_SENT',
      metadata:  { roomId: room.id },
    });

    res.status(201).json({ message: inviteMsg, room: { id: room.id, title: room.title } });
  } catch (err) { next(err); }
});

// POST /api/v1/support/admin/sessions/:id/resolve - Résoudre la session
router.post('/admin/sessions/:id/resolve', async (req, res, next) => {
  try {
    const result = await supportService.resolveSession(req.params.id, req.user.id);
    // Notifier le client de la résolution
    sendToUser(result.user_id, {
      type:    'support:session:resolved',
      payload: { sessionId: result.id, resolvedAt: result.resolved_at },
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
