'use strict';

/**
 * Tunnel Gateway — WebSocket persistant pour les Tunnel Connectors
 *
 * Chaque Tenant_Server se connecte ici pour :
 *  1. S'authentifier (token d'enregistrement ou controlToken)
 *  2. Envoyer des heartbeats périodiques avec l'état de santé
 *  3. Recevoir des messages entrants à relayer vers les services locaux
 *  4. Être notifié des directives (suspension, mise à jour)
 *
 * L'objectif est un canal WebSocket TLS persistant authenticated par token.
 * Le contenu des messages E2E n'est jamais inspecté — seule l'enveloppe
 * de routage est lue (destinataire, tenant d'origine).
 *
 * Usage dans server.js :
 *   const { attachTunnelGateway } = require('./modules/tenant-provisioning/tunnel.gateway');
 *   attachTunnelGateway(httpServer);
 */

const WebSocket = require('ws');
const crypto    = require('crypto');
const { pool }  = require('../../config/db');
const { redis } = require('../../config/redis');
const provService = require('./tenant-provisioning.service');

// Map orgId → WebSocket connection
const connections = new Map();

/**
 * Attache le gateway WebSocket au serveur HTTP existant.
 * @param {http.Server} server — instance créée par app.listen()
 */
function attachTunnelGateway(server) {
  const wss = new WebSocket.Server({
    server,
    path: '/tunnel/socket',
  });

  console.log('[tunnel-gateway] WebSocket gateway démarré sur /tunnel/socket');

  wss.on('connection', async (ws, req) => {
    // Authentification via query param ?orgId=...&token=...
    const url = new URL(req.url, 'http://localhost');
    const orgId = url.searchParams.get('orgId');
    const token = url.searchParams.get('token');

    if (!orgId || !token) {
      ws.close(4001, 'Missing orgId or token');
      return;
    }

    // Vérifier le token (controlToken ou registrationToken)
    const isAuthenticated = await authenticateTunnel(orgId, token);
    if (!isAuthenticated) {
      ws.close(4003, 'TENANT_AUTH_FAILED');
      await provService.logTunnelEvent({
        orgId, eventType: 'error', ipAddress: req.socket.remoteAddress,
        errorMessage: 'Authentication failed', metadata: { event: 'auth_failed' },
      });
      return;
    }

    // Connexion authentifiée
    const ipAddress = req.socket.remoteAddress;
    ws.orgId = orgId;
    ws.isAlive = true;
    ws.connectedAt = Date.now();
    ws.bytesRelayed = 0;

    // Fermer l'ancienne connexion si elle existe
    const existing = connections.get(orgId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close(1000, 'Replaced by new connection');
    }
    connections.set(orgId, ws);

    await provService.logTunnelEvent({
      orgId, eventType: 'connected', ipAddress,
      metadata: { event: 'tunnel_connected' },
    });

    console.log(`[tunnel-gateway] Tenant connecté : ${orgId} depuis ${ipAddress}`);

    // Envoyer un ACK de bienvenue
    safeSend(ws, { type: 'connected', orgId, timestamp: new Date().toISOString() });

    // Heartbeat ping/pong (détection de déconnexion silencieuse)
    ws.on('pong', () => { ws.isAlive = true; });

    // Gestion des messages entrants
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleTunnelMessage(ws, orgId, msg, ipAddress);
        ws.bytesRelayed += data.length;
      } catch (err) {
        console.error(`[tunnel-gateway] Message parse error (${orgId}):`, err.message);
        safeSend(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'JSON invalide' });
      }
    });

    // Gestion de la déconnexion
    ws.on('close', async (code, reason) => {
      connections.delete(orgId);
      const duration = Math.round((Date.now() - ws.connectedAt) / 1000);
      await provService.logTunnelEvent({
        orgId, eventType: 'disconnected', ipAddress,
        bytesRelayed: ws.bytesRelayed,
        metadata: { code, reason: reason?.toString(), durationSeconds: duration },
      });
      console.log(`[tunnel-gateway] Tenant déconnecté : ${orgId} (durée: ${duration}s)`);
    });

    ws.on('error', (err) => {
      console.error(`[tunnel-gateway] Erreur WebSocket (${orgId}):`, err.message);
    });
  });

  // Ping périodique pour détecter les connexions mortes (toutes les 30s)
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) {
        connections.delete(ws.orgId);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(pingInterval));

  return wss;
}

// ── Authentification ──────────────────────────────────────────────────────────

