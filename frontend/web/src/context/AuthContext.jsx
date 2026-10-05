import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/apiClient';
import { getAccessToken, setTokens, clearTokens, onTokensChanged } from '../lib/tokenStore';
import { registerFcmToken, unregisterFcmToken, onForegroundMessage } from '../lib/fcm';
import { e2eCrypto } from '../lib/e2eCrypto';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef(null);
  const fcmUnsubRef  = useRef(null);

  const loadProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await api.get('/me');
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    const unsubscribe = onTokensChanged(loadProfile);
    return unsubscribe;
  }, [loadProfile]);

  // Présence temps réel
  useEffect(() => {
    if (!user) {
      clearInterval(heartbeatRef.current);
      return;
    }
    const sendHeartbeat = () => api.post('/sessions/heartbeat').catch(() => {});
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 45_000);
    return () => clearInterval(heartbeatRef.current);
  }, [user]);

  // Enregistrement FCM après connexion
  useEffect(() => {
    if (!user) return;

    // Initialiser les clés E2E (non-bloquant - si ça échoue l'app continue)
    e2eCrypto.initialize().catch(err =>
      console.warn('[e2e] init failed:', err.message)
    );

    // Enregistrer le token FCM (non bloquant - peut échouer si refusé)
    registerFcmToken().catch(() => {});

    // Écoute des messages FCM au premier plan
    onForegroundMessage(({ title, body, data }) => {
      // Afficher une notification native si l'onglet est actif
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title || 'Palabre', {
          body:  body || '',
          icon:  '/logo.png',
          tag:   data?.conversationId || 'palabre',
          data,
        });
      }
    }).then(unsub => { fcmUnsubRef.current = unsub; }).catch(() => {});

    return () => { fcmUnsubRef.current?.(); };
  }, [user?.id]); // eslint-disable-line

  const applySession = useCallback((sessionResult) => {
    setTokens({ accessToken: sessionResult.accessToken, refreshToken: sessionResult.refreshToken });
    setUser(sessionResult.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* déconnexion locale malgré tout */ }
    unregisterFcmToken().catch(() => {});
    e2eCrypto.clearKeys().catch(() => {});
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, applySession, logout, refreshProfile: loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
