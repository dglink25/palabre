/**
 * AuthContext.jsx
 *
 * Gestion de l'authentification SSO pour le Developer Portal.
 *
 * Fonctionnement :
 *  1. Lit `palabre_access_token` depuis localStorage au montage.
 *  2. Si aucun token → redirige immédiatement vers <LoginPage>.
 *  3. Si token présent → appelle POST /accounts/me pour créer/récupérer
 *     le Developer_Account associé à la session SSO.
 *  4. Si l'appel retourne 401 → supprime le token et redirige vers <LoginPage>.
 *  5. Pendant le chargement initial → affiche un spinner plein-écran.
 *  6. Expose { account, loading, error, logout } via Context.
 *
 * Requirements couverts : 1.2, 1.3, 1.5, 1.6, 2.5
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import developerApi from '../api/developerApi';

// ─── Contexte ────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Spinner plein-écran ──────────────────────────────────────────────────────

function AuthLoader() {
  return (
    <div className="dev-page-loader" aria-label="Authentification en cours…">
      <div className="dev-spinner" role="status" aria-live="polite" />
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * AuthProvider
 *
 * Doit être placé à l'intérieur de <BrowserRouter> pour pouvoir utiliser
 * useNavigate. Il est wrappé autour de <App> dans main.jsx via
 * <BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>.
 */
export function AuthProvider({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Déconnexion ─────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('palabre_access_token');
    setAccount(null);
    setError(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // ── Initialisation SSO ───────────────────────────────────────────────────────
  useEffect(() => {
    // Ne pas ré-exécuter si on est déjà sur /login
    if (location.pathname === '/login') {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('palabre_access_token');

    // Pas de token → rediriger vers la page de connexion
    if (!token) {
      setLoading(false);
      navigate('/login', { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // POST /accounts/me : crée ou récupère le Developer_Account (req 2.1, 2.3, 2.4)
        const response = await developerApi.post('/accounts/me');
        if (!cancelled) {
          setAccount(response.data);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;

        const status = err.response?.status;

        if (status === 401) {
          // Token expiré ou invalide (req 1.6) → nettoyer et rediriger
          localStorage.removeItem('palabre_access_token');
          navigate('/login', { replace: true });
        } else {
          // Autre erreur réseau / serveur → afficher un message d'erreur (req 1.6)
          setError(
            err.response?.data?.message
              || 'Une erreur est survenue lors de l\'authentification. Veuillez réessayer.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // S'exécute une seule fois au montage

  // ── Rendu ────────────────────────────────────────────────────────────────────

  // Spinner pendant le chargement initial (req 1.3)
  if (loading) {
    return <AuthLoader />;
  }

  return (
    <AuthContext.Provider value={{ account, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook d'accès au contexte ─────────────────────────────────────────────────

/**
 * useAuth()
 *
 * Hook personnalisé pour consommer AuthContext dans n'importe quel composant.
 *
 * @throws {Error} Si utilisé en dehors de <AuthProvider>
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
