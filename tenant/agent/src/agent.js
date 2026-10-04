/**
 * ======================================================================
 * AGENT TENANT PALABRE
 * ======================================================================
 *
 * Responsabilités :
 *  1. Heartbeat permanent vers le serveur central (toutes les 30s)
 *     → Reçoit le statut de l'organisation (active / suspended)
 *     → Applique les directives reçues (allowConnections, messagingMode...)
 *
 *  2. Gestion de la résilience :
 *     - TUNNEL OK   : routage normal, sync des messages en attente
 *     - TUNNEL DOWN : mode dégradé, messagerie intra-réseau uniquement
 *     - RECONNEXION : sync automatique des messages manqués
 *
 *  3. Synchronisation des messages hors-ligne :
 *     - Les messages envoyés pendant le mode dégradé sont mis en file
 *     - À la reconnexion, ils sont renvoyés dans l'ordre au central
 *
 *  4. Routage bidirectionnel :
 *     - Externe → Local  : le central pousse via WebSocket
 *     - Local → Externe  : l'agent relaie vers le central via HTTPS/WebSocket
 */

'use strict';
require('dotenv').config();

const axios  = require('axios');
const WebSocket = require('ws');
const fs     = require('fs');
const path   = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const CENTRAL_API_URL      = process.env.CENTRAL_API_URL     || 'https://api.palabre.app';
const CENTRAL_WS_URL       = process.env.CENTRAL_WS_URL      || 'wss://ws.palabre.app';
const TENANT_ID            = process.env.ORG_ID;
const CONTROL_TOKEN        = process.env.CONTROL_TOKEN;
const LOCAL_MESSAGE_ROUTER = process.env.LOCAL_MESSAGE_ROUTER_URL || 'http://localhost:4020';
const HEARTBEAT_INTERVAL   = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);
const RECONNECT_BASE_DELAY = 1000;   // 1s  → backoff exponentiel jusqu'à 30s
const RECONNECT_MAX_DELAY  = 30000;  // 30s max

// Chemin du fichier de persistance de la file hors-ligne (sur volume Docker)
const DATA_DIR      = process.env.AGENT_DATA_DIR || '/data/agent';
const QUEUE_FILE    = path.join(DATA_DIR, 'pending_queue.json');

if (!TENANT_ID || !CONTROL_TOKEN) {
  console.error('[agent] ERREUR : ORG_ID et CONTROL_TOKEN sont obligatoires dans .env');
  process.exit(1);
}

// ── Persistance de la file hors-ligne ─────────────────────────────────────────

function loadQueue() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[agent] Impossible de lire la file persistée :', e.message);
  }
  return [];
}

function saveQueue(queue) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
  } catch (e) {
    console.error('[agent] Impossible de persister la file :', e.message);
  }
}

// ── État global ────────────────────────────────────────────────────────────────

const state = {
  tunnelUp:      false,   // Le tunnel WireGuard vers le central est opérationnel
  orgStatus:     'unknown', // 'active' | 'suspended' | 'archived'
  directives:    { allowConnections: true, allowOutboundCalls: true, messagingMode: 'full' },
  pendingSync:   loadQueue(),  // Chargé depuis le disque au démarrage
  ws:            null,    // WebSocket vers le central
  reconnectDelay: RECONNECT_BASE_DELAY,
};

// ── Logging ────────────────────────────────────────────────────────────────────

function log(level, ...args) {
  const ts  = new Date().toISOString();
  const tag = { info: '\x1b[34m[INFO]\x1b[0m', warn: '\x1b[33m[WARN]\x1b[0m', error: '\x1b[31m[ERR ]\x1b[0m', ok: '\x1b[32m[ OK ]\x1b[0m' }[level] || '[LOG ]';
  console.log(`${ts} ${tag}`, ...args);
}

// ── Heartbeat vers le serveur central ─────────────────────────────────────────

