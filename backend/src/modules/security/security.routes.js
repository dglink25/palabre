const express = require('express');
const { requireAuth, requireTwoFactorIfEnabled } = require('../../middleware/authMiddleware');
const securityService = require('./security.service');
const otpService = require('../auth/otp.service');
const deviceService = require('../auth/device.service');
const authService = require('../auth/auth.service');
const { requireValidPhone } = require('../../middleware/validators');
const writeConfirmationService = require('./writeConfirmation.service');
const { requireCaptcha } = require('../../middleware/captcha');
const { pool } = require('../../config/db');

const router = express.Router();

/**
 * @openapi
 * /security/questions:
 *   get:
 *     tags: [Sécurité]
 *     summary: Liste les questions de sécurité disponibles.
 *     responses:
 *       200: { description: Liste des questions }
 */
router.get('/questions', async (req, res, next) => {
  try {
    res.json(await securityService.listAvailableQuestions());
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/questions/answers:
 *   put:
 *     tags: [Sécurité]
 *     summary: Définit ou met à jour les réponses de l'utilisateur connecté (utilisées en cas de mode de connexion oublié).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId: { type: string }
 *                     answer: { type: string }
 *     responses:
 *       200: { description: Réponses enregistrées }
 */
router.put('/questions/answers', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    await securityService.setSecurityAnswers(req.user.id, req.body.answers);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/recovery/start:
 *   post:
 *     tags: [Sécurité]
 *     summary: Démarre une procédure de récupération de compte (mode de connexion oublié) via OTP téléphone.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string }
 *     responses:
 *       200: { description: OTP de récupération envoyé si le numéro est associé à un compte }
 */
router.post('/recovery/start', requireCaptcha, requireValidPhone('phone'), async (req, res, next) => {
  try {
    const { phone } = req.body;
    const { rows } = await pool.query('SELECT id FROM users WHERE phone_e164 = $1', [phone]);
    if (!rows[0]) {
      // Réponse volontairement neutre pour ne pas révéler l'existence d'un compte.
      return res.json({ ok: true });
    }
    await otpService.sendOtp(phone, 'recovery');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/recovery/confirm:
 *   post:
 *     tags: [Sécurité]
 *     summary: Confirme la récupération de compte par OTP et ouvre une nouvelle session sur l'appareil courant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, deviceFingerprint]
 *             properties:
 *               phone: { type: string }
 *               code: { type: string }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte après récupération }
 */
router.post('/recovery/confirm', requireValidPhone('phone'), async (req, res, next) => {
  try {
    const { phone, code, deviceFingerprint, platform, model } = req.body;
    await otpService.verifyOtp(phone, 'recovery', code);
    const { rows } = await pool.query('SELECT * FROM users WHERE phone_e164 = $1', [phone]);
    if (!rows[0]) {
      return res.status(404).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'Compte introuvable.' } });
    }
    const deviceRow = await deviceService.getOrCreateDevice({ deviceFingerprint, platform, model });
    const result = await authService.issueSessionForUser({ user: rows[0], deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/recovery/questions/list:
 *   post:
 *     tags: [Sécurité]
 *     summary: >
 *       Voie de récupération alternative (téléphone perdu, passkeys inaccessibles) : liste les questions
 *       de sécurité que ce compte a effectivement configurées, sans jamais confirmer si le compte existe
 *       (réponse neutre dans tous les cas, pour ne pas révéler d'informations à un tiers).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier]
 *             properties:
 *               identifier: { type: string, description: "Numéro de téléphone ou e-mail du compte" }
 *     responses:
 *       200: { description: Liste des questions configurées (vide si le compte n'existe pas ou n'en a pas configuré) }
 */
router.post('/recovery/questions/list', async (req, res, next) => {
  try {
    const identifier = (req.body.identifier || '').trim();
    const { rows } = await pool.query('SELECT id FROM users WHERE phone_e164 = $1 OR email = $2', [identifier, identifier.toLowerCase()]);
    if (!rows[0]) return res.json([]);

    const questions = await pool.query(
      `SELECT sq.id, sq.label_fr FROM user_security_answers usa
       JOIN security_questions sq ON sq.id = usa.security_question_id
       WHERE usa.user_id = $1`,
      [rows[0].id]
    );
    res.json(questions.rows);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/recovery/questions/verify:
 *   post:
 *     tags: [Sécurité]
 *     summary: >
 *       Confirme les réponses aux questions de sécurité et ouvre une session si TOUTES sont correctes -
 *       nécessite qu'au moins deux questions aient été configurées au préalable, pour limiter les essais
 *       exhaustifs sur une seule question.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, answers, deviceFingerprint]
 *             properties:
 *               identifier: { type: string }
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId: { type: string }
 *                     answer: { type: string }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte }
 *       401: { description: Une ou plusieurs réponses sont incorrectes }
 */
router.post('/recovery/questions/verify', async (req, res, next) => {
  try {
    const identifier = (req.body.identifier || '').trim();
    const { answers, deviceFingerprint, platform, model } = req.body;

    if (!Array.isArray(answers) || answers.length < 2) {
      return res.status(400).json({ error: { code: 'NOT_ENOUGH_ANSWERS', message: 'Au moins deux questions de sécurité doivent être répondues.' } });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE phone_e164 = $1 OR email = $2', [identifier, identifier.toLowerCase()]);
    if (!rows[0]) {
      return res.status(401).json({ error: { code: 'RECOVERY_FAILED', message: 'Compte introuvable ou réponses incorrectes.' } });
    }

    const ok = await securityService.verifySecurityAnswers(rows[0].id, answers);
    if (!ok) {
      return res.status(401).json({ error: { code: 'RECOVERY_FAILED', message: 'Compte introuvable ou réponses incorrectes.' } });
    }

    const deviceRow = await deviceService.getOrCreateDevice({ deviceFingerprint, platform, model });
    const result = await authService.issueSessionForUser({ user: rows[0], deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/step-up/start:
 *   post:
 *     tags: [Sécurité]
 *     summary: >
 *       Démarre la double vérification requise avant toute modification effectuée par le
 *       super-administrateur (section sécurité) : envoie un code par e-mail. Sans effet pour
 *       un utilisateur normal.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Code envoyé (si applicable) }
 */
router.post('/step-up/start', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.is_super_admin) {
      return res.json({ required: false });
    }
    const result = await writeConfirmationService.startConfirmation(req.user);
    res.json({ required: true, verificationId: result.verificationId, expiresAt: result.expiresAt });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/step-up/verify:
 *   post:
 *     tags: [Sécurité]
 *     summary: >
 *       Valide le code reçu par e-mail et renvoie le jeton à joindre (en-tête X-Confirmation-Token)
 *       aux requêtes de modification suivantes, pendant sa courte durée de validité.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200: { description: Jeton de confirmation émis }
 *       401: { description: Code incorrect ou expiré }
 */
router.post('/step-up/verify', requireAuth, async (req, res, next) => {
  try {
    const result = await writeConfirmationService.verifyConfirmation(req.user, req.sessionId, req.body.code);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
