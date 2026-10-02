import { useEffect, useRef, useState, useCallback } from 'react';

// ── Alert — déclenche un toast via le NotificationContext ────────────────────
// Import dynamique pour éviter les dépendances circulaires.
let _notifyFn = null;
export function __setNotifyFn(fn) { _notifyFn = fn; }

export function Alert({ variant = 'primary', children }) {
  const lastTicket = useRef(null);
  const resetTimer = useRef(null);

  useEffect(() => {
    if (!children) {
      lastTicket.current = null;
      clearTimeout(resetTimer.current);
      return;
    }
    if (!_notifyFn) return;

    const ticket = `${variant}||${children}`;
    if (lastTicket.current === ticket) return;

    lastTicket.current = ticket;
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => { lastTicket.current = null; }, 500);

    const type = { danger: 'error', success: 'success', warning: 'warning', primary: 'info' }[variant] || 'info';
    _notifyFn(type, children);
  }, [children, variant]);

  useEffect(() => () => clearTimeout(resetTimer.current), []);
  return null;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-secondary)', fontSize: 14 }}>
      <span className="spinner" />
      Chargement…
    </span>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}


export function useConfirm() {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger, resolve }

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        title:        opts.title        || 'Confirmer l\'action',
        message:      opts.message      || 'Êtes-vous sûr de vouloir continuer ?',
        confirmLabel: opts.confirmLabel || 'Confirmer',
        danger:       opts.danger       || false,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    state?.resolve(result);
    setState(null);
  }, [state]);

  function ConfirmModal() {
    if (!state) return null;
    return (
      <div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onKeyDown={(e) => { if (e.key === 'Escape') handleClose(false); }}
        style={{ zIndex: 200 }}
      >
        <div className="modal-box" style={{ maxWidth: 420 }}>
          {/* Icône */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: state.danger ? 'rgba(234,67,53,0.10)' : 'rgba(26,115,232,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {state.danger ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-alert-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
            </div>
            <div>
              <h3 id="confirm-modal-title" style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>
                {state.title}
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {state.message}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleClose(false)}
              autoFocus
            >
              Annuler
            </button>
            <button
              className={`btn btn-sm${state.danger ? ' btn-danger' : ''}`}
              style={!state.danger ? { background: 'var(--color-primary-blue)' } : {}}
              onClick={() => handleClose(true)}
            >
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { confirm, ConfirmModal };
}
