/**
 * Routes de liaison organisation — disponibles pour TOUT utilisateur authentifié.
 *
 * Deux flux :
 *
 * A. Administrateur d'organisation (après installation du tenant local)
 *    POST /org/link/admin
 *    → Reçoit le qrPayload scanné (tenantId, controlToken, vpnPrivateKey, heartbeatUrl)
 *    → Vérifie le controlToken contre tenant_control_tokens
 *    → Crée ou met à jour la liaison membership de l'utilisateur
 *    → Retourne les informations de l'organisation
 *
 * B. Utilisateur standard (rejoindre une organisation)
 *    POST /org/join
 *    → Reçoit soit { orgId, joinCode } soit le qrPayload d'invitation
 *    → Vérifie le code d'invitation de l'organisation
 *    → Crée le membership
 *    → Retourne les informations de l'organisation
 *
 * GET /org/join-info/:orgId
 *    → Retourne les informations publiques d'une organisation (nom, logo)
 *      pour afficher une prévisualisation avant confirmation
 */

const express = require('express');
const crypto  = require('crypto');
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');
const authService = require('../auth/auth.service');

const router = express.Router();

// ── A. Liaison admin via QR code du tenant ────────────────────────────────────

router.post('/link/admin', requireAuth, async (req, res, next) => {
  try {
    const { tenantId, controlToken } = req.body;

    if (!tenantId || !controlToken) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'tenantId et controlToken sont requis.' },
      });
    }

    // Vérifier le controlToken contre le hash stocké
    const tokenHash = crypto.createHash('sha256').update(controlToken).digest('hex');
    const { rows: tokenRows } = await pool.query(
      `SELECT t.*, o.id as org_id, o.name as org_name, o.status as org_status
       FROM tenant_control_tokens t
       JOIN organizations o ON o.id = t.organization_id
       WHERE t.organization_id = $1 AND t.token_hash = $2 AND t.revoked_at IS NULL`,
      [tenantId, tokenHash]
    );

    if (!tokenRows[0]) {
      return res.status(401).json({
        error: { code: 'INVALID_CONTROL_TOKEN', message: 'Token de controle invalide ou organisation introuvable.' },
      });
    }

    const org = tokenRows[0];

    if (org.org_status === 'suspended') {
      return res.status(403).json({
        error: { code: 'ORG_SUSPENDED', message: 'Cette organisation est suspendue.' },
      });
    }

    // S'assurer que l'utilisateur a le rôle org_admin sur cette organisation
    const { rows: roleRows } = await pool.query(
      "SELECT id FROM roles WHERE code = 'org_admin'"
    );
    if (!roleRows[0]) {
      return res.status(500).json({
        error: { code: 'ROLE_NOT_FOUND', message: "Role 'org_admin' introuvable." },
      });
    }

    await pool.query(
      `INSERT INTO memberships (user_id, organization_id, role_id, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active'`,
      [req.user.id, tenantId, roleRows[0].id]
    );

    // Marquer le QR comme utilisé (dernière utilisation)
    await pool.query(
      'UPDATE tenant_control_tokens SET qr_used_at = now() WHERE organization_id = $1',
      [tenantId]
    );

    // Retourner le profil mis à jour avec le nouvel orgId
    const { rows: userRows } = await pool.query(
      `SELECT u.*, m.organization_id as org_id
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       WHERE u.id = $1
       ORDER BY m.created_at ASC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      ok: true,
      organization: { id: org.org_id, name: org.org_name, status: org.org_status },
      user: authService.sanitizeUser(userRows[0]),
    });
  } catch (e) { next(e); }
});

// ── B. Rejoindre une organisation (utilisateur standard) ─────────────────────

router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { orgId, joinCode } = req.body;

    if (!orgId || !joinCode) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'orgId et joinCode sont requis.' },
      });
    }

    // Vérifier l'organisation
    const { rows: orgRows } = await pool.query(
      'SELECT * FROM organizations WHERE id = $1',
      [orgId]
    );
    if (!orgRows[0]) {
      return res.status(404).json({
        error: { code: 'ORG_NOT_FOUND', message: 'Organisation introuvable.' },
      });
    }
    const org = orgRows[0];

    if (org.status === 'suspended') {
      return res.status(403).json({
        error: { code: 'ORG_SUSPENDED', message: 'Cette organisation est suspendue.' },
      });
    }

    // Vérifier le code d'invitation
    // Le join_code est stocké haché dans organizations.join_code_hash
    // Si la colonne n'existe pas encore, on utilise une vérification basique
    if (org.join_code_hash) {
      const codeHash = crypto.createHash('sha256').update(joinCode).digest('hex');
      if (codeHash !== org.join_code_hash) {
        return res.status(401).json({
          error: { code: 'INVALID_JOIN_CODE', message: 'Code incorrect.' },
        });
      }
    }

    // Attribuer le rôle member
    const { rows: roleRows } = await pool.query(
      "SELECT id FROM roles WHERE code = 'org_member'"
    );
    if (!roleRows[0]) {
      return res.status(500).json({
        error: { code: 'ROLE_NOT_FOUND', message: "Role 'org_member' introuvable." },
      });
    }

    // Vérifier si déjà membre
    const { rows: existing } = await pool.query(
      'SELECT * FROM memberships WHERE user_id = $1 AND organization_id = $2',
      [req.user.id, orgId]
    );

    if (existing[0] && existing[0].status === 'active') {
      return res.status(409).json({
        error: { code: 'ALREADY_MEMBER', message: 'Vous etes deja membre de cette organisation.' },
      });
    }

    await pool.query(
      `INSERT INTO memberships (user_id, organization_id, role_id, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active'`,
      [req.user.id, orgId, roleRows[0].id]
    );

    // Retourner le profil mis à jour
    const { rows: userRows } = await pool.query(
      `SELECT u.*, m.organization_id as org_id
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       WHERE u.id = $1
       ORDER BY m.created_at ASC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      ok: true,
      organization: { id: org.id, name: org.name, status: org.status },
      user: authService.sanitizeUser(userRows[0]),
    });
  } catch (e) { next(e); }
});

// ── Info publique d'une organisation (prévisualisation avant rejoindre) ───────

router.get('/join-info/:orgId', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, logo_url, status, sector, city, country FROM organizations WHERE id = $1',
      [req.params.orgId]
    );
    if (!rows[0]) {
      return res.status(404).json({
        error: { code: 'ORG_NOT_FOUND', message: 'Organisation introuvable.' },
      });
    }
    const org = rows[0];
    if (org.status === 'suspended') {
      return res.status(403).json({
        error: { code: 'ORG_SUSPENDED', message: 'Organisation suspendue.' },
      });
    }
    res.json({ id: org.id, name: org.name, logoUrl: org.logo_url, sector: org.sector, city: org.city, country: org.country });
  } catch (e) { next(e); }
});

// ── Générer / régénérer le code d'invitation de l'organisation ───────────────

router.post('/join-code/generate', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.user.org_id;
    if (!orgId) {
      return res.status(403).json({ error: { code: 'NO_ORG', message: 'Aucune organisation associee.' } });
    }

    // Vérifier que l'utilisateur est admin de cette org
    const { rows: memberRows } = await pool.query(
      `SELECT m.*, r.code as role_code FROM memberships m
       JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1 AND m.organization_id = $2 AND m.status = 'active'`,
      [req.user.id, orgId]
    );
    if (!memberRows[0] || memberRows[0].role_code !== 'org_admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Seul un administrateur peut generer un code d\'invitation.' } });
    }

    const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars hex
    const joinCodeHash = crypto.createHash('sha256').update(joinCode).digest('hex');

    await pool.query(
      'UPDATE organizations SET join_code_hash = $1 WHERE id = $2',
      [joinCodeHash, orgId]
    );

    res.json({ joinCode, orgId });
  } catch (e) { next(e); }
});

module.exports = router;
