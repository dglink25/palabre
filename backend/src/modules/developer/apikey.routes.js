// backend/src/modules/developer/apikey.routes.js
// Routes de gestion des clés API d'un projet.
// Montées sous /api/v1/developer/projects via developer.routes.js (avec requireAuth SSO).
//
//   GET  /projects/:id/keys          - lister les clés actives (secret masquée)
//   POST /projects/:id/keys/rotate   - rotation d'une clé (once-only, confirm requis)
//
// Note : GET /projects/:id/config (White_Label_Config publique) est définie
//        directement dans developer.routes.js pour éviter requireAuth.
//
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.6

'use strict';

const router = require('express').Router();
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const { rotateKey } = require('./apikey.service');

// ---------------------------------------------------------------------------
// Helpers internes (partagés avec project.routes.js)
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
    `SELECT id, account_id, name, logo_url,
            color_primary, color_secondary, display_name,
            status
     FROM developer_projects
     WHERE id = $1 AND account_id = $2 AND status != 'deleted'`,
    [projectId, accountId]
  );
  return rows[0] ?? null;
}

/**
 * Masque la secret key pour l'affichage.
 * Format : sk_live_••••••••••••<4 derniers chars de la valeur stockée>
 * Requirements: 4.2
 */
function maskSecretKey(storedValue, prefix) {
  const last4 = storedValue.slice(-4);
  return `${prefix}••••••••••••${last4}`;
}

// ---------------------------------------------------------------------------
// GET /:id/keys
// Lister les clés actives du projet.
// Retourne la publishable en clair, la secret masquée, avec created_at et last_used_at.
// Requirements: 4.1, 4.2, 4.6
// ---------------------------------------------------------------------------
router.get('/:id/keys', async (req, res) => {
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

    // Vérification ownership
    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Récupérer les clés actives
    const { rows: keys } = await pool.query(
      `SELECT id, key_type, key_prefix, key_value, created_at, last_used_at
       FROM developer_api_keys
       WHERE project_id = $1 AND status = 'active'
       ORDER BY key_type`,
      [projectId]
    );

    const formattedKeys = keys.map((k) => {
      if (k.key_type === 'publishable') {
        // Publishable : affichée en clair (Requirement 4.1)
        return {
          id: k.id,
          key_type: k.key_type,
          key_value: k.key_value,
          created_at: k.created_at,
          last_used_at: k.last_used_at,
        };
      }
      // Secret : masquée (Requirement 4.2)
      return {
        id: k.id,
        key_type: k.key_type,
        key_value: maskSecretKey(k.key_value, k.key_prefix),
        created_at: k.created_at,
        last_used_at: k.last_used_at,
      };
    });

    return res.status(200).json({ keys: formattedKeys });
  } catch (err) {
    console.error('[apikey.routes] GET /:id/keys error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/keys/rotate
// Rotation d'une clé (publishable ou secret).
// Exige `confirm: true` dans le body, sinon HTTP 422.
// Retourne la nouvelle clé brute (once-only).
// Requirements: 4.3, 4.4
// ---------------------------------------------------------------------------
router.post('/:id/keys/rotate', async (req, res) => {
  const userId = req.user.id;
  const { id: projectId } = req.params;
  const { confirm, key_type: keyType } = req.body;

  // Validation de la confirmation (Requirement 4.4)
  if (confirm !== true) {
    return res.status(422).json({
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message:
          'La rotation doit être confirmée explicitement. Fournissez `confirm: true` dans le body.',
      },
    });
  }

  // Validation du type de clé
  if (!keyType || !['publishable', 'secret'].includes(keyType)) {
    return res.status(422).json({
      error: {
        code: 'INVALID_KEY_TYPE',
        message: "Le champ `key_type` est obligatoire et doit valoir 'publishable' ou 'secret'.",
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

    // Vérification ownership
    const project = await getOwnedProject(projectId, accountId);
    if (!project) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Effectuer la rotation (Requirement 4.3)
    const newKeyRaw = await rotateKey(pool, redis, projectId, keyType);

    // Retourner la nouvelle clé brute - une seule fois (Requirement 4.3)
    return res.status(200).json({
      message: 'Rotation effectuée avec succès. Copiez la nouvelle clé maintenant - elle ne sera plus affichée.',
      key_type: keyType,
      new_key: newKeyRaw,
    });
  } catch (err) {
    if (err.code === 'KEY_NOT_FOUND') {
      return res.status(404).json({
        error: { code: 'KEY_NOT_FOUND', message: err.message },
      });
    }
    console.error('[apikey.routes] POST /:id/keys/rotate error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

module.exports = router;
