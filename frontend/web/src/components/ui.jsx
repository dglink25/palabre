import { useEffect, useRef } from 'react';

// ── Alert - déclenche un toast via le NotificationContext ────────────────────
// Import dynamique pour éviter les dépendances circulaires
let _notifyFn = null;
export function __setNotifyFn(fn) { _notifyFn = fn; }

/**
 * Alert - composant invisible qui déclenche un toast.
 *
 * Usage : <Alert variant="danger">{errorMessage}</Alert>
 *
 * Comportement :
 * - Chaque fois que `children` change vers une valeur non vide, un toast est affiché.
 * - Quand `children` revient à vide (''), la référence est réinitialisée :
 *   le prochain message identique déclenchera bien un nouveau toast.
 * - Si `children` ne passe jamais par vide entre deux erreurs identiques,
 *   un setTimeout de 500ms force la réinitialisation pour permettre la répétition.
 */
export function Alert({ variant = 'primary', children }) {
  const lastTicket = useRef(null);
  const resetTimer = useRef(null);

  useEffect(() => {
    if (!children) {
      // Message effacé → réinitialiser immédiatement
      lastTicket.current = null;
      clearTimeout(resetTimer.current);
      return;
    }
    if (!_notifyFn) return;

    const ticket = `${variant}||${children}`;

    // Même ticket dans le même cycle React → skip (double-render harmless)
    if (lastTicket.current === ticket) return;

    lastTicket.current = ticket;

    // Programmer la réinitialisation après 500ms :
    // si l'utilisateur re-soumet immédiatement avec la même erreur,
    // le ticket aura été réinitialisé et le toast se re-déclenchera.
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      lastTicket.current = null;
    }, 500);

    const type = {
      danger:  'error',
      success: 'success',
      warning: 'warning',
      primary: 'info',
    }[variant] || 'info';

    _notifyFn(type, children);
  }, [children, variant]);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

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
