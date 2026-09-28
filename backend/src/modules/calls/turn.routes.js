/**
 * Route TURN credentials — génère des identifiants éphémères pour Coturn.
 *
 * Authentification REST API de Coturn :
 *   username = "<timestamp_expiry>:<user_id>"
 *   password = base64(HMAC-SHA1(TURN_SECRET, username))
 *
 * Le client WebRTC utilise ces credentials pour se connecter au TURN.
 * Ils expirent après TTL_SECONDS (défaut 3600s = 1h).
 * Le serveur TURN vérifie lui-même l'expiration sans appel au backend.
 *
 * GET /api/v1/calls/turn-credentials
 */

const express = require('express');
const crypto  = require('crypto');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

const TURN_SECRET  = process.env.TURN_SECRET  || 'change_me_turn_secret';
const TURN_HOST    = process.env.TURN_HOST    || 'localhost';
const TURN_PORT    = process.env.TURN_PORT    || '3478';
const TURN_TLS_PORT = process.env.TURN_TLS_PORT || '5349';
const TTL_SECONDS  = 3600; // 1 heure

router.get('/turn-credentials', requireAuth, (req, res) => {
  const expiry   = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const username = `${expiry}:${req.user.id}`;
  const password = crypto
    .createHmac('sha1', TURN_SECRET)
    .update(username)
    .digest('base64');

  res.json({
    iceServers: [
      // STUN gratuit (fallback, 0 bande passante serveur)
      { urls: 'stun:stun.l.google.com:19302' },
      // STUN auto-hébergé
      { urls: `stun:${TURN_HOST}:${TURN_PORT}` },
      // TURN UDP (principal)
      {
        urls:       `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
        username,
        credential: password,
      },
      // TURN TCP (fallback si UDP bloqué)
      {
        urls:       `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
        username,
        credential: password,
      },
      // TURN TLS (fallback dernier recours, port 443 souvent ouvert)
      {
        urls:       `turns:${TURN_HOST}:${TURN_TLS_PORT}`,
        username,
        credential: password,
      },
    ],
    ttl: TTL_SECONDS,
  });
});

module.exports = router;
