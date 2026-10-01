/**
 * SupportWidget — Bouton flottant d'accès au service client
 * Affiché sur toutes les pages (public + tenant).
 * Redirige vers /login si non authentifié, sinon ouvre SupportPage.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supportApi } from '../lib/supportApi';

// Icône headset SVG inline
const HeadsetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
    <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

export default function SupportWidget() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const [status, setStatus]     = useState(null); // { available, queueLength }
  const [loading, setLoading]   = useState(false);

  // Ne pas afficher sur la page support elle-même ni sur les pages admin
  const isHidden = location.pathname.startsWith('/support')
    || location.pathname.startsWith('/admin/support');

  // Polling statut toutes les 30 secondes
  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const s = await supportApi.getStatus();
      setStatus(s);
    } catch { /* silencieux */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [user, fetchStatus]);

  if (isHidden) return null;

  const handleClick = async () => {
    if (!user) {
      navigate(`/login?redirect=/support`);
      return;
    }
    setLoading(true);
    navigate('/support');
    setLoading(false);
  };

  const dot = status?.available
    ? { bg: '#34A853', title: 'Disponible' }
    : { bg: '#FBBC05', title: status ? 'Occupé' : 'Chargement…' };

  return (
    <button
      className="support-widget-btn"
      onClick={handleClick}
      disabled={loading}
      aria-label="Ouvrir le service client"
      title={`Service client — ${dot.title}`}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: '#1A73E8',
        color: '#fff',
        border: 'none',
        borderRadius: 0,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(26,115,232,0.3)',
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
        transition: 'opacity 0.15s',
        opacity: loading ? 0.7 : 1,
      }}
    >
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <HeadsetIcon />
        {/* Dot de disponibilité */}
        <span style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dot.bg,
          border: '1.5px solid #fff',
        }} />
      </span>
      <span>Service client</span>
    </button>
  );
}
