'use strict';

/**
 * FCM Service — envoi de notifications push Firebase Cloud Messaging.
 * Utilise Firebase Admin SDK (déjà initialisé pour l'auth fédérée).
 *
 * Appelé après chaque insertion de message, appel entrant, etc.
 */

const { initFirebase } = require('../../config/firebase');
const { pool } = require('../../config/db');

/**
 * Récupère les tokens FCM d'un utilisateur stockés dans preferences.fcmTokens.
 */
async function getUserFcmTokens(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT preferences->'fcmTokens' AS tokens FROM users WHERE id = $1`,
      [userId]
    );
    const tokens = rows[0]?.tokens;
    if (!Array.isArray(tokens)) return [];
    return tokens.map(t => t.token).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Envoie une notification push à un utilisateur.
 * Non bloquant — les erreurs sont loguées sans faire échouer l'appelant.
 *
 * @param {string} userId — ID de l'utilisateur destinataire
 * @param {{ title, body, data }} notification — contenu de la notif
 */
async function sendPushNotification(userId, { title, body, data = {} }) {
  const tokens = await getUserFcmTokens(userId);
  if (tokens.length === 0) return;

  let admin;
  try {
    admin = initFirebase();
  } catch {
    return; // Firebase non configuré — ignorer silencieusement
  }

  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    webpush: {
      notification: {
        title,
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        requireInteraction: false,
        tag: data.conversationId || data.callId || 'palabre',
      },
      fcm_options: { link: data.url || '/app/conversations' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    // Nettoyer les tokens invalides
    const invalidTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && ['registration-token-not-registered', 'invalid-registration-token'].includes(r.error?.code)) {
        invalidTokens.push(tokens[i]);
      }
    });
    if (invalidTokens.length > 0) {
      await _removeInvalidTokens(userId, invalidTokens);
    }
  } catch (err) {
    console.warn('[fcm] Erreur envoi notification:', err.message);
  }
}

async function _removeInvalidTokens(userId, invalidTokens) {
  try {
    // Retirer les tokens invalides du tableau preferences.fcmTokens
    await pool.query(
      `UPDATE users
       SET preferences = jsonb_set(
         preferences,
         '{fcmTokens}',
         COALESCE(
           (SELECT jsonb_agg(t) FROM jsonb_array_elements(preferences->'fcmTokens') t
            WHERE NOT (t->>'token' = ANY($1))),
           '[]'::jsonb
         )
       )
       WHERE id = $2`,
      [invalidTokens, userId]
    );
  } catch { /* ignore */ }
}

module.exports = { sendPushNotification, getUserFcmTokens };