async function sendHeartbeat() {
  try {
    const resp = await axios.post(
      `${CENTRAL_API_URL}/api/v1/org/tenants/heartbeat`,
      {
        tenantId:     TENANT_ID,
        controlToken: CONTROL_TOKEN,
        // Déclarer l'URL publique de cet agent pour le routage inter-organisations
        agentUrl:     process.env.AGENT_PUBLIC_URL || null,
        agentVersion: require('../package.json').version,
      },
      { timeout: 10000 }
    );
    const { status, directives } = resp.data;

    const wasDown = !state.tunnelUp;
    state.tunnelUp  = true;
    state.orgStatus = status;
    if (directives) state.directives = directives;
    state.reconnectDelay = RECONNECT_BASE_DELAY;

    if (wasDown) {
      log('ok', `Tunnel retabli - statut organisation : ${status}`);
      // Reconnexion : synchroniser les messages en attente
      await syncPendingMessages();
      // Rétablir le WebSocket
      connectWebSocket();
    }
  } catch (err) {
    if (state.tunnelUp) {
      log('warn', 'Tunnel perdu -', err.message || err.code, '- mode dégradé activé');
      state.tunnelUp = false;
      notifyLocalServices({ mode: 'degraded' });
    }
  }
}

// ── Notification aux services locaux (mode dégradé / normal) ──────────────────

async function notifyLocalServices({ mode }) {
  try {
    await axios.post(
      `${LOCAL_MESSAGE_ROUTER}/internal/agent/mode`,
      { mode, directives: state.directives },
      { timeout: 3000 }
    );
    log('info', `Services locaux notifiés : mode=${mode}`);
  } catch {
    // Le message-router local peut être temporairement inaccessible
  }
}

// ── Synchronisation des messages en attente ───────────────────────────────────

async function syncPendingMessages() {
  if (state.pendingSync.length === 0) return;
  log('info', `Synchronisation de ${state.pendingSync.length} message(s) en attente...`);

  const toSync = [...state.pendingSync];
  state.pendingSync = [];
  saveQueue(state.pendingSync); // Vider sur disque immédiatement

  for (const msg of toSync) {
    try {
      await axios.post(
        `${CENTRAL_API_URL}/api/v1/internal/messages/sync`,
        { tenantId: TENANT_ID, controlToken: CONTROL_TOKEN, message: msg },
        { timeout: 10000 }
      );
    } catch (e) {
      log('warn', 'Echec sync message - requeue', e.message);
      state.pendingSync.unshift(msg); // Remettre en tête de file
      saveQueue(state.pendingSync);   // Persister immédiatement
      break; // Arrêter si le central est encore inaccessible
    }
  }

  if (state.pendingSync.length === 0) {
    log('ok', 'Synchronisation complete');
    saveQueue([]); // Vider le fichier sur disque
  } else {
    log('warn', `${state.pendingSync.length} message(s) restent en attente`);
  }
}

// ── WebSocket vers le serveur central (messages entrants pour les membres locaux)

function connectWebSocket() {
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = `${CENTRAL_WS_URL}/tenant/socket?tenantId=${TENANT_ID}&token=${encodeURIComponent(CONTROL_TOKEN)}`;

  try {
    state.ws = new WebSocket(wsUrl);
  } catch (e) {
    log('warn', 'WebSocket central indisponible - nouvelle tentative dans', state.reconnectDelay / 1000, 's');
    scheduleReconnect();
    return;
  }

  state.ws.on('open', () => {
    log('ok', 'WebSocket central connecte');
    state.reconnectDelay = RECONNECT_BASE_DELAY;
  });

  state.ws.on('message', (data) => {
    try {
      const event = JSON.parse(data);
      handleCentralEvent(event);
    } catch {
      log('warn', 'Message WebSocket invalide recu du central');
    }
  });

  state.ws.on('close', (code, reason) => {
    log('warn', `WebSocket central ferme (code=${code})${reason ? ' - ' + reason : ''}`);
    state.ws = null;
    if (state.tunnelUp) {
      scheduleReconnect();
    }
  });

  state.ws.on('error', (err) => {
    log('error', 'WebSocket central - erreur :', err.message);
  });
}

// ── Gestion des événements reçus du serveur central ───────────────────────────

async function handleCentralEvent(event) {
  switch (event.type) {

    // Message destiné à un utilisateur interne au réseau local
    case 'message:inbound':
      await relayToLocalRouter(event.payload);
      break;

    // Appel entrant vers un utilisateur interne
    case 'call:incoming':
      await relayCallSignal(event.payload);
      break;

    // Directive de changement de mode (suspension, etc.)
    case 'directive:update':
      state.directives = event.directives;
      state.orgStatus  = event.orgStatus;
      notifyLocalServices({ mode: event.orgStatus === 'active' ? 'full' : 'restricted' });
      log('info', `Directive recue : orgStatus=${event.orgStatus}`);
      break;

    default:
      log('info', `Evenement non gere : ${event.type}`);
  }
}

