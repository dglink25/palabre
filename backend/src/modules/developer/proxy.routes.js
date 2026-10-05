// backend/src/modules/developer/proxy.routes.js
// Routes proxy – permettent aux applications tierces d'accéder aux
// fonctionnalités de communication Palabre via leur clé API de projet.
//
// Authentification : requireApiKey (X-Palabre-Key, publishable key)
// Isolation       : req.projectId est injecté par requireApiKey sur chaque requête
// Requirements    : 6.1, 6.2, 6.3, 6.4, 6.5

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { pool }  = require('../../config/db');
const { requireApiKey, logApiCall } = require('./developer.middleware');
const { sendPushNotification } = require('../users/fcm.service');

const router = express.Router();

// ── Variables d'environnement ──────────────────────────────────────────────
const TURN_SECRET    = process.env.TURN_SECRET    || 'change_me_turn_secret';
const TURN_HOST      = process.env.TURN_HOST      || 'localhost';
const TURN_PORT      = process.env.TURN_PORT      || '3478';
const TURN_TLS_PORT  = process.env.TURN_TLS_PORT  || '5349';
const TURN_TTL       = 3600; // 1 heure

const MESSAGE_ROUTER_URL = process.env.MESSAGE_ROUTER_INTERNAL_URL || 'http://localhost:4020';
const INTERNAL_SECRET    = process.env.INTERNAL_SERVICES_SECRET    || 'dev_internal_secret';

// ── Appliquer requireApiKey sur toutes les routes proxy ──────────────────────
// req.projectId est disponible dans chaque handler après ce middleware.
router.use(requireApiKey);


