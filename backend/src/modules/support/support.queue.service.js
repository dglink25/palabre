'use strict';

/**
 * Support Queue Service — File d'attente des appels du service client
 *
 * Utilise Redis pour gérer :
 * - support:call_queue  → liste FIFO des callIds en attente (RPUSH/LPOP)
 * - support:call:<id>   → métadonnées JSON d'un appel (userId, sessionId, ts)
 * - support:admin:current_call → callId de l'appel actif du super-admin
 * - support:admin:hold_calls   → ensemble des callIds en Hold_State
 * - support:admin:online       → 1 si super-admin disponible
 */

const { redis } = require('../../config/redis');

const QUEUE_KEY          = 'support:call_queue';
const CURRENT_CALL_KEY   = 'support:admin:current_call';
const HOLD_CALLS_KEY     = 'support:admin:hold_calls';
const ADMIN_ONLINE_KEY   = 'support:admin:online';

function callMetaKey(callId)  { return `support:call:${callId}`; }
function callUserKey(userId)  { return `support:user_call:${userId}`; }

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCallMeta(callId) {
  const raw = await redis.get(callMetaKey(callId));
  return raw ? JSON.parse(raw) : null;
}

async function setCallMeta(callId, meta) {
  // TTL 4h — nettoyage automatique si l'appel reste bloqué
  await redis.set(callMetaKey(callId), JSON.stringify(meta), 'EX', 14400);
}

async function deleteCallMeta(callId) {
  await redis.del(callMetaKey(callId));
}

// ── Statut du service ─────────────────────────────────────────────────────────

/**
 * Retourne l'état actuel du service client.
 * Utilisé par GET /api/v1/support/status
 */
async function getQueueStatus() {
  const [adminOnline, queueLen, currentCall] = await Promise.all([
    redis.get(ADMIN_ONLINE_KEY),
    redis.llen(QUEUE_KEY),
    redis.get(CURRENT_CALL_KEY),
  ]);

  const available    = !!adminOnline && !currentCall;
  const queueLength  = queueLen || 0;
  // Estimation simple : 5 min par appel en attente + 2 min si admin occupé
  const estimatedWaitMinutes = (available ? 0 : 2) + queueLength * 5;

  return {
    available,
    adminOnline: !!adminOnline,
    currentCallId: currentCall || null,
    queueLength,
    estimatedWaitMinutes,
  };
}

/**
 * Marque le super-admin comme en ligne (appelé à sa connexion WebSocket).
 */
async function setAdminOnline(online = true) {
  if (online) {
    await redis.set(ADMIN_ONLINE_KEY, '1', 'EX', 86400); // expire après 24h sans heartbeat
  } else {
    await redis.del(ADMIN_ONLINE_KEY);
  }
}

/**
 * Renouvelle le heartbeat du super-admin (appelé périodiquement).
 */
async function renewAdminHeartbeat() {
  await redis.set(ADMIN_ONLINE_KEY, '1', 'EX', 86400);
}

// ── File d'attente ────────────────────────────────────────────────────────────

/**
 * Ajoute un appel à la Call_Queue.
 * Retourne la position dans la file (1-indexed).
 */
async function enqueue(callId, userId, sessionId) {
  const ts   = Date.now();
  const meta = { callId, userId, sessionId, enqueuedAt: ts };

  await setCallMeta(callId, meta);
  await redis.rpush(QUEUE_KEY, callId);
  await redis.set(callUserKey(userId), callId, 'EX', 14400);

  const position = await redis.lpos(QUEUE_KEY, callId);
  const queue    = await getFullQueue();

  // Publier les nouvelles positions à tous les clients en attente
  await notifyQueuePositions(queue);
  // Notifier le super-admin d'un nouvel appel entrant
  await redis.publish('support:call:incoming', JSON.stringify(meta));

  return (position !== null ? position : 0) + 1;
}

/**
 * Retire un appel de la file (raccrochage avant d'être pris en charge).
 */
async function dequeue(callId) {
  await redis.lrem(QUEUE_KEY, 0, callId);
  await deleteCallMeta(callId);

  const queue = await getFullQueue();
  await notifyQueuePositions(queue);
}

/**
 * Prend le prochain appel en file d'attente.
 * Met automatiquement l'appel actif courant en Hold_State.
 * Retourne le callId du nouvel appel actif ou null si file vide.
 */
async function answerNext(adminCurrentCallId = null) {
  const nextCallId = await redis.lpop(QUEUE_KEY);
  if (!nextCallId) return null;

  // Mettre en hold l'appel actif si besoin
  if (adminCurrentCallId) {
    await putOnHold(adminCurrentCallId);
  }

  // Définir le nouvel appel comme appel actif
  await redis.set(CURRENT_CALL_KEY, nextCallId);

  const meta  = await getCallMeta(nextCallId);
  const queue = await getFullQueue();

  // Notifier le client que son appel est décroché
  await redis.publish('support:call:answered', JSON.stringify({ callId: nextCallId, meta }));

  // Mettre à jour les positions restantes
  await notifyQueuePositions(queue);

  return { callId: nextCallId, meta };
}

