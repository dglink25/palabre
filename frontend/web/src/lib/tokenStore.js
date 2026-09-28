const ACCESS_KEY = 'palabre_access_token';
const REFRESH_KEY = 'palabre_refresh_token';

const listeners = new Set();

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  listeners.forEach((fn) => fn());
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  listeners.forEach((fn) => fn());
}

export function onTokensChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
