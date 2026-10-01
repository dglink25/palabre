'use strict';

/**
 * Tenant Provisioning Routes
 * Montées sous /api/v1/tenants
 *
 * Routes publiques (authentifiées par controlToken) :
 *   POST /api/v1/tenants/register   — Enregistrer un nouveau Tenant_Server
 *   POST /api/v1/tenants/heartbeat  — Heartbeat HTTP (fallback si WebSocket indispo)
 *   GET  /api/v1/tenants/:orgId/status — Statut du tenant
 *
 * Routes super-admin :
 *   GET  /api/v1/tenants             — Lister tous les tenants actifs
 *   POST /api/v1/tenants/:orgId/suspend — Suspendre un tenant
 *   POST /api/v1/tenants/:orgId/reactivate — Réactiver un tenant
 *
 * Routes relatives au relay (utilisées par les clients web/mobile) :
 *   GET  /api/v1/tenants/resolve/:orgId  — Résoudre l'URL du tenant pour un org
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { requireAuth } = require('../../middleware/authMiddleware');
const { requireSuperAdmin } = require('../../middleware/rbac');
const provService = require('./tenant-provisioning.service');
const { isTenantConnected, getConnectionCount } = require('./tunnel.gateway');

const router = express.Router();

// ── Rate limiting ─────────────────────────────────────────────────────────────
const registerLimiter  = rateLimit({ windowMs: 5 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const heartbeatLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

// ═════════════════════════════════════════════════════════════════════════════
// POST /tenants/register — Enregistrer un Tenant_Server
// ═════════════════════════════════════════════════════════════════════════════

router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { orgId, orgSlug, publicKey, ipAddress, localIp, componentsVersion, controlToken } = req.body;

    if (!orgId || !publicKey || !ipAddress || !controlToken) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TENANT_CONFIG',
          message: 'Champs obligatoires manquants : orgId, publicKey, ipAddress, controlToken',
        },
      });
    }

    // Validation basique de l'IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    if (!ipRegex.test(ipAddress)) {
      return res.status(400).json({
        error: { code: 'INVALID_IP', message: 'Adresse IP invalide.' },
      });
    }

    const result = await provService.registerTenant({
      orgId, orgSlug, publicKey,
      ipAddress,                    // IP publique → DNS public central (pour le tunnel)
      localIp: localIp || null,     // IP locale LAN → DNS local dnsmasq (pour accès direct)
      componentsVersion: componentsVersion || '1.0.0',
      controlToken,
    });

    res.status(result.alreadyRegistered ? 200 : 201).json({
      tenantSubdomain:    result.tenantSubdomain,
      registrationToken:  result.registrationToken,
      alreadyRegistered:  result.alreadyRegistered,
      dnsTtl:             result.dnsTtl || 300,
      tunnelSocketUrl:    `${process.env.APP_BASE_URL || ''}/tunnel/socket?orgId=${orgId}&token=`,
    });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /tenants/heartbeat — Heartbeat HTTP (fallback du WebSocket)
// ═════════════════════════════════════════════════════════════════════════════

router.post('/heartbeat', heartbeatLimiter, async (req, res, next) => {
  try {
    const { orgId, controlToken, components, version } = req.body;

    if (!orgId || !controlToken) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'orgId et controlToken requis.' },
      });
    }

    // Vérifier le controlToken
    const crypto = require('crypto');
    const { pool } = require('../../config/db');
    const tokenHash = crypto.createHash('sha256').update(controlToken).digest('hex');
    const { rows } = await pool.query(
      `SELECT t.organization_id FROM tenant_control_tokens t
       WHERE t.organization_id = $1 AND t.token_hash = $2 AND t.revoked_at IS NULL`,
      [orgId, tokenHash]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: { code: 'INVALID_CONTROL_TOKEN', message: 'Token invalide.' } });
    }

    const ipAddress = req.ip || req.socket?.remoteAddress;
    const result = await provService.processHeartbeat({
      orgId, components: components || {}, version,
      ipAddress,
    });

    res.json({
      orgStatus:  result.orgStatus,
      receivedAt: result.receivedAt,
      tunnelConnected: isTenantConnected(orgId),
    });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /tenants/resolve/:orgId — Résoudre l'URL du tenant pour un orgId
// Utilisé par le NetworkDetector côté client
// ═════════════════════════════════════════════════════════════════════════════

router.get('/resolve/:orgId', requireAuth, async (req, res, next) => {
  try {
    const { orgId } = req.params;

    // Vérifier que l'utilisateur appartient à cette organisation
    if (req.user.org_id !== orgId && !req.user.is_super_admin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
    }

    const status = await provService.getTenantStatus(orgId);
    if (!status) {
      return res.status(404).json({ error: { code: 'TENANT_NOT_FOUND', message: 'Aucun tenant enregistré pour cette organisation.' } });
    }

    res.json({
      tenantSubdomain: status.tenantSubdomain,
      tenantUrl:       `https://${status.tenantSubdomain}`,
      relayUrl:        `${process.env.APP_BASE_URL || ''}/relay/${orgId}`,
      tunnelStatus:    status.tunnelStatus,
      dnsProvisioned:  status.dnsProvisioned,
    });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /tenants/:orgId/status — Statut détaillé d'un tenant
// ═════════════════════════════════════════════════════════════════════════════

router.get('/:orgId/status', requireAuth, async (req, res, next) => {
  try {
    const { orgId } = req.params;

    if (req.user.org_id !== orgId && !req.user.is_super_admin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
    }

    const status = await provService.getTenantStatus(orgId);
    if (!status) {
      return res.status(404).json({ error: { code: 'TENANT_NOT_FOUND', message: 'Tenant non enregistré.' } });
    }

    res.json({
      ...status,
      wsConnected: isTenantConnected(orgId),
    });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// Routes super-admin
// ═════════════════════════════════════════════════════════════════════════════

// GET /tenants — Liste tous les tenants
router.get('/', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page  || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const tenants = await provService.listActiveTenants({ page, limit });

    res.json({
      tenants: tenants.map(t => ({
        ...t,
        wsConnected: isTenantConnected(t.orgId),
      })),
      meta: { page, limit, totalConnected: getConnectionCount() },
    });
  } catch (err) { next(err); }
});

// POST /tenants/:orgId/suspend
router.post('/:orgId/suspend', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { pool } = require('../../config/db');
    await pool.query(
      "UPDATE tenant_registrations SET status = 'suspended', updated_at = now() WHERE organization_id = $1",
      [req.params.orgId]
    );

    // Notifier le tenant via WebSocket
    const { sendToTenant } = require('./tunnel.gateway');
    sendToTenant(req.params.orgId, {
      type:      'directive:update',
      orgStatus: 'suspended',
      directives: { allowConnections: false, allowOutboundCalls: false, messagingMode: 'readonly' },
    });

    res.json({ ok: true, orgId: req.params.orgId, status: 'suspended' });
  } catch (err) { next(err); }
});

// POST /tenants/:orgId/reactivate
router.post('/:orgId/reactivate', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { pool } = require('../../config/db');
    await pool.query(
      "UPDATE tenant_registrations SET status = 'active', updated_at = now() WHERE organization_id = $1",
      [req.params.orgId]
    );

    const { sendToTenant } = require('./tunnel.gateway');
    sendToTenant(req.params.orgId, {
      type:      'directive:update',
      orgStatus: 'active',
      directives: { allowConnections: true, allowOutboundCalls: true, messagingMode: 'full' },
    });

    res.json({ ok: true, orgId: req.params.orgId, status: 'active' });
  } catch (err) { next(err); }
});

module.exports = router;
