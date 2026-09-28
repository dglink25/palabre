const crypto = require('crypto');
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const { sendMail } = require('../../config/mailer');
const { wrapEmail, calloutBox } = require('../../emails/brand');

const CODE_LENGTH = 6;
const TTL_SECONDS = parseInt(process.env.EMAIL_OTP_TTL_SECONDS || '900', 10); // 15 min
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN = parseInt(process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

const PURPOSE_PRESENTATION = {
  verify_email: { subject: 'Vérifiez votre adresse e-mail — Palabre', title: 'Vérification de votre adresse e-mail', accent: 'primary', intro: 'Utilisez le code ci-dessous pour confirmer que cette adresse e-mail vous appartient et l\'associer à votre compte Palabre.' },
  recovery: { subject: 'Récupération de votre compte — Palabre', title: 'Récupération de votre compte', accent: 'warning', intro: 'Une demande de récupération de compte a été effectuée. Saisissez le code ci-dessous pour continuer.' },
  link: { subject: 'Association d\'un moyen de connexion — Palabre', title: 'Association d\'un moyen de connexion', accent: 'primary', intro: 'Utilisez le code ci-dessous pour confirmer l\'association de cette adresse e-mail à votre compte.' },
  confirm_action: { subject: 'Confirmation de modification requise — Palabre', title: 'Confirmation de modification', accent: 'primary', intro: 'Une modification sensible de votre compte super-administrateur est en attente. Saisissez le code ci-dessous pour la confirmer.' },
};

function generateCode() {
  return crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * purpose: 'verify_email' (rattacher/confirmer une adresse sur le profil) |
 * 'recovery' | 'link' | 'confirm_action' (double vérification super-admin)
 */
async function sendVerification(email, purpose) {
  const cooldownKey = `email_otp:cooldown:${email}:${purpose}`;
  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) {
    const ttl = await redis.ttl(cooldownKey);
    const err = new Error('Veuillez patienter avant de redemander un code.');
    err.code = 'OTP_COOLDOWN';
    err.retryAfterSeconds = ttl;
    throw err;
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

  const { rows } = await pool.query(
    `INSERT INTO email_verifications (email, purpose, code_hash, max_attempts, expires_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [email, purpose, hashCode(code), MAX_ATTEMPTS, expiresAt]
  );

  const presentation = PURPOSE_PRESENTATION[purpose] || PURPOSE_PRESENTATION.verify_email;
  const minutes = Math.round(TTL_SECONDS / 60);
  const html = wrapEmail({
    title: presentation.title,
    preheader: `Votre code de vérification Palabre : ${code}`,
    accent: presentation.accent,
    bodyHtml: `
      <p style="margin:0 0 8px 0;">${presentation.intro}</p>
      ${calloutBox({ label: 'Code de vérification', value: code, accent: presentation.accent })}
      <p style="margin:16px 0 0 0; color:#5F6368; font-size:13px;">Ce code expire dans ${minutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
    `,
  });

  await sendMail({
    to: email,
    subject: presentation.subject,
    text: `${code} est votre code de vérification Palabre. Il expire dans ${minutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html,
  });

  await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN);
  return { verificationId: rows[0].id, expiresAt };
}

async function verifyCode(email, purpose, code) {
  const { rows } = await pool.query(
    `SELECT * FROM email_verifications
     WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  );
  const record = rows[0];
  if (!record) {
    const err = new Error('Aucun code en attente pour cette adresse.');
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
  if (record.code_hash !== hashCode(code)) {
    await pool.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    const err = new Error('Code incorrect.');
    err.code = 'OTP_INVALID';
    throw err;
  }

  await pool.query('UPDATE email_verifications SET consumed_at = now() WHERE id = $1', [record.id]);
  return true;
}

module.exports = { sendVerification, verifyCode };