async function authenticateTunnel(orgId, token) {
  // Vérifier le controlToken
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { rows } = await pool.query(
    `SELECT t.organization_id
     FROM tenant_control_tokens t
     WHERE t.organization_id = $1 AND t.token_hash = $2 AND t.revoked_at IS NULL
     UNION ALL
     SELECT tr.organization_id
     FROM tenant_registrations tr
     WHERE tr.organization_id = $1 AND tr.registration_token_hash = $2 AND tr.status = 'active'
     LIMIT 1`,
    [orgId, tokenHash]
  );

  return rows.length > 0;
}

// ── Traitement des messages entrants ─────────────────────────────────────────

async function handleTunnelMessage(ws, orgId, msg, ipAddress) {
  switch (msg.type) {

    // Heartbeat du Tunnel Connector
    case 'heartbeat': {
      const result = await provService.processHeartbeat({
        orgId,
        components: msg.components || {},
        version:    msg.version,
        ipAddress,
      });
      safeSend(ws, {
        type:      'heartbeat_ack',
        orgStatus: result.orgStatus,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    // Message à relayer vers un autre tenant ou l'extérieur
    case 'relay_message': {
      await relayMessage(orgId, msg.payload);
      safeSend(ws, { type: 'relay_ack', messageId: msg.payload?.id });
      break;
    }

    // Signal d'appel sortant
    case 'call_signal': {
      await relayCallSignal(orgId, msg.payload);
      safeSend(ws, { type: 'call_signal_ack' });
      break;
    }

    // Rapport de santé d'un composant
    case 'component_health': {
      await provService.processHeartbeat({
        orgId,
        components: msg.components || {},
        ipAddress,
      });
      break;
    }

    default:
      safeSend(ws, { type: 'error', code: 'UNKNOWN_MESSAGE_TYPE', msgType: msg.type });
  }
}

// ── Relai de message vers le tenant destinataire ──────────────────────────────

async function relayMessage(fromOrgId, payload) {
  if (!payload || !payload.to_user_id) return;

  // Trouver l'organisation du destinataire
  const { rows } = await pool.query(
    `SELECT m.organization_id
     FROM memberships m
     WHERE m.user_id = $1 AND m.status = 'active'
     LIMIT 1`,
    [payload.to_user_id]
  );

  const destOrgId = rows[0]?.organization_id;
  if (!destOrgId) return;

  // Le destinataire est-il dans un tenant connecté ?
  const destWs = connections.get(destOrgId);
  if (destWs && destWs.readyState === WebSocket.OPEN) {
    safeSend(destWs, {
      type:    'message:inbound',
      payload,
      from_org: fromOrgId,
    });
    await provService.logTunnelEvent({
      orgId: fromOrgId, eventType: 'relay',
      bytesRelayed: JSON.stringify(payload).length,
      metadata: { destOrgId, messageId: payload.id },
    });
    return;
  }

  // Sinon : pub/sub Redis pour que le message-router central le prenne en charge
  await redis.publish('tunnel:relay', JSON.stringify({
    fromOrgId, payload,
  }));
}

// ── Relai de signal d'appel ───────────────────────────────────────────────────

async function relayCallSignal(fromOrgId, payload) {
  if (!payload || !payload.to_user_id) return;

  const { rows } = await pool.query(
    `SELECT m.organization_id FROM memberships m
     WHERE m.user_id = $1 AND m.status = 'active' LIMIT 1`,
    [payload.to_user_id]
  );

  const destOrgId = rows[0]?.organization_id;
  if (!destOrgId) return;

  const destWs = connections.get(destOrgId);
  if (destWs && destWs.readyState === WebSocket.OPEN) {
    safeSend(destWs, { type: 'call:incoming', payload, from_org: fromOrgId });
    return;
  }

  await redis.publish('tunnel:call_signal', JSON.stringify({ fromOrgId, payload }));
}

// ── Envoyer un message depuis le Central_Server vers un tenant connecté ───────

function sendToTenant(orgId, message) {
  const ws = connections.get(orgId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    safeSend(ws, message);
    return true;
  }
  return false;
}

/**
 * Diffuse un message de directive à tous les tenants connectés.
 * Utilisé pour les notifications de mise à jour, suspensions, etc.
 */
function broadcastDirective(message) {
  let count = 0;
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      safeSend(ws, message);
      count++;
    }
  });
  return count;
}

// ── Helper sécurisé ───────────────────────────────────────────────────────────

function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(data)); } catch { /* ignore */ }
  }
}

/**
 * Retourne le nombre de tenants actuellement connectés.
 */
function getConnectionCount() {
  return connections.size;
}

/**
 * Vérifie si un tenant est actuellement connecté via WebSocket.
 */
function isTenantConnected(orgId) {
  const ws = connections.get(orgId);
  return ws ? ws.readyState === WebSocket.OPEN : false;
}

module.exports = {
  attachTunnelGateway,
  sendToTenant,
  broadcastDirective,
  getConnectionCount,
  isTenantConnected,
};
