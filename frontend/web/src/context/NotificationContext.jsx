import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const NotificationContext = createContext(null);

let _uid = 0;
function uid() { return ++_uid; }

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message, duration = 4500) => {
    if (!message) return;
    const id = uid();
    setToasts(prev => [...prev, { id, type, message, duration, removing: false }]);
    setTimeout(() => remove(id), duration);
    return id;
  }, []); // eslint-disable-line

  const remove = useCallback((id) => {
    // Marquer comme "removing" pour déclencher l'animation de sortie
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    // Supprimer après la durée de l'animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 380);
  }, []);

  const notify = {
    success: (msg, d) => push('success', msg, d),
    error:   (msg, d) => push('error',   msg, d || 6000),
    info:    (msg, d) => push('info',    msg, d),
    warning: (msg, d) => push('warning', msg, d),
  };

  return (
    <NotificationContext.Provider value={{ notify, remove }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside NotificationProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icônes animées SVG
// ─────────────────────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {/* Cercle */}
      <circle cx="11" cy="11" r="10"
        stroke="#34A853" strokeWidth="2"
        fill="rgba(52,168,83,0.1)"
        style={{
          strokeDasharray: 63,
          strokeDashoffset: 63,
          animation: 'circleStroke 0.4s cubic-bezier(0.65,0,0.45,1) 0.1s forwards',
        }}
      />
      {/* Coche */}
      <path d="M6 11.5L9.5 15L16 8"
        stroke="#34A853" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        fill="none"
        style={{
          strokeDasharray: 14,
          strokeDashoffset: 14,
          animation: 'checkStroke 0.3s cubic-bezier(0.65,0,0.45,1) 0.45s forwards',
        }}
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="10"
        stroke="#EA4335" strokeWidth="2"
        fill="rgba(234,67,53,0.1)"
        style={{
          strokeDasharray: 63,
          strokeDashoffset: 63,
          animation: 'circleStroke 0.4s cubic-bezier(0.65,0,0.45,1) 0.1s forwards',
        }}
      />
      <path d="M8 8L14 14M14 8L8 14"
        stroke="#EA4335" strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        style={{
          strokeDasharray: 12,
          strokeDashoffset: 12,
          animation: 'checkStroke 0.3s cubic-bezier(0.65,0,0.45,1) 0.45s forwards',
        }}
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="10" stroke="#1A73E8" strokeWidth="2" fill="rgba(26,115,232,0.1)" />
      <path d="M11 10v5" stroke="#1A73E8" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="11" cy="7.5" r="1" fill="#1A73E8" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 2L20.5 19H1.5L11 2z" stroke="#FBBC05" strokeWidth="2" strokeLinejoin="round" fill="rgba(251,188,5,0.1)" />
      <path d="M11 9v4" stroke="#FBBC05" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="11" cy="15.5" r="1" fill="#FBBC05" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Config par type
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: {
    icon: SuccessIcon,
    accent: '#34A853',
    bg: '#fff',
    border: 'rgba(52,168,83,0.25)',
    bar: '#34A853',
  },
  error: {
    icon: ErrorIcon,
    accent: '#EA4335',
    bg: '#fff',
    border: 'rgba(234,67,53,0.25)',
    bar: '#EA4335',
  },
  info: {
    icon: InfoIcon,
    accent: '#1A73E8',
    bg: '#fff',
    border: 'rgba(26,115,232,0.25)',
    bar: '#1A73E8',
  },
  warning: {
    icon: WarningIcon,
    accent: '#FBBC05',
    bg: '#fff',
    border: 'rgba(251,188,5,0.3)',
    bar: '#FBBC05',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Composant Toast individuel
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ toast, onRemove }) {
  const cfg = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const [barWidth, setBarWidth] = useState('100%');
  const timerRef = useRef(null);

  useEffect(() => {
    // Démarrer la barre de progression
    requestAnimationFrame(() => {
      setBarWidth('0%');
    });
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
        padding: '14px 16px 10px 14px',
        boxShadow: '0 8px 32px rgba(32,33,36,0.14), 0 2px 8px rgba(32,33,36,0.08)',
        minWidth: 300,
        maxWidth: 420,
        position: 'relative',
        overflow: 'hidden',
        animation: toast.removing
          ? 'toastOut 0.35s cubic-bezier(0.4,0,1,1) forwards'
          : 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        cursor: 'default',
      }}
      onClick={() => onRemove(toast.id)}
    >
      {/* Barre de progression */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0,
        height: 3,
        background: cfg.bar,
        borderRadius: '0 0 0 12px',
        width: barWidth,
        transition: `width ${toast.duration - 300}ms linear`,
        transitionDelay: '300ms',
        opacity: 0.7,
      }} />

      {/* Icône animée */}
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon />
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#202124',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}>
          {toast.message}
        </div>
      </div>

      {/* Bouton fermer */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
        style={{
          flexShrink: 0,
          width: 20, height: 20,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4,
          color: '#9AA0A6',
          padding: 0,
          marginTop: 1,
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#202124'; e.currentTarget.style.background = '#F0F0F0'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9AA0A6'; e.currentTarget.style.background = 'none'; }}
        aria-label="Fermer"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conteneur de toasts
// ─────────────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(110%) scale(0.92); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(0) scale(1); max-height: 120px; margin-bottom: 10px; }
          to   { opacity: 0; transform: translateX(110%) scale(0.92); max-height: 0; margin-bottom: 0; padding: 0; }
        }
        @keyframes circleStroke {
          to { stroke-dashoffset: 0; }
        }
        @keyframes checkStroke {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <Toast toast={toast} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </>
  );
}
