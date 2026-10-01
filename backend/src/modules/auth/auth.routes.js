const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const authService = require('./auth.service');
const superAdminAuthService = require('./superAdminAuth.service');
const passkeyService = require('../security/passkey.service');
const deviceService = require('./device.service');
const { verifyFirebaseIdToken } = require('../../config/firebase');
const sessionService = require('../sessions/session.service');
const presenceService = require('../sessions/presence.service');
const { requireAuth } = require('../../middleware/authMiddleware');
const { requireValidPhone } = require('../../middleware/validators');
const { requireCaptcha } = require('../../middleware/captcha');

const router = express.Router();

// Limites générales de débit (section 36 : "limitation des tentatives de connexion").
// S'ajoutent au verrou applicatif par identifiant (loginAttempts.service.js),
// qui lui suit l'identifiant peu importe l'IP ou l'appareil d'origine.
const otpLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

function deviceFromBody(body) {
  return {
    deviceFingerprint: body.deviceFingerprint,
    platform: body.platform,
    model: body.model,
  };
}

/**
 * @openapi
 * /auth/phone/otp:
 *   post:
 *     tags: [Auth - Téléphone]
 *     summary: Envoie un code OTP par WhatsApp pour inscription, connexion ou récupération.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, purpose]
 *             properties:
 *               phone: { type: string, example: "+22961000000" }
 *               country: { type: string, description: "Code pays ISO (ex. BJ) si `phone` n'est pas déjà au format international", example: "BJ" }
 *               purpose: { type: string, enum: [register, login, recovery, link] }
 *     responses:
 *       200: { description: OTP envoyé }
 *       400: { description: Numéro de téléphone invalide }
 */
