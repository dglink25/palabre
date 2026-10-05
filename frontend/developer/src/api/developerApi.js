/**
 * developerApi.js
 *
 * Instance Axios préconfigurée pour l'API_Gateway du Developer Portal.
 * - baseURL : /api/v1/developer  (proxy Vite → backend port 4000)
 * - Intercepteur de requête : injecte le header Authorization avec le JWT
 *   stocké dans localStorage sous la clé `palabre_access_token`
 * - Intercepteur de réponse : centralise la gestion des 401 (token expiré)
 */

import axios from 'axios';

// ─── Création de l'instance ───────────────────────────────────────────────────

const developerApi = axios.create({
  baseURL: '/api/v1/developer',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000, // 15 secondes
});

// ─── Intercepteur de requête ──────────────────────────────────────────────────

developerApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('palabre_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Intercepteur de réponse ──────────────────────────────────────────────────

developerApi.interceptors.response.use(
  // Réponse 2xx : retourner directement
  (response) => response,

  // Erreur : normaliser et propager
  (error) => {
    if (error.response) {
      const { status } = error.response;

      if (status === 401) {
        // Supprimer le token invalide/expiré et rediriger vers la page de login
        localStorage.removeItem('palabre_access_token');
        // Redirection douce : ne pas utiliser react-router ici (hors composant)
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default developerApi;
