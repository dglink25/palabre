const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/db');
const presenceService = require('./presence.service');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user, session) {
  return jwt.sign(
    { sub: user.id, sid: session.id, did: session.device_id, twoFa: session.two_factor_passed },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefreshToken(session) {
  // Le refresh token encode la session + sa famille : cela permet la rotation
  // ET la détection de réutilisation, exactement comme les clients WhatsApp/Gmail :
  // un refresh token n'est valable qu'une fois ; le réutiliser après rotation
  // révoque toute la famille de sessions (signe probable de vol de token).
  return jwt.sign(
    { sid: session.id, fam: session.refresh_family_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  );
}

/**
 * Crée une nouvelle session (= une "connexion active" visible par l'utilisateur,
 * comme les appareils listés dans WhatsApp Web ou les sessions Gmail).
 */
async function createSession({ user, deviceId, ip, userAgent, twoFactorPassed }) {
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);

  const { rows } = await pool.query(
    `INSERT INTO sessions
       (user_id, device_id, refresh_token_hash, refresh_family_id, ip_address, user_agent, two_factor_passed, expires_at)
     VALUES ($1,$2,'',$3,$4,$5,$6,$7) RETURNING *`,
    [user.id, deviceId, familyId, ip, userAgent, !!twoFactorPassed, expiresAt]
  );
  const session = rows[0];

  const refreshToken = signRefreshToken(session);
  await pool.query('UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2', [hashToken(refreshToken), session.id]);

  const accessToken = signAccessToken(user, session);
  return { session, accessToken, refreshToken };
}

/**
 * Fait tourner un refresh token : valide l'ancien, en émet un nouveau, et
 * détecte la réutilisation d'un token déjà consommé (indice de compromission).
 */
async function rotateRefreshToken(oldRefreshToken) {
  let payload;
  try {
    payload = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Refresh token invalide ou expiré.');
    err.code = 'REFRESH_INVALID';
    throw err;
  }

  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [payload.sid]);
  const session = rows[0];

  if (!session || session.status !== 'active') {
    const err = new Error('Session introuvable ou révoquée.');
    err.code = 'REFRESH_INVALID';
    throw err;
  }

  if (session.refresh_token_hash !== hashToken(oldRefreshToken)) {
    // Réutilisation détectée : on révoque toute la famille par précaution,
    // et on coupe immédiatement leur présence Redis (ne pas attendre le TTL).
    const { rows: revoked } = await pool.query(
      `UPDATE sessions SET status = 'revoked', revoked_at = now()
       WHERE refresh_family_id = $1 RETURNING user_id, device_id`,
      [session.refresh_family_id]
    );
    await Promise.all(revoked.map((r) => presenceService.setOffline(r.user_id, r.device_id)));
    const err = new Error('Réutilisation de refresh token détectée - toutes les sessions liées ont été révoquées.');
    err.code = 'REFRESH_REUSE_DETECTED';
    throw err;
  }

  const newRefreshToken = signRefreshToken(session);
  await pool.query(
    `UPDATE sessions SET refresh_token_hash = $1, last_active_at = now() WHERE id = $2`,
    [hashToken(newRefreshToken), session.id]
  );

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [session.user_id]);
  const accessToken = signAccessToken(userResult.rows[0], session);

  return { accessToken, refreshToken: newRefreshToken, session };
}

async function listSessions(userId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.device_id, s.ip_address, s.user_agent, s.location_hint, s.status,
            s.created_at, s.last_active_at, s.two_factor_passed,
            d.platform, d.model
     FROM sessions s JOIN devices d ON d.id = s.device_id
     WHERE s.user_id = $1 ORDER BY s.last_active_at DESC`,
    [userId]
  );
  return rows;
}

async function revokeSession(userId, sessionId) {
  const { rows } = await pool.query(
    `UPDATE sessions SET status = 'revoked', revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING device_id`,
    [sessionId, userId]
  );
  return rows[0] ? rows[0].device_id : null;
}

async function revokeAllSessionsExcept(userId, keepSessionId) {
  const { rows } = await pool.query(
    `UPDATE sessions SET status = 'revoked', revoked_at = now()
     WHERE user_id = $1 AND status = 'active' AND id <> $2
     RETURNING device_id`,
    [userId, keepSessionId]
  );
  return rows.map((r) => r.device_id);
}

module.exports = {
  createSession,
  rotateRefreshToken,
  listSessions,
  revokeSession,
  revokeAllSessionsExcept,
};
