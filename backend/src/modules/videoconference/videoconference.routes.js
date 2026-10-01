'use strict';



const express    = require('express');
const { requireAuth } = require('../../middleware/authMiddleware');
const vcService  = require('./videoconference.service');
const recService = require('./recording.service');

const router = express.Router();

// ── Middleware anti-Jitsi white-label (R1.4) ──────────────────────────────
const JITSI_PATTERNS = ['jitsi', '8x8.vc', 'meet.jit.si', 'jaas.8x8'];

function rejectJitsiLeak(req, res, next) {
  const suspects = [
    JSON.stringify(req.query),
    JSON.stringify(req.body || {}),
    JSON.stringify(req.headers),
  ].join(' ').toLowerCase();

  for (const pattern of JITSI_PATTERNS) {
    if (suspects.includes(pattern)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST' } });
    }
  }
  next();
}

router.use(rejectJitsiLeak);

// ── Proxy du SDK client — charge le script external_api.js de Jitsi ───────
// Le frontend charge ce script via /api/v1/videoconference/client-sdk
// Le nom "jitsi" n'apparaît jamais dans l'URL côté client.
router.get('/client-sdk', async (req, res) => {
  const fetch  = require('node-fetch');
  const domain = process.env.JITSI_DOMAIN || 'meet.jitsi.si'; // fallback public
  try {
    const upstream = await fetch(`https://${domain}/external_api.js`);
    if (!upstream.ok) throw new Error('SDK unavailable');
    const script = await upstream.text();
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(script);
  } catch {
    res.status(503).json({ error: { code: 'SDK_UNAVAILABLE', message: 'Service temporairement indisponible.' } });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// ROOMS
// ═════════════════════════════════════════════════════════════════════════

// POST /rooms — Créer une room (tenant)
router.post('/rooms', requireAuth, async (req, res, next) => {
  try {
    const { title, accessPolicy, immediate, scheduledAt, estimatedDurationMin, inviteeIds } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: { code: 'MISSING_TITLE', message: 'Le titre est obligatoire.' } });
    }

    const room = await vcService.createRoom({
      user: req.user,
      orgId: req.user.org_id,
      title: title.trim(),
      accessPolicy: accessPolicy || 'closed',
      immediate: immediate !== false,
      scheduledAt: scheduledAt || null,
      estimatedDurationMin: estimatedDurationMin || null,
      inviteeIds: inviteeIds || [],
      isPublic: false,
    });

    res.status(201).json(room);
  } catch (err) { next(err); }
});

