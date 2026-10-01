'use strict';

/**
 * DNS Service — Provisionnement automatique des sous-domaines tenant
 *
 * Supporte deux backends :
 *   - PowerDNS (via REST API)  — mode production recommandé
 *   - Mock (dev/test)          — simule la création DNS sans appel réseau
 *
 * Le sous-domaine attribué est {org_slug}.palabre.com
 * Une entrée A pointe vers l'IP publique du Tenant_Server.
 */

const nodeFetch = require('node-fetch');

const DNS_PROVIDER     = process.env.DNS_PROVIDER      || 'mock';
const PDNS_API_URL     = process.env.POWERDNS_API_URL  || 'http://localhost:8053';
const PDNS_API_KEY     = process.env.POWERDNS_API_KEY  || '';
const BASE_DOMAIN      = process.env.PALABRE_BASE_DOMAIN || 'palabre.com';
const DNS_TTL          = parseInt(process.env.DNS_TTL || '300', 10);

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildFQDN(orgSlug) {
  return `${orgSlug}.${BASE_DOMAIN}`;
}

async function pdnsFetch(method, path, body) {
  const url = `${PDNS_API_URL}${path}`;
  const res = await nodeFetch(url, {
    method,
    headers: {
      'X-API-Key':    PDNS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    timeout: 10000,
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(`PowerDNS API error ${res.status}: ${text}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  return res.json();
}

// ── PowerDNS backend ──────────────────────────────────────────────────────────

async function pdnsCreateRecord(orgSlug, ipAddress) {
  const fqdn = buildFQDN(orgSlug);
  const zone = `${BASE_DOMAIN}.`;

  // Vérifier si la zone existe
  const zones = await pdnsFetch('GET', '/api/v1/servers/localhost/zones');
  const zoneExists = Array.isArray(zones) && zones.some(z => z.id === zone || z.name === zone);

  if (!zoneExists) {
    // Créer la zone si elle n'existe pas (cas d'un nouveau déploiement)
    await pdnsFetch('POST', '/api/v1/servers/localhost/zones', {
      name: zone,
      kind: 'Native',
      nameservers: [],
    });
  }

  // Créer/mettre à jour le record A
  await pdnsFetch('PATCH', `/api/v1/servers/localhost/zones/${zone}`, {
    rrsets: [{
      name:       `${fqdn}.`,
      type:       'A',
      ttl:        DNS_TTL,
      changetype: 'REPLACE',
      records: [{ content: ipAddress, disabled: false }],
    }],
  });

  return { fqdn, ipAddress, ttl: DNS_TTL };
}

async function pdnsDeleteRecord(orgSlug) {
  const fqdn = buildFQDN(orgSlug);
  const zone = `${BASE_DOMAIN}.`;

  await pdnsFetch('PATCH', `/api/v1/servers/localhost/zones/${zone}`, {
    rrsets: [{
      name:       `${fqdn}.`,
      type:       'A',
      changetype: 'DELETE',
    }],
  });
}

async function pdnsUpdateRecord(orgSlug, newIpAddress) {
  return pdnsCreateRecord(orgSlug, newIpAddress);
}

// ── Mock backend (développement / test) ──────────────────────────────────────

const mockRecords = new Map();

async function mockCreateRecord(orgSlug, ipAddress) {
  const fqdn = buildFQDN(orgSlug);
  mockRecords.set(fqdn, { ipAddress, ttl: DNS_TTL, createdAt: new Date().toISOString() });
  console.log(`[dns:mock] A record créé : ${fqdn} → ${ipAddress} (TTL=${DNS_TTL})`);
  return { fqdn, ipAddress, ttl: DNS_TTL };
}

async function mockDeleteRecord(orgSlug) {
  const fqdn = buildFQDN(orgSlug);
  mockRecords.delete(fqdn);
  console.log(`[dns:mock] A record supprimé : ${fqdn}`);
}

async function mockUpdateRecord(orgSlug, newIpAddress) {
  return mockCreateRecord(orgSlug, newIpAddress);
}

// ── Interface publique ────────────────────────────────────────────────────────

/**
 * Crée un enregistrement DNS A pour un tenant.
 * @param {string} orgSlug - identifiant court (ex: "monorg")
 * @param {string} ipAddress - IP publique du Tenant_Server
 * @returns {{ fqdn: string, ipAddress: string, ttl: number }}
 */
async function createDnsRecord(orgSlug, ipAddress) {
  if (DNS_PROVIDER === 'powerdns') {
    return pdnsCreateRecord(orgSlug, ipAddress);
  }
  return mockCreateRecord(orgSlug, ipAddress);
}

/**
 * Met à jour l'IP d'un enregistrement DNS existant.
 */
async function updateDnsRecord(orgSlug, newIpAddress) {
  if (DNS_PROVIDER === 'powerdns') {
    return pdnsUpdateRecord(orgSlug, newIpAddress);
  }
  return mockUpdateRecord(orgSlug, newIpAddress);
}

/**
 * Supprime l'enregistrement DNS d'un tenant.
 */
async function deleteDnsRecord(orgSlug) {
  if (DNS_PROVIDER === 'powerdns') {
    return pdnsDeleteRecord(orgSlug);
  }
  return mockDeleteRecord(orgSlug);
}

/**
 * Vérifie si un sous-domaine est disponible.
 */
async function isSubdomainAvailable(orgSlug) {
  const fqdn = buildFQDN(orgSlug);
  if (DNS_PROVIDER === 'mock') {
    return !mockRecords.has(fqdn);
  }
  try {
    const zone = `${BASE_DOMAIN}.`;
    const data = await pdnsFetch('GET', `/api/v1/servers/localhost/zones/${zone}`);
    if (!data || !data.rrsets) return true;
    return !data.rrsets.some(r => r.name === `${fqdn}.` && r.type === 'A');
  } catch {
    // Si la zone n'existe pas encore, le sous-domaine est disponible
    return true;
  }
}

/**
 * Suggère un sous-domaine alternatif si le slug demandé est pris.
 */
async function suggestAlternativeSlug(orgSlug) {
  for (let i = 2; i <= 99; i++) {
    const candidate = `${orgSlug}${i}`;
    if (await isSubdomainAvailable(candidate)) return candidate;
  }
  // Fallback avec suffixe aléatoire
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${orgSlug}-${suffix}`;
}

module.exports = {
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
  isSubdomainAvailable,
  suggestAlternativeSlug,
  buildFQDN,
  BASE_DOMAIN,
};
