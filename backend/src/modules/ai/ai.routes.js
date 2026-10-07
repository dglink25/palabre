'use strict';

/**
 * AI Routes - /api/v1/ai
 *
 * Routes IVR (service client vocal) :
 *   POST /api/v1/ai/ivr/greeting        → message d'accueil + options
 *   POST /api/v1/ai/ivr/route           → traitement de la touche saisie
 *   POST /api/v1/ai/ivr/ask             → question dans le contexte IVR sélectionné
 *   GET  /api/v1/ai/ivr/config          → configuration IVR active
 *
 * Routes admin (super-admin uniquement) :
 *   GET    /api/v1/ai/admin/kb                  → liste des entrées KB
 *   GET    /api/v1/ai/admin/kb/stats            → statistiques KB
 *   GET    /api/v1/ai/admin/kb/:id              → détail d'une entrée
 *   POST   /api/v1/ai/admin/kb                  → créer une entrée
 *   PUT    /api/v1/ai/admin/kb/:id              → modifier une entrée
 *   DELETE /api/v1/ai/admin/kb/:id              → supprimer une entrée
 *   POST   /api/v1/ai/admin/kb/:id/toggle       → activer/désactiver
 *   POST   /api/v1/ai/admin/kb/bulk-import      → import en masse
 *   POST   /api/v1/ai/admin/kb/sync             → forcer re-indexation
 *   GET    /api/v1/ai/admin/candidates          → candidats en attente
 *   POST   /api/v1/ai/admin/candidates/:id/approve
 *   POST   /api/v1/ai/admin/candidates/:id/reject
 *   GET    /api/v1/ai/admin/feedback/negatives  → réponses mal notées
 *   PUT    /api/v1/ai/admin/ivr/agent           → config agent (nom, message, avatar)
 *   PUT    /api/v1/ai/admin/ivr/config          → config menu IVR
 *   GET    /api/v1/ai/health                    → santé du service AI
 */

const express           = require('express');
const { requireAuth }        = require('../../middleware/authMiddleware');
const { requireSuperAdmin }  = require('../../middleware/rbac');
const aiService              = require('./ai.service');

const router = express.Router();

// Toutes les routes AI requièrent une authentification
router.use(requireAuth);

// ── Erreur normalisée depuis le service AI ────────────────────────────────────

function _handleAiError(err, res, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: { code: 'AI_SERVICE_ERROR', message: err.message, detail: err.body },
    });
  }
  if (err.message && err.message.includes('timeout')) {
    return res.status(504).json({
      error: { code: 'AI_SERVICE_TIMEOUT', message: 'Le service AI ne répond pas. Réessayez dans un instant.' },
    });
  }
  next(err);
}

// =============================================================================
// IVR - Accessible à tous les utilisateurs authentifiés
// =============================================================================

/**
 * POST /api/v1/ai/ivr/greeting
 * Retourne le message d'accueil personnalisé et les options IVR.
 * Appelé à l'ouverture du service client.
 */
