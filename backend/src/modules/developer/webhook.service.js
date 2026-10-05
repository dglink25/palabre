// backend/src/modules/developer/webhook.service.js
const crypto = require('crypto');
const axios  = require('axios');
const { pool }  = require('../../config/db');
const mailer    = require('../../config/mailer');

const RETRY_DELAYS_MS = [30_000, 120_000, 480_000]; // 30s, 120s, 480s

/**
 * Calcule la signature HMAC-SHA256 du webhook.
 * Format : sha256=hmac(secret, "${timestamp}.${body}")
 *
 * @param {string} secret    - Secret HMAC dédié du webhook
 * @param {string} timestamp - Horodatage Unix en secondes (string)
 * @param {string} body      - Corps de la requête (JSON stringifié)
 * @returns {string} Signature au format `sha256=<hex>`
 */
function computeSignature(secret, timestamp, body) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + body)
    .digest('hex');
}

/**
 * Crée une entrée de livraison en base de données.
 *
 * @param {string} webhookId  - UUID du webhook
 * @param {string} eventType  - Type d'événement (ex. 'message.received')
 * @param {object} payload    - Données de l'événement
 * @returns {Promise<string>} UUID de la livraison créée
 */
async function createDelivery(webhookId, eventType, payload) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO developer_webhook_deliveries
       (webhook_id, event_type, payload, status, attempts)
     VALUES ($1, $2, $3, 'pending', 0)
     RETURNING id`,
    [webhookId, eventType, JSON.stringify(payload)]
  );
  return row.id;
}

/**
 * Tente la livraison d'un webhook via POST HTTPS.
 * En cas d'échec, planifie la prochaine tentative via setTimeout.
 * Après 3 échecs consécutifs, marque le webhook comme 'failed'
 * et envoie un email de notification au développeur.
 *
 * @param {string} deliveryId    - UUID de la livraison
 * @param {object} webhook       - Objet webhook { id, url, secret }
 * @param {string} eventType     - Type d'événement
 * @param {object} payload       - Données de l'événement
 * @param {number} attemptIndex  - Index de la tentative courante (0-based)
 */
async function deliver(deliveryId, webhook, eventType, payload, attemptIndex) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body      = JSON.stringify(payload);
  const signature = computeSignature(webhook.secret, timestamp, body);

  let responseCode = null;
  let responseBody = null;
  let success = false;

  try {
    const response = await axios.post(webhook.url, body, {
      timeout: 10_000,
      headers: {
        'Content-Type':        'application/json',
        'X-Palabre-Signature': signature,
        'X-Palabre-Event':     eventType,
        'X-Palabre-Timestamp': timestamp,
      },
    });
    responseCode = response.status;
    responseBody = JSON.stringify(response.data).slice(0, 1000);
    success = response.status >= 200 && response.status < 300;
  } catch (err) {
    responseCode = err.response?.status || 0;
    responseBody = err.message?.slice(0, 500);
  }

  const nextAttempt = attemptIndex + 1;

  if (success) {
    // Livraison réussie : mettre à jour la delivery et réinitialiser failure_count
    await pool.query(
      `UPDATE developer_webhook_deliveries
       SET status = 'delivered', response_code = $2, response_body = $3,
           attempts = $4, delivered_at = now()
       WHERE id = $1`,
      [deliveryId, responseCode, responseBody, nextAttempt]
    );
    await pool.query(
      `UPDATE developer_webhooks SET last_fired_at = now(), failure_count = 0 WHERE id = $1`,
      [webhook.id]
    );
  } else if (nextAttempt < RETRY_DELAYS_MS.length + 1) {
    // Échec, mais des tentatives restent disponibles
    const delay = RETRY_DELAYS_MS[attemptIndex] ?? RETRY_DELAYS_MS.at(-1);
    const nextRetryAt = new Date(Date.now() + delay);

    await pool.query(
      `UPDATE developer_webhook_deliveries
       SET response_code = $2, response_body = $3, attempts = $4, next_retry_at = $5
       WHERE id = $1`,
      [deliveryId, responseCode, responseBody, nextAttempt, nextRetryAt]
    );

    // Planifier la prochaine tentative (pour production multi-instances, utiliser BullMQ)
    setTimeout(
      () => deliver(deliveryId, webhook, eventType, payload, nextAttempt),
      delay
    );
  } else {
    // Échec définitif après 3 tentatives : marquer 'failed' et notifier le développeur
    await pool.query(
      `UPDATE developer_webhook_deliveries
       SET status = 'failed', response_code = $2, response_body = $3, attempts = $4
       WHERE id = $1`,
      [deliveryId, responseCode, responseBody, nextAttempt]
    );
    await pool.query(
      `UPDATE developer_webhooks
       SET status = 'failed', failure_count = failure_count + 1
       WHERE id = $1`,
      [webhook.id]
    );
    await notifyDeveloper(webhook.id, webhook.url, eventType);
  }
}

/**
 * Déclenche l'envoi d'un événement webhook pour tous les webhooks
 * actifs d'un projet qui écoutent cet eventType.
 *
 * @param {string} projectId  - UUID du projet developer
 * @param {string} eventType  - Type d'événement (ex. 'message.received')
 * @param {object} payload    - Données de l'événement
 */
async function fireEvent(projectId, eventType, payload) {
  const { rows: webhooks } = await pool.query(
    `SELECT w.id, w.url, w.secret
     FROM developer_webhooks w
     WHERE w.project_id = $1
       AND w.status = 'active'
       AND $2 = ANY(w.events)`,
    [projectId, eventType]
  );

  for (const webhook of webhooks) {
    const deliveryId = await createDelivery(webhook.id, eventType, payload);
    // Livraison non bloquante : on ne await pas deliver pour ne pas retarder fireEvent
    deliver(deliveryId, webhook, eventType, payload, 0).catch((err) => {
      console.error('[webhook.service] Erreur inattendue dans deliver:', err);
    });
  }
}

/**
 * Envoie un email de notification au développeur propriétaire du webhook.
 * Effectue un JOIN developer_webhooks → developer_projects → developer_accounts → users.
 *
 * @param {string} webhookId  - UUID du webhook en échec
 * @param {string} webhookUrl - URL du webhook (pour affichage dans l'email)
 * @param {string} eventType  - Type d'événement concerné
 */
async function notifyDeveloper(webhookId, webhookUrl, eventType) {
  try {
    const { rows: [row] } = await pool.query(
      `SELECT u.email, u.first_name
       FROM developer_webhooks w
       JOIN developer_projects  p  ON p.id  = w.project_id
       JOIN developer_accounts  da ON da.id = p.account_id
       JOIN users               u  ON u.id  = da.user_id
       WHERE w.id = $1`,
      [webhookId]
    );

    if (!row) return;

    await mailer.sendMail({
      to:      row.email,
      subject: '[Palabre Developer] Webhook en échec',
      text: `Bonjour ${row.first_name || 'développeur'},\n\nVotre webhook ${webhookUrl} a échoué 3 fois consécutives pour l'événement "${eventType}". Il a été marqué comme défaillant.\n\nVeuillez vérifier votre endpoint et le réactiver depuis le Developer_Portal.\n\nL'équipe Palabre`,
      html: `<p>Bonjour ${row.first_name || 'développeur'},</p><p>Votre webhook <code>${webhookUrl}</code> a échoué 3 fois consécutives pour l'événement <strong>${eventType}</strong>. Il a été marqué comme défaillant.</p><p>Veuillez vérifier votre endpoint et le réactiver depuis le <a href="${process.env.DEVELOPER_PORTAL_URL || 'http://localhost:3001'}">Developer Portal</a>.</p><p>L'équipe Palabre</p>`,
    });
  } catch (err) {
    console.error('[webhook.service] Erreur lors de la notification développeur:', err);
  }
}

module.exports = { computeSignature, createDelivery, deliver, fireEvent };
