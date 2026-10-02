const { pool } = require('../../config/db');
const { verifyFirebaseIdToken } = require('../../config/firebase');
const deviceService = require('./device.service');
const otpService = require('./otp.service');
const loginAttemptsService = require('./loginAttempts.service');
const sessionService = require('../sessions/session.service');
const presenceService = require('../sessions/presence.service');
const { armSuperAdminIdleTimeout } = require('../../middleware/authMiddleware');

/**
 * ======================================================================
 * INSCRIPTION / CONNEXION PAR TÉLÉPHONE (OTP WhatsApp)
 * ======================================================================
 * Aucune inscription ni connexion n'utilise de mot de passe : tout passe par
 * un code à usage unique envoyé par WhatsApp (Convessa), ou par une identité
 * fédérée vérifiée par Firebase.
 */

async function requestPhoneOtp(phoneE164, purpose) {
  return otpService.sendOtp(phoneE164, purpose);
}

/**
 * Finalise une inscription par téléphone après vérification du code OTP.
 * Refuse si l'appareil a déjà servi à créer un autre compte.
 */
async function registerWithPhone({ phoneE164, code, device }) {
  await otpService.verifyOtp(phoneE164, 'register', code);

  const existingUser = await pool.query('SELECT * FROM users WHERE phone_e164 = $1', [phoneE164]);
  if (existingUser.rows[0]) {
    const err = new Error('Un compte existe déjà avec ce numéro. Connectez-vous plutôt.');
    err.code = 'ACCOUNT_ALREADY_EXISTS';
    err.httpStatus = 409;
    throw err;
  }

  const deviceRow = await deviceService.getOrCreateDevice(device);
  await deviceService.assertDeviceNotAlreadyRegistered(deviceRow);

  const { rows } = await pool.query(
    `INSERT INTO users (phone_e164) VALUES ($1) RETURNING *`,
    [phoneE164]
  );
  const user = rows[0];

  await deviceService.bindDeviceToNewUser(deviceRow.id, user.id);
  await pool.query(
    `INSERT INTO account_recovery_methods (user_id, method_type, reference, verified)
     VALUES ($1, 'phone', $2, true)`,
    [user.id, phoneE164]
  );

  return { user, deviceRow };
}

/**
 * Connexion par téléphone après vérification du code OTP. L'appareil est
 * enregistré s'il est nouveau (un appareil peut se CONNECTER à plusieurs
 * comptes au fil du temps ; seule la première INSCRIPTION sur un appareil
 * donné est restreinte à un seul compte).
 */
