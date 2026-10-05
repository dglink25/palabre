/**
 * WebhooksPage.jsx - Developer Portal
 *
 * Onglet Webhooks d'un Developer_Project.
 *
 * Fonctionnalités :
 *   1. Liste des webhooks : url, events abonnés, statut, last_fired_at (req 10.1)
 *   2. Formulaire de création : champ URL (validation HTTPS côté client),
 *      checkboxes pour les event types disponibles, bouton "Créer" (req 10.1)
 *   3. Bouton "Supprimer" par webhook (confirmation requise)
 *   4. Section "Historique des livraisons" : tableau des 100 dernières entrées
 *      avec event_type, statut (badge coloré), code HTTP, timestamp (req 10.6)
 *
 * Requirements couverts : 10.1, 10.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import developerApi from '../api/developerApi';

// ─── Types d'événements disponibles ──────────────────────────────────────────

const AVAILABLE_EVENT_TYPES = [
  { value: 'message.received',   label: 'Message reçu' },
  { value: 'call.missed',        label: 'Appel manqué' },
  { value: 'call.started',       label: 'Appel démarré' },
  { value: 'call.ended',         label: 'Appel terminé' },
  { value: 'user.online',        label: 'Utilisateur connecté' },
  { value: 'user.offline',       label: 'Utilisateur déconnecté' },
  { value: 'notification.sent',  label: 'Notification envoyée' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(isoString) {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(isoString));
}

function isHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconWebhook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 24 }) {
  return (
    <span
      role="status"
      aria-label="Chargement…"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '3px solid var(--dev-color-neutral-200)',
        borderTopColor: 'var(--dev-color-brand-primary)',
        borderRadius: '50%',
        animation: 'dev-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Badge de statut webhook ──────────────────────────────────────────────────

function WebhookStatusBadge({ status }) {
  const config = {
    active: {
      label: 'Actif',
      bg:    'var(--dev-color-success-light)',
      color: 'var(--dev-color-success)',
    },
    failed: {
      label: 'Défaillant',
      bg:    'var(--dev-color-error-light)',
      color: 'var(--dev-color-error)',
    },
    disabled: {
      label: 'Désactivé',
      bg:    'var(--dev-color-neutral-100)',
      color: 'var(--dev-color-neutral-500)',
    },
  };
  const cfg = config[status] ?? config.disabled;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 'var(--dev-border-radius-full)',
        background: cfg.bg,
        color: cfg.color,
        fontSize: 'var(--dev-font-size-xs)',
        fontWeight: 'var(--dev-font-weight-semibold)',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Badge de statut de livraison ─────────────────────────────────────────────

function DeliveryStatusBadge({ status }) {
  const config = {
    delivered: {
      label: 'Livré',
      bg:    'var(--dev-color-success-light)',
      color: 'var(--dev-color-success)',
    },
    pending: {
      label: 'En attente',
      bg:    'var(--dev-color-warning-light)',
      color: 'var(--dev-color-warning)',
    },
    failed: {
      label: 'Échoué',
      bg:    'var(--dev-color-error-light)',
      color: 'var(--dev-color-error)',
    },
  };
  const cfg = config[status] ?? config.pending;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--dev-border-radius-full)',
        background: cfg.bg,
        color: cfg.color,
        fontSize: 'var(--dev-font-size-xs)',
        fontWeight: 'var(--dev-font-weight-semibold)',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Modale de confirmation de suppression ────────────────────────────────────

function ConfirmDeleteModal({ webhook, onConfirm, onCancel, busy }) {
  // Fermer avec Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--dev-bg-overlay)',
        padding: 'var(--dev-space-4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: 'var(--dev-bg-surface)',
          borderRadius: 'var(--dev-border-radius-xl)',
          boxShadow: 'var(--dev-shadow-xl)',
          width: '100%',
          maxWidth: 440,
          padding: 'var(--dev-space-8)',
        }}
      >
        {/* En-tête */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--dev-space-4)',
            marginBottom: 'var(--dev-space-6)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--dev-border-radius-full)',
              background: 'var(--dev-color-error-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dev-color-error)',
              flexShrink: 0,
            }}
          >
            <IconWarning />
          </div>
          <div>
            <h2
              id="confirm-delete-title"
              style={{
                fontSize: 'var(--dev-font-size-lg)',
                fontWeight: 'var(--dev-font-weight-bold)',
                color: 'var(--dev-text-primary)',
                margin: '0 0 var(--dev-space-2) 0',
              }}
            >
              Supprimer ce webhook ?
            </h2>
            <p
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-secondary)',
                margin: 0,
                wordBreak: 'break-all',
              }}
            >
              Cette action est irréversible. Le webhook{' '}
              <strong style={{ color: 'var(--dev-text-primary)' }}>
                {webhook.url}
              </strong>{' '}
              ainsi que tout son historique de livraisons seront supprimés définitivement.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--dev-space-3)', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: 'var(--dev-space-2) var(--dev-space-5)',
              background: 'var(--dev-bg-surface)',
              color: 'var(--dev-text-secondary)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-medium)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dev-space-2)',
              padding: 'var(--dev-space-2) var(--dev-space-5)',
              background: busy ? 'var(--dev-color-neutral-300)' : 'var(--dev-color-error)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'background var(--dev-transition-fast)',
            }}
          >
            {busy ? <Spinner size={14} /> : <IconTrash />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulaire de création de webhook ───────────────────────────────────────

function CreateWebhookForm({ projectId, onCreated }) {
  const [url, setUrl]           = useState('');
  const [events, setEvents]     = useState([]);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [urlError, setUrlError] = useState('');
  const urlInputRef             = useRef(null);

  function toggleEvent(value) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  function validateUrl(value) {
    if (!value.trim()) {
      setUrlError('L\'URL est obligatoire.');
      return false;
    }
    if (!isHttpsUrl(value.trim())) {
      setUrlError('L\'URL doit commencer par https://');
      return false;
    }
    setUrlError('');
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateUrl(url)) {
      urlInputRef.current?.focus();
      return;
    }
    if (events.length === 0) {
      setError('Sélectionnez au moins un type d\'événement.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { data } = await developerApi.post(`/projects/${projectId}/webhooks`, {
        url: url.trim(),
        events,
      });
      const newWebhook = data?.webhook ?? data;
      onCreated(newWebhook);
      setUrl('');
      setEvents([]);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Une erreur est survenue lors de la création du webhook.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = url.trim().length > 0 && events.length > 0 && !busy;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Créer un webhook"
      style={{
        background: 'var(--dev-bg-surface)',
        border: '1px solid var(--dev-border-color)',
        borderRadius: 'var(--dev-border-radius-lg)',
        padding: 'var(--dev-space-6)',
        boxShadow: 'var(--dev-shadow-sm)',
      }}
    >
      <h3
        style={{
          fontSize: 'var(--dev-font-size-base)',
          fontWeight: 'var(--dev-font-weight-semibold)',
          color: 'var(--dev-text-primary)',
          margin: '0 0 var(--dev-space-5) 0',
        }}
      >
        Nouveau webhook
      </h3>

      {/* Erreur générale */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--dev-space-2)',
            padding: 'var(--dev-space-3) var(--dev-space-4)',
            background: 'var(--dev-color-error-light)',
            border: '1px solid var(--dev-color-error)',
            borderRadius: 'var(--dev-border-radius-md)',
            color: 'var(--dev-color-error)',
            fontSize: 'var(--dev-font-size-sm)',
            marginBottom: 'var(--dev-space-4)',
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>
            <IconAlertCircle />
          </span>
          {error}
        </div>
      )}

      {/* Champ URL */}
      <div style={{ marginBottom: 'var(--dev-space-5)' }}>
        <label
          htmlFor="webhook-url"
          style={{
            display: 'block',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            color: 'var(--dev-text-primary)',
            marginBottom: 'var(--dev-space-2)',
          }}
        >
          URL de destination{' '}
          <span aria-hidden="true" style={{ color: 'var(--dev-color-error)' }}>*</span>
        </label>
        <input
          ref={urlInputRef}
          id="webhook-url"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (urlError) validateUrl(e.target.value);
          }}
          onBlur={(e) => validateUrl(e.target.value)}
          placeholder="https://api.monapp.com/webhooks/palabre"
          required
          aria-describedby={urlError ? 'webhook-url-error' : 'webhook-url-hint'}
          aria-invalid={!!urlError}
          style={{
            width: '100%',
            padding: 'var(--dev-space-3) var(--dev-space-4)',
            border: `1px solid ${urlError ? 'var(--dev-color-error)' : 'var(--dev-border-color)'}`,
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-base)',
            color: 'var(--dev-text-primary)',
            background: 'var(--dev-bg-surface)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color var(--dev-transition-fast)',
          }}
          onFocus={(e) => {
            if (!urlError) e.target.style.borderColor = 'var(--dev-border-color-focus)';
          }}
          onBlurCapture={(e) => {
            if (!urlError) e.target.style.borderColor = 'var(--dev-border-color)';
          }}
        />
        {urlError ? (
          <p
            id="webhook-url-error"
            role="alert"
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-color-error)',
              marginTop: 'var(--dev-space-1)',
              marginBottom: 0,
            }}
          >
            {urlError}
          </p>
        ) : (
          <p
            id="webhook-url-hint"
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-text-muted)',
              marginTop: 'var(--dev-space-1)',
              marginBottom: 0,
            }}
          >
            L'URL doit commencer par <code>https://</code>
          </p>
        )}
      </div>

      {/* Checkboxes des event types */}
      <fieldset
        style={{
          border: 'none',
          padding: 0,
          margin: '0 0 var(--dev-space-6) 0',
        }}
        aria-label="Types d'événements à écouter"
      >
        <legend
          style={{
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            color: 'var(--dev-text-primary)',
            marginBottom: 'var(--dev-space-3)',
            display: 'block',
          }}
        >
          Types d'événements{' '}
          <span aria-hidden="true" style={{ color: 'var(--dev-color-error)' }}>*</span>
          <span
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-text-muted)',
              fontWeight: 'var(--dev-font-weight-normal)',
              marginLeft: 'var(--dev-space-2)',
            }}
          >
            (sélectionnez au moins un)
          </span>
        </legend>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--dev-space-2)',
          }}
        >
          {AVAILABLE_EVENT_TYPES.map((evt) => {
            const checked = events.includes(evt.value);
            return (
              <label
                key={evt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--dev-space-3)',
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  border: `1px solid ${checked ? 'var(--dev-color-brand-primary)' : 'var(--dev-border-color)'}`,
                  borderRadius: 'var(--dev-border-radius-md)',
                  background: checked ? '#eff6ff' : 'var(--dev-bg-surface)',
                  cursor: 'pointer',
                  transition: 'border-color var(--dev-transition-fast), background var(--dev-transition-fast)',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEvent(evt.value)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: 'var(--dev-color-brand-primary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--dev-font-size-sm)',
                    color: checked ? 'var(--dev-color-brand-primary)' : 'var(--dev-text-secondary)',
                    fontWeight: checked ? 'var(--dev-font-weight-medium)' : 'var(--dev-font-weight-normal)',
                  }}
                >
                  {evt.label}
                </span>
                <code
                  style={{
                    fontSize: 'var(--dev-font-size-xs)',
                    color: 'var(--dev-text-muted)',
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {evt.value}
                </code>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Bouton Créer */}
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--dev-space-2)',
          padding: 'var(--dev-space-3) var(--dev-space-5)',
          background: canSubmit
            ? 'var(--dev-color-brand-primary)'
            : 'var(--dev-color-neutral-300)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--dev-border-radius-md)',
          fontSize: 'var(--dev-font-size-base)',
          fontWeight: 'var(--dev-font-weight-semibold)',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background var(--dev-transition-fast)',
        }}
      >
        {busy ? <Spinner size={16} /> : <IconPlus />}
        {busy ? 'Création…' : 'Créer le webhook'}
      </button>
    </form>
  );
}

