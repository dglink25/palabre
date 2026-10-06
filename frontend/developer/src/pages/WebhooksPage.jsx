/**
 * WebhooksPage.jsx - Developer Portal
 *
 * Onglet Webhooks d'un Developer_Project — design institutionnel.
 * Tableaux header #F8F9FA, badges border-radius 4px, icônes Lucide stroke-only.
 * Pas de gradient, état vide sobre.
 *
 * Requirements couverts : 10.1, 10.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import developerApi from '../api/developerApi';

// ─── Types d'événements ───────────────────────────────────────────────────────

const AVAILABLE_EVENT_TYPES = [
  { value: 'message.received',  label: 'Message reçu'           },
  { value: 'call.missed',       label: 'Appel manqué'           },
  { value: 'call.started',      label: 'Appel démarré'          },
  { value: 'call.ended',        label: 'Appel terminé'          },
  { value: 'user.online',       label: 'Utilisateur connecté'   },
  { value: 'user.offline',      label: 'Utilisateur déconnecté' },
  { value: 'notification.sent', label: 'Notification envoyée'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(isoString) {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(isoString));
}

function isHttpsUrl(url) {
  try { const p = new URL(url); return p.protocol === 'https:'; }
  catch { return false; }
}

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconActivity() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }) {
  return (
    <span
      role="status"
      aria-label="Chargement…"
      style={{
        display:        'inline-block',
        width:          size,
        height:         size,
        border:         '2px solid #E0E0E0',
        borderTopColor: '#1A73E8',
        borderRadius:   '50%',
        animation:      'dev-spin 0.7s linear infinite',
        flexShrink:     0,
      }}
    />
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function WebhookStatusBadge({ status }) {
  const config = {
    active:   { label: 'Actif',      bg: 'rgba(52,168,83,.12)',  color: '#34A853' },
    failed:   { label: 'Défaillant', bg: 'rgba(234,67,53,.12)',  color: '#EA4335' },
    disabled: { label: 'Désactivé',  bg: 'rgba(95,99,104,.10)', color: '#5F6368' },
  };
  const cfg = config[status] ?? config.disabled;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      padding:       '2px 8px',
      borderRadius:  4,
      background:    cfg.bg,
      color:         cfg.color,
      fontSize:      11,
      fontWeight:    600,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
      whiteSpace:    'nowrap',
    }}>
      <span aria-hidden="true" style={{
        width: 5, height: 5, borderRadius: '50%',
        background: cfg.color, flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}

function DeliveryStatusBadge({ status }) {
  const config = {
    delivered: { label: 'Livré',      bg: 'rgba(52,168,83,.12)',  color: '#34A853' },
    pending:   { label: 'En attente', bg: 'rgba(251,188,5,.12)',  color: '#8a6700' },
    failed:    { label: 'Échoué',     bg: 'rgba(234,67,53,.12)',  color: '#EA4335' },
  };
  const cfg = config[status] ?? config.pending;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       '2px 8px',
      borderRadius:  4,
      background:    cfg.bg,
      color:         cfg.color,
      fontSize:      11,
      fontWeight:    600,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
      whiteSpace:    'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Modale de confirmation de suppression ────────────────────────────────────

function ConfirmDeleteModal({ webhook, onConfirm, onCancel, busy }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'rgba(32,33,36,.5)',
        padding:         16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background:   '#FFFFFF',
        borderRadius: 12,
        boxShadow:    '0 8px 32px rgba(32,33,36,.14)',
        width:        '100%',
        maxWidth:     420,
        padding:      '28px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width:           40,
            height:          40,
            borderRadius:    '50%',
            backgroundColor: 'rgba(234,67,53,.10)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           '#EA4335',
            flexShrink:      0,
          }} aria-hidden="true">
            <IconAlertTriangle />
          </div>
          <div>
            <h2
              id="confirm-delete-title"
              style={{ fontSize: 17, fontWeight: 700, color: '#202124', margin: '0 0 8px' }}
            >
              Supprimer ce webhook ?
            </h2>
            <p style={{ fontSize: 13, color: '#5F6368', margin: 0, wordBreak: 'break-all' }}>
              Cette action est irréversible. Le webhook{' '}
              <strong style={{ color: '#202124' }}>{webhook.url}</strong>{' '}
              ainsi que son historique seront supprimés définitivement.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              height:       36,
              padding:      '0 16px',
              background:   '#FFFFFF',
              color:        '#5F6368',
              border:       '1px solid #E0E0E0',
              borderRadius: 8,
              fontSize:     13,
              fontWeight:   500,
              cursor:       busy ? 'not-allowed' : 'pointer',
              fontFamily:   'inherit',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          6,
              height:       36,
              padding:      '0 16px',
              background:   busy ? '#dadce0' : '#EA4335',
              color:        busy ? '#5F6368' : '#FFFFFF',
              border:       'none',
              borderRadius: 8,
              fontSize:     13,
              fontWeight:   600,
              cursor:       busy ? 'not-allowed' : 'pointer',
              fontFamily:   'inherit',
              transition:   'background 150ms ease',
            }}
          >
            {busy ? <Spinner size={13} /> : <IconTrash />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulaire de création ───────────────────────────────────────────────────

function CreateWebhookForm({ projectId, onCreated }) {
  const [url,      setUrl]      = useState('');
  const [events,   setEvents]   = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [urlError, setUrlError] = useState('');
  const urlInputRef             = useRef(null);

  function toggleEvent(value) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  function validateUrl(value) {
    if (!value.trim()) { setUrlError("L'URL est obligatoire."); return false; }
    if (!isHttpsUrl(value.trim())) { setUrlError("L'URL doit commencer par https://"); return false; }
    setUrlError('');
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateUrl(url)) { urlInputRef.current?.focus(); return; }
    if (events.length === 0) { setError("Sélectionnez au moins un type d'événement."); return; }
    setError('');
    setBusy(true);
    try {
      const { data } = await developerApi.post(`/projects/${projectId}/webhooks`, {
        url: url.trim(), events,
      });
      const newWebhook = data?.webhook ?? data;
      onCreated(newWebhook);
      setUrl('');
      setEvents([]);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Une erreur est survenue lors de la création.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = url.trim().length > 0 && events.length > 0 && !busy;

  const inputStyle = {
    width:        '100%',
    padding:      '9px 12px',
    border:       `1px solid ${urlError ? '#EA4335' : '#E0E0E0'}`,
    borderRadius: 8,
    fontFamily:   'inherit',
    fontSize:     14,
    color:        '#202124',
    background:   '#FFFFFF',
    outline:      'none',
    boxSizing:    'border-box',
    transition:   'border-color 150ms ease',
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Créer un webhook"
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E0E0E0',
        borderRadius: 8,
        padding:      '20px 24px',
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#202124', margin: '0 0 16px' }}>
        Nouveau webhook
      </h3>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '10px 14px',
            background:   'rgba(234,67,53,.06)',
            border:       '1px solid #EA4335',
            borderLeft:   '3px solid #EA4335',
            borderRadius: 8,
            color:        '#EA4335',
            fontSize:     13,
            marginBottom: 14,
          }}
        >
          <IconAlertCircle />
          {error}
        </div>
      )}

      {/* Champ URL */}
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="webhook-url"
          style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#202124', marginBottom: 6 }}
        >
          URL de destination <span aria-hidden="true" style={{ color: '#EA4335' }}>*</span>
        </label>
        <input
          ref={urlInputRef}
          id="webhook-url"
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (urlError) validateUrl(e.target.value); }}
          onBlur={(e) => validateUrl(e.target.value)}
          placeholder="https://api.monapp.com/webhooks/palabre"
          required
          aria-describedby={urlError ? 'webhook-url-error' : 'webhook-url-hint'}
          aria-invalid={!!urlError}
          style={inputStyle}
          onFocus={(e) => { if (!urlError) e.target.style.borderColor = '#1A73E8'; }}
        />
        {urlError ? (
          <p id="webhook-url-error" role="alert"
            style={{ fontSize: 12, color: '#EA4335', marginTop: 4, marginBottom: 0 }}>
            {urlError}
          </p>
        ) : (
          <p id="webhook-url-hint"
            style={{ fontSize: 12, color: '#9aa0a6', marginTop: 4, marginBottom: 0 }}>
            L'URL doit commencer par <code>https://</code>
          </p>
        )}
      </div>

      {/* Checkboxes événements */}
      <fieldset
        style={{ border: 'none', padding: 0, margin: '0 0 20px' }}
        aria-label="Types d'événements"
      >
        <legend style={{
          fontSize: 13, fontWeight: 500, color: '#202124',
          marginBottom: 10, display: 'block',
        }}>
          Types d'événements <span aria-hidden="true" style={{ color: '#EA4335' }}>*</span>
          <span style={{ fontSize: 11, color: '#9aa0a6', fontWeight: 400, marginLeft: 6 }}>
            (au moins un)
          </span>
        </legend>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
          {AVAILABLE_EVENT_TYPES.map((evt) => {
            const checked = events.includes(evt.value);
            return (
              <label
                key={evt.value}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                  padding:      '9px 12px',
                  border:       `1px solid ${checked ? '#1A73E8' : '#E0E0E0'}`,
                  borderRadius: 8,
                  background:   checked ? '#EAF2FD' : '#FFFFFF',
                  cursor:       'pointer',
                  transition:   'border-color 150ms ease, background 150ms ease',
                  userSelect:   'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEvent(evt.value)}
                  style={{ width: 15, height: 15, accentColor: '#1A73E8', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{
                  fontSize:   13,
                  color:      checked ? '#1A73E8' : '#5F6368',
                  fontWeight: checked ? 500 : 400,
                }}>
                  {evt.label}
                </span>
                <code style={{
                  fontSize:   10,
                  color:      '#9aa0a6',
                  marginLeft: 'auto',
                  whiteSpace: 'nowrap',
                  background: 'none',
                  border:     'none',
                  padding:    0,
                }}>
                  {evt.value}
                </code>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          6,
          height:       40,
          padding:      '0 18px',
          background:   canSubmit ? '#1A73E8' : '#dadce0',
          color:        canSubmit ? '#FFFFFF' : '#5F6368',
          border:       'none',
          borderRadius: 8,
          fontSize:     14,
          fontWeight:   600,
          cursor:       canSubmit ? 'pointer' : 'not-allowed',
          fontFamily:   'inherit',
          transition:   'background 150ms ease',
        }}
      >
        {busy ? <Spinner size={14} /> : <IconPlus />}
        {busy ? 'Création…' : 'Créer le webhook'}
      </button>
    </form>
  );
}

// ─── Carte webhook ────────────────────────────────────────────────────────────

function WebhookCard({ webhook, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background:   '#FFFFFF',
      border:       '1px solid #E0E0E0',
      borderRadius: 8,
      overflow:     'hidden',
    }}>
      {/* En-tête */}
      <div style={{
        display:    'flex',
        alignItems: 'flex-start',
        gap:        16,
        padding:    '16px 20px',
        flexWrap:   'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <code style={{
              fontSize:   13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color:      '#202124',
              wordBreak:  'break-all',
              background: '#F8F9FA',
              padding:    '2px 8px',
              borderRadius: 4,
              border:     '1px solid #E0E0E0',
            }}>
              {webhook.url}
            </code>
            <WebhookStatusBadge status={webhook.status} />
          </div>

          {/* Events */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}
            aria-label="Événements abonnés">
            {(webhook.events ?? []).map((evt) => (
              <span key={evt} style={{
                fontSize:   11,
                padding:    '1px 7px',
                background: '#EAF2FD',
                color:      '#1A73E8',
                borderRadius: 4,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
              }}>
                {evt}
              </span>
            ))}
            {(!webhook.events || webhook.events.length === 0) && (
              <span style={{ fontSize: 12, color: '#9aa0a6' }}>Aucun événement</span>
            )}
          </div>

          <p style={{ fontSize: 12, color: '#9aa0a6', margin: 0 }}>
            Dernier déclenchement :{' '}
            <strong style={{ color: '#5F6368' }}>{formatDateTime(webhook.last_fired_at)}</strong>
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Masquer les détails' : 'Afficher les détails'}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              padding:      '6px 12px',
              background:   '#FFFFFF',
              color:        '#5F6368',
              border:       '1px solid #E0E0E0',
              borderRadius: 6,
              fontSize:     12,
              fontWeight:   500,
              cursor:       'pointer',
              fontFamily:   'inherit',
              transition:   'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F9FA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
          >
            {expanded ? <IconChevronUp /> : <IconChevronDown />}
            {expanded ? 'Réduire' : 'Détails'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(webhook)}
            aria-label={`Supprimer le webhook ${webhook.url}`}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              padding:      '6px 12px',
              background:   'rgba(234,67,53,.06)',
              color:        '#EA4335',
              border:       '1px solid #EA4335',
              borderRadius: 6,
              fontSize:     12,
              fontWeight:   500,
              cursor:       'pointer',
              fontFamily:   'inherit',
              transition:   'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(234,67,53,.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(234,67,53,.06)'; }}
          >
            <IconTrash />
            Supprimer
          </button>
        </div>
      </div>

      {/* Détails */}
      {expanded && (
        <div style={{
          padding:    '14px 20px',
          borderTop:  '1px solid #E0E0E0',
          background: '#F8F9FA',
        }}>
          <dl style={{
            display:             'grid',
            gridTemplateColumns: 'max-content 1fr',
            gap:                 '8px 20px',
            fontSize:            13,
            margin:              0,
          }}>
            <dt style={{ color: '#9aa0a6', fontWeight: 500 }}>ID</dt>
            <dd style={{ color: '#5F6368', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, margin: 0 }}>
              {webhook.id}
            </dd>
            <dt style={{ color: '#9aa0a6', fontWeight: 500 }}>Créé le</dt>
            <dd style={{ color: '#5F6368', margin: 0 }}>{formatDateTime(webhook.created_at)}</dd>
            {webhook.failure_count > 0 && (
              <>
                <dt style={{ color: '#EA4335', fontWeight: 500 }}>Échecs</dt>
                <dd style={{ color: '#EA4335', margin: 0 }}>{webhook.failure_count}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

// ─── Historique des livraisons ────────────────────────────────────────────────

function DeliveryHistorySection({ projectId }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const fetchDeliveries = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await developerApi.get(`/projects/${projectId}/webhooks/deliveries`);
      const list = Array.isArray(data) ? data : (data?.deliveries ?? []);
      setDeliveries(list);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        "Impossible de charger l'historique des livraisons.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  return (
    <section aria-label="Historique des livraisons">
      {/* En-tête */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   12,
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#202124', margin: '0 0 2px' }}>
            Historique des livraisons
          </h3>
          <p style={{ fontSize: 12, color: '#9aa0a6', margin: 0 }}>
            100 dernières entrées pour tous les webhooks
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDeliveries}
          disabled={loading}
          aria-label="Actualiser l'historique"
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          5,
            padding:      '6px 12px',
            background:   '#FFFFFF',
            color:        '#5F6368',
            border:       '1px solid #E0E0E0',
            borderRadius: 6,
            fontSize:     12,
            fontWeight:   500,
            cursor:       loading ? 'not-allowed' : 'pointer',
            fontFamily:   'inherit',
          }}
        >
          {loading ? <Spinner size={12} /> : <IconRefresh />}
          Actualiser
        </button>
      </div>

      {/* Tableau */}
      <div style={{
        background:   '#FFFFFF',
        border:       '1px solid #E0E0E0',
        borderRadius: 8,
        overflow:     'hidden',
      }}>
        {loading && deliveries.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Spinner size={24} />
          </div>
        ) : error ? (
          <div
            role="alert"
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        8,
              padding:    '16px 20px',
              color:      '#EA4335',
              fontSize:   13,
            }}
          >
            <IconAlertCircle />
            {error}
          </div>
        ) : deliveries.length === 0 ? (
          <p style={{
            padding:   '32px 20px',
            textAlign: 'center',
            color:     '#9aa0a6',
            fontSize:  13,
            margin:    0,
          }}>
            Aucune livraison enregistrée pour l'instant.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse' }}
              aria-label="Historique des livraisons"
            >
              <thead>
                <tr>
                  {[
                    "Type d'événement",
                    'Statut',
                    'Code HTTP',
                    'Horodatage',
                  ].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      style={{
                        padding:       '9px 16px',
                        textAlign:     'left',
                        fontSize:      12,
                        fontWeight:    600,
                        color:         '#5F6368',
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        background:    '#F8F9FA',
                        borderBottom:  '1px solid #E0E0E0',
                        whiteSpace:    'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery, index) => (
                  <tr
                    key={delivery.id ?? index}
                    style={{ borderBottom: '1px solid #E0E0E0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(26,115,232,.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <code style={{
                        fontSize:   11,
                        background: '#F1F3F4',
                        padding:    '2px 7px',
                        borderRadius: 4,
                        color:      '#202124',
                        fontFamily: "'JetBrains Mono', monospace",
                        border:     '1px solid #E0E0E0',
                      }}>
                        {delivery.event_type}
                      </code>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <DeliveryStatusBadge status={delivery.status} />
                    </td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      {delivery.response_code != null ? (
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize:   13,
                          fontWeight: 600,
                          color:
                            delivery.response_code >= 200 && delivery.response_code < 300
                              ? '#34A853'
                              : delivery.response_code >= 400
                              ? '#EA4335'
                              : '#5F6368',
                        }}>
                          {delivery.response_code}
                        </span>
                      ) : (
                        <span style={{ color: '#9aa0a6' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#5F6368', whiteSpace: 'nowrap' }}>
                      {formatDateTime(delivery.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── WebhooksPage ─────────────────────────────────────────────────────────────

export default function WebhooksPage({ projectId: projectIdProp } = {}) {
  const params    = useParams();
  const projectId = projectIdProp ?? params.id;

  const [webhooks,        setWebhooks]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [webhookToDelete, setWebhookToDelete] = useState(null);
  const [deleteBusy,      setDeleteBusy]      = useState(false);
  const [deleteError,     setDeleteError]     = useState('');
  const [successMsg,      setSuccessMsg]      = useState('');

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

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  function handleWebhookCreated(newWebhook) {
    setWebhooks((prev) => [newWebhook, ...prev]);
    setSuccessMsg('Webhook créé avec succès.');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function handleDeleteConfirm() {
    if (!webhookToDelete) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await developerApi.delete(`/projects/${projectId}/webhooks/${webhookToDelete.id}`);
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

  return (
    <section
      aria-label="Gestion des webhooks"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* En-tête */}
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>
          Webhooks
        </h2>
        <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
          Configurez des endpoints HTTPS pour recevoir les événements de votre projet en temps réel.
        </p>
      </div>

      {/* Message succès */}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '10px 14px',
            background:   'rgba(52,168,83,.08)',
            border:       '1px solid #34A853',
            borderLeft:   '3px solid #34A853',
            borderRadius: 8,
            color:        '#34A853',
            fontSize:     13,
            fontWeight:   500,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Erreur suppression */}
      {deleteError && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '10px 14px',
            background:   'rgba(234,67,53,.06)',
            border:       '1px solid #EA4335',
            borderLeft:   '3px solid #EA4335',
            borderRadius: 8,
            color:        '#EA4335',
            fontSize:     13,
          }}
        >
          <IconAlertCircle />
          {deleteError}
        </div>
      )}

      {/* Formulaire */}
      <CreateWebhookForm projectId={projectId} onCreated={handleWebhookCreated} />

      {/* Liste des webhooks */}
      <section aria-label="Webhooks configurés">
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   12,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#202124', margin: 0 }}>
            Webhooks configurés
            {!loading && (
              <span style={{
                marginLeft:   8,
                padding:      '1px 7px',
                background:   '#F1F3F4',
                color:        '#5F6368',
                borderRadius: 4,
                fontSize:     11,
                fontWeight:   600,
              }}>
                {webhooks.length}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={fetchWebhooks}
            disabled={loading}
            aria-label="Actualiser"
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          5,
              padding:      '6px 12px',
              background:   '#FFFFFF',
              color:        '#5F6368',
              border:       '1px solid #E0E0E0',
              borderRadius: 6,
              fontSize:     12,
              fontWeight:   500,
              cursor:       loading ? 'not-allowed' : 'pointer',
              fontFamily:   'inherit',
            }}
          >
            {loading ? <Spinner size={12} /> : <IconRefresh />}
            Actualiser
          </button>
        </div>

        {loading ? (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            padding:      40,
            background:   '#FFFFFF',
            border:       '1px solid #E0E0E0',
            borderRadius: 8,
          }}>
            <Spinner size={24} />
          </div>
        ) : error ? (
          <div
            role="alert"
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          10,
              padding:      '16px 20px',
              background:   'rgba(234,67,53,.06)',
              border:       '1px solid #EA4335',
              borderLeft:   '3px solid #EA4335',
              borderRadius: 8,
              color:        '#EA4335',
              fontSize:     13,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}><IconAlertCircle /></span>
            <div>
              <p style={{ margin: '0 0 8px' }}>{error}</p>
              <button
                type="button"
                onClick={fetchWebhooks}
                style={{
                  padding:      '4px 12px',
                  background:   '#EA4335',
                  color:        '#FFFFFF',
                  border:       'none',
                  borderRadius: 6,
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : webhooks.length === 0 ? (
          /* État vide institutionnel */
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            padding:       '40px 24px',
            background:    '#FFFFFF',
            border:        '1px solid #E0E0E0',
            borderRadius:  8,
            textAlign:     'center',
          }}>
            <div style={{
              width:           40,
              height:          40,
              borderRadius:    8,
              backgroundColor: '#F1F3F4',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              color:           '#9aa0a6',
              marginBottom:    12,
            }} aria-hidden="true">
              <IconActivity />
            </div>
            <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
              Aucun webhook configuré. Créez-en un ci-dessus.
            </p>
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            role="list"
            aria-label="Webhooks"
          >
            {webhooks.map((webhook) => (
              <div key={webhook.id} role="listitem">
                <WebhookCard
                  webhook={webhook}
                  onDelete={(w) => { setDeleteError(''); setWebhookToDelete(w); }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historique livraisons */}
      <DeliveryHistorySection projectId={projectId} />

      {/* Modale suppression */}
      {webhookToDelete && (
        <ConfirmDeleteModal
          webhook={webhookToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { if (!deleteBusy) { setWebhookToDelete(null); setDeleteError(''); } }}
          busy={deleteBusy}
        />
      )}
    </section>
  );
}
