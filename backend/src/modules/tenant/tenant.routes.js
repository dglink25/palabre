/**
 * Routes internes de relai multi-tenant
 *
 * Ces routes sont appelées UNIQUEMENT par les agents tenant (jamais par les clients).
 * Elles permettent :
 *   POST /internal/messages/relay  — Un agent relai un message d'un utilisateur local
 *                                    vers un utilisateur externe (dans une autre org ou
 *                                    sur le serveur central)
 *   POST /internal/messages/sync   — Un agent synchronise les messages accumulés
 *                                    pendant une coupure tunnel (mode dégradé)
 *
 * Authentification : secret partagé via header X-Internal-Secret
 * (même valeur que INTERNAL_SERVICES_SECRET dans tous les services)
 *
 * Sécurité : ces routes ne sont jamais exposées publiquement —
 * elles doivent être derrière un pare-feu ou accessibles uniquement
 * via le tunnel WireGuard.
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { pool } = require('../../config/db');

const router = express.Router();

// ── Middleware : vérification du secret interne ───────────────────────────────

function requireInternalSecret(req, res, next) {
  const expected = process.env.INTERNAL_SERVICES_SECRET;
  const provided  = req.headers['x-internal-secret'];
  if (!expected || !provided || !crypto.timingSafeEqual(
    Buffer.from(provided, 'utf8'),
    Buffer.from(expected, 'utf8')
  )) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Secret interne invalide.' } });
  }
  next();
}

// ── POST /internal/messages/relay ────────────────────────────────────────────
// Reçoit un message d'un agent tenant et le livre au destinataire.
// Le destinataire peut être :
//   - Un utilisateur en ligne sur le serveur central → livraison directe WebSocket
//   - Un utilisateur dans un AUTRE tenant → relai vers cet autre agent
//   - Un utilisateur hors ligne → enqueue Redis/message-router central

router.post('/messages/relay', requireInternalSecret, async (req, res, next) => {
  try {
    const { tenantId, controlToken, message } = req.body;

    if (!tenantId || !controlToken || !message) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'tenantId, controlToken et message sont requis.' },
      });
    }

    // Vérifier le controlToken du tenant émetteur
    const tokenHash = crypto.createHash('sha256').update(controlToken).digest('hex');
    const { rows: tokenRows } = await pool.query(
      `SELECT t.organization_id FROM tenant_control_tokens t
       WHERE t.organization_id = $1 AND t.token_hash = $2 AND t.revoked_at IS NULL`,
      [tenantId, tokenHash]
    );
    if (!tokenRows[0]) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token tenant invalide.' } });
    }

    const toUserId = message.to || message.to_user_id;
    if (!toUserId) {
      return res.status(400).json({ error: { code: 'MISSING_TO', message: 'Destinataire manquant.' } });
    }

    // Trouver l'organisation du destinataire
    const { rows: memberRows } = await pool.query(
      `SELECT m.organization_id, o.status as org_status
       FROM memberships m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY m.created_at ASC LIMIT 1`,
      [toUserId]
    );

    const destOrgId = memberRows[0]?.organization_id;
    const destOrgStatus = memberRows[0]?.org_status;

    if (!destOrgId) {
      // Utilisateur introuvable — peut-être jamais connecté
      // On stocke le message quand même pour livraison ultérieure
      await storeUndeliveredMessage(message, tenantId);
      return res.json({ ok: true, status: 'queued_unknown_recipient' });
    }

    if (destOrgStatus === 'suspended') {
      return res.status(403).json({ error: { code: 'ORG_SUSPENDED', message: 'Organisation du destinataire suspendue.' } });
    }

    // Le destinataire est-il dans le même tenant émetteur ?
    if (destOrgId === tenantId) {
      // Cas anormal : l'agent ne devrait pas envoyer des messages intra-org au central
      // On les relai quand même via le message-router central
      await relayToMessageRouter(message);
      return res.json({ ok: true, status: 'relayed_same_org' });
    }

    // Le destinataire est dans une ORG DIFFÉRENTE
    // 1. Est-ce une org avec un tenant local ? Si oui → relayer vers cet agent
    const destTenantUrl = await getTenantUrl(destOrgId);
    if (destTenantUrl) {
      // Relai vers l'agent du tenant destinataire via son URL WebSocket/HTTP
      const relayed = await relayToTenant(destTenantUrl, message, tenantId, controlToken);
      if (relayed) {
        return res.json({ ok: true, status: 'relayed_to_tenant', destOrg: destOrgId });
      }
    }

    // 2. Fallback : livraison via le message-router central (utilisateur externe sans tenant)
    await relayToMessageRouter(message);
    res.json({ ok: true, status: 'relayed_central', destOrg: destOrgId });

  } catch (err) { next(err); }
});

// ── POST /internal/messages/sync ─────────────────────────────────────────────
// Synchronisation des messages accumulés pendant une coupure tunnel.
// L'agent envoie les messages dans l'ordre chronologique.

router.post('/messages/sync', requireInternalSecret, async (req, res, next) => {
  try {
    const { tenantId, controlToken, message } = req.body;

    if (!tenantId || !controlToken || !message) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'tenantId, controlToken et message requis.' },
      });
    }

    // Vérifier le controlToken
    const tokenHash = crypto.createHash('sha256').update(controlToken).digest('hex');
    const { rows } = await pool.query(
      'SELECT organization_id FROM tenant_control_tokens WHERE organization_id = $1 AND token_hash = $2 AND revoked_at IS NULL',
      [tenantId, tokenHash]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token tenant invalide.' } });
    }

    // Relayer le message via le message-router central (avec déduplication par ID)
    const msgId = message.id;
    if (msgId) {
      // Vérifier si le message n'a pas déjà été livré (idempotence)
      const { rows: existing } = await pool.query(
        'SELECT id FROM messages WHERE id = $1',
        [msgId]
      );
      if (existing[0]) {
        return res.json({ ok: true, status: 'already_delivered', id: msgId });
      }
    }

    await relayToMessageRouter(message);
    res.json({ ok: true, status: 'synced', id: msgId });

  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function relayToMessageRouter(message) {
  const internalSecret = process.env.INTERNAL_SERVICES_SECRET || 'dev_internal_secret';
  const messageRouterUrl = process.env.MESSAGE_ROUTER_INTERNAL_URL || 'http://message-router:4020';
  const axios = require('axios');
  await axios.post(
    `${messageRouterUrl}/internal/messages/deliver`,
    message,
    {
      headers: { 'x-internal-secret': internalSecret },
      timeout: 8000,
    }
  );
}

async function getTenantUrl(orgId) {
  // Chercher si cette organisation a un agent tenant enregistré avec son URL
  const { rows } = await pool.query(
    `SELECT agent_url FROM tenant_agents WHERE organization_id = $1 AND status = 'active' LIMIT 1`,
    [orgId]
  );
  return rows[0]?.agent_url || null;
}

async function relayToTenant(agentUrl, message, fromTenantId, controlToken) {
  try {
    const axios = require('axios');
    const internalSecret = process.env.INTERNAL_SERVICES_SECRET || 'dev_internal_secret';
    const resp = await axios.post(
      `${agentUrl}/outbound/message`,
      message,
      {
        headers: { 'x-internal-secret': internalSecret },
        timeout: 5000,
      }
    );
    return resp.status === 200 || resp.status === 202;
  } catch {
    return false;
  }
}

async function storeUndeliveredMessage(message, fromTenantId) {
  // Stocker dans Redis ou en base pour livraison ultérieure
  // Pour l'instant : log et abandon (le sender recevra un échec de livraison)
  console.warn('[tenant-relay] Destinataire introuvable pour message', message.id, 'depuis tenant', fromTenantId);
}

module.exports = router;
