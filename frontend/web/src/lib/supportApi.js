/**
 * Support API - Palabre Service Client
 * Wrappers REST + WebSocket pour le module support
 */

import { api } from './apiClient';
import { getAccessToken } from './tokenStore';

const BASE = '/support';

// ── REST ──────────────────────────────────────────────────────────────────────

export const supportApi = {
  /** Statut du service (disponibilité, file d'attente) */
  getStatus: () => api.get(`${BASE}/status`),

  /** Obtenir ou créer la session active */
  getOrCreateSession: () => api.post(`${BASE}/sessions`),

  /** Session active + messages récents */
  getMySession: () => api.get(`${BASE}/sessions/me`),

  /** Messages paginés */
  getMessages: (params = {}) => api.get(`${BASE}/sessions/me/messages`, { params }),

  /** Initier un appel audio */
  initiateCall: () => api.post(`${BASE}/sessions/me/calls`),

  /** Raccrocher */
  hangup: (callId) => api.post(`${BASE}/sessions/me/calls/${callId}/hangup`),

  // ── Admin ───────────────────────────────────────────────────────────────

  admin: {
    getSessions: () => api.get(`${BASE}/admin/sessions`),
    getSession: (id) => api.get(`${BASE}/admin/sessions/${id}`),
    getHistory: (params = {}) => api.get(`${BASE}/admin/sessions/history`, { params }),
    answerCall: (sessionId, callId) => api.post(`${BASE}/admin/sessions/${sessionId}/calls/${callId}/answer`),
    holdCall:   (sessionId, callId) => api.post(`${BASE}/admin/sessions/${sessionId}/calls/${callId}/hold`),
    resumeCall: (sessionId, callId) => api.post(`${BASE}/admin/sessions/${sessionId}/calls/${callId}/resume`),
    hangup:     (sessionId, callId) => api.post(`${BASE}/admin/sessions/${sessionId}/calls/${callId}/hangup`),
    startVideo: (sessionId) => api.post(`${BASE}/admin/sessions/${sessionId}/videoconference`),
    resolve:    (sessionId) => api.post(`${BASE}/admin/sessions/${sessionId}/resolve`),
  },
};

// ── WebSocket ─────────────────────────────────────────────────────────────────

const WS_BASE = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:4001').replace(/\/$/, '');

export class SupportWebSocket {
  constructor() {
    this._ws          = null;
    this._listeners   = new Map();
    this._reconnectTm = null;
    this._shouldReconnect = false;
    this._pingInterval = null;
  }

  connect() {
    const token = getAccessToken();
    if (!token) return;

    this._shouldReconnect = true;
    const url = `${WS_BASE}/support/socket?token=${encodeURIComponent(token)}`;
    this._ws  = new WebSocket(url);

    this._ws.onopen = () => {
      this._emit('connected');
      this._startPing();
    };

    this._ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._emit(msg.type, msg.payload);
        this._emit('*', msg); // listener générique
      } catch { /* ignore */ }
    };

    this._ws.onclose = () => {
      this._stopPing();
      this._emit('disconnected');
      if (this._shouldReconnect) {
        this._reconnectTm = setTimeout(() => this.connect(), 3000);
      }
    };

    this._ws.onerror = (err) => {
      this._emit('error', err);
    };
  }

  disconnect() {
    this._shouldReconnect = false;
    this._stopPing();
    clearTimeout(this._reconnectTm);
    if (this._ws) { this._ws.close(); this._ws = null; }
  }

  send(type, payload = {}) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type, payload }));
    }
  }

  /** Envoyer un message chat chiffré */
  sendMessage({ sessionId, ciphertext, senderKeyId, type = 'text', clientTs = Date.now() }) {
    this.send('support:message', { sessionId, ciphertext, senderKeyId, type, clientTs });
  }

  /** Relayer un signal WebRTC */
  sendCallSignal(callId, signal) {
    this.send('support:call:signal', { callId, signal });
  }

  /** Acquitter la lecture */
  sendReadAck(sessionId, upToServerTs) {
    this.send('support:read_ack', { sessionId, upToServerTs });
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }

  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach(fn => fn(data));
  }

  _startPing() {
    this._pingInterval = setInterval(() => {
      this.send('ping');
      this.send('support:heartbeat');
    }, 20000);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = null;
  }

  get isConnected() {
    return this._ws?.readyState === WebSocket.OPEN;
  }
}

// Instance singleton partagée à travers l'app
export const supportWs = new SupportWebSocket();
