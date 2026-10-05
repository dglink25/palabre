// backend/src/modules/developer/developer.routes.js
const router = require('express').Router();
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');
const { requireApiKey } = require('./developer.middleware');
const accountRoutes = require('./account.routes');
const projectRoutes = require('./project.routes');
const apikeyRoutes  = require('./apikey.routes');
const proxyRoutes   = require('./proxy.routes');
const webhookRoutes = require('./webhook.routes');
const statsRoutes   = require('./stats.routes');

// ---------------------------------------------------------------------------
// Route publique GET /projects/:id/config
// Authentifiée par X-Palabre-Key - accessible aux SDK sans SSO JWT.
// Requirements: 11.1, 11.5
// ---------------------------------------------------------------------------
router.get('/projects/:id/config', requireApiKey, async (req, res) => {
  const { id: projectId } = req.params;

  // requireApiKey a résolu req.projectId depuis la clé fournie.
  // On s'assure que la clé correspond bien au projet demandé.
  if (req.projectId !== projectId) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'La clé API fournie ne correspond pas au projet demandé.',
      },
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT logo_url, color_primary, color_secondary, display_name
       FROM developer_projects
       WHERE id = $1 AND status = 'active'
       LIMIT 1`,
      [projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Projet introuvable ou inactif.' },
      });
    }

    const { logo_url, color_primary, color_secondary, display_name } = rows[0];

    return res.status(200).json({
      white_label_config: {
        logo_url,
        color_primary,
        color_secondary,
        display_name,
      },
    });
  } catch (err) {
    console.error('[developer.routes] GET /projects/:id/config error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  }
});

// ---------------------------------------------------------------------------
// Routes protégées par SSO JWT (Developer_Portal)
// ---------------------------------------------------------------------------
router.use('/accounts', requireAuth, accountRoutes);
router.use('/projects', requireAuth, projectRoutes);

// ---------------------------------------------------------------------------
// Routes protégées par clé API (applications tierces via SDK)
// L'auth est gérée dans developer.middleware (requireApiKey / requireSecretKey)
// ---------------------------------------------------------------------------
router.use('/proxy', proxyRoutes);

// ---------------------------------------------------------------------------
// Webhooks, stats et clés API (protégés par SSO du Developer_Portal)
// ---------------------------------------------------------------------------
router.use('/projects', requireAuth, webhookRoutes);
router.use('/projects', requireAuth, statsRoutes);
router.use('/projects', requireAuth, apikeyRoutes);

// ---------------------------------------------------------------------------
// Documentation OpenAPI developer
// Requirements: 9.1, 9.2
// ---------------------------------------------------------------------------
router.get('/docs', (_req, res) => {
  res.json(require('../../docs/swagger-developer'));
});

module.exports = router;