async function loginWithPhone({ phoneE164, code, device, ip }) {
  await loginAttemptsService.assertNotLocked(phoneE164);

  try {
    await otpService.verifyOtp(phoneE164, 'login', code);
  } catch (err) {
    await loginAttemptsService.record({ identifier: phoneE164, method: 'phone', ip, success: false });
    throw err;
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE phone_e164 = $1', [phoneE164]);
  const user = rows[0];
  if (!user) {
    await loginAttemptsService.record({ identifier: phoneE164, method: 'phone', ip, success: false });
    const err = new Error('Aucun compte associé à ce numéro.');
    err.code = 'ACCOUNT_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }

  await loginAttemptsService.record({ identifier: phoneE164, method: 'phone', ip, success: true });
  const deviceRow = await deviceService.getOrCreateDevice(device);
  return { user, deviceRow };
}

/**
 * ======================================================================
 * INSCRIPTION / CONNEXION FÉDÉRÉE (Google, GitHub, Facebook, Apple, TikTok)
 * ======================================================================
 * Le client obtient un idToken Firebase après authentification auprès du
 * provider choisi ; le backend le vérifie puis crée ou retrouve le compte.
 * Contrainte produit : un identifiant fédéré (ex. un compte Google précis)
 * n'est jamais lié qu'à un seul compte Palabre (contrainte UNIQUE en base).
 */
async function registerWithFederatedProvider({ idToken, device }) {
  const identity = await verifyFirebaseIdToken(idToken);

  // Vérifier si ce providerUid est déjà lié à un compte
  const existingLink = await pool.query(
    'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_uid = $2',
    [identity.provider, identity.providerUid]
  );
  if (existingLink.rows[0]) {
    const err = new Error(`Un compte Palabre existe deja pour ce compte ${identity.provider}. Connectez-vous plutot.`);
    err.code = 'ACCOUNT_ALREADY_EXISTS';
    err.httpStatus = 409;
    throw err;
  }

  // Vérifier si un compte avec cet email existe déjà (ex: admin org activé via téléphone)
  // Dans ce cas, lier le provider Google à ce compte existant plutôt que d'en créer un nouveau
  if (identity.email) {
    const emailMatch = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [identity.email.toLowerCase()]
    );
    if (emailMatch.rows[0]) {
      // Compte existant avec cet email - lier le provider et renvoyer le compte
      const existingUser = emailMatch.rows[0];
      await pool.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_uid, provider_email)
         VALUES ($1, $2, $3, $4) ON CONFLICT (provider, provider_uid) DO NOTHING`,
        [existingUser.id, identity.provider, identity.providerUid, identity.email]
      );
      const deviceRow = await deviceService.getOrCreateDevice(device);
      return { user: existingUser, deviceRow };
    }
  }

  // Nouvelle inscription - vérification unicité appareil
  const deviceRow = await deviceService.getOrCreateDevice(device);
  await deviceService.assertDeviceNotAlreadyRegistered(deviceRow);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userInsert = await client.query(
      `INSERT INTO users (full_name, email, photo_url) VALUES ($1, $2, $3) RETURNING *`,
      [identity.name, identity.email, identity.photoUrl]
    );
    const user = userInsert.rows[0];

    await client.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_uid, provider_email)
       VALUES ($1, $2, $3, $4)`,
      [user.id, identity.provider, identity.providerUid, identity.email]
    );
    await client.query(
      `INSERT INTO account_recovery_methods (user_id, method_type, reference, verified)
       VALUES ($1, $2, $3, true)`,
      [user.id, identity.provider, identity.providerUid]
    );
    await client.query('COMMIT');

    await deviceService.bindDeviceToNewUser(deviceRow.id, user.id);
    return { user, deviceRow };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function loginWithFederatedProvider({ idToken, device, ip }) {
  const identity = await verifyFirebaseIdToken(idToken);
  await loginAttemptsService.assertNotLocked(identity.providerUid);

  // Chercher d'abord par providerUid (lien OAuth direct)
  const existingLink = await pool.query(
    'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_uid = $2',
    [identity.provider, identity.providerUid]
  );

  let user;

  if (existingLink.rows[0]) {
    // Lien OAuth trouvé - connexion directe
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [existingLink.rows[0].user_id]);
    user = userResult.rows[0];
  } else if (identity.email) {
    // Pas de lien OAuth mais on a un email : chercher un compte avec cet email
    // Cas typique : admin d'organisation activé via téléphone/email puis tente
    // de se connecter via Google avec le même email
    const emailMatch = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND email_verified = true',
      [identity.email.toLowerCase()]
    );

    if (!emailMatch.rows[0]) {
      await loginAttemptsService.record({ identifier: identity.providerUid, method: identity.provider, ip, success: false });
      const err = new Error(`Aucun compte Palabre associe a l'adresse ${identity.email}. Utilisez le moyen de connexion avec lequel vous avez active votre compte.`);
      err.code = 'ACCOUNT_NOT_FOUND';
      err.httpStatus = 404;
      throw err;
    }

    user = emailMatch.rows[0];

    // Créer le lien OAuth automatiquement pour les prochaines connexions
    await pool.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_uid, provider_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_uid) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [user.id, identity.provider, identity.providerUid, identity.email]
    );
  } else {
    await loginAttemptsService.record({ identifier: identity.providerUid, method: identity.provider, ip, success: false });
    const err = new Error(`Aucun compte Palabre lie a ce compte ${identity.provider}.`);
    err.code = 'ACCOUNT_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }

  await loginAttemptsService.record({ identifier: identity.providerUid, method: identity.provider, ip, success: true });
  const deviceRow = await deviceService.getOrCreateDevice(device);
  return { user, deviceRow };
}

/**
 * Lie un nouveau moyen de connexion fédéré à un compte déjà connecté -
 * uniquement si ce provider n'est pas déjà associé à ce compte, ET que
 * l'identifiant fédéré n'est pas déjà utilisé par un AUTRE utilisateur.
 */
