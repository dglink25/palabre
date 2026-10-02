/**
 * SupportWidget - Bouton flottant d'accès au service client
 * Affiché sur toutes les pages (public + tenant).
 * Redirige vers /login si non authentifié, sinon ouvre SupportPage.
 * Toutes les couleurs utilisent les tokens CSS - zéro valeur en dur.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supportApi } from '../lib/supportApi';

const HeadsetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
    <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

export default function SupportWidget() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(false);

  const isHidden = location.pathname.startsWith('/support')
    || location.pathname.startsWith('/admin/support');

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
    if (!user) { navigate('/login?redirect=/support'); return; }
    setLoading(true);
    navigate('/support');
    setLoading(false);
  };

  // Couleurs via tokens CSS - on lit la valeur via une variable CSS inline
  const dotColor = status?.available
    ? 'var(--color-success-green)'
    : 'var(--color-warning-amber)';
  const dotTitle = status?.available ? 'Disponible' : (status ? 'Occupé' : 'Chargement…');

  return (
    <>
      <style>{`
        .support-widget-btn {
          position: fixed;
          bottom: 28px;
          right: 88px; /* décalé à gauche du ScrollButton : 28 + 48 + 12 */
          z-index: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: var(--color-primary-blue);
          color: var(--color-white);
          border: none;
          border-radius: 0;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(var(--color-primary-blue-rgb), 0.30);
          font-family: var(--font-stack);
          font-size: var(--font-size-sm);
          font-weight: 600;
          letter-spacing: 0.2px;
          transition: opacity var(--duration-fast) var(--ease),
                      transform var(--duration-fast) var(--ease);
          min-height: 44px;
        }
        .support-widget-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }
        .support-widget-btn:disabled { opacity: 0.7; cursor: wait; }
        .support-widget-btn:focus-visible {
          outline: 3px solid var(--color-primary-blue);
          outline-offset: 2px;
        }
        /* Mobile : icône seule, sans texte, pour ne pas déborder */
        @media (max-width: 640px) {
          .support-widget-btn {
            right: 80px;
            bottom: 20px;
            padding: 10px 12px;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            justify-content: center;
          }
          .support-widget-label { display: none; }
        }
      `}</style>

      <button
        className="support-widget-btn"
        onClick={handleClick}
        disabled={loading}
        aria-label={`Service client - ${dotTitle}`}
        title={`Service client - ${dotTitle}`}
      >
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <HeadsetIcon />
          <span
            aria-live="polite"
            aria-label={dotTitle}
            style={{
              position:     'absolute',
              top:          -2,
              right:        -2,
              width:        8,
              height:       8,
              borderRadius: '50%',
              background:   dotColor,
              border:       '1.5px solid var(--color-white)',
            }}
          />
        </span>
        <span className="support-widget-label">Service client</span>
      </button>
    </>
  );
}
