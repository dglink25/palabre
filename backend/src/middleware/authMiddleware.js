const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { redis } = require('../config/redis');
const sessionService = require('../modules/sessions/session.service');
const presenceService = require('../modules/sessions/presence.service');

// Déconnexion automatique après inactivité - demandée UNIQUEMENT pour le
// super-administrateur (les utilisateurs normaux restent connectés tant
// qu'ils envoient un heartbeat, voir presence.service.js). Contrairement au
// heartbeat (déclenché par le client), ce compteur est renouvelé par
// TOUTE requête authentifiée du super-admin : 15 minutes sans le moindre
// appel API = déconnexion forcée, pas seulement sans heartbeat explicite.
const SUPER_ADMIN_IDLE_TIMEOUT_SECONDS = parseInt(process.env.SUPER_ADMIN_IDLE_TIMEOUT_SECONDS || '900', 10);

function superAdminIdleKey(sessionId) {
  return `super_admin:idle:${sessionId}`;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: 'NO_TOKEN', message: 'Jeton d\'accès manquant.' } });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).json({ error: { code: 'TOKEN_INVALID', message: 'Jeton d\'accès invalide ou expiré.' } });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
  if (!rows[0]) {
    return res.status(401).json({ error: { code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable.' } });
  }
  const user = rows[0];

  if (user.is_super_admin) {
    const idleKey = superAdminIdleKey(payload.sid);
    const stillActive = await redis.exists(idleKey);
    if (!stillActive) {
      // Plus de 15 minutes sans requête : on révoque la session pour de bon
      // (pas seulement un refus ponctuel) - la prochaine action exigera une
      // reconnexion complète, y compris le parcours renforcé si via Google.
      await sessionService.revokeSession(user.id, payload.sid);
      await presenceService.setOffline(user.id, payload.did);
      return res.status(401).json({
        error: { code: 'SUPER_ADMIN_IDLE_TIMEOUT', message: 'Session super-administrateur expirée après 15 minutes d\'inactivité. Reconnectez-vous.' },
      });
    }
    // Requête active : on renouvelle la fenêtre de 15 minutes.
    await redis.set(idleKey, '1', 'EX', SUPER_ADMIN_IDLE_TIMEOUT_SECONDS);
  }

  req.user = user;
  req.sessionId = payload.sid;
  req.deviceId = payload.did;
  req.twoFactorPassed = payload.twoFa;
  next();
}

/**
 * À appeler juste après avoir émis les jetons d'une session super-admin
 * (connexion initiale) pour amorcer la fenêtre d'inactivité de 15 minutes -
 * sans quoi la toute première requête suivant la connexion échouerait faute
 * de clé Redis existante.
 */
async function armSuperAdminIdleTimeout(sessionId) {
  await redis.set(superAdminIdleKey(sessionId), '1', 'EX', SUPER_ADMIN_IDLE_TIMEOUT_SECONDS);
}

/**
 * À utiliser après requireAuth sur les routes sensibles : exige que la
 * vérification biométrique (2FA) ait été validée pour la session en cours,
 * quel que soit le mode de connexion initial.
 */
function requireTwoFactorIfEnabled(req, res, next) {
  if (req.user.two_factor_enabled && !req.twoFactorPassed) {
    return res.status(403).json({
      error: { code: 'TWO_FACTOR_REQUIRED', message: 'Vérification en deux étapes requise pour cette session.' },
    });
  }
  next();
}

module.exports = { requireAuth, requireTwoFactorIfEnabled, armSuperAdminIdleTimeout, SUPER_ADMIN_IDLE_TIMEOUT_SECONDS };
