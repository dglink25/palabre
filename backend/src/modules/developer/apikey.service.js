'use strict';

const crypto = require('crypto');

const PUB_PREFIX = process.env.DEVELOPER_API_KEY_PREFIX_PUB || 'pk_live_';
const SEC_PREFIX = process.env.DEVELOPER_API_KEY_PREFIX_SEC || 'sk_live_';

/**
 * Génère une paire de clés (publishable + secret) pour un projet.
 *
 * @returns {{ publishable: string, secret: string, secretHash: string }}
 *   - publishable : valeur brute stockée telle quelle en DB (pk_live_<32 bytes hex>)
 *   - secret      : valeur brute à retourner UNE SEULE FOIS au développeur (sk_live_<32 bytes hex>)
 *   - secretHash  : hash SHA-256 de secret, stocké en DB à la place de la valeur brute
 */
function generateKeyPair() {
  const pubRaw  = PUB_PREFIX + crypto.randomBytes(32).toString('hex');
  const secRaw  = SEC_PREFIX + crypto.randomBytes(32).toString('hex');
  const secHash = crypto.createHash('sha256').update(secRaw).digest('hex');
  return { publishable: pubRaw, secret: secRaw, secretHash: secHash };
}

/**
 * Effectue la rotation d'une clé (publishable ou secret) pour un projet.
 *
 * Séquence atomique dans une transaction SQL :
 *   1. Récupère l'ancienne clé active.
 *   2. La révoque (status → 'revoked', revoked_at = now()).
 *   3. Inscrit la grace period dans Redis : keyrotation:grace:{oldKeyValue} = projectId, TTL 60s.
 *   4. Insère la nouvelle clé.
 *   5. COMMIT - ou ROLLBACK si une étape échoue.
 *
 * @param {import('pg').Pool} pool        - Pool PostgreSQL
 * @param {import('ioredis').Redis} redis  - Instance Redis
 * @param {string} projectId              - UUID du projet
 * @param {'publishable'|'secret'} keyType - Type de clé à tourner
 * @returns {Promise<string>} La valeur brute de la nouvelle clé (one-shot)
 */
async function rotateKey(pool, redis, projectId, keyType) {
  // Récupérer l'ancienne clé active
  const { rows } = await pool.query(
    `SELECT id, key_value
     FROM developer_api_keys
     WHERE project_id = $1 AND key_type = $2 AND status = 'active'
     LIMIT 1`,
    [projectId, keyType]
  );

  if (!rows[0]) {
    const err = new Error(`Aucune clé active de type '${keyType}' trouvée pour le projet ${projectId}.`);
    err.code = 'KEY_NOT_FOUND';
    throw err;
  }

  const oldKey = rows[0];
  const graceTTL = parseInt(process.env.DEVELOPER_KEY_ROTATION_GRACE_SECONDS, 10) || 60;

  // Générer la nouvelle paire
  const newPair  = generateKeyPair();
  const newValue = keyType === 'publishable' ? newPair.publishable : newPair.secretHash;
  const newRaw   = keyType === 'publishable' ? newPair.publishable : newPair.secret;
  const newPrefix = keyType === 'publishable' ? PUB_PREFIX : SEC_PREFIX;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Révoquer l'ancienne clé
    await client.query(
      `UPDATE developer_api_keys
       SET status = 'revoked', revoked_at = now()
       WHERE id = $1`,
      [oldKey.id]
    );

    // 2. Grace period Redis - l'ancienne clé reste acceptée pendant TTL secondes
    const graceRedisKey = `keyrotation:grace:${oldKey.key_value}`;
    await redis.set(graceRedisKey, projectId, 'EX', graceTTL);

    // 3. Insérer la nouvelle clé
    await client.query(
      `INSERT INTO developer_api_keys (project_id, key_type, key_prefix, key_value)
       VALUES ($1, $2, $3, $4)`,
      [projectId, keyType, newPrefix, newValue]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Retourner la valeur brute - doit être affichée une seule fois au développeur
  return newRaw;
}

module.exports = { generateKeyPair, rotateKey };
