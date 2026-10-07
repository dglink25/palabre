/**
 * aiApi - Client API pour le service AI (IVR, base de connaissance, config)
 * Toutes les routes passent par /api/v1/ai
 */
import { api } from './apiClient';

// ── IVR ───────────────────────────────────────────────────────────────────────

export const ivrApi = {
  greeting: (userId = null) =>
    api.post('/ai/ivr/greeting', { user_id: userId }),

  route: (key) =>
    api.post('/ai/ivr/route', { key }),

  ask: ({ message, conversationId, kbType, ivrOption, voice = false }) =>
    api.post('/ai/ivr/ask', {
      message,
      conversation_id: conversationId || null,
      kb_type:         kbType     || null,
      ivr_option:      ivrOption  || null,
      voice,
    }),

  getConfig: () =>
    api.get('/ai/ivr/config'),
};

// ── Admin - Base de connaissance ──────────────────────────────────────────────

export const kbApi = {
  list: ({ type, ivrOption, active = true, search, limit = 50, offset = 0 } = {}) => {
    const params = new URLSearchParams({ active: String(active), limit, offset });
    if (type)           params.set('type', type);
    if (ivrOption != null) params.set('ivr_option', ivrOption);
    if (search)         params.set('search', search);
    return api.get(`/ai/admin/kb?${params.toString()}`);
  },

  get: (id) => api.get(`/ai/admin/kb/${id}`),

  create: (data) => api.post('/ai/admin/kb', data),

  update: (id, data) => api.put(`/ai/admin/kb/${id}`, data),

  delete: (id) => api.delete(`/ai/admin/kb/${id}`),

  toggle: (id, active) => api.post(`/ai/admin/kb/${id}/toggle`, { active }),

  bulkImport: (entries) => api.post('/ai/admin/kb/bulk-import', { entries }),

  stats: () => api.get('/ai/admin/kb/stats'),

  sync: () => api.post('/ai/admin/kb/sync'),

  // Candidats issus des feedbacks utilisateurs
  candidates: (status = 'pending') => api.get(`/ai/admin/candidates?status=${status}`),
  approveCandidate: (id) => api.post(`/ai/admin/candidates/${id}/approve`),
  rejectCandidate:  (id) => api.post(`/ai/admin/candidates/${id}/reject`),
  negativeFeedback: (limit = 50) => api.get(`/ai/admin/feedback/negatives?limit=${limit}`),
};

// ── Admin - Configuration IVR et agent ───────────────────────────────────────

export const ivrConfigApi = {
  updateAgent: (data) => api.put('/ai/admin/ivr/agent', data),
  updateConfig: (options) => api.put('/ai/admin/ivr/config', { options }),
};
