/**
 * fcm.js — Gestion des notifications push Firebase Cloud Messaging
 *
 * Flux :
 * 1. Demander la permission navigateur
 * 2. Obtenir le FCM token (getToken)
 * 3. Envoyer le token au backend (POST /me/fcm-token)
 * 4. Le SW firebase-messaging-sw.js reçoit les notifs en arrière-plan
 */

import { api } from './apiClient';

const SDK_VERSION = '10.12.2';
const CDN_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '926157935845',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

let _messaging = null;
let _initPromise = null;

async function getMessaging() {
  if (_messaging) return _messaging;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    if (!firebaseConfig.apiKey) {
      console.warn('[fcm] Variables VITE_FIREBASE_* manquantes — notifications désactivées.');
      return null;
    }

    const [{ initializeApp, getApps }, { getMessaging: _getMessaging, getToken, onMessage }] = await Promise.all([
      import(/* @vite-ignore */ `${CDN_BASE}/firebase-app.js`),
      import(/* @vite-ignore */ `${CDN_BASE}/firebase-messaging.js`),
    ]);

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _messaging = { instance: _getMessaging(app), getToken, onMessage };
    return _messaging;
  })();

  return _initPromise;
}

/**
 * Demande la permission et enregistre le token FCM auprès du backend.
 * Appelé au login ou depuis les paramètres de notification.
 * @returns {string|null} FCM token ou null si non supporté/refusé
 */
export async function registerFcmToken() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const m = await getMessaging();
    if (!m) return null;

    // Enregistrer le Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

    // Demander la permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[fcm] Permission notifications refusée.');
      return null;
    }

    // Obtenir le token FCM
    const token = await m.getToken(m.instance, {
      vapidKey:            VAPID_KEY || undefined,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('[fcm] Impossible d\'obtenir le FCM token (VAPID key manquante ?)');
      return null;
    }

    // Envoyer le token au backend
    await api.post('/me/fcm-token', { token, platform: 'web' });
    console.info('[fcm] Token enregistré:', token.slice(0, 20) + '…');
    return token;
  } catch (err) {
    console.warn('[fcm] Erreur enregistrement FCM:', err.message);
    return null;
  }
}

/**
 * Écoute les messages FCM quand l'onglet est en premier plan.
 * Affiche une notification native ou déclenche une action dans l'app.
 * @param {function} onMessageCallback fn({ title, body, data })
 */
export async function onForegroundMessage(onMessageCallback) {
  try {
    const m = await getMessaging();
    if (!m) return () => {};

    const unsubscribe = m.onMessage(m.instance, (payload) => {
      console.log('[fcm] Message au premier plan:', payload);
      const { title, body } = payload.notification || {};
      const data = payload.data || {};
      onMessageCallback({ title, body, data });
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[fcm] onForegroundMessage error:', err.message);
    return () => {};
  }
}

/**
 * Supprimer le token FCM (à la déconnexion).
 */
export async function unregisterFcmToken() {
  try {
    await api.delete('/me/fcm-token').catch(() => {});
    const m = await getMessaging();
    if (!m) return;
    const { deleteToken } = await import(/* @vite-ignore */ `${CDN_BASE}/firebase-messaging.js`);
    await deleteToken(m.instance);
  } catch { /* ignore */ }
}
