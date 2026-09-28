const crypto = require('crypto');
const fetch = require('node-fetch');
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');

const CONVESSA_API_KEY = process.env.CONVESSA_API_KEY;
const CONVESSA_API_URL = process.env.CONVESSA_API_URL;

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS || '300', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const RESEND_COOLDOWN = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

function generateCode() {
  const max = 10 ** OTP_LENGTH;
  const code = crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
  return code;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function convessaSend(to, message) {
  const res = await fetch(`${CONVESSA_API_URL}/api/v1/send`, {
    method: 'POST',
    headers: { 'X-Api-Key': CONVESSA_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Erreur Convessa ${res.status}`);
  }
  return data;
}

/**
 * Génère un OTP, le stocke (haché) et l'envoie par WhatsApp via Convessa.
 * purpose: 'register' | 'login' | 'recovery' | 'link'
 * ttlSecondsOverride : permet à un appelant (ex. flux super-admin, 3 min)
 * d'imposer une durée de validité différente du défaut global.
 */
async function sendOtp(phoneE164, purpose, ttlSecondsOverride) {
  const ttlSeconds = ttlSecondsOverride || OTP_TTL_SECONDS;
  const cooldownKey = `otp:cooldown:${phoneE164}:${purpose}`;
  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) {
    const ttl = await redis.ttl(cooldownKey);
    const err = new Error('Veuillez patienter avant de redemander un code.');
    err.code = 'OTP_COOLDOWN';
    err.retryAfterSeconds = ttl;
    throw err;
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const { rows } = await pool.query(
    `INSERT INTO phone_verifications (phone_e164, purpose, code_hash, max_attempts, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [phoneE164, purpose, codeHash, OTP_MAX_ATTEMPTS, expiresAt]
  );

  const message = `*Palabre - Code de vérification*\n\nVotre code : *${code}*\n\nSaisissez ce code dans l'application pour vérifier votre compte. Il expire dans ${Math.round(ttlSeconds / 60)} minutes.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`;
  const sendResult = await convessaSend(phoneE164, message);

  await pool.query(
    'UPDATE phone_verifications SET whatsapp_message_id = $1 WHERE id = $2',
    [sendResult.messageId || sendResult.id || null, rows[0].id]
  );

  await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN);

  return { verificationId: rows[0].id, expiresAt };
}

/**
 * Vérifie un code OTP saisi par l'utilisateur pour un numéro + un but donnés.
 * Retourne true si valide (et marque le code comme consommé), sinon lève une erreur.
 */
async function verifyOtp(phoneE164, purpose, code) {
  const { rows } = await pool.query(
    `SELECT * FROM phone_verifications
     WHERE phone_e164 = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [phoneE164, purpose]
  );

  const record = rows[0];
  if (!record) {
    const err = new Error('Aucun code en attente pour ce numéro.');
    err.code = 'OTP_NOT_FOUND';
    throw err;
  }

  if (new Date(record.expires_at) < new Date()) {
    const err = new Error('Le code a expiré.');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  if (record.attempts >= record.max_attempts) {
    const err = new Error('Nombre maximal de tentatives atteint.');
    err.code = 'OTP_LOCKED';
    throw err;
  }

  const isValid = record.code_hash === hashCode(code);

  if (!isValid) {
    await pool.query('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    const err = new Error('Code incorrect.');
    err.code = 'OTP_INVALID';
    throw err;
  }

  await pool.query('UPDATE phone_verifications SET consumed_at = now() WHERE id = $1', [record.id]);
  return true;
}

module.exports = { sendOtp, verifyOtp, convessaSend };
