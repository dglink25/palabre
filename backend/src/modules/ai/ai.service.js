'use strict';

/**
 * AI Service - Pont entre le backend Palabre et le service AI FastAPI
 *
 * Toutes les requêtes vers l'API AI passent par ce service.
 * Ajoute automatiquement la clé API interne (X-API-Key).
 */

const http = require('http');
const https = require('https');

const AI_BASE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const AI_API_KEY  = process.env.AI_API_KEY || '';

// ── Client HTTP léger (pas de dépendance externe) ─────────────────────────────

function _request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url      = new URL(AI_BASE_URL + path);
    const protocol = url.protocol === 'https:' ? https : http;

    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'X-API-Key':     AI_API_KEY,
      },
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            const err = new Error(parsed.detail || parsed.message || `AI service error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.body = parsed;
            return reject(err);
          }
          resolve(parsed);
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('AI service timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ── IVR ───────────────────────────────────────────────────────────────────────

/**
 * Obtient le message d'accueil et les options IVR pour un utilisateur.
 * @param {string|null} userId - ID de l'utilisateur (pour personnalisation)
 */
async function ivrGreeting(userId = null) {
  return _request('POST', '/ivr/greeting', { user_id: userId });
}

/**
 * Traite la touche saisie par l'utilisateur.
 * @param {string} key - Touche pressée (0-9)
 * @param {string|null} userId
 */
async function ivrRoute(key, userId = null) {
  return _request('POST', '/ivr/route', { key, user_id: userId });
}

/**
 * Envoie la question de l'utilisateur dans le contexte IVR.
 * @param {object} params
 */
async function ivrAsk({ userId, conversationId, message, kbType, ivrOption, voice = false }) {
  return _request('POST', '/ivr/ask', {
    user_id:         userId || null,
    conversation_id: conversationId || null,
    message,
    kb_type:         kbType || null,
    ivr_option:      ivrOption || null,
    voice,
  });
}

/**
 * Retourne la configuration IVR complète.
 */
async function getIvrConfig() {
  return _request('GET', '/ivr/config');
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

async function kbList({ type, ivrOption, active = true, search, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ active: active.toString(), limit, offset });
  if (type)      params.set('type', type);
  if (ivrOption != null) params.set('ivr_option', ivrOption);
  if (search)    params.set('search', search);
  return _request('GET', `/admin/kb/entries?${params.toString()}`);
}

async function kbGet(entryId) {
  return _request('GET', `/admin/kb/entries/${entryId}`);
}

async function kbCreate({ question, response, type = 'general', ivrOption = null, adminUserId }) {
  const params = adminUserId ? `?admin_user_id=${encodeURIComponent(adminUserId)}` : '';
  return _request('POST', `/admin/kb/entries${params}`, {
    question, response, type, ivr_option: ivrOption,
  });
}

async function kbUpdate(entryId, { question, response, type, ivrOption, active, adminUserId } = {}) {
  const params = adminUserId ? `?admin_user_id=${encodeURIComponent(adminUserId)}` : '';
  const body = {};
  if (question   !== undefined) body.question    = question;
  if (response   !== undefined) body.response    = response;
  if (type       !== undefined) body.type        = type;
  if (ivrOption  !== undefined) { body.ivr_option = ivrOption; body._ivr_option_explicit = true; }
  if (active     !== undefined) body.active      = active;
  return _request('PUT', `/admin/kb/entries/${entryId}${params}`, body);
}

async function kbDelete(entryId) {
  return _request('DELETE', `/admin/kb/entries/${entryId}`);
}

async function kbToggle(entryId, active, adminUserId) {
  const params = new URLSearchParams({ active: active.toString() });
  if (adminUserId) params.set('admin_user_id', adminUserId);
  return _request('POST', `/admin/kb/entries/${entryId}/toggle?${params.toString()}`);
}

async function kbBulkImport(entries, adminUserId) {
  const params = adminUserId ? `?admin_user_id=${encodeURIComponent(adminUserId)}` : '';
  return _request('POST', `/admin/kb/bulk-import${params}`, { entries });
}

async function kbStats() {
  return _request('GET', '/admin/kb/stats');
}

async function kbSync() {
  return _request('POST', '/admin/kb/sync');
}

// ── IVR Config (admin) ────────────────────────────────────────────────────────

async function updateAgentConfig({ adminUserId, agentName, welcomeMessage, fallbackMessage, avatarUrl, voiceEnabled } = {}) {
  const params = adminUserId ? `?admin_user_id=${encodeURIComponent(adminUserId)}` : '';
  const body = {};
  if (agentName        !== undefined) body.agent_name       = agentName;
  if (welcomeMessage   !== undefined) body.welcome_message  = welcomeMessage;
  if (fallbackMessage  !== undefined) body.fallback_message = fallbackMessage;
  if (avatarUrl        !== undefined) body.avatar_url       = avatarUrl;
  if (voiceEnabled     !== undefined) body.voice_enabled    = voiceEnabled;
  return _request('PUT', `/admin/ivr/agent${params}`, body);
}

async function updateIvrConfig(options, adminUserId) {
  const params = adminUserId ? `?admin_user_id=${encodeURIComponent(adminUserId)}` : '';
  return _request('PUT', `/admin/ivr/config${params}`, { options });
}

// ── KB Candidates (validation des suggestions) ────────────────────────────────

async function kbCandidates(status = 'pending') {
  return _request('GET', `/admin/candidates?status=${status}`);
}

async function kbApproveCandidate(candidateId) {
  return _request('POST', `/admin/candidates/${candidateId}/approve`);
}

async function kbRejectCandidate(candidateId) {
  return _request('POST', `/admin/candidates/${candidateId}/reject`);
}

async function kbNegativeFeedback(limit = 50) {
  return _request('GET', `/admin/negatives?limit=${limit}`);
}

// ── Health ────────────────────────────────────────────────────────────────────

async function healthCheck() {
  try {
    return await _request('GET', '/health');
  } catch {
    return { status: 'unavailable' };
  }
}

module.exports = {
  // IVR
  ivrGreeting,
  ivrRoute,
  ivrAsk,
  getIvrConfig,
  // KB CRUD
  kbList,
  kbGet,
  kbCreate,
  kbUpdate,
  kbDelete,
  kbToggle,
  kbBulkImport,
  kbStats,
  kbSync,
  // IVR Config
  updateAgentConfig,
  updateIvrConfig,
  // KB Candidates
  kbCandidates,
  kbApproveCandidate,
  kbRejectCandidate,
  kbNegativeFeedback,
  // Health
  healthCheck,
};
