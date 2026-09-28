/**
 * Routes Signal Protocol — gestion des clés publiques E2E
 *
 * Le serveur stocke UNIQUEMENT les clés publiques.
 * Les clés privées ne quittent jamais l'appareil.
 *
 * Flux d'initialisation d'une session Signal (X3DH) :
 *   1. Alice téléverse ses prékeys publiques au démarrage (POST /signal/prekeys)
 *   2. Bob veut écrire à Alice → GET /signal/prekeys/:userId/:deviceId
 *      → reçoit une prékey d'Alice (marquée consumed=true, usage unique)
 *   3. Bob calcule le secret partagé localement (X3DH)
 *   4. Bob chiffre le message avec ce secret → envoie via WebSocket
 *   5. Alice déchiffre avec sa clé privée correspondante
 */

const express = require('express');
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /messaging/signal/identity:
 *   post:
 *     summary: Enregistre la clé d'identité publique d'un appareil.
 *     security: [{ bearerAuth: [] }]
 */
router.post('/identity', requireAuth, async (req, res, next) => {
  try {
    const { deviceId, identityKey, registrationId } = req.body;
    if (!deviceId || !identityKey || !registrationId) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'deviceId, identityKey et registrationId sont requis.' } });
    }

    await pool.query(
      `INSERT INTO signal_identities (user_id, device_id, identity_key, registration_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, device_id) DO UPDATE
         SET identity_key = EXCLUDED.identity_key,
             registration_id = EXCLUDED.registration_id`,
      [req.user.id, deviceId, identityKey, registrationId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /messaging/signal/prekeys:
 *   post:
 *     summary: Téléverse un lot de prékeys publiques (one-time prekeys + signed prekey).
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Appelé au démarrage de l'app et quand le stock de prékeys est bas (<10).
 *       Le client génère les paires localement, envoie uniquement les clés publiques.
 *       Format attendu :
 *         { deviceId, prekeys: [{ keyId, publicKey }], signedPrekey: { keyId, publicKey, signature } }
 */
router.post('/prekeys', requireAuth, async (req, res, next) => {
  try {
    const { deviceId, prekeys = [], signedPrekey } = req.body;
    if (!deviceId || prekeys.length === 0) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'deviceId et prekeys sont requis.' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // One-time prekeys
      for (const pk of prekeys) {
        await client.query(
          `INSERT INTO signal_prekeys (user_id, device_id, key_id, public_key, is_signed)
           VALUES ($1, $2, $3, $4, false)
           ON CONFLICT (user_id, device_id, key_id) DO NOTHING`,
          [req.user.id, deviceId, pk.keyId, pk.publicKey]
        );
      }

      // Signed prekey (remplace le précédent)
      if (signedPrekey) {
        await client.query(
          `INSERT INTO signal_prekeys (user_id, device_id, key_id, public_key, signature, is_signed)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (user_id, device_id, key_id) DO UPDATE
             SET public_key = EXCLUDED.public_key, signature = EXCLUDED.signature`,
          [req.user.id, deviceId, signedPrekey.keyId, signedPrekey.publicKey, signedPrekey.signature]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true, uploaded: prekeys.length });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /messaging/signal/prekeys/:userId/:deviceId:
 *   get:
 *     summary: Récupère un bundle de prékeys pour établir une session Signal avec un utilisateur.
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       Retourne :
 *         - 1 one-time prekey (marquée consumed, usage unique)
 *         - 1 signed prekey
 *         - La clé d'identité publique de l'appareil cible
 *       Si plus de one-time prekeys disponibles, retourne uniquement signed + identity.
 */
router.get('/prekeys/:userId/:deviceId', requireAuth, async (req, res, next) => {
  try {
    const { userId, deviceId } = req.params;

    // Clé d'identité
    const identityResult = await pool.query(
      'SELECT identity_key, registration_id FROM signal_identities WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );
    if (!identityResult.rows[0]) {
      return res.status(404).json({ error: { code: 'IDENTITY_NOT_FOUND', message: 'Cet appareil n\'a pas encore enregistré sa clé d\'identité.' } });
    }

    // Signed prekey
    const signedResult = await pool.query(
      `SELECT key_id, public_key, signature FROM signal_prekeys
       WHERE user_id = $1 AND device_id = $2 AND is_signed = true
       ORDER BY created_at DESC LIMIT 1`,
      [userId, deviceId]
    );

    // One-time prekey (consommée atomiquement)
    const otkResult = await pool.query(
      `UPDATE signal_prekeys SET consumed = true
       WHERE id = (
         SELECT id FROM signal_prekeys
         WHERE user_id = $1 AND device_id = $2
           AND is_signed = false AND consumed = false
         ORDER BY created_at ASC LIMIT 1
       )
       RETURNING key_id, public_key`,
      [userId, deviceId]
    );

    // Vérifier le stock restant et notifier si bas
    const stockResult = await pool.query(
      'SELECT COUNT(*) FROM signal_prekeys WHERE user_id = $1 AND device_id = $2 AND is_signed = false AND consumed = false',
      [userId, deviceId]
    );
    const remaining = parseInt(stockResult.rows[0].count, 10);

    res.json({
      userId,
      deviceId,
      identityKey:    identityResult.rows[0].identity_key,
      registrationId: identityResult.rows[0].registration_id,
      signedPrekey:   signedResult.rows[0] || null,
      oneTimePrekey:  otkResult.rows[0] || null,   // null si stock épuisé
      remainingPrekeys: remaining,
      lowStock: remaining < 10,
    });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /messaging/signal/prekeys/count:
 *   get:
 *     summary: Retourne le nombre de prékeys disponibles pour l'appareil courant.
 *     security: [{ bearerAuth: [] }]
 */
router.get('/prekeys/count', requireAuth, async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    const result = await pool.query(
      'SELECT COUNT(*) FROM signal_prekeys WHERE user_id = $1 AND device_id = $2 AND is_signed = false AND consumed = false',
      [req.user.id, deviceId]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (e) { next(e); }
});

module.exports = router;
