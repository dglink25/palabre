import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

class ApiError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

let refreshPromise = null;

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError(401, 'NO_REFRESH_TOKEN', 'Session expirée.');
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    throw new ApiError(res.status, 'REFRESH_FAILED', 'Session expirée, reconnectez-vous.');
  }
  const data = await res.json();
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

// Fenêtre de confirmation super-admin (voir writeConfirmation.service.js
// côté backend) : évite de redemander un code e-mail à chaque requête tant
// que le jeton obtenu reste valable.
let confirmationToken = null;
let confirmationHandler = null; // fourni par l'app (ouvre la modale, résout avec un token)

export function setConfirmationHandler(fn) {
  confirmationHandler = fn;
}
export function clearCachedConfirmationToken() {
  confirmationToken = null;
}

/**
 * `opts.form` : true si body est un FormData (upload) — pas de Content-Type
 * manuel, le navigateur pose le boundary multipart lui-même.
 * `opts.auth` : false pour les routes publiques (défaut : true).
 * `opts.headers` : en-têtes additionnels (ex. X-Draft-Token).
 */
async function request(path, { method = 'GET', body, form = false, auth = true, headers = {}, _retried = false, _confirmRetried = false } = {}) {
  const finalHeaders = { ...headers };
  if (!form && body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }
  if (confirmationToken && !finalHeaders['X-Confirmation-Token']) {
    finalHeaders['X-Confirmation-Token'] = confirmationToken;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  } catch {
    // Le serveur est injoignable (réseau coupé, mauvaise URL d'API, CORS...)
    // — jamais de message technique brut affiché à l'utilisateur.
    throw new ApiError(0, 'NETWORK_ERROR', 'Impossible de joindre le serveur.');
  }

  if (res.status === 401 && auth && !_retried) {
    try {
      if (!refreshPromise) refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
      await refreshPromise;
      return request(path, { method, body, form, auth, headers, _retried: true, _confirmRetried });
    } catch (e) {
      clearTokens();
      throw e;
    }
  }

  if (res.status === 428 && !_confirmRetried) {
    // Double vérification requise (super-admin) — voir writeConfirmation.service.js.
    if (!confirmationHandler) {
      throw new ApiError(428, 'CONFIRMATION_REQUIRED', 'Double vérification requise.');
    }
    confirmationToken = await confirmationHandler();
    return request(path, { method, body, form, auth, headers, _retried, _confirmRetried: true });
  }

  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch { /* pas de corps */ }

  if (!res.ok) {
    const err = data && data.error ? data.error : { code: 'UNKNOWN', message: 'Une erreur est survenue.' };
    throw new ApiError(res.status, err.code, err.message, err);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData, form: true }),
};

export { ApiError, API_BASE };