// ─── Carte d'un webhook ───────────────────────────────────────────────────────

function WebhookCard({ webhook, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--dev-bg-surface)',
        border: '1px solid var(--dev-border-color)',
        borderRadius: 'var(--dev-border-radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--dev-shadow-sm)',
      }}
    >
      {/* En-tête de la carte */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--dev-space-4)',
          padding: 'var(--dev-space-5)',
          flexWrap: 'wrap',
        }}
      >
        {/* URL + events */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--dev-space-3)',
              flexWrap: 'wrap',
              marginBottom: 'var(--dev-space-2)',
            }}
          >
            <code
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-primary)',
                fontFamily: 'var(--dev-font-family-mono)',
                wordBreak: 'break-all',
                background: 'var(--dev-color-neutral-100)',
                padding: '2px 8px',
                borderRadius: 'var(--dev-border-radius-sm)',
              }}
            >
              {webhook.url}
            </code>
            <WebhookStatusBadge status={webhook.status} />
          </div>

          {/* Events abonnés */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--dev-space-1)',
              marginBottom: 'var(--dev-space-2)',
            }}
            aria-label="Événements abonnés"
          >
            {(webhook.events ?? []).map((evt) => (
              <span
                key={evt}
                style={{
                  fontSize: 'var(--dev-font-size-xs)',
                  padding: '1px 8px',
                  background: 'var(--dev-color-info-light)',
                  color: 'var(--dev-color-info)',
                  borderRadius: 'var(--dev-border-radius-full)',
                  fontFamily: 'var(--dev-font-family-mono)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                }}
              >
                {evt}
              </span>
            ))}
            {(!webhook.events || webhook.events.length === 0) && (
              <span style={{ fontSize: 'var(--dev-font-size-xs)', color: 'var(--dev-text-muted)' }}>
                Aucun événement abonné
              </span>
            )}
          </div>

          {/* last_fired_at */}
          <p
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-text-muted)',
              margin: 0,
            }}
          >
            Dernier déclenchement :{' '}
            <strong style={{ color: 'var(--dev-text-secondary)' }}>
              {formatDateTime(webhook.last_fired_at)}
            </strong>
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--dev-space-2)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Masquer les détails' : 'Afficher les détails'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dev-space-1)',
              padding: 'var(--dev-space-2) var(--dev-space-3)',
              background: 'var(--dev-bg-surface)',
              color: 'var(--dev-text-secondary)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-xs)',
              fontWeight: 'var(--dev-font-weight-medium)',
              cursor: 'pointer',
              transition: 'background var(--dev-transition-fast)',
            }}
          >
            {expanded ? <IconChevronUp /> : <IconChevronDown />}
            {expanded ? 'Réduire' : 'Détails'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(webhook)}
            aria-label={`Supprimer le webhook ${webhook.url}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dev-space-1)',
              padding: 'var(--dev-space-2) var(--dev-space-3)',
              background: 'var(--dev-color-error-light)',
              color: 'var(--dev-color-error)',
              border: '1px solid var(--dev-color-error)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-xs)',
              fontWeight: 'var(--dev-font-weight-medium)',
              cursor: 'pointer',
              transition: 'background var(--dev-transition-fast)',
            }}
          >
            <IconTrash />
            Supprimer
          </button>
        </div>
      </div>

      {/* Détails étendus */}
      {expanded && (
        <div
          style={{
            padding: 'var(--dev-space-4) var(--dev-space-5)',
            borderTop: '1px solid var(--dev-border-color)',
            background: 'var(--dev-color-neutral-50)',
          }}
        >
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              gap: 'var(--dev-space-2) var(--dev-space-6)',
              fontSize: 'var(--dev-font-size-sm)',
              margin: 0,
            }}
          >
            <dt style={{ color: 'var(--dev-text-muted)', fontWeight: 'var(--dev-font-weight-medium)' }}>
              ID
            </dt>
            <dd style={{ color: 'var(--dev-text-secondary)', fontFamily: 'var(--dev-font-family-mono)', fontSize: 'var(--dev-font-size-xs)', margin: 0 }}>
              {webhook.id}
            </dd>

            <dt style={{ color: 'var(--dev-text-muted)', fontWeight: 'var(--dev-font-weight-medium)' }}>
              Créé le
            </dt>
            <dd style={{ color: 'var(--dev-text-secondary)', margin: 0 }}>
              {formatDateTime(webhook.created_at)}
            </dd>

            {webhook.failure_count > 0 && (
              <>
                <dt style={{ color: 'var(--dev-color-error)', fontWeight: 'var(--dev-font-weight-medium)' }}>
                  Échecs consécutifs
                </dt>
                <dd style={{ color: 'var(--dev-color-error)', margin: 0 }}>
                  {webhook.failure_count}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

// ─── Section historique des livraisons ───────────────────────────────────────

function DeliveryHistorySection({ projectId }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fetchDeliveries = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await developerApi.get(
        `/projects/${projectId}/webhooks/deliveries`
      );
      const list = Array.isArray(data) ? data : (data?.deliveries ?? []);
      setDeliveries(list);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Impossible de charger l\'historique des livraisons.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  return (
    <section
      aria-label="Historique des livraisons de webhooks"
      style={{
        background: 'var(--dev-bg-surface)',
        border: '1px solid var(--dev-border-color)',
        borderRadius: 'var(--dev-border-radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--dev-shadow-sm)',
      }}
    >
      {/* En-tête section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--dev-space-5) var(--dev-space-6)',
          borderBottom: '1px solid var(--dev-border-color)',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 'var(--dev-font-size-base)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            Historique des livraisons
          </h3>
          <p
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-text-muted)',
              margin: 'var(--dev-space-1) 0 0 0',
            }}
          >
            100 dernières entrées pour tous les webhooks de ce projet
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDeliveries}
          disabled={loading}
          aria-label="Actualiser l'historique"
          title="Actualiser"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--dev-space-2)',
            padding: 'var(--dev-space-2) var(--dev-space-3)',
            background: 'var(--dev-bg-surface)',
            color: 'var(--dev-text-secondary)',
            border: '1px solid var(--dev-border-color)',
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-xs)',
            fontWeight: 'var(--dev-font-weight-medium)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? <Spinner size={13} /> : <IconRefresh />}
          Actualiser
        </button>
      </div>

      {/* Contenu */}
      {loading && deliveries.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--dev-space-12)',
          }}
        >
          <Spinner size={28} />
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--dev-space-3)',
            padding: 'var(--dev-space-5) var(--dev-space-6)',
            color: 'var(--dev-color-error)',
            fontSize: 'var(--dev-font-size-sm)',
          }}
        >
          <span style={{ flexShrink: 0 }}><IconAlertCircle /></span>
          {error}
        </div>
      ) : deliveries.length === 0 ? (
        <p
          style={{
            padding: 'var(--dev-space-12) var(--dev-space-6)',
            textAlign: 'center',
            color: 'var(--dev-text-muted)',
            fontSize: 'var(--dev-font-size-sm)',
            margin: 0,
          }}
        >
          Aucune livraison enregistrée pour l'instant.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--dev-font-size-sm)',
            }}
            aria-label="Tableau de l'historique des livraisons"
          >
            <thead>
              <tr
                style={{
                  background: 'var(--dev-color-neutral-50)',
                  borderBottom: '1px solid var(--dev-border-color)',
                }}
              >
                {[
                  { key: 'event_type', label: 'Type d\'événement' },
                  { key: 'status',     label: 'Statut'           },
                  { key: 'http_code',  label: 'Code HTTP'        },
                  { key: 'timestamp',  label: 'Horodatage'       },
                ].map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    style={{
                      padding: 'var(--dev-space-3) var(--dev-space-4)',
                      textAlign: 'left',
                      fontSize: 'var(--dev-font-size-xs)',
                      fontWeight: 'var(--dev-font-weight-semibold)',
                      color: 'var(--dev-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery, index) => (
                <tr
                  key={delivery.id ?? index}
                  style={{
                    borderBottom: '1px solid var(--dev-border-color)',
                    background: index % 2 === 0
                      ? 'var(--dev-bg-surface)'
                      : 'var(--dev-color-neutral-50)',
                  }}
                >
                  {/* event_type */}
                  <td
                    style={{
                      padding: 'var(--dev-space-3) var(--dev-space-4)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <code
                      style={{
                        fontSize: 'var(--dev-font-size-xs)',
                        background: 'var(--dev-color-neutral-100)',
                        padding: '2px 8px',
                        borderRadius: 'var(--dev-border-radius-sm)',
                        color: 'var(--dev-text-primary)',
                        fontFamily: 'var(--dev-font-family-mono)',
                      }}
                    >
                      {delivery.event_type}
                    </code>
                  </td>

                  {/* statut */}
                  <td style={{ padding: 'var(--dev-space-3) var(--dev-space-4)' }}>
                    <DeliveryStatusBadge status={delivery.status} />
                  </td>

                  {/* code HTTP */}
                  <td
                    style={{
                      padding: 'var(--dev-space-3) var(--dev-space-4)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {delivery.response_code != null ? (
                      <span
                        style={{
                          fontFamily: 'var(--dev-font-family-mono)',
                          fontSize: 'var(--dev-font-size-sm)',
                          fontWeight: 'var(--dev-font-weight-semibold)',
                          color:
                            delivery.response_code >= 200 && delivery.response_code < 300
                              ? 'var(--dev-color-success)'
                              : delivery.response_code >= 400
                              ? 'var(--dev-color-error)'
                              : 'var(--dev-text-secondary)',
                        }}
                      >
                        {delivery.response_code}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--dev-text-muted)' }}>-</span>
                    )}
                  </td>

                  {/* horodatage */}
                  <td
                    style={{
                      padding: 'var(--dev-space-3) var(--dev-space-4)',
                      color: 'var(--dev-text-secondary)',
                      whiteSpace: 'nowrap',
                      fontSize: 'var(--dev-font-size-xs)',
                    }}
                  >
                    {formatDateTime(delivery.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── WebhooksPage ─────────────────────────────────────────────────────────────

/**
 * WebhooksPage
 *
 * Utilisé comme onglet dans ProjectPage (reçoit `projectId` en prop)
 * ou en page standalone (lit l'ID depuis useParams).
 *
 * @param {object}  [props]
 * @param {string}  [props.projectId] - ID du projet (injecté par ProjectPage)
 */
export default function WebhooksPage({ projectId: projectIdProp } = {}) {
  // Fallback sur useParams si utilisé en standalone
  const params         = useParams();
  const projectId      = projectIdProp ?? params.id;

  const [webhooks, setWebhooks]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [webhookToDelete, setWebhookToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy]       = useState(false);
  const [deleteError, setDeleteError]     = useState('');
  const [successMsg, setSuccessMsg]       = useState('');

  // ── Chargement des webhooks ────────────────────────────────────────────────

  const fetchWebhooks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await developerApi.get(`/projects/${projectId}/webhooks`);
      const list = Array.isArray(data) ? data : (data?.webhooks ?? []);
      setWebhooks(list);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Impossible de charger les webhooks. Veuillez réessayer.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  // ── Création ───────────────────────────────────────────────────────────────

  function handleWebhookCreated(newWebhook) {
    setWebhooks((prev) => [newWebhook, ...prev]);
    setSuccessMsg('Webhook créé avec succès.');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!webhookToDelete) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await developerApi.delete(
        `/projects/${projectId}/webhooks/${webhookToDelete.id}`
      );
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookToDelete.id));
      setWebhookToDelete(null);
      setSuccessMsg('Webhook supprimé.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Impossible de supprimer le webhook. Veuillez réessayer.';
      setDeleteError(msg);
    } finally {
      setDeleteBusy(false);
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Gestion des webhooks"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--dev-space-8)',
      }}
    >
      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--dev-space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--dev-font-size-xl)',
              fontWeight: 'var(--dev-font-weight-bold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            Webhooks
          </h2>
          <p
            style={{
              fontSize: 'var(--dev-font-size-sm)',
              color: 'var(--dev-text-secondary)',
              margin: 'var(--dev-space-1) 0 0 0',
            }}
          >
            Configurez des endpoints HTTPS pour recevoir les événements de votre
            projet en temps réel.
          </p>
        </div>
      </div>

      {/* ── Message de succès ─────────────────────────────────────────────────── */}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--dev-space-3)',
            padding: 'var(--dev-space-3) var(--dev-space-5)',
            background: 'var(--dev-color-success-light)',
            border: '1px solid var(--dev-color-success)',
            borderRadius: 'var(--dev-border-radius-md)',
            color: 'var(--dev-color-success)',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
          }}
        >
          {successMsg}
        </div>
      )}

      {/* ── Erreur de suppression ─────────────────────────────────────────────── */}
      {deleteError && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--dev-space-3)',
            padding: 'var(--dev-space-3) var(--dev-space-5)',
            background: 'var(--dev-color-error-light)',
            border: '1px solid var(--dev-color-error)',
            borderRadius: 'var(--dev-border-radius-md)',
            color: 'var(--dev-color-error)',
            fontSize: 'var(--dev-font-size-sm)',
          }}
        >
          <span style={{ flexShrink: 0 }}><IconAlertCircle /></span>
          {deleteError}
        </div>
      )}

      {/* ── Formulaire de création ────────────────────────────────────────────── */}
      <CreateWebhookForm
        projectId={projectId}
        onCreated={handleWebhookCreated}
      />

      {/* ── Liste des webhooks ────────────────────────────────────────────────── */}
      <section aria-label="Liste des webhooks configurés">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--dev-space-4)',
          }}
        >
          <h3
            style={{
              fontSize: 'var(--dev-font-size-base)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            Webhooks configurés
            {!loading && (
              <span
                aria-label={`${webhooks.length} webhook${webhooks.length !== 1 ? 's' : ''}`}
                style={{
                  marginLeft: 'var(--dev-space-2)',
                  padding: '1px 8px',
                  background: 'var(--dev-color-neutral-100)',
                  color: 'var(--dev-text-muted)',
                  borderRadius: 'var(--dev-border-radius-full)',
                  fontSize: 'var(--dev-font-size-xs)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                }}
              >
                {webhooks.length}
              </span>
            )}
          </h3>

          <button
            type="button"
            onClick={fetchWebhooks}
            disabled={loading}
            aria-label="Actualiser la liste des webhooks"
            title="Actualiser"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dev-space-2)',
              padding: 'var(--dev-space-2) var(--dev-space-3)',
              background: 'var(--dev-bg-surface)',
              color: 'var(--dev-text-secondary)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-xs)',
              fontWeight: 'var(--dev-font-weight-medium)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <Spinner size={13} /> : <IconRefresh />}
            Actualiser
          </button>
        </div>

        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--dev-space-12)',
              background: 'var(--dev-bg-surface)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-lg)',
            }}
          >
            <Spinner size={28} />
          </div>
        ) : error ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--dev-space-3)',
              padding: 'var(--dev-space-5) var(--dev-space-6)',
              background: 'var(--dev-color-error-light)',
              border: '1px solid var(--dev-color-error)',
              borderRadius: 'var(--dev-border-radius-lg)',
              color: 'var(--dev-color-error)',
              fontSize: 'var(--dev-font-size-sm)',
            }}
          >
            <span style={{ flexShrink: 0 }}><IconAlertCircle /></span>
            <div>
              <p style={{ margin: '0 0 var(--dev-space-2) 0' }}>{error}</p>
              <button
                type="button"
                onClick={fetchWebhooks}
                style={{
                  padding: 'var(--dev-space-1) var(--dev-space-3)',
                  background: 'var(--dev-color-error)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--dev-border-radius-md)',
                  fontSize: 'var(--dev-font-size-xs)',
                  cursor: 'pointer',
                }}
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : webhooks.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--dev-space-3)',
              padding: 'var(--dev-space-12) var(--dev-space-6)',
              background: 'var(--dev-bg-surface)',
              border: '1px dashed var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-lg)',
              textAlign: 'center',
            }}
          >
            <span
              aria-hidden="true"
              style={{ color: 'var(--dev-text-muted)', opacity: 0.6 }}
            >
              <IconWebhook />
            </span>
            <p
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-muted)',
                margin: 0,
              }}
            >
              Aucun webhook configuré. Créez-en un ci-dessus.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--dev-space-3)',
            }}
            role="list"
            aria-label="Liste des webhooks"
          >
            {webhooks.map((webhook) => (
              <div key={webhook.id} role="listitem">
                <WebhookCard
                  webhook={webhook}
                  onDelete={(w) => {
                    setDeleteError('');
                    setWebhookToDelete(w);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Historique des livraisons ─────────────────────────────────────────── */}
      <DeliveryHistorySection projectId={projectId} />

      {/* ── Modale de confirmation de suppression ─────────────────────────────── */}
      {webhookToDelete && (
        <ConfirmDeleteModal
          webhook={webhookToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            if (!deleteBusy) {
              setWebhookToDelete(null);
              setDeleteError('');
            }
          }}
          busy={deleteBusy}
        />
      )}
    </section>
  );
}
