// backend/src/modules/developer/webhook.routes.js
// Routes de gestion des webhooks d'un projet développeur.
// Montées sous /api/v1/developer/projects via developer.routes.js (avec requireAuth SSO).
//
//   GET    /projects/:id/webhooks                - lister les webhooks du projet
//   POST   /projects/:id/webhooks                - créer un webhook (url HTTPS + events[])
//   PATCH  /projects/:id/webhooks/:wid           - mettre à jour url et/ou events
//   DELETE /projects/:id/webhooks/:wid           - supprimer un webhook (CASCADE deliveries)
//   GET    /projects/:id/webhooks/deliveries      - 100 dernières livraisons du projet
//
// Requirements: 10.1, 10.6

'use strict';

const crypto = require('crypto');
const router = require('express').Router();
const { pool } = require('../../config/db');

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Résout le developer_account_id pour l'utilisateur authentifié.
 * Retourne null si aucun compte développeur n'existe.
 */
async function getAccountId(userId) {
  const { rows } = await pool.query(
    `SELECT id FROM developer_accounts WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0]?.id ?? null;
}

/**
 * Vérifie que le projet appartient au compte développeur de l'utilisateur.
 * Retourne le projet si ownership confirmé, null sinon.
 */
async function getOwnedProject(projectId, accountId) {
  const { rows } = await pool.query(
    `SELECT id, account_id
     FROM developer_projects
     WHERE id = $1 AND account_id = $2 AND status != 'deleted'`,
    [projectId, accountId]
  );
  return rows[0] ?? null;
}

/**
 * Vérifie qu'une URL commence bien par https://.
 * Requirements: 10.1
 */
function isHttpsUrl(url) {
  return typeof url === 'string' && url.startsWith('https://');
}

// ---------------------------------------------------------------------------
// GET /:id/webhooks
// Lister les webhooks du projet avec url, events, statut, last_fired_at.
// Requirements: 10.1
// ---------------------------------------------------------------------------
router.get('/:id/webhooks', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: "Aucun compte développeur trouvé. Appelez POST /accounts/me d'abord.",
        },
      });
    }

    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    const { rows: webhooks } = await pool.query(
      `SELECT id, url, events, status, last_fired_at, created_at, updated_at
       FROM developer_webhooks
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    return res.status(200).json({ webhooks });
  } catch (err) {
    console.error('[webhook.routes] GET /:id/webhooks error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/webhooks/deliveries
// Retourner les 100 dernières livraisons du projet (tous webhooks confondus).
// Requirements: 10.6
// ---------------------------------------------------------------------------
// NOTE: cette route est définie AVANT /:id/webhooks/:wid pour éviter que
//       le segment "deliveries" soit interprété comme un :wid.
router.get('/:id/webhooks/deliveries', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: "Aucun compte développeur trouvé. Appelez POST /accounts/me d'abord.",
        },
      });
    }

    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    const { rows: deliveries } = await pool.query(
      `SELECT d.id, d.webhook_id, d.event_type, d.status, d.response_code,
              d.created_at, d.delivered_at
       FROM developer_webhook_deliveries d
       JOIN developer_webhooks w ON w.id = d.webhook_id
       WHERE w.project_id = $1
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [projectId]
    );

    return res.status(200).json({ deliveries });
  } catch (err) {
    console.error('[webhook.routes] GET /:id/webhooks/deliveries error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/webhooks
// Créer un webhook : valider url HTTPS, events[] non vide, générer secret HMAC.
// Retourne HTTP 201.
// Requirements: 10.1
// ---------------------------------------------------------------------------
router.post('/:id/webhooks', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;
  const { url, events } = req.body;

  // Validation URL (format HTTPS obligatoire)
  if (!url || !isHttpsUrl(url)) {
    return res.status(422).json({
      error: {
        code: 'INVALID_URL',
        message: "L'URL du webhook doit commencer par https://.",
      },
    });
  }

  // Validation events[] non vide
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(422).json({
      error: {
        code: 'INVALID_EVENTS',
        message: 'Le tableau events doit contenir au moins un type d\'événement.',
      },
    });
  }

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: "Aucun compte développeur trouvé. Appelez POST /accounts/me d'abord.",
        },
      });
    }

    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Générer un secret HMAC dédié (32 octets aléatoires en hex)
    const secret = crypto.randomBytes(32).toString('hex');

    const { rows: [webhook] } = await pool.query(
      `INSERT INTO developer_webhooks (project_id, url, events, secret)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url, events, status, last_fired_at, created_at, updated_at`,
      [projectId, url, events, secret]
    );

    return res.status(201).json({ webhook });
  } catch (err) {
    console.error('[webhook.routes] POST /:id/webhooks error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id/webhooks/:wid
// Mettre à jour url et/ou events d'un webhook.
// Retourne HTTP 200.
// Requirements: 10.1
// ---------------------------------------------------------------------------
router.patch('/:id/webhooks/:wid', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId, wid: webhookId } = req.params;
  const { url, events } = req.body;

  // Au moins un champ à mettre à jour
  if (url === undefined && events === undefined) {
    return res.status(422).json({
      error: {
        code: 'NO_FIELDS',
        message: 'Fournissez au moins un champ à mettre à jour : url ou events.',
      },
    });
  }

  // Valider url si fournie
  if (url !== undefined && !isHttpsUrl(url)) {
    return res.status(422).json({
      error: {
        code: 'INVALID_URL',
        message: "L'URL du webhook doit commencer par https://.",
      },
    });
  }

  // Valider events si fourni
  if (events !== undefined && (!Array.isArray(events) || events.length === 0)) {
    return res.status(422).json({
      error: {
        code: 'INVALID_EVENTS',
        message: 'Le tableau events doit contenir au moins un type d\'événement.',
      },
    });
  }

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: "Aucun compte développeur trouvé. Appelez POST /accounts/me d'abord.",
        },
      });
    }

    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Vérifier que le webhook appartient bien au projet
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM developer_webhooks WHERE id = $1 AND project_id = $2`,
      [webhookId, projectId]
    );
    if (!existing) {
      return res.status(404).json({
        error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook introuvable.' },
      });
    }

    // Construire la requête UPDATE dynamiquement
    const updates = [];
    const values = [];
    let idx = 1;

    if (url !== undefined) {
      updates.push(`url = $${idx++}`);
      values.push(url);
    }
    if (events !== undefined) {
      updates.push(`events = $${idx++}`);
      values.push(events);
    }
    updates.push(`updated_at = now()`);
    values.push(webhookId);

    const { rows: [webhook] } = await pool.query(
      `UPDATE developer_webhooks
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, url, events, status, last_fired_at, created_at, updated_at`,
      values
    );

    return res.status(200).json({ webhook });
  } catch (err) {
    console.error('[webhook.routes] PATCH /:id/webhooks/:wid error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/webhooks/:wid
// Supprimer un webhook. Les deliveries cascadent automatiquement via FK ON DELETE CASCADE.
// Retourne HTTP 204.
// Requirements: 10.1
// ---------------------------------------------------------------------------
router.delete('/:id/webhooks/:wid', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId, wid: webhookId } = req.params;

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: "Aucun compte développeur trouvé. Appelez POST /accounts/me d'abord.",
        },
      });
    }

    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Supprimer le webhook (les deliveries cascadent automatiquement)
    const { rowCount } = await pool.query(
      `DELETE FROM developer_webhooks WHERE id = $1 AND project_id = $2`,
      [webhookId, projectId]
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook introuvable.' },
      });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[webhook.routes] DELETE /:id/webhooks/:wid error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

module.exports = router;
