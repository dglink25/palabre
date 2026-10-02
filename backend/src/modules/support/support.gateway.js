'use strict';

/**
 * Support Gateway - WebSocket /support/socket
 *
 * Gère le signaling temps réel pour :
 * - Messagerie instantanée (support:message)
 * - Signaling WebRTC audio (support:call:signal)
 * - Acquittements de lecture (support:read_ack)
 * - Notifications admin (support:admin:*)
 *
 * Tous les échanges passent par le Central_Server.
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const supportService = require('./support.service');
const queueService   = require('./support.queue.service');

// Map clientId → ws, pour le ciblage direct
const clients = new Map(); // userId → ws (connexion la plus récente)
let adminWs   = null;      // Connexion WebSocket du super-admin

// ── Attacher la gateway au serveur HTTP ───────────────────────────────────────

function attachSupportGateway(server) {
  const wss = new WebSocketServer({ server, path: '/support/socket' });

  wss.on('connection', async (ws, req) => {
    // ── Authentification JWT ──────────────────────────────────────────────
    let user;
    try {
      const url   = new URL(req.url, 'ws://localhost');
      const token = url.searchParams.get('token') || _extractBearerFromHeaders(req.headers);
      if (!token) throw new Error('No token');

      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const { rows } = await pool.query(
        `SELECT id, is_super_admin, full_name FROM users WHERE id = $1`,
        [payload.sub]
      );
      if (!rows[0]) throw new Error('User not found');
      user = rows[0];
    } catch (err) {
      _send(ws, { type: 'error', code: 'AUTH_FAILED', message: 'Authentification requise.' });
      ws.close(4001, 'Unauthorized');
      return;
    }

    // ── Enregistrement du client ──────────────────────────────────────────
    ws.userId       = user.id;
    ws.isSuperAdmin = !!user.is_super_admin;
    ws.isAlive      = true;
    clients.set(user.id, ws);

    if (ws.isSuperAdmin) {
      adminWs = ws;
      await queueService.setAdminOnline(true);
      _broadcastToAll({ type: 'support:admin:online' });
      // Envoyer l'état courant de la file au super-admin
      const status = await queueService.getQueueStatus();
      _send(ws, { type: 'support:status', payload: status });
    }

    // Confirmation de connexion
    _send(ws, { type: 'connected', userId: user.id, isSuperAdmin: ws.isSuperAdmin });

    // ── Gestion des messages entrants ────────────────────────────────────
    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {

        // ── Nouveau message chat ────────────────────────────────────────
        case 'support:message': {
          const { sessionId, ciphertext, senderKeyId, type, clientTs } = msg.payload || {};
          if (!sessionId || !ciphertext) break;

          const senderType = ws.isSuperAdmin ? 'super_admin' : 'user';

          // Bloquer : seul un utilisateur peut initier (req 2.8)
          // → si c'est le super-admin, il peut répondre mais pas initier
          // (vérification gérée côté service, ici on persiste juste)

          try {
            const saved = await supportService.saveMessage({
              sessionId,
              senderId:   user.id,
              senderType,
              ciphertext,
              senderKeyId,
              type:       type || 'text',
              clientTs:   clientTs || Date.now(),
            });

            // Accusé d'envoi à l'expéditeur
            _send(ws, { type: 'support:message:status', payload: {
              messageId:  saved.id,
              status:     'sent',
              serverTs:   saved.server_ts,
            }});

            // Livraison au destinataire
            const targetUserId = ws.isSuperAdmin
              ? await _getSessionUserId(sessionId)
              : null; // super-admin always connected as adminWs

            const deliveryPayload = { type: 'support:message:new', payload: saved };

            if (ws.isSuperAdmin) {
              // Envoyer au client
              const clientSocket = targetUserId ? clients.get(targetUserId) : null;
              if (clientSocket && clientSocket.readyState === 1) {
                _send(clientSocket, deliveryPayload);
                await supportService.markMessagesDelivered(sessionId, 'super_admin');
                _send(ws, { type: 'support:message:status', payload: {
                  messageId: saved.id, status: 'delivered',
                }});
              }
            } else {
              // Envoyer au super-admin
              if (adminWs && adminWs.readyState === 1) {
                _send(adminWs, deliveryPayload);
                await supportService.markMessagesDelivered(sessionId, 'user');
                _send(ws, { type: 'support:message:status', payload: {
                  messageId: saved.id, status: 'delivered',
                }});
              }
            }

            // Persistance via Redis pub/sub pour les instances multiples
            await redis.publish('support:message:new', JSON.stringify({
              sessionId,
              message:    saved,
              targetType: ws.isSuperAdmin ? 'user' : 'super_admin',
            })).catch(() => {});

          } catch (err) {
            _send(ws, { type: 'support:message:status', payload: {
              error: err.message, clientTs,
            }});
          }
          break;
        }

        // ── Signaling WebRTC audio ───────────────────────────────────────
        case 'support:call:signal': {
          const { callId, signal } = msg.payload || {};
          if (!callId || !signal) break;

          const sigPayload = { type: 'support:call:signal', payload: { callId, signal, from: user.id } };

          if (ws.isSuperAdmin) {
            // Relayer le signal au client de l'appel
            const meta = await queueService.getCallMeta(callId);
            if (meta) {
              const clientSock = clients.get(meta.userId);
              if (clientSock && clientSock.readyState === 1) _send(clientSock, sigPayload);
            }
          } else {
            // Relayer le signal au super-admin
            if (adminWs && adminWs.readyState === 1) _send(adminWs, sigPayload);
          }
          break;
        }

        // ── Acquittement de lecture ──────────────────────────────────────
        case 'support:read_ack': {
          const { sessionId, upToServerTs } = msg.payload || {};
          if (!sessionId || !upToServerTs) break;

          const recipientType = ws.isSuperAdmin ? 'super_admin' : 'user';
          await supportService.markMessagesRead(sessionId, recipientType, upToServerTs);

          // Notifier l'autre partie que les messages ont été lus
          const readPayload = { type: 'support:messages:read', payload: { sessionId, upToServerTs, by: recipientType } };
          if (ws.isSuperAdmin) {
            const uid = await _getSessionUserId(sessionId);
            const sock = uid ? clients.get(uid) : null;
            if (sock && sock.readyState === 1) _send(sock, readPayload);
          } else {
            if (adminWs && adminWs.readyState === 1) _send(adminWs, readPayload);
          }
          break;
        }

        // ── Heartbeat super-admin ────────────────────────────────────────
        case 'support:heartbeat': {
          if (ws.isSuperAdmin) {
            await queueService.renewAdminHeartbeat();
          }
          _send(ws, { type: 'support:heartbeat:ack' });
          break;
        }

        // ── Ping/pong WebSocket ──────────────────────────────────────────
        case 'ping': {
          ws.isAlive = true;
          _send(ws, { type: 'pong' });
          break;
        }

        default:
          break;
      }
    });

    // ── Déconnexion ──────────────────────────────────────────────────────
    ws.on('close', async () => {
      clients.delete(user.id);
      if (ws.isSuperAdmin) {
        adminWs = null;
        await queueService.setAdminOnline(false);
        _broadcastToAll({ type: 'support:admin:offline' });
      }
    });

    ws.on('error', (err) => {
      console.error(`[support:gateway] ws error user=${user.id}:`, err.message);
    });
  });

  // ── Abonnement Redis pub/sub ──────────────────────────────────────────────
  // Permet de fonctionner sur plusieurs instances Node
  const subscriber = redis.duplicate();
  subscriber.subscribe(
    'support:call:incoming',
    'support:call:answered',
    'support:call:hold',
    'support:call:resumed',
    'support:call:ended',
    'support:queue:update',
    'support:message:new',
    (err) => {
      if (err) console.error('[support:gateway] redis subscribe error:', err.message);
    }
  );

  subscriber.on('message', (channel, message) => {
    try {
      const payload = JSON.parse(message);
      _handleRedisMessage(channel, payload);
    } catch { /* ignore */ }
  });

  // ── Ping/pong keepalive ───────────────────────────────────────────────────
  const pingInterval = setInterval(() => {
    clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
    if (adminWs && !adminWs.isAlive) {
      adminWs.terminate();
      adminWs = null;
    }
  }, 30000);

  wss.on('close', () => clearInterval(pingInterval));

  console.log('[support:gateway] WebSocket attaché sur /support/socket');
  return wss;
}