async function linkFederatedProvider(userId, idToken) {
  const identity = await verifyFirebaseIdToken(idToken);

  const alreadyLinkedElsewhere = await pool.query(
    'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_uid = $2',
    [identity.provider, identity.providerUid]
  );
  if (alreadyLinkedElsewhere.rows[0] && alreadyLinkedElsewhere.rows[0].user_id !== userId) {
    const err = new Error(`Ce compte ${identity.provider} est déjà utilisé par un autre utilisateur Palabre.`);
    err.code = 'PROVIDER_ALREADY_LINKED';
    err.httpStatus = 409;
    throw err;
  }

  const alreadyLinkedHere = await pool.query(
    'SELECT * FROM oauth_accounts WHERE provider = $1 AND user_id = $2',
    [identity.provider, userId]
  );
  if (alreadyLinkedHere.rows[0]) {
    const err = new Error(`Ce moyen de connexion (${identity.provider}) est déjà associé à votre compte.`);
    err.code = 'PROVIDER_ALREADY_LINKED_SELF';
    err.httpStatus = 409;
    throw err;
  }

  await pool.query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_uid, provider_email)
     VALUES ($1, $2, $3, $4)`,
    [userId, identity.provider, identity.providerUid, identity.email]
  );
  await pool.query(
    `INSERT INTO account_recovery_methods (user_id, method_type, reference, verified)
     VALUES ($1, $2, $3, true)`,
    [userId, identity.provider, identity.providerUid]
  );

  return { provider: identity.provider };
}

/**
 * Finalise la connexion (téléphone ou fédérée) en émettant une session.
 * Si l'utilisateur a activé la 2FA, la session est créée avec
 * two_factor_passed = false tant que l'étape biométrique n'est pas validée
 * (voir security.service.confirmTwoFactorForSession).
 */
async function issueSessionForUser({ user, deviceRow, ip, userAgent, twoFactorPassedOverride = false }) {
  // Si twoFactorPassedOverride est vrai (ex: connexion par passkey), le 2FA
  // est considéré comme accompli - le passkey lui-même est le second facteur.
  const twoFactorPassed = twoFactorPassedOverride || !user.two_factor_enabled;

  // Résoudre le rôle de membership si pas encore chargé (login téléphone/fédéré
  // ne fait pas le JOIN roles contrairement à authMiddleware)
  let enrichedUser = user;
  if (!user.member_role) {
    const roleRow = await pool.query(
      `SELECT r.code as member_role
       FROM memberships m JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY m.created_at ASC LIMIT 1`,
      [user.id]
    );
    enrichedUser = { ...user, member_role: roleRow.rows[0]?.member_role || null };
  }

  const { session, accessToken, refreshToken } = await sessionService.createSession({
    user: enrichedUser,
    deviceId: deviceRow.id,
    ip,
    userAgent,
    twoFactorPassed,
  });

  // La session Postgres existe désormais ; on marque l'appareil "en ligne"
  await presenceService.setOnline(enrichedUser.id, deviceRow.id);

  if (enrichedUser.is_super_admin) {
    await armSuperAdminIdleTimeout(session.id);
  }

  return {
    user: sanitizeUser(enrichedUser),
    requiresTwoFactor: enrichedUser.two_factor_enabled && !twoFactorPassed,
    session: { id: session.id },
    accessToken,
    refreshToken,
  };
}

function sanitizeUser(user) {
  const { id, full_name, email, email_verified, phone_e164, photo_url, sector, locale, timezone, two_factor_enabled, preferences, is_super_admin, org_id, member_role } = user;
  return {
    id,
    fullName:         full_name,
    email,
    emailVerified:    !!email_verified,
    phone:            phone_e164,
    photoUrl:         photo_url,
    sector,
    locale,
    timezone,
    twoFactorEnabled: two_factor_enabled,
    preferences:      preferences || {},
    isSuperAdmin:     !!is_super_admin,
    orgId:            org_id || null,
    // role de membership : 'org_admin', 'org_member', etc. - null si pas de membership
    role:             member_role || null,
  };
}

module.exports = {
  requestPhoneOtp,
  registerWithPhone,
  loginWithPhone,
  registerWithFederatedProvider,
  loginWithFederatedProvider,
  linkFederatedProvider,
  issueSessionForUser,
  sanitizeUser,
};
