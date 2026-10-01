'use strict';

/**
 * Support Call Service — Appels audio du service client
 *
 * Gère le cycle de vie des Support_Calls :
 * initiateCall → queued → (hold ↔ active) → ended
 *
 * Les appels sont exclusivement audio (aucun flux vidéo via ce canal).
 * Tous les échanges transitent par le Central_Server.
 */

const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const queue = require('./support.queue.service');
const supportService = require('./support.service');

const QUEUE_TIMEOUT_SECONDS = parseInt(process.env.SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS || '600', 10); // 10 min
const QUEUE_MAX             = parseInt(process.env.SUPPORT_CALL_QUEUE_MAX || '10', 10);

// ── Helpers erreurs ───────────────────────────────────────────────────────────

function notFound(msg = 'Appel introuvable.') {
  const err = new Error(msg);
  err.code       = 'CALL_NOT_FOUND';
  err.httpStatus = 404;
  return err;
}

function conflict(msg, code = 'CONFLICT') {
  const err = new Error(msg);
  err.code       = code;
  err.httpStatus = 409;
  return err;
}

function forbidden(msg, code = 'FORBIDDEN') {
  const err = new Error(msg);
  err.code       = code;
  err.httpStatus = 403;
  return err;
}

// ── Initier un appel ──────────────────────────────────────────────────────────

/**
 * Lance un Support_Call depuis une session active.
 * Vérifie la disponibilité du super-admin et la capacité de la Call_Queue.
 */
async function initiateCall(sessionId, userId) {
  // Vérifier la session
  const { rows: sessionRows } = await pool.query(
    `SELECT id, user_id, status FROM support_sessions WHERE id = $1 AND status = 'open'`,
    [sessionId]
  );
  if (!sessionRows[0] || sessionRows[0].user_id !== userId) {
    throw notFound('Session de support introuvable ou fermée.');
  }

  // Vérifier qu'aucun appel actif ou en file n'existe déjà pour cet utilisateur
  const existingCallId = await queue.getUserActiveCallId(userId);
  if (existingCallId) {
    throw conflict('Vous avez déjà un appel en cours.', 'CALL_ALREADY_ACTIVE');
  }

  // Vérifier si super-admin en ligne
  const status = await queue.getQueueStatus();
  if (!status.adminOnline) {
    // Super-admin hors ligne → envoyer un message système dans le chat
    const sysMsg = await supportService.saveMessage({
      sessionId,
      senderId:   userId,
      senderType: 'user',
      ciphertext: JSON.stringify({ text: 'Le service client vocal est temporairement indisponible. Veuillez utiliser la messagerie.' }),
      type:       'system',
      clientTs:   Date.now(),
    });
    await redis.publish('support:message:new', JSON.stringify({
      sessionId,
      message: sysMsg,
      targetType: 'user',
    }));

    const err = new Error('Service vocal indisponible. Le super-administrateur est hors ligne.');
    err.code       = 'ADMIN_OFFLINE';
    err.httpStatus = 503;
    return { unavailable: true, message: err.message };
  }

  // Vérifier la capacité de la file
  if (status.queueLength >= QUEUE_MAX) {
    const err = new Error('Toutes les lignes sont occupées. Veuillez utiliser la messagerie ou réessayer dans quelques minutes.');
    err.code       = 'QUEUE_FULL';
    err.httpStatus = 503;
    throw err;
  }

  // Créer l'enregistrement de l'appel en BDD
  const { rows } = await pool.query(
    `INSERT INTO support_calls (session_id, user_id, status, queued_at)
     VALUES ($1, $2, 'queued', now())
     RETURNING id, session_id, user_id, status, initiated_at, queued_at`,
    [sessionId, userId]
  );
  const call = rows[0];

  // Enregistrer dans la queue Redis
  const position = await queue.enqueue(call.id, userId, sessionId);

  // Démarrer le timer de timeout automatique
  _scheduleQueueTimeout(call.id, sessionId, userId);

  await supportService.auditLog({ sessionId, userId, action: 'CALL_INITIATED', metadata: { callId: call.id } });

  return {
    callId:   call.id,
    status:   'queued',
    position,
    estimatedWaitMinutes: status.estimatedWaitMinutes + 5,
  };
}

// ── Décrocher un appel ────────────────────────────────────────────────────────

/**
 * Le super-admin décroche un appel spécifique.
 * Met automatiquement en hold l'appel actif courant.
 */
async function answerCall(callId, adminUserId) {
  const call = await _getCallOrThrow(callId);

  if (!['queued', 'ringing'].includes(call.status)) {
    throw conflict('Cet appel ne peut pas être décroché dans son état actuel.', 'INVALID_CALL_STATE');
  }

  // Mettre en hold l'appel courant et activer le nouveau
  const currentCallId = await queue.getCurrentCallId();
  await queue.answerSpecific(callId, currentCallId || null);

  // Mettre à jour la BDD
  await pool.query(
    `UPDATE support_calls
     SET status = 'active', answered_at = now(), queue_position = NULL, updated_at = now()
     WHERE id = $1`,
    [callId]
  );

  // Si l'appel courant était actif, le passer en hold en BDD aussi
  if (currentCallId && currentCallId !== callId) {
    await pool.query(
      `UPDATE support_calls
       SET status = 'hold', hold_started_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'active'`,
      [currentCallId]
    );
  }

  await supportService.auditLog({
    sessionId: call.session_id,
    userId:    adminUserId,
    action:    'CALL_ANSWERED',
    metadata:  { callId },
  });

  return { callId, status: 'active', sessionId: call.session_id };
}

