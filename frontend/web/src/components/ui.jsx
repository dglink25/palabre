import { useEffect, useRef } from 'react';

// ── Alert — déclenche un toast via le NotificationContext ────────────────────
// Import dynamique pour éviter les dépendances circulaires
let _notifyFn = null;
export function __setNotifyFn(fn) { _notifyFn = fn; }

export function Alert({ variant = 'primary', children }) {
  const prevRef = useRef(null);

  useEffect(() => {
    if (!children || !_notifyFn) return;
    // Ne pas re-notifier si le message n'a pas changé
    if (prevRef.current === children) return;
    prevRef.current = children;

    const type = {
      danger:  'error',
      success: 'success',
      warning: 'warning',
      primary: 'info',
    }[variant] || 'info';

    _notifyFn(type, children);
  }, [children, variant]);

  // Rendu invisible — le toast gère l'affichage
  return null;
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#5F6368', fontSize: 14 }}>
      <span className="spinner" />
      Chargement...
    </span>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
