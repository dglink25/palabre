const express = require('express');
const { pool } = require('../../config/db');
const { requireAuth, requireTwoFactorIfEnabled } = require('../../middleware/authMiddleware');
const { isValidEmail } = require('../../middleware/validators');
const { makeUploader, publicUrlFor } = require('../../middleware/upload');
const authService = require('../auth/auth.service');
const writeConfirmationService = require('../security/writeConfirmation.service');
const emailService = require('../auth/email.service');

const router = express.Router();
const photoUpload = makeUploader('profile-photos', { maxSizeMB: 5, allowedMimePrefixes: ['image/'] });

/**
 * @openapi
 * /me:
 *   get:
 *     tags: [Profil]
 *     summary: Récupère le profil de l'utilisateur connecté.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profil utilisateur }
 */
router.get('/', requireAuth, async (req, res) => {
  res.json(authService.sanitizeUser(req.user));
});

/**
 * @openapi
 * /me:
 *   patch:
 *     tags: [Profil]
 *     summary: Met à jour les informations personnelles (nom, secteur, langue, fuseau horaire).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               sector: { type: string }
 *               locale: { type: string, description: "Langue de l'interface, ex. fr, en" }
 *               timezone: { type: string, description: "Fuseau horaire IANA, ex. Africa/Porto-Novo" }
 *     responses:
 *       200: { description: Profil mis à jour }
 */
router.patch('/', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    const { fullName, sector, locale, timezone } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         sector    = COALESCE($2, sector),
         locale    = COALESCE($3, locale),
         timezone  = COALESCE($4, timezone),
         updated_at = now()
       WHERE id = $5 RETURNING *`,
      [fullName, sector, locale, timezone, req.user.id]
    );
    res.json(authService.sanitizeUser(rows[0]));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /me/photo:
 *   post:
 *     tags: [Profil]
 *     summary: Change la photo de profil (upload direct, remplace l'ancienne).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo: { type: string, format: binary }
 *     responses:
 *       200: { description: Photo mise à jour, renvoie la nouvelle photoUrl }
 *       400: { description: Fichier manquant ou type non autorisé }
 */
router.post('/photo', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, photoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Fichier "photo" manquant.' } });
    }
    const photoUrl = publicUrlFor('profile-photos', req.file.filename);
    await pool.query('UPDATE users SET photo_url = $1, updated_at = now() WHERE id = $2', [photoUrl, req.user.id]);
    res.json({ photoUrl });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /me/preferences:
 *   get:
 *     tags: [Profil]
 *     summary: Récupère les préférences libres de l'utilisateur (notifications, thème, etc.).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Objet de préférences }
 */
router.get('/preferences', requireAuth, async (req, res) => {
  res.json(req.user.preferences || {});
});

/**
 * @openapi
 * /me/preferences:
 *   patch:
 *     tags: [Profil]
 *     summary: Met à jour les préférences (fusion superficielle avec les préférences existantes, pas de remplacement total).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *             example: { "notifications": { "email": true, "push": false }, "theme": "dark" }
 *     responses:
 *       200: { description: Préférences mises à jour }
 */
router.patch('/preferences', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET preferences = preferences || $1::jsonb, updated_at = now()
       WHERE id = $2 RETURNING preferences`,
      [JSON.stringify(req.body || {}), req.user.id]
    );
    res.json(rows[0].preferences);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /me/email/request-verification:
 *   post:
 *     tags: [Profil]
 *     summary: Envoie un code de vérification à une adresse e-mail (à rattacher/confirmer sur le compte).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Code envoyé }
 *       400: { description: Adresse invalide }
 */
router.post('/email/request-verification', requireAuth, async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Adresse e-mail invalide.' } });
    }
    const result = await emailService.sendVerification(email, 'verify_email');
    res.json({ verificationId: result.verificationId, expiresAt: result.expiresAt });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /me/email/confirm:
 *   post:
 *     tags: [Profil]
 *     summary: Confirme le code reçu par e-mail et rattache l'adresse au compte (email_verified = true).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string }
 *               code: { type: string }
 *     responses:
 *       200: { description: Adresse rattachée et vérifiée }
 *       409: { description: Adresse déjà utilisée par un autre compte }
 */
router.post('/email/confirm', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    await emailService.verifyCode(email, 'verify_email', req.body.code);

    const conflict = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, req.user.id]);
    if (conflict.rows[0]) {
      return res.status(409).json({ error: { code: 'EMAIL_ALREADY_USED', message: 'Cette adresse est déjà utilisée par un autre compte.' } });
    }

    const { rows } = await pool.query(
      `UPDATE users SET email = $1, email_verified = true, updated_at = now() WHERE id = $2 RETURNING *`,
      [email, req.user.id]
    );
    res.json(authService.sanitizeUser(rows[0]));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /me/recovery-methods:
 *   get:
 *     tags: [Profil]
 *     summary: Liste les moyens de connexion / récupération associés au compte.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste des moyens associés }
 */
router.get('/recovery-methods', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT method_type, reference, verified, created_at FROM account_recovery_methods WHERE user_id = $1',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /me/fcm-token — enregistrer un token FCM pour les notifications push ──
router.post('/fcm-token', requireAuth, async (req, res, next) => {
  try {
    const { token, platform = 'web' } = req.body;
    if (!token) return res.status(400).json({ error: { code: 'TOKEN_REQUIRED', message: 'Token FCM requis.' } });

    // Stocker dans les préférences utilisateur (upsert)
    await pool.query(
      `UPDATE users
       SET preferences = preferences || jsonb_build_object('fcmTokens',
           COALESCE(preferences->'fcmTokens', '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object('token', $1::text, 'platform', $2::text, 'updatedAt', now()::text)
           )
         ),
         updated_at = now()
       WHERE id = $3`,
      [token, platform, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE /me/fcm-token — supprimer le token FCM (déconnexion) ───────────────
router.delete('/fcm-token', requireAuth, async (req, res, next) => {
  try {
    // Vider tous les tokens FCM (déconnexion totale)
    await pool.query(
      `UPDATE users SET preferences = preferences - 'fcmTokens', updated_at = now() WHERE id = $1`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