// ── Mettre en attente / Reprendre ─────────────────────────────────────────────

/**
 * Met l'appel actif en Hold_State.
 */
async function holdCall(callId, adminUserId) {
  const call = await _getCallOrThrow(callId);

  if (call.status !== 'active') {
    throw conflict('Seul un appel actif peut être mis en attente.', 'INVALID_CALL_STATE');
  }

  await queue.putOnHold(callId);

  await pool.query(
    `UPDATE support_calls
     SET status = 'hold', hold_started_at = now(), updated_at = now()
     WHERE id = $1`,
    [callId]
  );

  await supportService.auditLog({
    sessionId: call.session_id,
    userId:    adminUserId,
    action:    'CALL_HOLD',
    metadata:  { callId },
  });

  return { callId, status: 'hold' };
}

/**
 * Reprend un appel en Hold_State.
 */
async function resumeCall(callId, adminUserId) {
  const call = await _getCallOrThrow(callId);

  if (call.status !== 'hold') {
    throw conflict('Seul un appel en attente peut être repris.', 'INVALID_CALL_STATE');
  }

  await queue.resumeFromHold(callId);

  await pool.query(
    `UPDATE support_calls
     SET status = 'active', hold_started_at = NULL, updated_at = now()
     WHERE id = $1`,
    [callId]
  );

  // Si un autre appel était actif, il est passé en hold — mettre à jour la BDD
  const newCurrent = await queue.getCurrentCallId();
  if (newCurrent !== callId) {
    await pool.query(
      `UPDATE support_calls
       SET status = 'hold', hold_started_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'active'`,
      [newCurrent]
    );
  }

  await supportService.auditLog({
    sessionId: call.session_id,
    userId:    adminUserId,
    action:    'CALL_RESUMED',
    metadata:  { callId },
  });

  return { callId, status: 'active' };
}

// ── Terminer un appel ─────────────────────────────────────────────────────────

/**
 * Termine un appel (côté utilisateur ou super-admin).
 */
async function endCall(callId, actorUserId, reason = 'user_hangup') {
  const call = await _getCallOrThrow(callId, true /* allow already ended */);

  if (call.status === 'ended') {
    return { callId, status: 'ended', alreadyEnded: true };
  }

  const durationSeconds = call.answered_at
    ? Math.floor((Date.now() - new Date(call.answered_at).getTime()) / 1000)
    : 0;

  await queue.terminateCall(callId, reason);

  await pool.query(
    `UPDATE support_calls
     SET status = 'ended', end_reason = $2, ended_at = now(),
         duration_seconds = $3, updated_at = now()
     WHERE id = $1`,
    [callId, reason, durationSeconds]
  );

  await supportService.auditLog({
    sessionId: call.session_id,
    userId:    actorUserId,
    action:    'CALL_ENDED',
    metadata:  { callId, reason, durationSeconds },
  });

  return { callId, status: 'ended', durationSeconds };
}

// ── Timeout automatique de file d'attente ─────────────────────────────────────

/**
 * Lance un timer. Si l'appel est toujours en file après QUEUE_TIMEOUT_SECONDS,
 * envoie un message système et retire l'utilisateur de la file.
 */
function _scheduleQueueTimeout(callId, sessionId, userId) {
  setTimeout(async () => {
    try {
      const { rows } = await pool.query(
        `SELECT status FROM support_calls WHERE id = $1`,
        [callId]
      );
      if (!rows[0] || rows[0].status !== 'queued') return;

      // Encore en file après le timeout → sortir de la file
      await endCall(callId, userId, 'timeout');

      // Envoyer un message système dans le chat
      const sysMsg = await supportService.saveMessage({
        sessionId,
        senderId:   userId,
        senderType: 'user',
        ciphertext: JSON.stringify({
          text: 'Votre temps d\'attente a expiré. Vous avez été retiré de la file. Laissez-nous un message et nous vous rappellerons.',
        }),
        type:     'system',
        clientTs: Date.now(),
      });

      await redis.publish('support:message:new', JSON.stringify({
        sessionId,
        message: sysMsg,
        targetType: 'user',
      }));

    } catch (err) {
      console.error('[support:call] queue timeout error:', err.message);
    }
  }, QUEUE_TIMEOUT_SECONDS * 1000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _getCallOrThrow(callId, allowEnded = false) {
  const { rows } = await pool.query(
    `SELECT id, session_id, user_id, status, queue_position,
            initiated_at, queued_at, answered_at, hold_started_at, ended_at
     FROM support_calls
     WHERE id = $1`,
    [callId]
  );

  if (!rows[0]) throw notFound();
  if (!allowEnded && rows[0].status === 'ended') {
    throw conflict('Cet appel est déjà terminé.', 'CALL_ALREADY_ENDED');
  }

  return rows[0];
}

/**
 * Récupère les détails de l'appel actif d'une session.
 */
async function getActiveCallForSession(sessionId) {
  const { rows } = await pool.query(
    `SELECT id, session_id, user_id, status, queue_position,
            initiated_at, queued_at, answered_at, hold_started_at, ended_at, duration_seconds
     FROM support_calls
     WHERE session_id = $1
       AND status IN ('queued', 'ringing', 'active', 'hold')
     ORDER BY initiated_at DESC
     LIMIT 1`,
    [sessionId]
  );
  return rows[0] || null;
}

module.exports = {
  initiateCall,
  answerCall,
  holdCall,
  resumeCall,
  endCall,
  getActiveCallForSession,
  QUEUE_MAX,
  QUEUE_TIMEOUT_SECONDS,
};
