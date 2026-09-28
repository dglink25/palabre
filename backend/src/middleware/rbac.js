const { pool } = require('../config/db');

/**
 * ======================================================================
 * CONTRÔLE D'ACCÈS PAR RÔLE (section 36 du cahier des charges)
 * ======================================================================
 * Palabre est multi-tenant : la plupart des permissions sont scoping à une
 * organisation précise, via `memberships` (user × organization × role).
 * `requireSuperAdmin` couvre le rôle plateforme (hors organisation) ;
 * `requireOrgRole` couvre les rôles internes à une organisation, et prend
 * soin de vérifier l'appartenance à CETTE organisation précisément - c'est
 * ce qui garantit qu'une organisation ne peut jamais accéder aux données
 * d'une autre (isolation stricte demandée section 36).
 */

function requireSuperAdmin(req, res, next) {
  if (!req.user.is_super_admin) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Réservé au super-administrateur de la plateforme.' },
    });
  }
  next();
}

/**
 * `organizationIdParam` : nom du paramètre de route contenant l'ID
 * d'organisation (par défaut `organizationId`). Les super-administrateurs
 * passent toujours ce contrôle (accès plateforme transverse).
 */
function requireOrgRole(allowedRoleCodes, organizationIdParam = 'organizationId') {
  return async (req, res, next) => {
    try {
      if (req.user.is_super_admin) return next();

      const organizationId = req.params[organizationIdParam] || req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: { code: 'ORG_ID_REQUIRED', message: 'Identifiant d\'organisation requis.' } });
      }

      const { rows } = await pool.query(
        `SELECT r.code FROM memberships m
         JOIN roles r ON r.id = m.role_id
         WHERE m.user_id = $1 AND m.organization_id = $2 AND m.status = 'active'`,
        [req.user.id, organizationId]
      );

      const roleCode = rows[0] && rows[0].code;
      if (!roleCode || !allowedRoleCodes.includes(roleCode)) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Rôle insuffisant pour cette action dans cette organisation.' },
        });
      }

      req.orgRole = roleCode;
      req.organizationId = organizationId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireSuperAdmin, requireOrgRole };
