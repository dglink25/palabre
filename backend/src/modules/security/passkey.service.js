const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');

/**
 * ======================================================================
 * PASSKEYS (WebAuthn) - authentification et 2FA "comme sur GitHub"
 * ======================================================================
 * Un passkey est une paire de clés générée et gardée par l'authentificateur
 * (Touch ID, Windows Hello, clé de sécurité, ou le trousseau du téléphone) :
 * la clé privée ne quitte JAMAIS l'appareil. Le serveur ne stocke que la
 * clé publique et vérifie une signature à chaque connexion - c'est le
 * standard W3C WebAuthn, implémenté ici via la bibliothèque de référence
 * @simplewebauthn/server plutôt qu'à la main (la validation CBOR/COSE et la
 * vérification de signature sont trop sensibles pour être réinventées).
 *
 * Un même passkey sert à deux usages :
 *  - connexion directe (sans mot de passe ni téléphone), à la façon GitHub ;
 *  - second facteur après une connexion par téléphone ou compte fédéré.
 */

const RP_NAME = process.env.PASSKEY_RP_NAME || 'Palabre';
const RP_ID = process.env.PASSKEY_RP_ID || 'localhost';
const ORIGIN = process.env.PASSKEY_ORIGIN || 'http://localhost:3000';

function challengeKey(userId, purpose) {
  return `passkey:challenge:${purpose}:${userId || 'anonymous'}`;
}

async function listCredentialsForUser(userId) {
  const { rows } = await pool.query('SELECT * FROM passkeys WHERE user_id = $1', [userId]);
  return rows;
}

/**
 * Prépare l'enrôlement d'un nouveau passkey pour un utilisateur déjà
 * connecté (Sécurité > Ajouter un passkey).
 */
async function startRegistration(user) {
  const existing = await listCredentialsForUser(user.id);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email || user.phone_e164 || user.id,
    userDisplayName: user.full_name || user.email || user.phone_e164 || 'Utilisateur Palabre',
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: c.transports || [] })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await redis.set(challengeKey(user.id, 'register'), options.challenge, 'EX', 300);
  return options;
}

