const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { wrapEmail, calloutBox } = require('../../emails/brand');
const otpService = require('./otp.service');
const deviceService = require('./device.service');
const { normalizePhone } = require('../../middleware/validators');

/**
 * ======================================================================
 * CONNEXION RENFORCÉE DU SUPER-ADMINISTRATEUR
 * ======================================================================
 * Dès que l'e-mail Google détecté correspond à l'e-mail du
 * super-administrateur, la connexion normale (auth.service.js) est
 * court-circuitée au profit de ce parcours à 3 étapes :
 *
 *   1. Code de 12 caractères envoyé par e-mail (3 min) - confirme la
 *      maîtrise de la boîte mail enregistrée.
 *   2. Confirmation du numéro de téléphone enregistré (un indice affichant
 *      seulement ses 2 derniers chiffres, mais la valeur ATTENDUE est le
 *      numéro complet - afficher uniquement 2 chiffres et n'en exiger que
 *      2 en retour n'aurait quasiment aucune valeur de sécurité).
 *   3. Code OTP WhatsApp (3 min) envoyé à ce numéro - confirme la
 *      possession réelle du téléphone.
 *
 * Chaque étape se transmet via un jeton signé à courte durée de vie
 * (`stepToken`), sans jamais garder d'état "connecté" avant l'étape 3.
 */

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'dglink25@gmail.com').toLowerCase();
const STEP_TOKEN_SECRET = process.env.SUPER_ADMIN_STEP_SECRET || `${process.env.JWT_ACCESS_SECRET}_super_admin_step`;
const STEP_TOKEN_TTL = '6m'; // couvre confortablement 2 x 3 min de code + le temps de saisie
const EMAIL_CODE_TTL_SECONDS = 3 * 60;
const PHONE_OTP_TTL_SECONDS = 3 * 60;

