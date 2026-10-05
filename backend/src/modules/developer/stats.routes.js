// backend/src/modules/developer/stats.routes.js
// Statistiques d'usage d'un projet développeur.
// Protégé par requireAuth (SSO JWT), appliqué au niveau de developer.routes.js.
//
// Requirements: 12.1, 12.3

'use strict';

const router       = require('express').Router();
const { pool }     = require('../../config/db');
const statsService = require('./stats.service');

// Valeurs de période acceptées (Requirement 12.3)
const VALID_PERIODS = ['today', '7d', '30d', '90d'];
const DEFAULT_PERIOD = '30d';

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
 * Retourne true si ownership confirmé, false sinon.
 * Inclut les projets supprimés (soft-delete) pour permettre la lecture
 * des stats historiques (Requirement 12.4).
 */
async function checkProjectOwnership(projectId, accountId) {
  const { rows } = await pool.query(
    `SELECT id
     FROM developer_projects
     WHERE id = $1 AND account_id = $2`,
    [projectId, accountId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// GET /:id/stats?period=today|7d|30d|90d
// Retourner les statistiques agrégées du projet pour la période demandée.
// Requirements: 12.1, 12.3
// ---------------------------------------------------------------------------
router.get('/:id/stats', async (req, res) => {
  const userId    = req.user.id;
  const projectId = req.params.id;

  // Validation + normalisation du paramètre period (Requirement 12.3)
  let period = req.query.period;
  if (!period || !VALID_PERIODS.includes(period)) {
    period = DEFAULT_PERIOD;
  }

  try {
    // Résoudre le compte développeur
    const accountId = await getAccountId(userId);
    if (!accountId) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: "Aucun compte développeur trouvé. Appelez POST /accounts/me d'abord.",
        },
      });
    }

    // Vérifier l'ownership du projet (Requirement 12.1, 12.3)
    const owned = await checkProjectOwnership(projectId, accountId);
    if (!owned) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé ou projet introuvable.' },
      });
    }

    // Déléguer l'agrégation au service stats
    // Si aucune donnée, getStats() retourne déjà des compteurs à zéro
    // sans erreur (Requirement 12.5).
    const stats = await statsService.getStats(projectId, period);

    return res.status(200).json({
      project_id: projectId,
      period,
      stats: {
        messages_sent: stats.messages_sent,
        calls_made:    stats.calls_made,
        active_users:  stats.active_users,
        api_calls:     stats.api_calls,
      },
    });
  } catch (err) {
    console.error('[stats.routes] GET /:id/stats error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

module.exports = router;