router.post('/ivr/greeting', async (req, res, next) => {
  try {
    const result = await aiService.ivrGreeting(req.user.id);
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/ivr/route
 * Traite la touche saisie par l'utilisateur dans le menu IVR.
 * Body : { key: "1" }
 */
router.post('/ivr/route', async (req, res, next) => {
  try {
    const { key } = req.body;
    if (!key || typeof key !== 'string' || key.trim().length !== 1) {
      return res.status(400).json({
        error: { code: 'INVALID_KEY', message: 'La touche doit être un caractère unique.' },
      });
    }
    const result = await aiService.ivrRoute(key.trim(), req.user.id);
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/ivr/ask
 * Envoie la question de l'utilisateur à l'agent IA dans le contexte IVR.
 * Body : { message, conversation_id?, kb_type?, ivr_option?, voice? }
 */
router.post('/ivr/ask', async (req, res, next) => {
  try {
    const { message, conversation_id, kb_type, ivr_option, voice = false } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: { code: 'EMPTY_MESSAGE', message: 'Le message ne peut pas être vide.' },
      });
    }
    const result = await aiService.ivrAsk({
      userId:         req.user.id,
      conversationId: conversation_id || null,
      message:        message.trim(),
      kbType:         kb_type    || null,
      ivrOption:      ivr_option || null,
      voice,
    });
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * GET /api/v1/ai/ivr/config
 * Retourne la configuration IVR active (options du menu et paramètres de l'agent).
 * Accessible à tous les utilisateurs pour initialiser l'interface.
 */
router.get('/ivr/config', async (req, res, next) => {
  try {
    const result = await aiService.getIvrConfig();
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * GET /api/v1/ai/health
 */
router.get('/health', async (req, res) => {
  const result = await aiService.healthCheck();
  res.json(result);
});

// =============================================================================
// ADMIN - Super-admin uniquement
// =============================================================================

router.use('/admin', requireSuperAdmin);

// ── Base de connaissance ──────────────────────────────────────────────────────

/**
 * GET /api/v1/ai/admin/kb
 * Liste les entrées de la base de connaissance avec filtres.
 * Query : type?, ivr_option?, active?, search?, limit?, offset?
 */
router.get('/admin/kb', async (req, res, next) => {
  try {
    const { type, ivr_option, search, limit = 50, offset = 0 } = req.query;
    const active = req.query.active !== undefined ? req.query.active !== 'false' : true;
    const result = await aiService.kbList({
      type:       type       || null,
      ivrOption:  ivr_option != null ? parseInt(ivr_option, 10) : undefined,
      active,
      search:     search     || null,
      limit:      Math.min(parseInt(limit, 10) || 50, 200),
      offset:     parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * GET /api/v1/ai/admin/kb/stats
 */
router.get('/admin/kb/stats', async (req, res, next) => {
  try {
    res.json(await aiService.kbStats());
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/admin/kb/sync
 * Force la re-indexation vectorielle de la base de connaissance.
 */
router.post('/admin/kb/sync', async (req, res, next) => {
  try {
    res.json(await aiService.kbSync());
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/admin/kb/bulk-import
 * Importe une liste d'entrées en une seule opération.
 * Body : { entries: [{ question, response, type, ivr_option? }] }
 */
router.post('/admin/kb/bulk-import', async (req, res, next) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_ENTRIES', message: 'Le tableau d\'entrées est vide ou invalide.' },
      });
    }
    if (entries.length > 500) {
      return res.status(400).json({
        error: { code: 'TOO_MANY_ENTRIES', message: 'Maximum 500 entrées par import.' },
      });
    }
    const result = await aiService.kbBulkImport(entries, req.user.id);
    res.status(201).json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * GET /api/v1/ai/admin/kb/:id
 */
router.get('/admin/kb/:id', async (req, res, next) => {
  try {
    const entry = await aiService.kbGet(parseInt(req.params.id, 10));
    if (!entry) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entrée introuvable.' } });
    res.json(entry);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/admin/kb
 * Body : { question, response, type, ivr_option? }
 */
router.post('/admin/kb', async (req, res, next) => {
  try {
    const { question, response, type = 'general', ivr_option } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: { code: 'MISSING_QUESTION', message: 'La question est obligatoire.' } });
    }
    if (!response || !response.trim()) {
      return res.status(400).json({ error: { code: 'MISSING_RESPONSE', message: 'La réponse est obligatoire.' } });
    }
    const result = await aiService.kbCreate({
      question: question.trim(),
      response: response.trim(),
      type,
      ivrOption:   ivr_option != null ? parseInt(ivr_option, 10) : null,
      adminUserId: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * PUT /api/v1/ai/admin/kb/:id
 */
router.put('/admin/kb/:id', async (req, res, next) => {
  try {
    const { question, response, type, ivr_option, active } = req.body;
    const payload = { adminUserId: req.user.id };
    if (question   !== undefined) payload.question  = question;
    if (response   !== undefined) payload.response  = response;
    if (type       !== undefined) payload.type      = type;
    if (active     !== undefined) payload.active    = active;
    if (ivr_option !== undefined) payload.ivrOption = ivr_option != null ? parseInt(ivr_option, 10) : null;
    const result = await aiService.kbUpdate(parseInt(req.params.id, 10), payload);
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * DELETE /api/v1/ai/admin/kb/:id
 */
router.delete('/admin/kb/:id', async (req, res, next) => {
  try {
    const result = await aiService.kbDelete(parseInt(req.params.id, 10));
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/admin/kb/:id/toggle
 * Body : { active: true|false }
 */
router.post('/admin/kb/:id/toggle', async (req, res, next) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: { code: 'INVALID_ACTIVE', message: '"active" doit être un booléen.' } });
    }
    const result = await aiService.kbToggle(parseInt(req.params.id, 10), active, req.user.id);
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

// ── Candidates et feedback ────────────────────────────────────────────────────

/**
 * GET /api/v1/ai/admin/candidates
 * Query : status? (pending | approved | rejected)
 */
router.get('/admin/candidates', async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    res.json(await aiService.kbCandidates(status));
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/admin/candidates/:id/approve
 */
router.post('/admin/candidates/:id/approve', async (req, res, next) => {
  try {
    res.json(await aiService.kbApproveCandidate(parseInt(req.params.id, 10)));
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * POST /api/v1/ai/admin/candidates/:id/reject
 */
router.post('/admin/candidates/:id/reject', async (req, res, next) => {
  try {
    res.json(await aiService.kbRejectCandidate(parseInt(req.params.id, 10)));
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * GET /api/v1/ai/admin/feedback/negatives
 * Query : limit?
 */
router.get('/admin/feedback/negatives', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    res.json(await aiService.kbNegativeFeedback(limit));
  } catch (err) { _handleAiError(err, res, next); }
});

// ── Configuration IVR et agent ────────────────────────────────────────────────

/**
 * PUT /api/v1/ai/admin/ivr/agent
 * Met à jour les paramètres de l'agent IA.
 * Body : { agent_name?, welcome_message?, fallback_message?, avatar_url?, voice_enabled? }
 */
router.put('/admin/ivr/agent', async (req, res, next) => {
  try {
    const { agent_name, welcome_message, fallback_message, avatar_url, voice_enabled } = req.body;
    const result = await aiService.updateAgentConfig({
      adminUserId:     req.user.id,
      agentName:       agent_name,
      welcomeMessage:  welcome_message,
      fallbackMessage: fallback_message,
      avatarUrl:       avatar_url,
      voiceEnabled:    voice_enabled,
    });
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

/**
 * PUT /api/v1/ai/admin/ivr/config
 * Remplace la configuration IVR complète.
 * Body : { options: [{ key, label, type, description?, prompt? }] }
 */
router.put('/admin/ivr/config', async (req, res, next) => {
  try {
    const { options } = req.body;
    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_OPTIONS', message: 'Le tableau d\'options IVR est vide ou invalide.' },
      });
    }
    // Validation basique des options
    for (const opt of options) {
      if (!opt.key || !opt.label || !opt.type) {
        return res.status(400).json({
          error: { code: 'INVALID_OPTION', message: 'Chaque option doit avoir key, label et type.' },
        });
      }
    }
    const result = await aiService.updateIvrConfig(options, req.user.id);
    res.json(result);
  } catch (err) { _handleAiError(err, res, next); }
});

module.exports = router;