function isSuperAdminEmail(email) {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

function signStepToken(payload) {
  // On écarte exp et iat hérités d'un payload décodé pour éviter le conflit
  // avec l'option expiresIn : jsonwebtoken refuse les deux simultanément.
  const { exp, iat, ...cleanPayload } = payload;
  return jwt.sign(cleanPayload, STEP_TOKEN_SECRET, { expiresIn: STEP_TOKEN_TTL });
}

function verifyStepToken(token, expectedStep) {
  let payload;
  try {
    payload = jwt.verify(token, STEP_TOKEN_SECRET);
  } catch {
    const err = new Error('Session de vérification invalide ou expirée. Recommencez la connexion.');
    err.code = 'STEP_TOKEN_INVALID';
    err.httpStatus = 401;
    throw err;
  }
  if (payload.step !== expectedStep) {
    const err = new Error('Étape de vérification incorrecte.');
    err.code = 'STEP_MISMATCH';
    err.httpStatus = 400;
    throw err;
  }
  return payload;
}

/**
 * Code à 12 caractères : au moins 2 majuscules, 3 minuscules, 3 chiffres,
 * 2 caractères spéciaux - le reste tiré au hasard du jeu complet, puis tout
 * mélangé pour que la composition ne soit pas prévisible en position.
 */
function generateComplexEmailCode() {
  const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I/O, ambigus à l'oeil
  const LOWER = 'abcdefghijkmnpqrstuvwxyz';
  const DIGITS = '23456789';
  const SPECIAL = '!@#$%^&*-_+=?';
  const ALL = UPPER + LOWER + DIGITS + SPECIAL;

  const pick = (charset, count) =>
    Array.from({ length: count }, () => charset[crypto.randomInt(0, charset.length)]);

  let chars = [
    ...pick(UPPER, 2),
    ...pick(LOWER, 3),
    ...pick(DIGITS, 3),
    ...pick(SPECIAL, 2),
    ...pick(ALL, 2), // complète à 12
  ];

  // Mélange (Fisher-Yates) pour ne pas exposer la structure par position.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Point d'entrée : appelé par les routes /auth/federated/register|login
 * lorsque l'e-mail Google détecté est celui du super-administrateur.
 * Renvoie le premier défi (code e-mail) au lieu d'une session.
 */
async function startStepUp({ identity, device }) {
  const userResult = await pool.query('SELECT * FROM users WHERE email = $1 AND is_super_admin = true', [SUPER_ADMIN_EMAIL]);
  const user = userResult.rows[0];
  if (!user) {
    const err = new Error('Aucun compte super-administrateur configuré pour cet e-mail.');
    err.code = 'SUPER_ADMIN_NOT_PROVISIONED';
    err.httpStatus = 500;
    throw err;
  }

  const code = generateComplexEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_SECONDS * 1000);
  await pool.query(
    `INSERT INTO super_admin_email_challenges (email, code_hash, expires_at) VALUES ($1,$2,$3)`,
    [SUPER_ADMIN_EMAIL, hashCode(code), expiresAt]
  );

  await sendMail({
    to: SUPER_ADMIN_EMAIL,
    subject: 'Code de connexion super-administrateur - Palabre',
    text: `Code super-admin etape 1/3 : ${code}. Expire dans 3 minutes.`,
    html: wrapEmail({
      title: 'Connexion super-administrateur - étape 1 sur 3',
      preheader: `Code de connexion : ${code}`,
      accent: 'alert',
      bodyHtml: `
        <p style="margin:0 0 8px 0;">Une tentative de connexion au compte super-administrateur Palabre vient d'être initiée depuis un compte Google.</p>
        ${calloutBox({ label: 'Code de vérification (étape 1 sur 3)', value: code, accent: 'alert' })}
        <p style="margin:16px 0 0 0; color:#5F6368; font-size:13px;">Ce code expire dans 3 minutes. Si vous n'êtes pas à l'origine de cette tentative de connexion, sécurisez immédiatement votre compte Google et contactez le support.</p>
      `,
    }),
  });

  const stepToken = signStepToken({
    step: 'email_code',
    userId: user.id,
    providerUid: identity.providerUid,
    deviceFingerprint: device.deviceFingerprint,
    platform: device.platform,
    model: device.model,
  });

  return { requiresSuperAdminVerification: true, step: 'email_code', stepToken, expiresAt };
}

async function verifyEmailStep({ stepToken, code }) {
  const payload = verifyStepToken(stepToken, 'email_code');

  const { rows } = await pool.query(
    `SELECT * FROM super_admin_email_challenges
     WHERE email = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [SUPER_ADMIN_EMAIL]
  );
  const challenge = rows[0];
  if (!challenge) {
    const err = new Error('Aucun code en attente.');
    err.code = 'CHALLENGE_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  if (new Date(challenge.expires_at) < new Date()) {
    const err = new Error('Le code a expiré.');
    err.code = 'CODE_EXPIRED';
    err.httpStatus = 401;
    throw err;
  }
  if (challenge.attempts >= challenge.max_attempts) {
    const err = new Error('Trop de tentatives.');
    err.code = 'CODE_LOCKED';
    err.httpStatus = 429;
    throw err;
  }
  if (challenge.code_hash !== hashCode(code)) {
    await pool.query('UPDATE super_admin_email_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
    const err = new Error('Code incorrect.');
    err.code = 'CODE_INVALID';
    err.httpStatus = 401;
    throw err;
  }
  await pool.query('UPDATE super_admin_email_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);

  const userResult = await pool.query('SELECT phone_e164 FROM users WHERE id = $1', [payload.userId]);
  const registeredPhone = userResult.rows[0].phone_e164 || '';
  const hint = registeredPhone.slice(-2);

  const nextToken = signStepToken({ ...payload, step: 'phone_confirmation' });
  return { step: 'phone_confirmation', stepToken: nextToken, phoneHintLastTwoDigits: hint };
}

/**
 * L'utilisateur choisit un pays et saisit un numéro complet. Le numéro
 * normalisé doit correspondre EXACTEMENT au numéro enregistré - les 2
 * derniers chiffres servis en indice à l'étape précédente ne sont qu'un
 * repère pour l'utilisateur, pas le critère de validation (2 chiffres
 * seuls seraient trivialement devinables).
 */
async function verifyPhoneConfirmationStep({ stepToken, country, phone }) {
  const payload = verifyStepToken(stepToken, 'phone_confirmation');

  const normalized = normalizePhone(phone, country);
  if (!normalized) {
    const err = new Error('Numéro de téléphone invalide.');
    err.code = 'INVALID_PHONE';
    err.httpStatus = 400;
    throw err;
  }

  const userResult = await pool.query('SELECT phone_e164 FROM users WHERE id = $1', [payload.userId]);
  const registeredPhone = userResult.rows[0].phone_e164;
  if (normalized !== registeredPhone) {
    const err = new Error('Ce numéro ne correspond pas au numéro enregistré.');
    err.code = 'PHONE_MISMATCH';
    err.httpStatus = 401;
    throw err;
  }

  await otpService.sendOtp(registeredPhone, 'login', PHONE_OTP_TTL_SECONDS);

  const nextToken = signStepToken({ ...payload, step: 'phone_otp', phone: registeredPhone });
  return { step: 'phone_otp', stepToken: nextToken };
}

/**
 * Dernière étape : le code WhatsApp valide, on finalise enfin la
 * connexion - création de la liaison Google si c'était la première fois,
 * puis émission d'une session comme pour un login classique.
 */
async function verifyPhoneOtpStep({ stepToken, code }) {
  const payload = verifyStepToken(stepToken, 'phone_otp');
  await otpService.verifyOtp(payload.phone, 'login', code);

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
  const user = userResult.rows[0];

  // Rattache le compte Google s'il ne l'était pas déjà (première fois).
  const existingLink = await pool.query(
    'SELECT id FROM oauth_accounts WHERE provider = $1 AND provider_uid = $2',
    ['google', payload.providerUid]
  );
  if (!existingLink.rows[0]) {
    await pool.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_uid, provider_email)
       VALUES ($1,'google',$2,$3) ON CONFLICT (provider, provider_uid) DO NOTHING`,
      [user.id, payload.providerUid, SUPER_ADMIN_EMAIL]
    );
  }

  const deviceRow = await deviceService.getOrCreateDevice({
    deviceFingerprint: payload.deviceFingerprint,
    platform: payload.platform,
    model: payload.model,
  });

  return { user, deviceRow };
}

