/**
 * authApi.js - Developer Portal
 *
 * Instance Axios pour les appels publics d'authentification (sans JWT).
 * Pointe vers le backend Palabre via le proxy Vite (/api → port 4000).
 *
 * Requirements : 1.2
 */

import axios from 'axios';

const authApi = axios.create({
  baseURL: '/api/v1/auth',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

export default authApi;