// ── Relai d'un message entrant vers le message-router local ───────────────────

async function relayToLocalRouter(payload) {
  try {
    await axios.post(
      `${LOCAL_MESSAGE_ROUTER}/internal/messages/deliver`,
      payload,
      { timeout: 5000 }
    );
  } catch (e) {
    log('warn', 'Echec relai message entrant :', e.message);
  }
}

// ── Relai d'un signal d'appel entrant ─────────────────────────────────────────

async function relayCallSignal(payload) {
  const LOCAL_CALL_SIGNAL = process.env.LOCAL_CALL_SIGNAL_URL || 'http://localhost:4040';
  try {
    await axios.post(
      `${LOCAL_CALL_SIGNAL}/internal/calls/incoming`,
      payload,
      { timeout: 5000 }
    );
  } catch (e) {
    log('warn', 'Echec relai signal appel :', e.message);
  }
}

// ── Reconnexion avec backoff exponentiel ──────────────────────────────────────

function scheduleReconnect() {
  setTimeout(() => {
    if (state.tunnelUp) connectWebSocket();
  }, state.reconnectDelay);
  state.reconnectDelay = Math.min(state.reconnectDelay * 2, RECONNECT_MAX_DELAY);
}

// ── API interne pour recevoir les messages sortants des utilisateurs locaux ───
// Les services locaux (message-router) appellent cette route quand un
// utilisateur local envoie un message à un utilisateur EXTERNE (hors réseau).

const http = require('http');
const AGENT_PORT = parseInt(process.env.AGENT_PORT || '8080', 10);

const server = http.createServer(async (req, res) => {
  // Vérification basique du secret interne
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SERVICES_SECRET) {
    res.writeHead(401); res.end('{"error":"unauthorized"}'); return;
  }

  if (req.method === 'POST' && req.url === '/outbound/message') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', async () => {
      try {
        const msg = JSON.parse(body);

        if (!state.tunnelUp) {
          // Tunnel down - mettre en file pour sync ultérieure
          state.pendingSync.push(msg);
          saveQueue(state.pendingSync); // Persister sur disque immédiatement
          log('info', `Message ${msg.id} mis en file (tunnel hors ligne) - total : ${state.pendingSync.length}`);
          res.writeHead(202);
          res.end(JSON.stringify({ queued: true, pending: state.pendingSync.length }));
          return;
        }

        // Tunnel up - relai immédiat vers le central
        await axios.post(
          `${CENTRAL_API_URL}/api/v1/internal/messages/relay`,
          { tenantId: TENANT_ID, controlToken: CONTROL_TOKEN, message: msg },
          { timeout: 8000 }
        );
        res.writeHead(200);
        res.end('{"ok":true}');
      } catch (e) {
        log('error', 'Erreur relai message sortant :', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status:     'ok',
      tunnel:     state.tunnelUp ? 'up' : 'down',
      orgStatus:  state.orgStatus,
      pending:    state.pendingSync.length,
      mode:       state.directives.messagingMode,
    }));
    return;
  }

  res.writeHead(404); res.end('{"error":"not_found"}');
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

async function main() {
  log('info', '='.repeat(60));
  log('info', 'Demarrage agent tenant Palabre');
  log('info', `Organisation : ${TENANT_ID}`);
  log('info', `Serveur central : ${CENTRAL_API_URL}`);
  log('info', '='.repeat(60));

  // Premier heartbeat immédiat
  await sendHeartbeat();

  // Heartbeat périodique
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  // Démarrer le serveur HTTP interne
  server.listen(AGENT_PORT, '0.0.0.0', () => {
    log('ok', `Agent HTTP interne ecoute sur le port ${AGENT_PORT}`);
  });

  // Connexion WebSocket si tunnel up
  if (state.tunnelUp) connectWebSocket();

  log('ok', 'Agent tenant demarre');
}

main().catch(err => {
  console.error('[agent] Erreur fatale au demarrage :', err);
  process.exit(1);
});
