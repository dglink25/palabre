const express = require('express');
const rateLimit = require('express-rate-limit');
const superAdminAuthService = require('./superAdminAuth.service');
const authService = require('./auth.service');

const router = express.Router();
const stepLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

/**
 * @openapi
 * /auth/super-admin/step/email-code:
 *   post:
 *     tags: [Auth - Super-admin]
 *     summary: >
 *       Étape 1/3 de la connexion super-administrateur : valide le code de 12 caractères
 *       envoyé par e-mail (3 minutes de validité).
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
 *       200: { description: "Étape validée, passage à l'étape téléphone (indice : 2 derniers chiffres)" }
 *       401: { description: Code incorrect ou expiré }
 */
router.post('/step/email-code', stepLimiter, async (req, res, next) => {
  try {
    res.json(await superAdminAuthService.verifyEmailStep(req.body));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/super-admin/step/phone-confirm:
 *   post:
 *     tags: [Auth - Super-admin]
 *     summary: >
 *       Étape 2/3 : le super-administrateur choisit son pays et saisit son numéro de téléphone
 *       complet (dont seuls les 2 derniers chiffres lui ont été rappelés). En cas de correspondance
 *       avec le numéro enregistré, un code OTP WhatsApp est envoyé (3 minutes de validité).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stepToken, country, phone]
 *             properties:
 *               stepToken: { type: string }
 *               country: { type: string, example: "BJ" }
 *               phone: { type: string }
 *     responses:
 *       200: { description: "Numéro confirmé, OTP WhatsApp envoyé" }
 *       401: { description: Le numéro ne correspond pas à celui enregistré }
 */
router.post('/step/phone-confirm', stepLimiter, async (req, res, next) => {
  try {
    res.json(await superAdminAuthService.verifyPhoneConfirmationStep(req.body));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/super-admin/step/phone-otp:
 *   post:
 *     tags: [Auth - Super-admin]
 *     summary: Étape 3/3 : valide le code OTP WhatsApp et ouvre enfin la session super-administrateur.
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
 *       200: { description: Session super-administrateur ouverte (mêmes jetons qu'une connexion classique) }
 *       401: { description: Code incorrect ou expiré }
 */
router.post('/step/phone-otp', stepLimiter, async (req, res, next) => {
  try {
    const { user, deviceRow } = await superAdminAuthService.verifyPhoneOtpStep(req.body);
    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
