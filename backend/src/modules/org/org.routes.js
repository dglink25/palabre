/**
 * Routes de liaison organisation - disponibles pour TOUT utilisateur authentifié.
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
const rateLimit = require('express-rate-limit');
const { pool } = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');
const authService = require('../auth/auth.service');

const router = express.Router();

// ── GET /org/me - infos complètes de l'organisation de l'admin connecté ──────

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.user.org_id;
    if (!orgId) {
      return res.status(404).json({ error: { code: 'NO_ORG', message: 'Aucune organisation liee a ce compte.' } });
    }

    // Infos org + statut VPN + demande d'origine
    const orgResult = await pool.query(
      `SELECT o.*,
              v.status as vpn_status,
              v.public_key as vpn_public_key,
              (SELECT MAX(hl.received_at) FROM heartbeat_logs hl WHERE hl.organization_id = o.id) as last_heartbeat,
              r.id as request_id, r.step3_documents
       FROM organizations o
       LEFT JOIN vpn_peers v ON v.organization_id = o.id
       LEFT JOIN organization_requests r ON r.organization_id = o.id AND r.status = 'approved'
       WHERE o.id = $1 LIMIT 1`,
      [orgId]
    );
    const org = orgResult.rows[0];
    if (!org) return res.status(404).json({ error: { code: 'ORG_NOT_FOUND', message: 'Organisation introuvable.' } });

    const secondsAgo = org.last_heartbeat
      ? Math.floor((Date.now() - new Date(org.last_heartbeat).getTime()) / 1000)
      : null;

    let vpnStatus = 'unknown';
    if (secondsAgo !== null) {
      if (secondsAgo < 120)      vpnStatus = 'active';
      else if (secondsAgo < 300) vpnStatus = 'degraded';
      else                       vpnStatus = 'offline';
    }

    res.json({
      id:            org.id,
      name:          org.name,
      headquarters:  org.headquarters,
      country:       org.country,
      city:          org.city,
      address:       org.address,
      sector:        org.sector,
      ifuNumber:     org.ifu_number,
      logoUrl:       org.logo_url,
      status:        org.status,
      requestId:     org.request_id,
      vpn: {
        status:      vpnStatus,
        publicKey:   org.vpn_public_key,
        lastHeartbeat: org.last_heartbeat,
        secondsAgo,
      },
      createdAt:     org.created_at,
    });
  } catch (err) { next(err); }
});

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

    // Vérifier le code d'invitation - OBLIGATOIRE, jamais contournable
    if (!org.join_code_hash) {
      return res.status(403).json({
        error: { code: 'JOIN_CODE_NOT_SET', message: 'Cette organisation n\'a pas encore genere de code d\'invitation. Demandez a votre administrateur de generer un code depuis son tableau de bord.' },
      });
    }
    const codeHash = crypto.createHash('sha256').update(joinCode).digest('hex');
    if (codeHash !== org.join_code_hash) {
      return res.status(401).json({
        error: { code: 'INVALID_JOIN_CODE', message: 'Code incorrect. Verifiez le code fourni par votre administrateur.' },
      });
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

// ── Heartbeat tenant ─────────────────────────────────────────────────────────
// Appelé régulièrement par l'instance locale du tenant pour confirmer sa
// présence et recevoir son statut officiel (actif / suspendu / archivé).
// Ce mécanisme est la brique de contrôle centrale décrite en section 10.2
// du cahier des charges - il fonctionne même quand l'org est suspendue.

const tenantLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.post('/tenants/heartbeat', tenantLimiter, async (req, res, next) => {
  try {
    const { tenantId, controlToken } = req.body;
    if (!tenantId || !controlToken) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'tenantId et controlToken requis.' } });
    }

    const tokenHash = crypto.createHash('sha256').update(controlToken).digest('hex');
    const { rows } = await pool.query(
      `SELECT t.*, o.status as org_status, o.name as org_name
       FROM tenant_control_tokens t
       JOIN organizations o ON o.id = t.organization_id
       WHERE t.organization_id = $1 AND t.token_hash = $2 AND t.revoked_at IS NULL`,
      [tenantId, tokenHash]
    );

    if (!rows[0]) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token de controle invalide.' } });
    }

    const org = rows[0];

    // Enregistrer le heartbeat + URL de l'agent si fournie
    const agentUrl = req.body.agentUrl || null;
    const agentVersion = req.body.agentVersion || null;
    await pool.query(
      `INSERT INTO heartbeat_logs (organization_id, status_reported, received_at, agent_url, agent_version)
       VALUES ($1, $2, now(), $3, $4)`,
      [tenantId, org.org_status, agentUrl, agentVersion]
    );

    // Mettre à jour la table tenant_agents avec l'URL publique si fournie
    if (agentUrl) {
      await pool.query(
        `INSERT INTO tenant_agents (organization_id, agent_url, agent_version, last_seen_at, status)
         VALUES ($1, $2, $3, now(), 'active')
         ON CONFLICT (organization_id)
         DO UPDATE SET agent_url = EXCLUDED.agent_url,
                       agent_version = EXCLUDED.agent_version,
                       last_seen_at = now(),
                       status = 'active',
                       updated_at = now()`,
        [tenantId, agentUrl, agentVersion]
      );
    }

    // Retourner le statut officiel - l'agent tenant applique ce statut localement
    res.json({
      tenantId,
      status:     org.org_status,   // 'active' | 'suspended' | 'archived'
      orgName:    org.org_name,
      receivedAt: new Date().toISOString(),
      // Directives optionnelles à appliquer côté tenant
      directives: {
        allowConnections: org.org_status === 'active',
        allowOutboundCalls: org.org_status === 'active',
        messagingMode: org.org_status === 'active' ? 'full' : 'readonly',
      },
    });
  } catch (e) { next(e); }
});

// ── Statut VPN en temps réel (pour l'interface admin org) ────────────────────
// Retourne le dernier heartbeat reçu pour afficher le statut dans OrgVpnPage.

router.get('/tenants/:orgId/status', requireAuth, async (req, res, next) => {
  try {
    const { orgId } = req.params;

    // Vérifier que l'utilisateur appartient à cette organisation
    const orgIdFromUser = req.user.org_id;
    if (orgId !== orgIdFromUser && !req.user.is_super_admin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Acces refuse.' } });
    }

    const { rows: orgRows } = await pool.query('SELECT status FROM organizations WHERE id = $1', [orgId]);
    if (!orgRows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organisation introuvable.' } });

    const { rows: heartbeatRows } = await pool.query(
      `SELECT received_at, status_reported FROM heartbeat_logs
       WHERE organization_id = $1
       ORDER BY received_at DESC LIMIT 1`,
      [orgId]
    );

    const lastHeartbeat = heartbeatRows[0];
    const now = Date.now();
    const lastSeen = lastHeartbeat ? new Date(lastHeartbeat.received_at).getTime() : null;
    const secondsAgo = lastSeen ? Math.floor((now - lastSeen) / 1000) : null;

    // Détermine le statut VPN :
    // - active   : heartbeat reçu il y a moins de 120s
    // - degraded : heartbeat reçu il y a 120s-300s
    // - offline  : pas de heartbeat depuis plus de 300s ou jamais reçu
    let vpnStatus = 'unknown';
    if (secondsAgo !== null) {
      if (secondsAgo < 120)       vpnStatus = 'active';
      else if (secondsAgo < 300)  vpnStatus = 'degraded';
      else                        vpnStatus = 'offline';
    }

    res.json({
      orgStatus:      orgRows[0].status,
      vpnStatus,
      lastHeartbeat:  lastHeartbeat?.received_at || null,
      secondsAgo,
    });
  } catch (e) { next(e); }
});

// ── Régénération du QR code / controlToken ────────────────────────────────────
// Si l'admin a perdu le QR avant de configurer son tunnel, le super-admin
// peut régénérer un nouveau token de contrôle + paire VPN.
// L'ancien token est révoqué, les secrets sont renvoyés UNE SEULE FOIS.

router.post('/tenants/:orgId/regenerate-qr', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.is_super_admin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Seul le super-administrateur peut regenerer le QR.' } });
    }

    const { orgId } = req.params;

    const { rows: orgRows } = await pool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    if (!orgRows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organisation introuvable.' } });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Révoquer l'ancien token de contrôle
      await client.query(
        'UPDATE tenant_control_tokens SET revoked_at = now() WHERE organization_id = $1 AND revoked_at IS NULL',
        [orgId]
      );

      // Générer un nouveau token de contrôle
      const rawControlToken = crypto.randomBytes(32).toString('base64url');
      await client.query(
        `INSERT INTO tenant_control_tokens (organization_id, token_hash, qr_issued_at)
         VALUES ($1, $2, now())`,
        [orgId, crypto.createHash('sha256').update(rawControlToken).digest('hex')]
      );

      // Générer une nouvelle paire VPN WireGuard x25519
      const { privateKey: wgPriv, publicKey: wgPub } = crypto.generateKeyPairSync('x25519', {
        publicKeyEncoding:  { type: 'spki',  format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      });
      const wgPrivateKeyB64 = wgPriv.subarray(16).toString('base64');
      const wgPublicKeyB64  = wgPub.subarray(12).toString('base64');

      // Mettre à jour la clé publique stockée
      await client.query(
        `UPDATE vpn_peers SET public_key = $1, status = 'pending', connected_at = NULL
         WHERE organization_id = $2`,
        [wgPublicKeyB64, orgId]
      );

      await client.query('COMMIT');

      // Retourner le nouveau payload QR (une seule fois, non stocké)
      res.json({
        ok: true,
        qrPayload: {
          tenantId:      orgId,
          controlToken:  rawControlToken,
          vpnPrivateKey: wgPrivateKeyB64,
          vpnPublicKey:  wgPublicKeyB64,
          heartbeatUrl:  `${process.env.APP_BASE_URL || ''}/api/v1/org/tenants/heartbeat`,
        },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) { next(e); }
});

module.exports = router;
