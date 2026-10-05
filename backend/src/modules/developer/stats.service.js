// backend/src/modules/developer/stats.service.js
// Service de statistiques d'usage - Redis (buffer) → PostgreSQL (persistance)
const { pool }  = require('../../config/db');
const { redis } = require('../../config/redis');

const RETENTION_DAYS     = parseInt(process.env.DEVELOPER_STATS_RETENTION_DAYS || '90', 10);
const FLUSH_INTERVAL_MS  = 60_000; // 60 secondes

/**
 * Retourne le bucket YYYYMMDD pour la date UTC actuelle.
 * @returns {string} ex. "20240115"
 */
function dateBucket() {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d   = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Incrémente le compteur Redis pour (projectId, eventType) dans le bucket du jour.
 * Opération non bloquante - les erreurs Redis sont silencieuses.
 *
 * Clé : stats:{projectId}:{eventType}:{YYYYMMDD}
 *
 * @param {string} projectId
 * @param {string} eventType  ex. 'api_call', 'message_sent', 'call_made', 'active_user'
 * @param {object} [metadata] métadonnées optionnelles (non stockées dans Redis)
 * @returns {Promise<void>}
 */
async function increment(projectId, eventType, metadata) { // eslint-disable-line no-unused-vars
  if (!projectId || !eventType) return;
  const key = `stats:${projectId}:${eventType}:${dateBucket()}`;
  try {
    await redis.incr(key);
  } catch (err) {
    console.error('[stats.service] increment error:', err.message);
  }
}

/**
 * Flushe les compteurs Redis vers PostgreSQL.
 * 1. SCAN toutes les clés `stats:*`
 * 2. Pour chaque clé, GETDEL pour lire + effacer atomiquement
 * 3. INSERT batch dans developer_sdk_events
 */
async function flushToDatabase() {
  try {
    // Récupérer toutes les clés stats:* via SCAN (non bloquant, cursor-based)
    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'stats:*', 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length === 0) return;

    // Pour chaque clé, lire et effacer le compteur, puis insérer en DB
    const rows = [];
    for (const key of keys) {
      // GETDEL : atomique, retourne la valeur puis supprime la clé
      // ioredis supporte GETDEL depuis Redis 6.2 ; fallback GET + DEL sinon
      let countStr;
      try {
        countStr = await redis.getdel(key);
      } catch {
        // Fallback pour Redis < 6.2
        countStr = await redis.get(key);
        if (countStr !== null) await redis.del(key);
      }

      const count = parseInt(countStr, 10);
      if (!count || count <= 0) continue;

      // Décomposer la clé : stats:{projectId}:{eventType}:{YYYYMMDD}
      const parts = key.split(':');
      if (parts.length < 4) continue;

      // Le format est stats:projectId:eventType:bucket
      // eventType peut contenir des ':' → on prend le 2e segment comme projectId,
      // le dernier comme bucket, et tout ce qui est entre comme eventType.
      const projectId = parts[1];
      const bucket    = parts[parts.length - 1];
      const eventType = parts.slice(2, parts.length - 1).join(':');

      if (!projectId || !eventType || !bucket) continue;

      // Convertir le bucket YYYYMMDD en timestamp UTC
      const year  = bucket.slice(0, 4);
      const month = bucket.slice(4, 6);
      const day   = bucket.slice(6, 8);
      const createdAt = new Date(`${year}-${month}-${day}T00:00:00Z`);

      // Créer `count` lignes (une ligne = un événement)
      // Pour des performances, on regroupe en une seule ligne avec payload count.
      rows.push({ projectId, eventType, count, createdAt });
    }

    if (rows.length === 0) return;

    // INSERT batch : une ligne par (projectId, eventType, bucket) avec count dans payload
    const values = [];
    const params = [];
    let idx = 1;

    for (const row of rows) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(
        row.projectId,
        row.eventType,
        JSON.stringify({ count: row.count }),
        row.createdAt.toISOString()
      );
    }

    await pool.query(
      `INSERT INTO developer_sdk_events (project_id, event_type, payload, created_at)
       VALUES ${values.join(', ')}`,
      params
    );

    console.log(`[stats.service] flushé ${rows.length} agrégats vers developer_sdk_events`);
  } catch (err) {
    console.error('[stats.service] flushToDatabase error:', err.message);
  }
}

/**
 * Démarre la boucle de flush périodique (toutes les 60s).
 * À appeler une seule fois au démarrage du serveur.
 */
function startFlushLoop() {
  setInterval(flushToDatabase, FLUSH_INTERVAL_MS);
  console.log(`[stats.service] boucle de flush démarrée (intervalle : ${FLUSH_INTERVAL_MS / 1000}s)`);
}

/**
 * Retourne les statistiques agrégées d'un projet pour une période donnée.
 *
 * @param {string} projectId
 * @param {'today'|'7d'|'30d'|'90d'} period
 * @returns {Promise<{messages_sent: number, calls_made: number, active_users: number, api_calls: number}>}
 */
async function getStats(projectId, period) {
  const ZERO = { messages_sent: 0, calls_made: 0, active_users: 0, api_calls: 0 };

  if (!projectId) return ZERO;

  // Calculer l'intervalle PostgreSQL selon la période
  let interval;
  switch (period) {
    case 'today': interval = '1 day';  break;
    case '7d':    interval = '7 days'; break;
    case '90d':   interval = `${RETENTION_DAYS} days`; break;
    case '30d':
    default:      interval = '30 days'; break;
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         event_type,
         COALESCE(SUM((payload->>'count')::int), COUNT(*)) AS total
       FROM developer_sdk_events
       WHERE project_id   = $1
         AND created_at  >= now() - interval '${interval}'
       GROUP BY event_type`,
      [projectId]
    );

    const stats = { ...ZERO };
    for (const row of rows) {
      const total = parseInt(row.total, 10) || 0;
      switch (row.event_type) {
        case 'message_sent':  stats.messages_sent  += total; break;
        case 'call_made':     stats.calls_made     += total; break;
        case 'active_user':   stats.active_users   += total; break;
        case 'api_call':      stats.api_calls      += total; break;
        default: break;
      }
    }

    return stats;
  } catch (err) {
    console.error('[stats.service] getStats error:', err.message);
    return ZERO;
  }
}

module.exports = { increment, startFlushLoop, getStats };
