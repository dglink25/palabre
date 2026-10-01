'use strict';

/**
 * Tenant Provisioning Service
 *
 * Gère l'enregistrement des tenants locaux :
 * 1. Validation et unicité du sous-domaine
 * 2. Provisionnement DNS via dns.service.js
 * 3. Persistance dans tenant_registrations
 * 4. Gestion des heartbeats et statuts
 * 5. Audit des événements tunnel
 */

const crypto   = require('crypto');
const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const dnsService = require('./dns.service');

// ── Clé Redis pour les connexions tunnel actives ──────────────────────────────
function tunnelKey(orgId) {
  return `tunnel:connected:${orgId}`;
}

// ── Générer un slug sûr depuis le nom de l'organisation ───────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // enlever les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'org';
}

// ── Log d'audit tunnel ─────────────────────────────────────────────────────────
async function logTunnelEvent({ orgId, eventType, ipAddress = null, bytesRelayed = 0, errorMessage = null, metadata = {} }) {
  try {
    await pool.query(
      `INSERT INTO tenant_tunnel_logs
         (organization_id, event_type, ip_address, bytes_relayed, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, eventType, ipAddress, bytesRelayed, errorMessage, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('[tenant-provisioning] tunnel log error:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ENREGISTREMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Enregistre un nouveau Tenant_Server auprès du Central_Server.
 *
 * Architecture DNS :
 * - L'IP locale (localIp) est utilisée par le DNS local sur le réseau interne.
 *   Le Tenant_Server fait tourner dnsmasq qui résout {org}.palabre.com → localIp.
 *   Les appareils sur le LAN accèdent directement au serveur via ce nom.
 *
 * - L'IP publique (ipAddress) est enregistrée ici sur le DNS public du Central_Server.
 *   Elle sert uniquement au tunnel de relais : quand un appareil est hors réseau,
 *   le Central_Server connaît l'IP publique du tenant pour établir le pont.
 *   Le Tenant_Server n'est PAS nécessairement accessible directement depuis Internet.
 */
async function registerTenant({ orgId, orgSlug, publicKey, ipAddress, localIp, componentsVersion = '1.0.0', controlToken }) {
  // 1. Vérifier l'organisation et le controlToken
  const tokenHash = crypto.createHash('sha256').update(controlToken).digest('hex');
  const { rows: orgRows } = await pool.query(
    `SELECT o.id, o.name, o.status
     FROM organizations o
     JOIN tenant_control_tokens t ON t.organization_id = o.id
     WHERE o.id = $1 AND t.token_hash = $2 AND t.revoked_at IS NULL`,
    [orgId, tokenHash]
  );
  if (!orgRows[0]) {
    const err = new Error('Organisation introuvable ou token de contrôle invalide.');
    err.code = 'INVALID_CONTROL_TOKEN';
    err.httpStatus = 401;
    throw err;
  }
  const org = orgRows[0];

  if (org.status === 'suspended') {
    const err = new Error('Cette organisation est suspendue.');
    err.code = 'ORG_SUSPENDED';
    err.httpStatus = 403;
    throw err;
  }

  // 2. Vérifier si l'organisation a déjà un tenant enregistré
  const { rows: existingRows } = await pool.query(
    'SELECT id, tenant_subdomain, ip_address FROM tenant_registrations WHERE organization_id = $1',
    [orgId]
  );
  if (existingRows[0]) {
    // Mettre à jour l'IP si elle a changé
    const existing = existingRows[0];
    if (existing.ip_address !== ipAddress) {
      await pool.query(
        `UPDATE tenant_registrations
         SET ip_address = $2, public_key = $3, components_version = $4,
             status = 'active', updated_at = now()
         WHERE organization_id = $1`,
        [orgId, ipAddress, publicKey, componentsVersion]
      );
      // Mettre à jour le DNS
      const slug = existing.tenant_subdomain.replace(`.${dnsService.BASE_DOMAIN}`, '');
      await dnsService.updateDnsRecord(slug, ipAddress).catch(e => {
        console.error('[tenant-provisioning] DNS update error:', e.message);
      });
    }
    return {
      tenantSubdomain: existing.tenant_subdomain,
      registrationToken: null, // déjà enregistré
      alreadyRegistered: true,
      dnsProvisioned: true,
    };
  }

  // 3. Déterminer le slug du sous-domaine
  const baseSlug = orgSlug || slugify(org.name);
  let finalSlug  = baseSlug;

  const available = await dnsService.isSubdomainAvailable(baseSlug);
  if (!available) {
    finalSlug = await dnsService.suggestAlternativeSlug(baseSlug);
  }

  const tenantSubdomain = dnsService.buildFQDN(finalSlug);

  // 4. Générer le token d'enregistrement (retourné une seule fois)
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const regTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 5. Persister dans la base de données
  // ip_address = IP publique (pour le tunnel)
  // local_ip   = IP locale LAN (pour information / diagnostic)
  await pool.query(
    `INSERT INTO tenant_registrations
       (organization_id, tenant_subdomain, ip_address, public_key,
        registration_token_hash, components_version, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
    [orgId, tenantSubdomain, ipAddress, publicKey, regTokenHash, componentsVersion]
  );

  // 6. Provisionner le DNS (asynchrone — ne bloque pas la réponse)
  dnsService.createDnsRecord(finalSlug, ipAddress).then(async () => {
    await pool.query(
      `UPDATE tenant_registrations
       SET dns_provisioned = true, dns_provisioned_at = now(), updated_at = now()
       WHERE organization_id = $1`,
      [orgId]
    );
    console.log(`[tenant-provisioning] DNS provisionné : ${tenantSubdomain} → ${ipAddress}`);
  }).catch(err => {
    console.error(`[tenant-provisioning] DNS provisioning failed for ${tenantSubdomain}:`, err.message);
  });

  // 7. Audit log
  await logTunnelEvent({
    orgId,
    eventType: 'connected',
    ipAddress,
    metadata: { tenantSubdomain, componentsVersion, event: 'registration' },
  });

  return {
    tenantSubdomain,
    registrationToken: rawToken,
    alreadyRegistered: false,
    dnsProvisioned: false, // en cours de provisionnement
    dnsTtl: 300,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// HEARTBEAT TUNNEL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Traite un heartbeat du Tunnel Connector (WebSocket ou HTTP).
 * Met à jour le statut du tenant et les métriques santé des composants.
 */
async function processHeartbeat({ orgId, components = {}, version, ipAddress }) {
  // Vérifier que l'organisation a bien un tenant enregistré
  const { rows } = await pool.query(
    `SELECT tr.id, tr.tenant_subdomain, tr.ip_address, o.status as org_status
     FROM tenant_registrations tr
     JOIN organizations o ON o.id = tr.organization_id
     WHERE tr.organization_id = $1 AND tr.status = 'active'`,
    [orgId]
  );
  if (!rows[0]) {
    const err = new Error('Tenant non enregistré.');
    err.code = 'TENANT_NOT_REGISTERED';
    err.httpStatus = 404;
    throw err;
  }

  const tenant = rows[0];

  // Mettre à jour last_heartbeat_at et composants santé
  await pool.query(
    `UPDATE tenant_registrations
     SET last_heartbeat_at = now(),
         last_components_health = $2,
         components_version = COALESCE($3, components_version),
         updated_at = now()
     WHERE organization_id = $1`,
    [orgId, JSON.stringify(components), version || null]
  );

  // Marquer le tunnel comme actif dans Redis (TTL = 3 × intervalle heartbeat = 180s)
  await redis.set(tunnelKey(orgId), JSON.stringify({
    connectedAt: Date.now(),
    ipAddress,
    components,
  }), 'EX', 180);

  // Mettre à jour l'IP si elle a changé (changement de réseau)
  if (ipAddress && ipAddress !== tenant.ip_address) {
    await pool.query(
      'UPDATE tenant_registrations SET ip_address = $2, updated_at = now() WHERE organization_id = $1',
      [orgId, ipAddress]
    );
    const slug = tenant.tenant_subdomain.replace(`.${dnsService.BASE_DOMAIN}`, '');
    await dnsService.updateDnsRecord(slug, ipAddress).catch(e => {
      console.error('[tenant-provisioning] DNS update on IP change:', e.message);
    });
  }

  return {
    orgStatus:       tenant.org_status,
    tenantSubdomain: tenant.tenant_subdomain,
    receivedAt:      new Date().toISOString(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUT ET LISTE
// ═════════════════════════════════════════════════════════════════════════════

async function getTenantStatus(orgId) {
  const { rows } = await pool.query(
    `SELECT tr.*, o.name as org_name, o.status as org_status
     FROM tenant_registrations tr
     JOIN organizations o ON o.id = tr.organization_id
     WHERE tr.organization_id = $1`,
    [orgId]
  );
  if (!rows[0]) return null;

  const tenant = rows[0];
  const tunnelData = await redis.get(tunnelKey(orgId));
  const isTunnelActive = !!tunnelData;

  const lastBeat = tenant.last_heartbeat_at ? new Date(tenant.last_heartbeat_at).getTime() : null;
  const secondsAgo = lastBeat ? Math.floor((Date.now() - lastBeat) / 1000) : null;
  let tunnelStatus = 'unknown';
  if (secondsAgo !== null) {
    if (secondsAgo < 70)  tunnelStatus = 'connected';
    else if (secondsAgo < 180) tunnelStatus = 'degraded';
    else                       tunnelStatus = 'disconnected';
  }

  return {
    id:                    tenant.id,
    orgId:                 tenant.organization_id,
    orgName:               tenant.org_name,
    orgStatus:             tenant.org_status,
    tenantSubdomain:       tenant.tenant_subdomain,
    ipAddress:             tenant.ip_address,
    componentsVersion:     tenant.components_version,
    componentsHealth:      tenant.last_components_health || {},
    status:                tenant.status,
    tunnelStatus,
    lastHeartbeatAt:       tenant.last_heartbeat_at,
    secondsSinceHeartbeat: secondsAgo,
    dnsProvisioned:        tenant.dns_provisioned,
    tlsProvisioned:        tenant.tls_provisioned,
    tlsExpiresAt:          tenant.tls_expires_at,
    registeredAt:          tenant.registered_at,
  };
}

/**
 * Liste tous les tenants actifs — pour le tableau de bord super-admin.
 */
async function listActiveTenants({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT tr.organization_id, tr.tenant_subdomain, tr.ip_address,
            tr.components_version, tr.status, tr.last_heartbeat_at,
            tr.dns_provisioned, tr.tls_provisioned,
            o.name as org_name, o.status as org_status
     FROM tenant_registrations tr
     JOIN organizations o ON o.id = tr.organization_id
     WHERE tr.status = 'active'
     ORDER BY tr.last_heartbeat_at DESC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return rows.map(r => {
    const lastBeat = r.last_heartbeat_at ? new Date(r.last_heartbeat_at).getTime() : null;
    const secondsAgo = lastBeat ? Math.floor((Date.now() - lastBeat) / 1000) : null;
    let tunnelStatus = 'unknown';
    if (secondsAgo !== null) {
      if (secondsAgo < 70) tunnelStatus = 'connected';
      else if (secondsAgo < 180) tunnelStatus = 'degraded';
      else tunnelStatus = 'disconnected';
    }
    return {
      orgId: r.organization_id,
      orgName: r.org_name,
      orgStatus: r.org_status,
      tenantSubdomain: r.tenant_subdomain,
      ipAddress: r.ip_address,
      componentsVersion: r.components_version,
      tunnelStatus,
      lastHeartbeatAt: r.last_heartbeat_at,
      dnsProvisioned: r.dns_provisioned,
      tlsProvisioned: r.tls_provisioned,
    };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// DÉTECTER LES TENANTS INACTIFS (appelé par un scheduler périodique)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Marque les tenants qui n'ont pas envoyé de heartbeat depuis > 180s
 * comme 'inactive' dans la table.
 */
async function markInactiveTenants() {
  const { rows } = await pool.query(
    `UPDATE tenant_registrations
     SET status = 'inactive', updated_at = now()
     WHERE status = 'active'
       AND last_heartbeat_at < now() - INTERVAL '3 minutes'
     RETURNING organization_id, tenant_subdomain`
  );

  if (rows.length > 0) {
    console.log(`[tenant-provisioning] ${rows.length} tenant(s) marqués inactifs:`,
      rows.map(r => r.tenant_subdomain).join(', '));
  }
  return rows;
}

module.exports = {
  registerTenant,
  processHeartbeat,
  getTenantStatus,
  listActiveTenants,
  markInactiveTenants,
  logTunnelEvent,
  slugify,
};