router.post('/phone/otp', otpLimiter, requireCaptcha, requireValidPhone('phone'), async (req, res, next) => {
  try {
    const { phone, purpose } = req.body;
    const result = await authService.requestPhoneOtp(phone, purpose);
    res.json({ verificationId: result.verificationId, expiresAt: result.expiresAt });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/phone/register:
 *   post:
 *     tags: [Auth - Téléphone]
 *     summary: Finalise une INSCRIPTION par téléphone après validation du code OTP (distinct de /phone/login).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, deviceFingerprint]
 *             properties:
 *               phone: { type: string }
 *               country: { type: string }
 *               code: { type: string }
 *               deviceFingerprint: { type: string }
 *               platform: { type: string }
 *               model: { type: string }
 *     responses:
 *       201: { description: Compte créé et session ouverte }
 *       409: { description: Compte déjà existant (utilisez /phone/login) ou appareil déjà utilisé pour une inscription }
 */
router.post('/phone/register', requireValidPhone('phone'), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const { user, deviceRow } = await authService.registerWithPhone({ phoneE164: phone, code, device: deviceFromBody(req.body) });
    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/phone/login:
 *   post:
 *     tags: [Auth - Téléphone]
 *     summary: >
 *       CONNEXION par téléphone après validation du code OTP (distinct de /phone/register - ne crée jamais
 *       de compte). Pour le super-administrateur, ne renvoie pas de session directement : renvoie un défi
 *       de second facteur par e-mail (voir /auth/super-admin/step/phone-login-email).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, deviceFingerprint]
 *             properties:
 *               phone: { type: string }
 *               country: { type: string }
 *               code: { type: string }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte (requiresTwoFactor éventuel), ou défi de second facteur pour le super-administrateur }
 *       404: { description: Aucun compte pour ce numéro (utilisez /phone/register) }
 *       429: { description: Trop de tentatives échouées pour ce numéro }
 */
router.post('/phone/login', loginLimiter, requireValidPhone('phone'), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const { user, deviceRow } = await authService.loginWithPhone({ phoneE164: phone, code, device: deviceFromBody(req.body), ip: req.ip });

    if (user.is_super_admin) {
      return res.json(await superAdminAuthService.startPhoneLoginSecondFactor({ user, device: deviceFromBody(req.body) }));
    }

    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/super-admin/step/phone-login-email:
 *   post:
 *     tags: [Auth - Super-admin]
 *     summary: Valide le second facteur e-mail après une connexion téléphone du super-administrateur, et ouvre la session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stepToken, code]
 *             properties:
 *               stepToken: { type: string }
 *               code: { type: string }
 *     responses:
 *       200: { description: Session ouverte }
 *       401: { description: Code incorrect ou expiré }
 */
router.post('/super-admin/step/phone-login-email', loginLimiter, async (req, res, next) => {
  try {
    const { user, deviceRow } = await superAdminAuthService.verifyPhoneLoginSecondFactor(req.body);
    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/federated/register:
 *   post:
 *     tags: [Auth - Fédérée]
 *     summary: INSCRIPTION via Google, GitHub, Facebook, Apple ou TikTok (idToken Firebase) - distinct de /federated/login. Si l'e-mail Google détecté est celui du super-administrateur, renvoie un défi de vérification renforcée (voir /auth/super-admin/step/*) au lieu d'une session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken, deviceFingerprint]
 *             properties:
 *               idToken: { type: string, description: "ID token Firebase obtenu côté client après connexion au provider" }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       201: { description: Compte créé et session ouverte }
 *       409: { description: Un compte existe déjà pour ce provider (utilisez /federated/login), ou appareil déjà utilisé pour une inscription }
 */
router.post('/federated/register', async (req, res, next) => {
  try {
    const { idToken } = req.body;

    // Interception : si l'e-mail Google détecté est celui du
    // super-administrateur, on ne crée/connecte jamais directement - on
    // bascule sur le parcours renforcé à 3 étapes (voir superAdminAuth.*).
    const identity = await verifyFirebaseIdToken(idToken);
    if (identity.provider === 'google' && superAdminAuthService.isSuperAdminEmail(identity.email)) {
      return res.json(await superAdminAuthService.startStepUp({ identity, device: deviceFromBody(req.body) }));
    }

    const { user, deviceRow } = await authService.registerWithFederatedProvider({ idToken, device: deviceFromBody(req.body) });
    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/federated/login:
 *   post:
 *     tags: [Auth - Fédérée]
 *     summary: CONNEXION via Google, GitHub, Facebook, Apple ou TikTok (idToken Firebase) - ne crée jamais de compte. Si l'e-mail Google détecté est celui du super-administrateur, renvoie un défi de vérification renforcée (voir /auth/super-admin/step/*) au lieu d'une session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken, deviceFingerprint]
 *             properties:
 *               idToken: { type: string }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte }
 *       404: { description: Aucun compte lié à ce provider (utilisez /federated/register) }
 *       429: { description: Trop de tentatives échouées pour cet identifiant }
 */
router.post('/federated/login', loginLimiter, async (req, res, next) => {
  try {
    const { idToken } = req.body;

    const identity = await verifyFirebaseIdToken(idToken);
    if (identity.provider === 'google' && superAdminAuthService.isSuperAdminEmail(identity.email)) {
      return res.json(await superAdminAuthService.startStepUp({ identity, device: deviceFromBody(req.body) }));
    }

    const { user, deviceRow } = await authService.loginWithFederatedProvider({ idToken, device: deviceFromBody(req.body), ip: req.ip });
    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/federated/link:
 *   post:
 *     tags: [Auth - Fédérée]
 *     summary: Associe un moyen de connexion fédéré supplémentaire au compte connecté.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string }
 *     responses:
 *       200: { description: Moyen de connexion associé }
 *       409: { description: Déjà utilisé par un autre compte, ou déjà associé à ce compte }
 */
router.post('/federated/link', requireAuth, async (req, res, next) => {
  try {
    const result = await authService.linkFederatedProvider(req.user.id, req.body.idToken);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth - Sessions]
 *     summary: Fait tourner le refresh token et retourne un nouvel access token (rotation façon WhatsApp/Gmail).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Nouveau couple access/refresh token }
 *       401: { description: Refresh token invalide, expiré, ou réutilisation détectée (toutes les sessions liées sont alors révoquées) }
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const result = await sessionService.rotateRefreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth - Sessions]
 *     summary: Déconnecte la session en cours (révocation du refresh token).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Déconnecté }
 */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await sessionService.revokeSession(req.user.id, req.sessionId);
    await presenceService.setOffline(req.user.id, req.deviceId);
    res.status(204).end();
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/passkey/login/options:
 *   post:
 *     tags: [Auth - Passkey]
 *     summary: >
 *       Démarre une connexion directe par passkey (sans téléphone ni compte fédéré, façon GitHub) :
 *       aucun identifiant à saisir, le navigateur propose les passkeys connus pour ce site.
 *     responses:
 *       200: { description: Options WebAuthn d'authentification + requestId à renvoyer à l'étape suivante }
 */
router.post('/passkey/login/options', async (req, res, next) => {
  try {
    const result = await passkeyService.startDiscoverableAuthentication();
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/passkey/login/verify:
 *   post:
 *     tags: [Auth - Passkey]
 *     summary: Vérifie la réponse de navigator.credentials.get et ouvre une session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, response, deviceFingerprint]
 *             properties:
 *               requestId: { type: string }
 *               response: { type: object }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte }
 *       401: { description: Passkey inconnu ou signature invalide }
 */
router.post('/passkey/login/verify', loginLimiter, async (req, res, next) => {
  try {
    const user = await passkeyService.finishDiscoverableAuthentication(req.body.requestId, req.body.response);
    const deviceRow = await deviceService.getOrCreateDevice(deviceFromBody(req.body));
    const result = await authService.issueSessionForUser({
      user,
      deviceRow,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      twoFactorPassedOverride: true, // Le passkey lui-même constitue le second facteur
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