/**
 * ======================================================================
 * SECOND FACTEUR SUR LA CONNEXION TÉLÉPHONE DU SUPER-ADMIN
 * ======================================================================
 * Le téléphone a déjà été prouvé (OTP WhatsApp validé par auth.service.js
 * AVANT d'appeler cette fonction) : il ne s'agit donc plus de re-prouver le
 * téléphone, seulement d'ajouter un second facteur indépendant - un code
 * envoyé à l'e-mail enregistré - avant d'émettre la session. C'est
 * délibéré et systématique : toute connexion du super-administrateur est
 * renforcée, quel que soit le canal (Google : 3 étapes ; téléphone : 2).
 */
async function startPhoneLoginSecondFactor({ user, device }) {
  const code = generateComplexEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_SECONDS * 1000);
  await pool.query(
    `INSERT INTO super_admin_email_challenges (email, code_hash, expires_at) VALUES ($1,$2,$3)`,
    [SUPER_ADMIN_EMAIL, hashCode(code), expiresAt]
  );

  await sendMail({
    to: SUPER_ADMIN_EMAIL,
    subject: 'Palabre - Code de connexion super-administrateur',
    text: `Code super-admin etape 2/2 : ${code}. Expire dans 3 minutes.`,
    html: wrapEmail({
      title: 'Connexion super-administrateur - étape 2 sur 2',
      preheader: `Code de connexion : ${code}`,
      accent: 'alert',
      bodyHtml: `
        <p style="margin:0 0 8px 0;">Votre numéro de téléphone super-administrateur vient d'être vérifié avec succès par OTP WhatsApp. Un second facteur indépendant est requis pour terminer la connexion.</p>
        ${calloutBox({ label: 'Code de vérification (étape 2 sur 2)', value: code, accent: 'alert' })}
        <p style="margin:16px 0 0 0; color:#5F6368; font-size:13px;">Ce code expire dans 3 minutes. Si vous n'êtes pas à l'origine de cette tentative de connexion, sécurisez immédiatement votre compte.</p>
      `,
    }),
  });

  const stepToken = signStepToken({
    step: 'phone_login_email',
    userId: user.id,
    deviceFingerprint: device.deviceFingerprint,
    platform: device.platform,
    model: device.model,
  });

  return { requiresSuperAdminVerification: true, step: 'phone_login_email', stepToken, expiresAt };
}

async function verifyPhoneLoginSecondFactor({ stepToken, code }) {
  const payload = verifyStepToken(stepToken, 'phone_login_email');

  const { rows } = await pool.query(
    `SELECT * FROM super_admin_email_challenges
     WHERE email = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [SUPER_ADMIN_EMAIL]
  );
  const challenge = rows[0];
  if (!challenge) {
    const err = new Error('Aucun code en attente.');
    err.code = 'CHALLENGE_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  if (new Date(challenge.expires_at) < new Date()) {
    const err = new Error('Le code a expiré.');
    err.code = 'CODE_EXPIRED';
    err.httpStatus = 401;
    throw err;
  }
  if (challenge.attempts >= challenge.max_attempts) {
    const err = new Error('Trop de tentatives.');
    err.code = 'CODE_LOCKED';
    err.httpStatus = 429;
    throw err;
  }
  if (challenge.code_hash !== hashCode(code)) {
    await pool.query('UPDATE super_admin_email_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
    const err = new Error('Code incorrect.');
    err.code = 'CODE_INVALID';
    err.httpStatus = 401;
    throw err;
  }
  await pool.query('UPDATE super_admin_email_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
  const deviceRow = await deviceService.getOrCreateDevice({
    deviceFingerprint: payload.deviceFingerprint,
    platform: payload.platform,
    model: payload.model,
  });

  return { user: userResult.rows[0], deviceRow };
}

module.exports = {
  isSuperAdminEmail,
  startStepUp,
  verifyEmailStep,
  verifyPhoneConfirmationStep,
  verifyPhoneOtpStep,
  startPhoneLoginSecondFactor,
  verifyPhoneLoginSecondFactor,
};