// ── Dispatch des messages Redis ───────────────────────────────────────────────

function _handleRedisMessage(channel, payload) {
  switch (channel) {
    case 'support:call:incoming':
      // Notifier le super-admin d'un appel entrant
      if (adminWs && adminWs.readyState === 1) {
        _send(adminWs, { type: 'support:call:incoming', payload });
      }
      break;

    case 'support:call:answered':
      // Notifier le client que son appel est décroché
      if (payload.meta?.userId) {
        const sock = clients.get(payload.meta.userId);
        if (sock && sock.readyState === 1) {
          _send(sock, { type: 'support:call:answered', payload });
        }
      }
      break;

    case 'support:call:hold':
      // Notifier le client de la mise en attente
      if (payload.meta?.userId) {
        const sock = clients.get(payload.meta.userId);
        if (sock && sock.readyState === 1) {
          _send(sock, { type: 'support:call:hold', payload });
        }
      }
      break;

    case 'support:call:resumed':
      // Notifier le client de la reprise
      if (payload.meta?.userId) {
        const sock = clients.get(payload.meta.userId);
        if (sock && sock.readyState === 1) {
          _send(sock, { type: 'support:call:resumed', payload });
        }
      }
      break;

    case 'support:call:ended':
      // Notifier les deux parties
      if (payload.meta?.userId) {
        const sock = clients.get(payload.meta.userId);
        if (sock && sock.readyState === 1) {
          _send(sock, { type: 'support:call:ended', payload });
        }
      }
      if (adminWs && adminWs.readyState === 1) {
        _send(adminWs, { type: 'support:call:ended', payload });
      }
      break;

    case 'support:queue:update':
      // Mettre à jour la position de chaque client en attente
      if (payload.updates) {
        for (const update of payload.updates) {
          const sock = clients.get(update.userId);
          if (sock && sock.readyState === 1) {
            _send(sock, { type: 'support:queue:update', payload: update });
          }
        }
        // Notifier l'admin aussi
        if (adminWs && adminWs.readyState === 1) {
          _send(adminWs, { type: 'support:queue:update', payload: { updates: payload.updates } });
        }
      }
      break;

    case 'support:message:new':
      // Livré par la gateway elle-même - pas de re-diffusion (déjà géré dans l'event handler)
      break;

    default:
      break;
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function _send(ws, data) {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(data));
  }
}

function _broadcastToAll(data) {
  clients.forEach((ws) => _send(ws, data));
  if (adminWs && adminWs.readyState === 1) _send(adminWs, data);
}

function _extractBearerFromHeaders(headers) {
  const auth = headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function _getSessionUserId(sessionId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM support_sessions WHERE id = $1`,
    [sessionId]
  );
  return rows[0]?.user_id || null;
}

/**
 * Envoie un événement à un utilisateur spécifique (utilisé par les routes REST).
 * Ex: pour notifier un client que l'admin a lancé une vidéo.
 */
function sendToUser(userId, data) {
  const sock = clients.get(userId);
  if (sock && sock.readyState === 1) _send(sock, data);
}

function sendToAdmin(data) {
  if (adminWs && adminWs.readyState === 1) _send(adminWs, data);
}

module.exports = { attachSupportGateway, sendToUser, sendToAdmin };
