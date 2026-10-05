// backend/src/modules/developer/project.routes.js
// Routes CRUD pour les Developer_Projects
// Protégées par requireAuth (SSO JWT), appliqué au niveau de developer.routes.js
//
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8

'use strict';

const router = require('express').Router();
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const { generateKeyPair } = require('./apikey.service');

// Préfixes de clé (cohérents avec apikey.service.js)
const PUB_PREFIX = process.env.DEVELOPER_API_KEY_PREFIX_PUB || 'pk_live_';
const SEC_PREFIX = process.env.DEVELOPER_API_KEY_PREFIX_SEC || 'sk_live_';

/**
 * Masque la secret key pour l'affichage :
 *   sk_live_••••••••••••<4 derniers chars>
 */
function maskSecretKey(rawOrHash, prefix) {
  // On reçoit soit la valeur brute (sk_live_...) soit le hash SHA-256
  // Pour l'affichage masqué on n'a besoin que des 4 derniers chars de la clé stockée.
  const last4 = rawOrHash.slice(-4);
  return `${prefix}••••••••••••${last4}`;
}

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
    `SELECT id, account_id, name, description, logo_url,
            color_primary, color_secondary, display_name, webhook_url,
            status, created_at, updated_at
     FROM developer_projects
     WHERE id = $1 AND account_id = $2 AND status != 'deleted'`,
    [projectId, accountId]
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// GET /projects
// Lister tous les projets actifs/inactifs du compte développeur courant.
// Requirement 3.4, 3.8
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const userId = req.user.id;

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Aucun compte développeur trouvé. Appelez POST /accounts/me d\'abord.' },
      });
    }

    const { rows } = await pool.query(
      `SELECT id, name, status, created_at,
              (SELECT COUNT(*)
               FROM developer_projects
               WHERE account_id = $1 AND status != 'deleted') AS total
       FROM developer_projects
       WHERE account_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`,
      [accountId]
    );

    // total est identique pour chaque ligne - on l'extrait de la première
    const total = rows.length > 0 ? parseInt(rows[0].total, 10) : 0;
    const projects = rows.map(({ total: _t, ...p }) => p);

    return res.status(200).json({ projects, total });
  } catch (err) {
    console.error('[project.routes] GET / error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

// ---------------------------------------------------------------------------
// POST /projects
// Créer un nouveau projet et générer la paire de clés.
// Requirement 3.1, 3.2, 3.3, 3.7
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { name, description } = req.body;

  // Validation du nom : obligatoire, 2–100 caractères (Requirement 3.7)
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(422).json({
      error: {
        code: 'INVALID_PROJECT_NAME',
        message: 'Le nom du projet est obligatoire et doit contenir entre 2 et 100 caractères.',
      },
    });
  }

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Aucun compte développeur trouvé. Appelez POST /accounts/me d\'abord.' },
      });
    }

    // Générer la paire de clés avant la transaction (Requirement 3.3)
    const { publishable, secret, secretHash } = generateKeyPair();

    const client = await pool.connect();
    let project;
    try {
      await client.query('BEGIN');

      // Créer le projet
      const { rows: [newProject] } = await client.query(
        `INSERT INTO developer_projects (account_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING id, account_id, name, description, logo_url,
                   color_primary, color_secondary, display_name, webhook_url,
                   status, created_at, updated_at`,
        [accountId, name.trim(), description ?? null]
      );
      project = newProject;

      // Insérer la publishable key (stockée en clair)
      await client.query(
        `INSERT INTO developer_api_keys (project_id, key_type, key_prefix, key_value)
         VALUES ($1, 'publishable', $2, $3)`,
        [project.id, PUB_PREFIX, publishable]
      );

      // Insérer la secret key (stockée hashée en SHA-256)
      await client.query(
        `INSERT INTO developer_api_keys (project_id, key_type, key_prefix, key_value)
         VALUES ($1, 'secret', $2, $3)`,
        [project.id, SEC_PREFIX, secretHash]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Retourner HTTP 201 avec les données du projet et la secret key en clair
    // (une seule fois - Requirement 3.3, 4.2)
    return res.status(201).json({
      project,
      keys: {
        publishable_key: publishable,
        // La secret key brute est exposée une seule fois à la création
        secret_key: secret,
      },
    });
  } catch (err) {
    console.error('[project.routes] POST / error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

// ---------------------------------------------------------------------------
// GET /projects/:id
// Retourner le projet avec clés (secret masquée), config white-label et webhooks.
// Requirement 3.2, 3.4, 3.5
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Aucun compte développeur trouvé.' },
      });
    }

    // Vérification ownership (Requirement 3.4 - ownership check)
    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      // Le projet n'existe pas ou n'appartient pas au compte - HTTP 403
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Récupérer les clés actives (Requirement 4.1, 4.2)
    const { rows: keys } = await pool.query(
      `SELECT id, key_type, key_prefix, key_value, status, created_at, last_used_at
       FROM developer_api_keys
       WHERE project_id = $1 AND status = 'active'
       ORDER BY key_type`,
      [projectId]
    );

    const formattedKeys = keys.map((k) => {
      if (k.key_type === 'publishable') {
        return {
          id: k.id,
          key_type: k.key_type,
          key_value: k.key_value,           // Publishable : affichée en clair
          created_at: k.created_at,
          last_used_at: k.last_used_at,
        };
      }
      // Secret key : affichage masqué (Requirement 4.2)
      return {
        id: k.id,
        key_type: k.key_type,
        key_value: maskSecretKey(k.key_value, k.key_prefix),
        created_at: k.created_at,
        last_used_at: k.last_used_at,
      };
    });

    // White-label config (fields on the project row)
    const whiteLabelConfig = {
      logo_url: project.logo_url,
      color_primary: project.color_primary,
      color_secondary: project.color_secondary,
      display_name: project.display_name,
    };

    // Webhooks du projet (Requirement 10.1)
    const { rows: webhooks } = await pool.query(
      `SELECT id, url, events, status, failure_count, last_fired_at, created_at, updated_at
       FROM developer_webhooks
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    return res.status(200).json({
      project,
      keys: formattedKeys,
      white_label_config: whiteLabelConfig,
      webhooks,
    });
  } catch (err) {
    console.error('[project.routes] GET /:id error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

// ---------------------------------------------------------------------------
// PATCH /projects/:id
// Mettre à jour les champs autorisés du projet.
// Requirement 3.5
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;

  // Champs autorisés à la mise à jour (Requirement 3.2)
  const ALLOWED_FIELDS = [
    'name',
    'description',
    'logo_url',
    'color_primary',
    'color_secondary',
    'display_name',
    'webhook_url',
  ];

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Aucun compte développeur trouvé.' },
      });
    }

    // Vérification ownership
    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Construire la liste des champs à mettre à jour
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    // Validation du nom si fourni (Requirement 3.7)
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || updates.name.trim().length < 2 || updates.name.trim().length > 100) {
        return res.status(422).json({
          error: {
            code: 'INVALID_PROJECT_NAME',
            message: 'Le nom du projet doit contenir entre 2 et 100 caractères.',
          },
        });
      }
      updates.name = updates.name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: { code: 'NO_FIELDS_TO_UPDATE', message: 'Aucun champ valide à mettre à jour.' },
      });
    }

    // Construire la requête SQL dynamiquement
    const setClauses = Object.keys(updates).map((field, idx) => `${field} = $${idx + 2}`);
    setClauses.push(`updated_at = now()`);
    const values = [projectId, ...Object.values(updates)];

    const { rows: [updatedProject] } = await pool.query(
      `UPDATE developer_projects
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING id, account_id, name, description, logo_url,
                 color_primary, color_secondary, display_name, webhook_url,
                 status, created_at, updated_at`,
      values
    );

    // ── Propagation White_Label_Config via Redis pub/sub (Requirement 11.5) ──
    // Publier la nouvelle config sur le canal whitelabel:updated:{projectId}
    // Les SDK actifs peuvent s'abonner ou re-fetcher la config en moins de 5 min.
    const whitelabelPayload = JSON.stringify({
      logo_url:        updatedProject.logo_url,
      color_primary:   updatedProject.color_primary,
      color_secondary: updatedProject.color_secondary,
      display_name:    updatedProject.display_name,
      updated_at:      updatedProject.updated_at,
    });
    redis.publish(`whitelabel:updated:${projectId}`, whitelabelPayload).catch((err) => {
      console.warn('[project.routes] Redis publish whitelabel error:', err.message);
    });

    return res.status(200).json({ project: updatedProject });
  } catch (err) {
    console.error('[project.routes] PATCH /:id error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

// ---------------------------------------------------------------------------
// DELETE /projects/:id
// Soft-delete : status = 'deleted', deleted_at = now(), révoquer toutes les clés actives.
// Requirement 3.6
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;

  try {
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Aucun compte développeur trouvé.' },
      });
    }

    // Vérification ownership
    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Soft-delete du projet (Requirement 3.6)
      await client.query(
        `UPDATE developer_projects
         SET status = 'deleted', deleted_at = now(), updated_at = now()
         WHERE id = $1`,
        [projectId]
      );

      // Révoquer toutes les clés actives (Requirement 3.6)
      await client.query(
        `UPDATE developer_api_keys
         SET status = 'revoked', revoked_at = now()
         WHERE project_id = $1 AND status = 'active'`,
        [projectId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[project.routes] DELETE /:id error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

module.exports = router;
