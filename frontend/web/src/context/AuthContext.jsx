import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/apiClient';
import { getAccessToken, setTokens, clearTokens, onTokensChanged } from '../lib/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef(null);

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

  // Présence temps réel (voir presence.service.js côté backend) : tant que
  // ce heartbeat part régulièrement, la session reste "en ligne".
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

  const applySession = useCallback((sessionResult) => {
    setTokens({ accessToken: sessionResult.accessToken, refreshToken: sessionResult.refreshToken });
    setUser(sessionResult.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* déconnexion locale malgré tout */ }
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
