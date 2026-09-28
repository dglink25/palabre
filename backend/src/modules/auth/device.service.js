const { pool } = require('../../config/db');

/**
 * Le client (app mobile/web) doit calculer et transmettre une empreinte
 * d'appareil stable (ex : identifiant matériel + salt applicatif côté mobile,
 * ou un identifiant persistant côté navigateur). Le backend ne fait que
 * l'enregistrer et vérifier son unicité - il ne peut pas la générer lui-même.
 */
async function getOrCreateDevice({ deviceFingerprint, platform, model }) {
  if (!deviceFingerprint) {
    const err = new Error('Empreinte d\'appareil manquante (deviceFingerprint).');
    err.code = 'DEVICE_FINGERPRINT_REQUIRED';
    throw err;
  }

  const existing = await pool.query('SELECT * FROM devices WHERE device_fingerprint = $1', [deviceFingerprint]);
  if (existing.rows[0]) {
    await pool.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [existing.rows[0].id]);
    return existing.rows[0];
  }

  const { rows } = await pool.query(
    `INSERT INTO devices (device_fingerprint, platform, model) VALUES ($1, $2, $3) RETURNING *`,
    [deviceFingerprint, platform || null, model || null]
  );
  return rows[0];
}

/**
 * Règle produit : un appareil donné ne peut servir à CRÉER (inscription) qu'un
 * seul compte Palabre, quel que soit le moyen utilisé (téléphone, Google,
 * GitHub, Facebook, Apple, TikTok). Si l'appareil a déjà été utilisé pour
 * inscrire un compte, toute nouvelle tentative d'INSCRIPTION doit être
 * refusée avec un message explicite - la CONNEXION à un compte existant
 * depuis ce même appareil reste bien sûr autorisée.
 */
async function assertDeviceNotAlreadyRegistered(device) {
  if (device.first_user_id) {
    const err = new Error(
      "Cet appareil est déjà associé à un compte Palabre. Connectez-vous avec ce compte, ou utilisez un autre appareil."
    );
    err.code = 'DEVICE_ALREADY_USED';
    err.httpStatus = 409;
    throw err;
  }
}

async function bindDeviceToNewUser(deviceId, userId) {
  await pool.query('UPDATE devices SET first_user_id = $1 WHERE id = $2 AND first_user_id IS NULL', [userId, deviceId]);
}

module.exports = { getOrCreateDevice, assertDeviceNotAlreadyRegistered, bindDeviceToNewUser };
