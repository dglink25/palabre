// backend/src/modules/developer/developer.middleware.js
const crypto = require('crypto');
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');

/**
 * Charge statsService de façon lazy pour éviter les erreurs si le fichier
 * n'existe pas encore au démarrage.
 */
function getStatsService() {
  try {
    return require('./stats.service');
  } catch {
    return null;
  }
}


async function requireApiKey(req, res, next) {
  const rawKey = req.headers['x-palabre-key'];
  if (!rawKey) {
    return res.status(401).json({
      error: { code: 'NO_API_KEY', message: 'En-tête X-Palabre-Key manquant.' },
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT k.id, k.project_id, k.status, p.status AS project_status
       FROM developer_api_keys k
       JOIN developer_projects p ON p.id = k.project_id
       WHERE k.key_value = $1 AND k.key_type = 'publishable'
       LIMIT 1`,
      [rawKey]
    );

    const row = rows[0];

    // Clé active et projet actif → accès autorisé
    if (row && row.status === 'active' && row.project_status === 'active') {
      req.projectId  = row.project_id;
      req.apiKeyId   = row.id;
      req.apiKeyType = 'publishable';

      // Mise à jour asynchrone de last_used_at (non bloquante)
      pool.query(
        'UPDATE developer_api_keys SET last_used_at = now() WHERE id = $1',
        [row.id]
      ).catch(() => {});

      return rateLimiter(req, res, next);
    }

    // Clé révoquée → vérification de la grace period Redis
    if (row && row.status === 'revoked') {
      const graceKey = `keyrotation:grace:${rawKey}`;
      const graceProjectId = await redis.get(graceKey);
      if (graceProjectId) {
        req.projectId  = graceProjectId;
        req.apiKeyId   = row.id;
        req.apiKeyType = 'publishable';
        return rateLimiter(req, res, next);
      }
    }

    return res.status(401).json({
      error: { code: 'INVALID_API_KEY', message: 'Clé API invalide ou révoquée.' },
    });
  } catch (err) {
    console.error('[developer.middleware] requireApiKey error:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
}


async function requireSecretKey(req, res, next) {
  const rawKey = req.headers['x-palabre-secret'];
  if (!rawKey) {
    return res.status(401).json({
      error: { code: 'NO_SECRET_KEY', message: 'En-tête X-Palabre-Secret manquant.' },
    });
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    const { rows } = await pool.query(
      `SELECT k.id, k.project_id, k.status, p.status AS project_status
       FROM developer_api_keys k
       JOIN developer_projects p ON p.id = k.project_id
       WHERE k.key_value = $1 AND k.key_type = 'secret'
       LIMIT 1`,
      [keyHash]
    );

    const row = rows[0];

    // Clé active et projet actif → accès autorisé
    if (row && row.status === 'active' && row.project_status === 'active') {
      req.projectId  = row.project_id;
      req.apiKeyId   = row.id;
      req.apiKeyType = 'secret';

      // Mise à jour asynchrone de last_used_at (non bloquante)
      pool.query(
        'UPDATE developer_api_keys SET last_used_at = now() WHERE id = $1',
        [row.id]
      ).catch(() => {});

      return rateLimiter(req, res, next);
    }

    // Clé révoquée → vérification de la grace period Redis (la grace est stockée sur le hash)
    if (row && row.status === 'revoked') {
      const graceKey = `keyrotation:grace:${keyHash}`;
      const graceProjectId = await redis.get(graceKey);
      if (graceProjectId) {
        req.projectId  = graceProjectId;
        req.apiKeyId   = row.id;
        req.apiKeyType = 'secret';
        return rateLimiter(req, res, next);
      }
    }

    return res.status(401).json({
      error: { code: 'INVALID_SECRET_KEY', message: 'Clé secrète invalide ou révoquée.' },
    });
  } catch (err) {
    console.error('[developer.middleware] requireSecretKey error:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
}


async function rateLimiter(req, res, next) {
  const minuteBucket = Math.floor(Date.now() / 60000);
  const redisKey = `ratelimit:${req.projectId}:${minuteBucket}`;

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // Positionner le TTL uniquement lors de la première incrémentation
      await redis.expire(redisKey, 120);
    }

    if (count > 1000) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Limite de 1000 requêtes/minute dépassée.',
        },
        retryAfter: 60 - (Math.floor(Date.now() / 1000) % 60),
      });
    }

    return next();
  } catch (err) {
    // En cas d'erreur Redis, on laisse passer la requête (fail-open)
    console.error('[developer.middleware] rateLimiter error:', err.message);
    return next();
  }
}

function logApiCall(eventType) {
  return (req, res, next) => {
    const statsService = getStatsService();
    if (statsService) {
      statsService
        .increment(req.projectId, eventType, { endpoint: req.path })
        .catch(() => {});
    }
    next();
  };
}

module.exports = { requireApiKey, requireSecretKey, rateLimiter, logApiCall };