// ════════════════════════════════════════════════════════════════════════════
// POST /proxy/messages
// Envoie un message E2E via l'infrastructure de messagerie Palabre existante.
// Req 6.1, 6.5
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/messages',
  logApiCall('message_sent'),
  async (req, res, next) => {
    try {
      const projectId = req.projectId;
      const { recipient_id, content, type = 'text', from_user_id } = req.body;

      // Validation du corps de la requête
      if (!recipient_id) {
        return res.status(422).json({
          error: {
            code: 'MISSING_RECIPIENT',
            message: "Le champ 'recipient_id' (UUID de l'utilisateur destinataire) est requis.",
          },
        });
      }
      if (!content || (typeof content === 'string' && content.trim() === '')) {
        return res.status(422).json({
          error: {
            code: 'MISSING_CONTENT',
            message: "Le champ 'content' (contenu du message) est requis et ne peut pas être vide.",
          },
        });
      }

      // Vérifier que le destinataire existe dans la base de données
      const { rows: recipientRows } = await pool.query(
        'SELECT id, full_name FROM users WHERE id = $1',
        [recipient_id]
      );
      if (!recipientRows[0]) {
        return res.status(404).json({
          error: {
            code: 'RECIPIENT_NOT_FOUND',
            message: "L'utilisateur destinataire est introuvable.",
          },
        });
      }

      // Générer un identifiant de message unique
      const now   = Date.now();
      const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 8)}`;

      // Résoudre l'expéditeur : soit from_user_id fourni par le développeur,
      // soit un utilisateur système associé au projet developer
      let senderId = from_user_id || null;

      if (!senderId) {
        // Utiliser un expéditeur virtuel lié au projet developer
        // (le projet lui-même est représenté par son project_id)
        senderId = null; // stocké en DB sans from_user_id (message de bot/système)
      }

      // Persister le message dans la table messages
      // org_id = null car les projets developer ne sont pas liés à une organisation
      const { rows } = await pool.query(
        `INSERT INTO messages
           (id, org_id, from_user_id, to_user_id, ciphertext, type, status,
            client_ts, server_ts)
         VALUES ($1, NULL, $2, $3, $4, $5, 'sent', $6, $6)
         RETURNING id, from_user_id, to_user_id, ciphertext, type, status,
                   created_at, server_ts`,
        [msgId, senderId, recipient_id, content, type, now]
      );
      const msg = rows[0];

      // Notifier en temps réel via le message-router Phoenix (non bloquant)
      _notifyMessageRouter({
        id:         msg.id,
        org_id:     null,
        from:       msg.from_user_id,
        to:         msg.to_user_id,
        ciphertext: msg.ciphertext,
        type:       msg.type,
        status:     msg.status,
        timestamp:  msg.server_ts,
        server_ts:  msg.server_ts,
        project_id: projectId, // isolation inter-projets
      });

      // Notification push FCM si le destinataire est hors ligne (non bloquant)
      sendPushNotification(recipient_id, {
        title: 'Nouveau message',
        body:  typeof content === 'string' && content.length > 60
          ? content.slice(0, 57) + '…'
          : String(content),
        data: { project_id: projectId, url: '/app/conversations' },
      });

      res.status(201).json({
        message_id:  msg.id,
        from:        msg.from_user_id,
        to:          msg.to_user_id,
        content:     msg.ciphertext,
        type:        msg.type,
        status:      msg.status,
        sent_at:     msg.created_at,
        server_ts:   msg.server_ts,
        project_id:  projectId,
      });
    } catch (err) {
      next(err);
    }
  }
);


// ════════════════════════════════════════════════════════════════════════════
// POST /proxy/calls
// Initie un appel WebRTC et retourne les credentials TURN + informations
// de signalisation via l'infrastructure d'appels Palabre existante.
// Req 6.2, 6.5
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/calls',
  logApiCall('call_made'),
  async (req, res, next) => {
    try {
      const projectId = req.projectId;
      const { callee_id, call_type = 'audio', caller_id } = req.body;

      if (!callee_id) {
        return res.status(422).json({
          error: {
            code: 'MISSING_CALLEE',
            message: "Le champ 'callee_id' (UUID de l'utilisateur appelé) est requis.",
          },
        });
      }

      // Vérifier que l'utilisateur appelé existe
      const { rows: calleeRows } = await pool.query(
        'SELECT id, full_name FROM users WHERE id = $1',
        [callee_id]
      );
      if (!calleeRows[0]) {
        return res.status(404).json({
          error: {
            code: 'CALLEE_NOT_FOUND',
            message: "L'utilisateur appelé est introuvable.",
          },
        });
      }

      // Générer les credentials TURN éphémères (TTL 1h)
      // Algorithme : username = "{expiry}:{userId}", password = base64(HMAC-SHA1(secret, username))
      const expiry   = Math.floor(Date.now() / 1000) + TURN_TTL;
      const username = `${expiry}:${callee_id}`;
      const password = crypto
        .createHmac('sha1', TURN_SECRET)
        .update(username)
        .digest('base64');

      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: `stun:${TURN_HOST}:${TURN_PORT}` },
        {
          urls:       `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
          username,
          credential: password,
        },
        {
          urls:       `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
          username,
          credential: password,
        },
        {
          urls:       `turns:${TURN_HOST}:${TURN_TLS_PORT}`,
          username,
          credential: password,
        },
      ];

      // Persister l'appel en base de données (org_id = null pour projets developer)
      const { rows } = await pool.query(
        `INSERT INTO p2p_calls
           (org_id, caller_id, callee_id, call_type, status)
         VALUES (NULL, $1, $2, $3, 'ringing')
         RETURNING id, created_at`,
        [caller_id || null, callee_id, call_type]
      );
      const call = rows[0];

      // Notifier l'appelé via le message-router Phoenix (signal WebRTC entrant)
      _notifyCallSignal(callee_id, {
        signal_type: 'call:incoming',
        call_id:     call.id,
        call_type:   call_type,
        caller_id:   caller_id || null,
        project_id:  projectId,
      });

      // Notification push FCM pour sonnerie si l'appelé est hors ligne
      sendPushNotification(callee_id, {
        title: call_type === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant',
        body:  'Vous avez un appel entrant',
        data:  {
          callId:    call.id,
          callType:  call_type,
          project_id: projectId,
          url:       '/app/calls',
        },
      });

      res.status(201).json({
        call_id:     call.id,
        status:      'ringing',
        project_id:  projectId,
        ice_servers: iceServers,
        ttl:         TURN_TTL,
      });
    } catch (err) {
      next(err);
    }
  }
);


// ════════════════════════════════════════════════════════════════════════════
// POST /proxy/video/rooms
// Crée une room de vidéoconférence Jitsi et retourne un token de session.
// Délègue au service videoconference.service.js existant.
// Req 6.3, 6.5
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/video/rooms',
  logApiCall('video_room_created'),
  async (req, res, next) => {
    try {
      const projectId = req.projectId;
      const {
        title,
        host_user_id,
        invitee_ids = [],
        access_policy = 'open',
      } = req.body;

      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(422).json({
          error: {
            code: 'MISSING_TITLE',
            message: "Le champ 'title' (titre de la réunion) est requis.",
          },
        });
      }

      if (!host_user_id) {
        return res.status(422).json({
          error: {
            code: 'MISSING_HOST',
            message: "Le champ 'host_user_id' (UUID de l'hôte de la réunion) est requis.",
          },
        });
      }

      // Vérifier que l'hôte existe
      const { rows: hostRows } = await pool.query(
        'SELECT id, full_name, email FROM users WHERE id = $1',
        [host_user_id]
      );
      if (!hostRows[0]) {
        return res.status(404).json({
          error: {
            code: 'HOST_NOT_FOUND',
            message: "L'utilisateur hôte est introuvable.",
          },
        });
      }
      const host = hostRows[0];

      // Déléguer la création de room au service videoconference existant
      // isPublic = true : pas d'org_id (projets developer ne sont pas liés à une org)
      const videoService = require('../videoconference/videoconference.service');
      const room = await videoService.createRoom({
        user:        host,
        orgId:       null,
        title:       title.trim(),
        accessPolicy: access_policy,
        immediate:   true,
        inviteeIds:  invitee_ids,
        isPublic:    true,
      });

      // Générer un token de session Palabre pour l'hôte (non bloquant)
      const jwt = require('jsonwebtoken');
      const SESSION_TTL = parseInt(process.env.VIDEO_SESSION_JWT_TTL_SECONDS || '86400', 10);
      const sessionToken = jwt.sign(
        { sub: host_user_id, roomId: room.id, project_id: projectId },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: SESSION_TTL }
      );

      res.status(201).json({
        room_id:       room.id,
        title:         room.title,
        status:        room.status,
        access_policy: room.accessPolicy,
        project_id:    projectId,
        session_token: sessionToken,
        ttl:           SESSION_TTL,
        created_at:    room.createdAt,
      });
    } catch (err) {
      // Réexpédier les erreurs du service videoconference avec leur code HTTP
      if (err.httpStatus) {
        return res.status(err.httpStatus).json({
          error: { code: err.code || 'VIDEO_ERROR', message: err.message },
        });
      }
      next(err);
    }
  }
);


// ════════════════════════════════════════════════════════════════════════════
// POST /proxy/push
// Envoie une notification push via Firebase Cloud Messaging (FCM).
// Délègue au service fcm.service.js existant.
// Req 6.4, 6.5
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/push',
  logApiCall('push_sent'),
  async (req, res, next) => {
    try {
      const projectId = req.projectId;
      const { user_id, title, body, data = {} } = req.body;

      if (!user_id) {
        return res.status(422).json({
          error: {
            code: 'MISSING_USER_ID',
            message: "Le champ 'user_id' (UUID de l'utilisateur destinataire) est requis.",
          },
        });
      }
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(422).json({
          error: {
            code: 'MISSING_TITLE',
            message: "Le champ 'title' (titre de la notification) est requis.",
          },
        });
      }
      if (!body || typeof body !== 'string' || body.trim() === '') {
        return res.status(422).json({
          error: {
            code: 'MISSING_BODY',
            message: "Le champ 'body' (corps de la notification) est requis.",
          },
        });
      }

      // Vérifier que l'utilisateur destinataire existe et récupérer ses tokens FCM
      const { rows: userRows } = await pool.query(
        "SELECT id, preferences->'fcmTokens' AS fcm_tokens FROM users WHERE id = $1",
        [user_id]
      );
      if (!userRows[0]) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: "L'utilisateur destinataire est introuvable.",
          },
        });
      }

      const fcmTokens = Array.isArray(userRows[0].fcm_tokens)
        ? userRows[0].fcm_tokens.map(t => t?.token).filter(Boolean)
        : [];

      if (fcmTokens.length === 0) {
        // L'utilisateur n'a pas de token FCM enregistré - retourner une réponse informative
        return res.json({
          ok:          false,
          project_id:  projectId,
          user_id,
          sent:        0,
          reason:      'NO_FCM_TOKENS',
          message:     "Aucun token FCM enregistré pour cet utilisateur. La notification n'a pas été envoyée.",
        });
      }

      // Déléguer l'envoi FCM au service existant (non bloquant par conception)
      // sendPushNotification est fire-and-forget, on le fait en async ici pour capter les erreurs
      await sendPushNotification(user_id, {
        title: title.trim(),
        body:  body.trim(),
        data:  {
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
          project_id: projectId,
        },
      });

      res.json({
        ok:         true,
        project_id: projectId,
        user_id,
        sent:       fcmTokens.length,
      });
    } catch (err) {
      next(err);
    }
  }
);


// ════════════════════════════════════════════════════════════════════════════
// Helpers internes
// ════════════════════════════════════════════════════════════════════════════

/**
 * Notifie le message-router Phoenix pour livrer un message en temps réel.
 * Non bloquant - le message est déjà persisté en DB.
 */
async function _notifyMessageRouter(msg) {
  try {
    const fetch = require('node-fetch');
    await fetch(`${MESSAGE_ROUTER_URL}/internal/messages/deliver`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body:    JSON.stringify(msg),
      timeout: 3000,
    });
  } catch (err) {
    // Non bloquant - le destinataire récupérera le message via polling ou reconnexion
    console.warn('[proxy] message-router unreachable, RT delivery skipped:', err.message);
  }
}

/**
 * Envoie un signal d'appel WebRTC via le message-router Phoenix.
 * Non bloquant.
 */
async function _notifyCallSignal(toUserId, payload) {
  try {
    const fetch = require('node-fetch');
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
    console.warn('[proxy] message-router unreachable for call signal:', err.message);
  }
}

module.exports = router;