// POST /public/rooms — Créer une room publique (depuis la page d'accueil)
router.post('/public/rooms', requireAuth, async (req, res, next) => {
  try {
    const { title, accessPolicy, immediate, scheduledAt, estimatedDurationMin, inviteeIdentifiers } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: { code: 'MISSING_TITLE', message: 'Le titre est obligatoire.' } });
    }

    // Résoudre les identifiants d'invités (email ou full_name)
    let inviteeIds = [];
    if (inviteeIdentifiers && inviteeIdentifiers.length > 0) {
      const { pool } = require('../../config/db');
      for (const identifier of inviteeIdentifiers) {
        const { rows } = await pool.query(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR full_name = $1`,
          [identifier]
        );
        if (rows[0]) inviteeIds.push(rows[0].id);
      }
    }

    const room = await vcService.createRoom({
      user: req.user,
      orgId: null,
      title: title.trim(),
      accessPolicy: accessPolicy || 'closed',
      immediate: immediate !== false,
      scheduledAt: scheduledAt || null,
      estimatedDurationMin: estimatedDurationMin || null,
      inviteeIds,
      isPublic: true,
    });

    const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    res.status(201).json({
      ...room,
      joinUrl:   `${frontendBase}/videoconference/${room.id}`,
      shareLink: `${frontendBase}/join/v/${room.id}`,
    });
  } catch (err) { next(err); }
});

// GET /rooms — Lister les rooms du tenant
router.get('/rooms', requireAuth, async (req, res, next) => {
  try {
    const orgId   = req.user.org_id;
    if (!orgId) return res.json({ rooms: [], history: [] });

    const isAdmin = req.user.member_role === 'org_admin' || req.user.is_super_admin;
    const page    = parseInt(req.query.page || '1', 10);
    const limit   = Math.min(parseInt(req.query.limit || '50', 10), 100);

    const [rooms, history] = await Promise.all([
      vcService.listRooms({ orgId, userId: req.user.id, isAdmin, page, limit }),
      isAdmin ? vcService.listHistory({ orgId }) : Promise.resolve([]),
    ]);

    res.json({ rooms, history });
  } catch (err) { next(err); }
});

// GET /rooms/:roomId — Détail d'une room
router.get('/rooms/:roomId', requireAuth, async (req, res, next) => {
  try {
    const room = await vcService.getRoomById(req.params.roomId, req.user.id, req.user.org_id || null);
    res.json(room);
  } catch (err) { next(err); }
});

// PATCH /rooms/:roomId — Modifier une room planifiée
router.patch('/rooms/:roomId', requireAuth, async (req, res, next) => {
  try {
    const { title, scheduledAt, estimatedDurationMin, accessPolicy, addInviteeIds, removeInviteeIds } = req.body;
    const room = await vcService.updateRoom({
      roomId: req.params.roomId,
      userId: req.user.id,
      orgId: req.user.org_id || null,
      title, scheduledAt, estimatedDurationMin, accessPolicy,
      addInviteeIds: addInviteeIds || [],
      removeInviteeIds: removeInviteeIds || [],
    });
    res.json(room);
  } catch (err) { next(err); }
});

// DELETE /rooms/:roomId — Annuler une room
router.delete('/rooms/:roomId', requireAuth, async (req, res, next) => {
  try {
    await vcService.cancelRoom({
      roomId: req.params.roomId,
      userId: req.user.id,
      orgId: req.user.org_id || null,
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════
// SESSION JITSI (usage serveur uniquement)
// ═════════════════════════════════════════════════════════════════════════

// POST /rooms/:roomId/session — Résoudre la config Jitsi (white-label)
// Retourne { domain, roomToken, displayName, isModerator }
// Ne contient JAMAIS jitsi_room_name en clair
router.post('/rooms/:roomId/session', requireAuth, async (req, res, next) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: { code: 'MISSING_SESSION_TOKEN', message: 'Token de session requis.' } });
    }

    const config = await vcService.resolveJitsiConfig({
      roomId: req.params.roomId,
      sessionToken,
      user: req.user,
    });

    res.json(config);
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════
// REJOINDRE / QUITTER
// ═════════════════════════════════════════════════════════════════════════

// POST /rooms/:roomId/join
router.post('/rooms/:roomId/join', requireAuth, async (req, res, next) => {
  try {
    const { invitationToken } = req.body;
    const result = await vcService.joinRoom({
      roomId: req.params.roomId,
      userId: req.user.id,
      orgId: req.user.org_id || null,
      invitationToken: invitationToken || null,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /rooms/:roomId/leave
router.post('/rooms/:roomId/leave', requireAuth, async (req, res, next) => {
  try {
    await vcService.leaveRoom({ roomId: req.params.roomId, userId: req.user.id });
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /rooms/:roomId/end — Terminer une room (hôte uniquement)
router.post('/rooms/:roomId/end', requireAuth, async (req, res, next) => {
  try {
    await vcService.endRoom(req.params.roomId, req.user.id, null);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════
// MODÉRATION
// ═════════════════════════════════════════════════════════════════════════

// POST /rooms/:roomId/admit/:userId
router.post('/rooms/:roomId/admit/:targetUserId', requireAuth, async (req, res, next) => {
  try {
    const result = await vcService.admitParticipant({
      roomId: req.params.roomId,
      targetUserId: req.params.targetUserId,
      actorUserId: req.user.id,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /rooms/:roomId/kick/:userId
router.post('/rooms/:roomId/kick/:targetUserId', requireAuth, async (req, res, next) => {
  try {
    await vcService.kickParticipant({
      roomId: req.params.roomId,
      targetUserId: req.params.targetUserId,
      actorUserId: req.user.id,
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// GET /rooms/:roomId/participants
router.get('/rooms/:roomId/participants', requireAuth, async (req, res, next) => {
  try {
    const participants = await vcService.getParticipants(req.params.roomId);
    res.json(participants);
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════
// INVITATIONS
// ═════════════════════════════════════════════════════════════════════════

// POST /rooms/:roomId/invite
router.post('/rooms/:roomId/invite', requireAuth, async (req, res, next) => {
  try {
    const { identifiers } = req.body; // emails ou noms d'utilisateurs
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({ error: { code: 'MISSING_IDENTIFIERS', message: 'Au moins un identifiant est requis.' } });
    }

    const result = await vcService.inviteUsers({
      roomId: req.params.roomId,
      inviteeIdentifiers: identifiers,
      actorUser: req.user,
      orgId: req.user.org_id || null,
    });

    res.json(result);
  } catch (err) { next(err); }
});

// GET /invite/:token — Résoudre un lien d'invitation
router.get('/invite/:token', requireAuth, async (req, res, next) => {
  try {
    const info = await vcService.resolveInvitationToken(req.params.token);
    // Vérifier que l'utilisateur connecté est bien le destinataire
    if (info.inviteeId !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cette invitation ne vous est pas destinée.' } });
    }
    res.json(info);
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════
// ENREGISTREMENT
// ═════════════════════════════════════════════════════════════════════════

// POST /rooms/:roomId/recording/start
router.post('/rooms/:roomId/recording/start', requireAuth, async (req, res, next) => {
  try {
    const result = await recService.startRecording({
      roomId: req.params.roomId,
      actorUserId: req.user.id,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /rooms/:roomId/recording/stop
router.post('/rooms/:roomId/recording/stop', requireAuth, async (req, res, next) => {
  try {
    const result = await recService.stopRecording({
      roomId: req.params.roomId,
      actorUserId: req.user.id,
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
