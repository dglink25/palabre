const express = require('express');
const { requireAuth, requireTwoFactorIfEnabled } = require('../../middleware/authMiddleware');
const sessionService = require('./session.service');
const presenceService = require('./presence.service');
const writeConfirmationService = require('../security/writeConfirmation.service');

const router = express.Router();

/**
 * @openapi
 * /sessions/heartbeat:
 *   post:
 *     tags: [Sessions]
 *     summary: >
 *       Signale que l'appareil courant est toujours actif et renouvelle son TTL de présence
 *       (Redis, clé `session:{deviceId}`). À appeler régulièrement par le client (ex. toutes
 *       les 30-45s) : tant que ce heartbeat arrive avant expiration du TTL, la session reste
 *       considérée comme active — sans limite de durée totale.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Présence renouvelée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ttlSeconds: { type: integer, description: "Durée en secondes avant expiration si aucun heartbeat n'arrive" }
 */
router.post('/heartbeat', requireAuth, async (req, res, next) => {
  try {
    const result = await presenceService.touch(req.user.id, req.deviceId);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: >
 *       Liste les sessions/appareils actifs du compte connecté (façon WhatsApp Web / Gmail),
 *       avec un indicateur `isOnline` calculé en temps réel depuis Redis (présence par heartbeat),
 *       distinct de la validité du refresh token (`status`).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Liste des sessions }
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [sessions, onlineDevices] = await Promise.all([
      sessionService.listSessions(req.user.id),
      presenceService.listOnlineDevicesForUser(req.user.id),
    ]);
    const onlineDeviceIds = new Set(onlineDevices.map((d) => d.deviceId));

    res.json(
      sessions.map((s) => ({
        ...s,
        isCurrent: s.id === req.sessionId,
        isOnline: onlineDeviceIds.has(s.device_id),
      }))
    );
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /sessions/others:
 *   delete:
 *     tags: [Sessions]
 *     summary: Révoque toutes les autres sessions, en gardant uniquement celle en cours ("déconnecter tous les autres appareils").
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Autres sessions révoquées }
 */
router.delete('/others', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    const revokedDeviceIds = await sessionService.revokeAllSessionsExcept(req.user.id, req.sessionId);
    await Promise.all(revokedDeviceIds.map((deviceId) => presenceService.setOffline(req.user.id, deviceId)));
    res.status(204).end();
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /sessions/{id}:
 *   delete:
 *     tags: [Sessions]
 *     summary: Révoque une session/appareil précis (déconnexion à distance).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Session révoquée }
 */
router.delete('/:id', requireAuth, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    const deviceId = await sessionService.revokeSession(req.user.id, req.params.id);
    if (deviceId) await presenceService.setOffline(req.user.id, deviceId);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
