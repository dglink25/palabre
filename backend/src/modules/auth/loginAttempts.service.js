const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');

const MAX_FAILURES = parseInt(process.env.LOGIN_MAX_FAILURES || '8', 10);
const LOCKOUT_WINDOW_SECONDS = parseInt(process.env.LOGIN_LOCKOUT_WINDOW_SECONDS || '900', 10); // 15 min

function counterKey(identifier) {
  return `login:failures:${identifier}`;
}

/**
 * À appeler avant toute tentative de connexion : bloque si trop d'échecs
 * récents pour cet identifiant (numéro, provider_uid...), quel que soit
 * l'appareil ou l'IP d'origine.
 */
async function assertNotLocked(identifier) {
  const failures = await redis.get(counterKey(identifier));
  if (failures && parseInt(failures, 10) >= MAX_FAILURES) {
    const ttl = await redis.ttl(counterKey(identifier));
    const err = new Error('Trop de tentatives échouées. Réessayez plus tard.');
    err.code = 'TOO_MANY_ATTEMPTS';
    err.httpStatus = 429;
    err.retryAfterSeconds = ttl > 0 ? ttl : LOCKOUT_WINDOW_SECONDS;
    throw err;
  }
}

async function record({ identifier, method, ip, success }) {
  await pool.query(
    `INSERT INTO login_attempts (identifier, method, ip_address, success) VALUES ($1,$2,$3,$4)`,
    [identifier, method, ip || null, success]
  );

  if (success) {
    await redis.del(counterKey(identifier));
  } else {
    const key = counterKey(identifier);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, LOCKOUT_WINDOW_SECONDS);
  }
}

module.exports = { assertNotLocked, record };