/**
 * Répond à un appel spécifique depuis la file (pas forcément le premier).
 */
async function answerSpecific(targetCallId, adminCurrentCallId = null) {
  await redis.lrem(QUEUE_KEY, 0, targetCallId);

  // Mettre en hold l'appel actif si besoin
  if (adminCurrentCallId) {
    await putOnHold(adminCurrentCallId);
  }

  await redis.set(CURRENT_CALL_KEY, targetCallId);

  const meta  = await getCallMeta(targetCallId);
  const queue = await getFullQueue();

  await redis.publish('support:call:answered', JSON.stringify({ callId: targetCallId, meta }));
  await notifyQueuePositions(queue);

  return { callId: targetCallId, meta };
}

// ── Hold/Resume ───────────────────────────────────────────────────────────────

/**
 * Met un appel actif en Hold_State.
 */
async function putOnHold(callId) {
  await redis.sadd(HOLD_CALLS_KEY, callId);

  // Si c'était l'appel courant, le retirer de current_call
  const current = await redis.get(CURRENT_CALL_KEY);
  if (current === callId) {
    await redis.del(CURRENT_CALL_KEY);
  }

  const meta = await getCallMeta(callId);
  await redis.publish('support:call:hold', JSON.stringify({ callId, meta }));
}

/**
 * Reprend un appel en Hold_State.
 * Met automatiquement en hold l'appel actif courant si présent.
 */
async function resumeFromHold(callId) {
  const current = await redis.get(CURRENT_CALL_KEY);

  // Mettre l'appel courant en hold avant de reprendre celui-ci
  if (current && current !== callId) {
    await putOnHold(current);
  }

  await redis.srem(HOLD_CALLS_KEY, callId);
  await redis.set(CURRENT_CALL_KEY, callId);

  const meta = await getCallMeta(callId);
  await redis.publish('support:call:resumed', JSON.stringify({ callId, meta }));

  return { callId, meta };
}

/**
 * Termine un appel (clôture définitive).
 */
async function terminateCall(callId, reason = 'user_hangup') {
  // Retirer de la queue si encore dedans
  await redis.lrem(QUEUE_KEY, 0, callId);
  // Retirer du hold si en hold
  await redis.srem(HOLD_CALLS_KEY, callId);
  // Retirer de current si actif
  const current = await redis.get(CURRENT_CALL_KEY);
  if (current === callId) {
    await redis.del(CURRENT_CALL_KEY);
  }

  const meta = await getCallMeta(callId);
  if (meta) {
    await redis.del(callUserKey(meta.userId));
  }

  await deleteCallMeta(callId);

  const queue = await getFullQueue();
  await notifyQueuePositions(queue);

  await redis.publish('support:call:ended', JSON.stringify({ callId, reason }));
}

// ── Getters ───────────────────────────────────────────────────────────────────

async function getFullQueue() {
  return redis.lrange(QUEUE_KEY, 0, -1);
}

async function getHoldCalls() {
  return redis.smembers(HOLD_CALLS_KEY);
}

async function getCurrentCallId() {
  return redis.get(CURRENT_CALL_KEY);
}

/**
 * Récupère l'appel actif d'un utilisateur s'il existe.
 */
async function getUserActiveCallId(userId) {
  return redis.get(callUserKey(userId));
}

/**
 * Retourne la position d'un callId dans la file (1-indexed), ou null si absent.
 */
async function getQueuePosition(callId) {
  const pos = await redis.lpos(QUEUE_KEY, callId);
  return pos !== null ? pos + 1 : null;
}

// ── Notifications internes ────────────────────────────────────────────────────

/**
 * Publie un update de position pour chaque appelant en file.
 * Chaque message contient { callId, userId, position, estimatedWaitMinutes }.
 */
async function notifyQueuePositions(queue) {
  if (!queue || queue.length === 0) return;

  const updates = [];
  for (let i = 0; i < queue.length; i++) {
    const callId = queue[i];
    const meta   = await getCallMeta(callId);
    if (!meta) continue;
    updates.push({
      callId,
      userId:  meta.userId,
      position: i + 1,
      estimatedWaitMinutes: (i + 1) * 5,
    });
  }

  if (updates.length > 0) {
    await redis.publish('support:queue:update', JSON.stringify({ updates }));
  }
}

module.exports = {
  enqueue,
  dequeue,
  answerNext,
  answerSpecific,
  putOnHold,
  resumeFromHold,
  terminateCall,
  getQueueStatus,
  getFullQueue,
  getHoldCalls,
  getCurrentCallId,
  getUserActiveCallId,
  getQueuePosition,
  setAdminOnline,
  renewAdminHeartbeat,
  getCallMeta,
};
