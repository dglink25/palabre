const express = require('express');
const jwt = require('jsonwebtoken');
const passkeyService = require('./passkey.service');
const { requireAuth, requireTwoFactorIfEnabled } = require('../../middleware/authMiddleware');
const writeConfirmationService = require('./writeConfirmation.service');

const router = express.Router();

/**
 * @openapi
 * /security/passkeys:
 *   get:
 *     tags: [Sécurité - Passkeys]
 *     summary: Liste les passkeys enregistrés pour le compte connecté.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste des passkeys }
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await passkeyService.listCredentialsForUser(req.user.id);
    res.json(rows.map((r) => ({ id: r.id, label: r.label, deviceType: r.device_type, createdAt: r.created_at, lastUsedAt: r.last_used_at })));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/passkeys/register/options:
 *   post:
 *     tags: [Sécurité - Passkeys]
 *     summary: Démarre l'enrôlement d'un nouveau passkey (options à passer à navigator.credentials.create).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Options WebAuthn de création }
 */
router.post('/register/options', requireAuth, async (req, res, next) => {
  try {
    res.json(await passkeyService.startRegistration(req.user));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/passkeys/register/verify:
 *   post:
 *     tags: [Sécurité - Passkeys]
 *     summary: Vérifie et enregistre la réponse de navigator.credentials.create.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response: { type: object, description: "Objet retourné par navigator.credentials.create, sérialisé" }
 *               label: { type: string, example: "MacBook de bureau" }
 *     responses:
 *       200: { description: Passkey enregistré }
 */
router.post('/register/verify', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    res.json(await passkeyService.finishRegistration(req.user, req.body.response, req.body.label));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/passkeys/{id}:
 *   delete:
 *     tags: [Sécurité - Passkeys]
 *     summary: Supprime un passkey enregistré.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Passkey supprimé }
 */
router.delete('/:id', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    await passkeyService.deleteCredential(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/passkeys/2fa/options:
 *   post:
 *     tags: [Sécurité - Passkeys]
 *     summary: Démarre le défi de second facteur par passkey (après une connexion téléphone/fédérée).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Options WebAuthn d'authentification }
 *       409: { description: Aucun passkey enregistré }
 */
router.post('/2fa/options', requireAuth, async (req, res, next) => {
  try {
    res.json(await passkeyService.startTwoFactorChallenge(req.user));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /security/passkeys/2fa/verify:
 *   post:
 *     tags: [Sécurité - Passkeys]
 *     summary: Valide le défi de second facteur et marque la session courante comme vérifiée.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response: { type: object }
 *     responses:
 *       200: { description: Nouvel access token avec 2FA validée }
 */
router.post('/2fa/verify', requireAuth, async (req, res, next) => {
  try {
    await passkeyService.verifyTwoFactorChallenge(req.user, req.body.response);
    const accessToken = jwt.sign(
      { sub: req.user.id, sid: req.sessionId, did: req.deviceId, twoFa: true },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_TTL || '15m' }
    );
    await require('../../config/db').pool.query('UPDATE sessions SET two_factor_passed = true WHERE id = $1', [req.sessionId]);
    res.json({ accessToken });
  } catch (err) { next(err); }
});

module.exports = router;