async function finishRegistration(user, response, label) {
  const expectedChallenge = await redis.get(challengeKey(user.id, 'register'));
  if (!expectedChallenge) {
    const err = new Error('Aucune procédure d\'enrôlement en cours ou expirée.');
    err.code = 'PASSKEY_CHALLENGE_EXPIRED';
    err.httpStatus = 400;
    throw err;
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    const err = new Error('Vérification du passkey échouée.');
    err.code = 'PASSKEY_VERIFICATION_FAILED';
    err.httpStatus = 401;
    throw err;
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await pool.query(
    `INSERT INTO passkeys (user_id, credential_id, public_key, counter, device_type, backed_up, transports, label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      user.id,
      credential.id,
      Buffer.from(credential.publicKey).toString('base64'),
      credential.counter,
      credentialDeviceType,
      credentialBackedUp,
      JSON.stringify(response.response.transports || []),
      label || null,
    ]
  );

  await redis.del(challengeKey(user.id, 'register'));
  await pool.query('UPDATE users SET two_factor_enabled = true WHERE id = $1', [user.id]);
  return { ok: true };
}

/**
 * Connexion DIRECTE par passkey (sans identifiant pré-saisi, à la façon
 * GitHub/Google) : le navigateur propose les passkeys connus de ce site via
 * la boîte de dialogue système, la réponse contient l'identifiant utilisateur
 * (`userHandle`) qui permet de retrouver le compte.
 */
async function startDiscoverableAuthentication() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    // Pas d'allowCredentials : authentification "discoverable" (usernameless).
  });
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await redis.set(challengeKey(requestId, 'discoverable'), options.challenge, 'EX', 300);
  return { options, requestId };
}

async function finishDiscoverableAuthentication(requestId, response) {
  const expectedChallenge = await redis.get(challengeKey(requestId, 'discoverable'));
  if (!expectedChallenge) {
    const err = new Error('Procédure de connexion expirée, réessayez.');
    err.code = 'PASSKEY_CHALLENGE_EXPIRED';
    err.httpStatus = 400;
    throw err;
  }

  const credResult = await pool.query('SELECT * FROM passkeys WHERE credential_id = $1', [response.id]);
  const stored = credResult.rows[0];
  if (!stored) {
    const err = new Error('Passkey inconnu.');
    err.code = 'PASSKEY_UNKNOWN';
    err.httpStatus = 401;
    throw err;
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: stored.credential_id,
      publicKey: Buffer.from(stored.public_key, 'base64'),
      counter: Number(stored.counter),
      transports: stored.transports || [],
    },
  });

  if (!verification.verified) {
    const err = new Error('Signature du passkey invalide.');
    err.code = 'PASSKEY_VERIFICATION_FAILED';
    err.httpStatus = 401;
    throw err;
  }

  await pool.query('UPDATE passkeys SET counter = $1, last_used_at = now() WHERE id = $2', [verification.authenticationInfo.newCounter, stored.id]);
  await redis.del(challengeKey(requestId, 'discoverable'));

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [stored.user_id]);
  return userResult.rows[0];
}

/**
 * Défi de connexion en second facteur, restreint aux passkeys DÉJÀ associés
 * à cet utilisateur précis (contrairement à la connexion directe ci-dessus).
 */
async function startTwoFactorChallenge(user) {
  const credentials = await listCredentialsForUser(user.id);
  if (credentials.length === 0) {
    const err = new Error('Aucun passkey enregistré pour la vérification en deux étapes.');
    err.code = 'NO_PASSKEYS';
    err.httpStatus = 409;
    throw err;
  }
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: credentials.map((c) => ({ id: c.credential_id, transports: c.transports || [] })),
  });
  await redis.set(challengeKey(user.id, 'twofactor'), options.challenge, 'EX', 300);
  return options;
}

async function verifyTwoFactorChallenge(user, response) {
  const expectedChallenge = await redis.get(challengeKey(user.id, 'twofactor'));
  if (!expectedChallenge) {
    const err = new Error('Défi de vérification expiré, réessayez.');
    err.code = 'PASSKEY_CHALLENGE_EXPIRED';
    err.httpStatus = 400;
    throw err;
  }
  const credResult = await pool.query('SELECT * FROM passkeys WHERE credential_id = $1 AND user_id = $2', [response.id, user.id]);
  const stored = credResult.rows[0];
  if (!stored) {
    const err = new Error('Ce passkey n\'appartient pas à ce compte.');
    err.code = 'PASSKEY_UNKNOWN';
    err.httpStatus = 401;
    throw err;
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: stored.credential_id,
      publicKey: Buffer.from(stored.public_key, 'base64'),
      counter: Number(stored.counter),
      transports: stored.transports || [],
    },
  });

  if (!verification.verified) {
    const err = new Error('Signature du passkey invalide.');
    err.code = 'PASSKEY_VERIFICATION_FAILED';
    err.httpStatus = 401;
    throw err;
  }

  await pool.query('UPDATE passkeys SET counter = $1, last_used_at = now() WHERE id = $2', [verification.authenticationInfo.newCounter, stored.id]);
  await redis.del(challengeKey(user.id, 'twofactor'));
  return true;
}

async function deleteCredential(userId, credentialDbId) {
  await pool.query('DELETE FROM passkeys WHERE id = $1 AND user_id = $2', [credentialDbId, userId]);
  const remaining = await pool.query('SELECT COUNT(*) FROM passkeys WHERE user_id = $1', [userId]);
  if (parseInt(remaining.rows[0].count, 10) === 0) {
    await pool.query('UPDATE users SET two_factor_enabled = false WHERE id = $1', [userId]);
  }
}

module.exports = {
  listCredentialsForUser,
  startRegistration,
  finishRegistration,
  startDiscoverableAuthentication,
  finishDiscoverableAuthentication,
  startTwoFactorChallenge,
  verifyTwoFactorChallenge,
  deleteCredential,
};
