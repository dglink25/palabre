/**
 * ApiKeyDisplay.jsx - Developer Portal
 *
 * Affiche et gère les clés API (publishable + secret) d'un projet.
 *
 * Fonctionnalités :
 *   - Publishable key : affichée en clair + bouton copie (req 4.1)
 *   - Secret key : affichée masquée + bouton "Révéler" (une seule fois,
 *     sans appel API supplémentaire) + bouton copie (req 4.2)
 *   - Bouton "Rotation" : modale de confirmation (confirm: true requis),
 *     appel POST /projects/:id/keys/rotate, alerte one-shot de la nouvelle
 *     valeur brute (req 4.3, 4.4)
 *   - Affichage de created_at et last_used_at formatées (req 4.6)
 *
 * Requirements couverts : 4.1, 4.2, 4.3, 4.4, 4.6
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import developerApi from '../api/developerApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formate une date ISO en format français lisible.
 * Retourne '-' si la valeur est absente.
 */
function formatDate(isoString) {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day:    '2-digit',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

/**
 * Copie une valeur dans le presse-papiers.
 * Retourne true si la copie a réussi, false sinon.
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconCopy({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconEye({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconRefreshCw({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconAlertTriangle({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconKey({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function Spinner({ size = 16 }) {
  return (
    <span
      role="status"
      aria-label="Chargement…"
      style={{
        display:       'inline-block',
        width:         size,
        height:        size,
        border:        '2px solid var(--dev-color-neutral-200)',
        borderTopColor: 'var(--dev-color-brand-primary)',
        borderRadius:  '50%',
        animation:     'dev-spin 0.7s linear infinite',
        flexShrink:    0,
      }}
    />
  );
}

// ─── Bouton copie ─────────────────────────────────────────────────────────────

/**
 * CopyButton - copie une valeur dans le presse-papiers et affiche
 * un retour visuel pendant 2 secondes.
 */
function CopyButton({ value, label = 'Copier', size = 'sm' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const padding = size === 'sm'
    ? 'var(--dev-space-1) var(--dev-space-3)'
    : 'var(--dev-space-2) var(--dev-space-4)';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copié !' : label}
      title={copied ? 'Copié !' : label}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           'var(--dev-space-1)',
        padding,
        background:    copied ? 'var(--dev-color-success-light)' : 'var(--dev-color-neutral-100)',
        color:         copied ? 'var(--dev-color-success)'        : 'var(--dev-text-secondary)',
        border:        `1px solid ${copied ? 'var(--dev-color-success)' : 'var(--dev-border-color)'}`,
        borderRadius:  'var(--dev-border-radius-md)',
        fontSize:      'var(--dev-font-size-xs)',
        fontWeight:    'var(--dev-font-weight-medium)',
        cursor:        'pointer',
        transition:    'all var(--dev-transition-fast)',
        whiteSpace:    'nowrap',
        flexShrink:    0,
      }}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {copied ? 'Copié !' : label}
    </button>
  );
}

// ─── Modale de confirmation de rotation ──────────────────────────────────────

/**
 * RotationModal - affiche une modale de confirmation avant la rotation d'une clé.
 * Exige une confirmation explicite de l'utilisateur (req 4.4).
 */
function RotationModal({ keyType, onConfirm, onCancel, loading }) {
  const cancelRef = useRef(null);

  // Focus initial sur le bouton Annuler pour éviter la validation accidentelle
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Fermer avec Échap
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !loading) onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel]);

  const keyLabel = keyType === 'publishable' ? 'publishable' : 'secrète';

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotation-modal-title"
      aria-describedby="rotation-modal-desc"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'var(--dev-bg-overlay)',
        padding:        'var(--dev-space-4)',
      }}
      onClick={(e) => {
        // Fermer en cliquant sur l'overlay (pas sur la carte)
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      {/* Carte */}
      <div
        style={{
          background:   'var(--dev-bg-surface)',
          borderRadius: 'var(--dev-border-radius-xl)',
          boxShadow:    'var(--dev-shadow-xl)',
          padding:      'var(--dev-space-8)',
          width:        '100%',
          maxWidth:     460,
        }}
      >
        {/* Icône d'avertissement */}
        <div
          style={{
            width:          48,
            height:         48,
            borderRadius:   'var(--dev-border-radius-full)',
            background:     'var(--dev-color-warning-light)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          'var(--dev-color-warning)',
            marginBottom:   'var(--dev-space-5)',
          }}
          aria-hidden="true"
        >
          <IconAlertTriangle size={24} />
        </div>

        <h2
          id="rotation-modal-title"
          style={{
            fontSize:     'var(--dev-font-size-xl)',
            fontWeight:   'var(--dev-font-weight-bold)',
            color:        'var(--dev-text-primary)',
            marginBottom: 'var(--dev-space-3)',
          }}
        >
          Rotation de la clé {keyLabel}
        </h2>

        <p
          id="rotation-modal-desc"
          style={{
            fontSize:     'var(--dev-font-size-sm)',
            color:        'var(--dev-text-secondary)',
            lineHeight:   'var(--dev-line-height-normal)',
            marginBottom: 'var(--dev-space-3)',
          }}
        >
          L'ancienne clé {keyLabel} sera immédiatement révoquée. Une période de
          grâce de <strong>60 secondes</strong> est accordée pour les requêtes
          en transit.
        </p>

        <p
          style={{
            fontSize:     'var(--dev-font-size-sm)',
            fontWeight:   'var(--dev-font-weight-semibold)',
            color:        'var(--dev-color-warning)',
            marginBottom: 'var(--dev-space-6)',
          }}
        >
          ⚠ La nouvelle valeur sera affichée une seule fois. Sauvegardez-la
          immédiatement.
        </p>

        <div style={{ display: 'flex', gap: 'var(--dev-space-3)', justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding:      'var(--dev-space-2) var(--dev-space-5)',
              background:   'var(--dev-bg-surface)',
              color:        'var(--dev-text-secondary)',
              border:       '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize:     'var(--dev-font-size-sm)',
              fontWeight:   'var(--dev-font-weight-medium)',
              cursor:       loading ? 'not-allowed' : 'pointer',
              opacity:      loading ? 0.5 : 1,
            }}
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          'var(--dev-space-2)',
              padding:      'var(--dev-space-2) var(--dev-space-5)',
              background:   loading ? 'var(--dev-color-warning-light)' : 'var(--dev-color-warning)',
              color:        loading ? 'var(--dev-color-warning)' : 'white',
              border:       'none',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize:     'var(--dev-font-size-sm)',
              fontWeight:   'var(--dev-font-weight-semibold)',
              cursor:       loading ? 'not-allowed' : 'pointer',
              transition:   'all var(--dev-transition-fast)',
            }}
          >
            {loading && <Spinner size={14} />}
            {loading ? 'Rotation en cours…' : 'Confirmer la rotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alerte one-shot nouvelle clé ─────────────────────────────────────────────

/**
 * NewKeyAlert - affiche la valeur brute d'une nouvelle clé après rotation.
 * Doit être fermée manuellement : une fois fermée, la valeur n'est plus accessible
 * sans appel API supplémentaire.
 */
function NewKeyAlert({ keyType, newKeyValue, onClose }) {
  const keyLabel = keyType === 'publishable' ? 'publishable' : 'secrète';

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background:   'var(--dev-color-success-light)',
        border:       '1px solid var(--dev-color-success)',
        borderRadius: 'var(--dev-border-radius-lg)',
        padding:      'var(--dev-space-5)',
        marginBottom: 'var(--dev-space-6)',
      }}
    >
      <p
        style={{
          fontSize:     'var(--dev-font-size-sm)',
          fontWeight:   'var(--dev-font-weight-semibold)',
          color:        'var(--dev-color-success)',
          marginBottom: 'var(--dev-space-2)',
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--dev-space-2)',
        }}
      >
        <IconCheck size={16} />
        Rotation réussie - nouvelle clé {keyLabel}
      </p>
      <p
        style={{
          fontSize:     'var(--dev-font-size-xs)',
          color:        'var(--dev-color-success)',
          marginBottom: 'var(--dev-space-3)',
        }}
      >
        Cette valeur ne sera plus affichée après fermeture. Copiez-la maintenant.
      </p>

      {/* Valeur avec fond monoespace */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            'var(--dev-space-3)',
          background:     'white',
          border:         '1px solid var(--dev-color-success)',
          borderRadius:   'var(--dev-border-radius-md)',
          padding:        'var(--dev-space-3) var(--dev-space-4)',
          marginBottom:   'var(--dev-space-4)',
          flexWrap:       'wrap',
        }}
      >
        <code
          style={{
            fontFamily:  'var(--dev-font-family-mono)',
            fontSize:    'var(--dev-font-size-sm)',
            color:       'var(--dev-color-neutral-800)',
            wordBreak:   'break-all',
            flex:        1,
          }}
        >
          {newKeyValue}
        </code>
        <CopyButton value={newKeyValue} label="Copier la clé" size="md" />
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          padding:      'var(--dev-space-2) var(--dev-space-4)',
          background:   'var(--dev-color-success)',
          color:        'white',
          border:       'none',
          borderRadius: 'var(--dev-border-radius-md)',
          fontSize:     'var(--dev-font-size-sm)',
          fontWeight:   'var(--dev-font-weight-medium)',
          cursor:       'pointer',
        }}
      >
        J'ai sauvegardé la clé, fermer
      </button>
    </div>
  );
}

// ─── Ligne de clé individuelle ────────────────────────────────────────────────

/**
 * KeyRow - affiche les informations d'une clé API (publishable ou secret).
 *
 * @param {object} props
 * @param {'publishable'|'secret'} props.keyType
 * @param {string}  props.keyValue       - valeur masquée fournie par l'API
 * @param {string}  [props.secretRaw]    - valeur brute de la secret key (si révélée)
 * @param {boolean} props.revealed       - la secret key est-elle révélée ?
 * @param {Function} props.onReveal      - callback pour révéler la secret key
 * @param {string}  [props.createdAt]
 * @param {string}  [props.lastUsedAt]
 * @param {Function} props.onRotate      - callback pour déclencher la rotation
 */
function KeyRow({
  keyType,
  keyValue,
  secretRaw,
  revealed,
  onReveal,
  createdAt,
  lastUsedAt,
  onRotate,
}) {
  const isPublishable = keyType === 'publishable';
  const displayLabel  = isPublishable ? 'Clé publishable' : 'Clé secrète';

  // La valeur affichée dans le champ texte
  const displayValue = isPublishable
    ? keyValue
    : revealed && secretRaw
      ? secretRaw
      : keyValue; // valeur déjà masquée fournie par l'API (sk_live_••••abcd)

  // La valeur copiée dans le presse-papiers
  const copyValue = isPublishable
    ? keyValue
    : revealed && secretRaw
      ? secretRaw
      : keyValue;

  return (
    <div
      style={{
        background:   'var(--dev-bg-surface)',
        border:       '1px solid var(--dev-border-color)',
        borderRadius: 'var(--dev-border-radius-lg)',
        padding:      'var(--dev-space-6)',
      }}
    >
      {/* En-tête de la ligne */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--dev-space-2)',
          marginBottom: 'var(--dev-space-4)',
        }}
      >
        <span
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          32,
            height:         32,
            borderRadius:   'var(--dev-border-radius-md)',
            background:     isPublishable
              ? 'var(--dev-color-info-light)'
              : 'var(--dev-color-warning-light)',
            color: isPublishable
              ? 'var(--dev-color-info)'
              : 'var(--dev-color-warning)',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <IconKey size={16} />
        </span>

        <div>
          <h3
            style={{
              fontSize:   'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              color:      'var(--dev-text-primary)',
              margin:     0,
            }}
          >
            {displayLabel}
          </h3>
          <p
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color:    'var(--dev-text-muted)',
              margin:   0,
            }}
          >
            {isPublishable
              ? 'Utilisable côté client (navigateur, application mobile)'
              : 'À utiliser exclusivement côté serveur'}
          </p>
        </div>
      </div>

      {/* Zone de valeur de la clé */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--dev-space-2)',
          background:   'var(--dev-color-neutral-50)',
          border:       '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-md)',
          padding:      'var(--dev-space-3) var(--dev-space-4)',
          marginBottom: 'var(--dev-space-4)',
          flexWrap:     'wrap',
        }}
      >
        <code
          style={{
            fontFamily: 'var(--dev-font-family-mono)',
            fontSize:   'var(--dev-font-size-sm)',
            color:      'var(--dev-color-neutral-800)',
            wordBreak:  'break-all',
            flex:       1,
            minWidth:   0,
          }}
          aria-label={`Valeur de la ${displayLabel}`}
        >
          {displayValue}
        </code>

        {/* Bouton Révéler - uniquement pour la clé secrète, avant révélation */}
        {!isPublishable && !revealed && (
          <button
            type="button"
            onClick={onReveal}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          'var(--dev-space-1)',
              padding:      'var(--dev-space-1) var(--dev-space-3)',
              background:   'var(--dev-color-neutral-100)',
              color:        'var(--dev-text-secondary)',
              border:       '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize:     'var(--dev-font-size-xs)',
              fontWeight:   'var(--dev-font-weight-medium)',
              cursor:       'pointer',
              flexShrink:   0,
              transition:   'all var(--dev-transition-fast)',
            }}
          >
            <IconEye size={14} />
            Révéler
          </button>
        )}

        {/* Indication "clé révélée" */}
        {!isPublishable && revealed && (
          <span
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:        'var(--dev-space-1)',
              padding:    'var(--dev-space-1) var(--dev-space-3)',
              background: 'var(--dev-color-warning-light)',
              color:      'var(--dev-color-warning)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize:   'var(--dev-font-size-xs)',
              fontWeight: 'var(--dev-font-weight-medium)',
              flexShrink: 0,
            }}
          >
            <IconEyeOff size={14} />
            Révélée
          </span>
        )}

        {/* Bouton copie */}
        <CopyButton
          value={copyValue}
          label={`Copier la ${displayLabel.toLowerCase()}`}
        />
      </div>

      {/* Méta-données : dates */}
      <dl
        style={{
          display:      'flex',
          gap:          'var(--dev-space-6)',
          flexWrap:     'wrap',
          marginBottom: 'var(--dev-space-5)',
        }}
      >
        <div>
          <dt
            style={{
              fontSize:     'var(--dev-font-size-xs)',
              color:        'var(--dev-text-muted)',
              marginBottom: 'var(--dev-space-1)',
            }}
          >
            Créée le
          </dt>
          <dd
            style={{
              fontSize:   'var(--dev-font-size-sm)',
              color:      'var(--dev-text-secondary)',
              fontWeight: 'var(--dev-font-weight-medium)',
              margin:     0,
            }}
          >
            {formatDate(createdAt)}
          </dd>
        </div>

        <div>
          <dt
            style={{
              fontSize:     'var(--dev-font-size-xs)',
              color:        'var(--dev-text-muted)',
              marginBottom: 'var(--dev-space-1)',
            }}
          >
            Dernière utilisation
          </dt>
          <dd
            style={{
              fontSize:   'var(--dev-font-size-sm)',
              color:      'var(--dev-text-secondary)',
              fontWeight: 'var(--dev-font-weight-medium)',
              margin:     0,
            }}
          >
            {lastUsedAt ? formatDate(lastUsedAt) : 'Jamais utilisée'}
          </dd>
        </div>
      </dl>

      {/* Bouton Rotation */}
      <div>
        <button
          type="button"
          onClick={onRotate}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          'var(--dev-space-2)',
            padding:      'var(--dev-space-2) var(--dev-space-4)',
            background:   'var(--dev-bg-surface)',
            color:        'var(--dev-color-warning)',
            border:       '1px solid var(--dev-color-warning)',
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize:     'var(--dev-font-size-sm)',
            fontWeight:   'var(--dev-font-weight-medium)',
            cursor:       'pointer',
            transition:   'all var(--dev-transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--dev-color-warning-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--dev-bg-surface)';
          }}
        >
          <IconRefreshCw size={14} />
          Effectuer une rotation
        </button>
      </div>
    </div>
  );
}

// ─── ApiKeyDisplay (composant principal) ──────────────────────────────────────

/**
 * @param {object}  props
 * @param {string}  props.projectId - ID du projet dont on affiche les clés
 * @param {object}  [props.project] - données du projet (non utilisé directement,
 *                                    mais transmis par ProjectPage pour cohérence)
 */
export default function ApiKeyDisplay({ projectId }) {
  // ── État des clés ────────────────────────────────────────────────────────────
  const [keys,    setKeys]    = useState(null);  // { publishable: {...}, secret: {...} }
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // ── Révélation de la secret key (une seule fois, sans appel API) ─────────────
  // secretRaw est stocké uniquement en mémoire React (non persisté)
  const [secretRevealed, setSecretRevealed] = useState(false);
  const secretRawRef = useRef(null); // valeur brute récupérée lors du chargement initial

  // ── Modale de rotation ───────────────────────────────────────────────────────
  const [rotatingKeyType,  setRotatingKeyType]  = useState(null); // 'publishable' | 'secret'
  const [rotationLoading,  setRotationLoading]  = useState(false);
  const [rotationError,    setRotationError]    = useState('');

  // ── Alerte one-shot après rotation ──────────────────────────────────────────
  const [newKeyAlert, setNewKeyAlert] = useState(null); // { keyType, value }

  // ── Chargement des clés ──────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await developerApi.get(`/projects/${projectId}/keys`);
      // L'API retourne { keys: { publishable: {...}, secret: {...} } } ou { publishable, secret }
      const keysData = data?.keys ?? data;
      setKeys(keysData);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Impossible de charger les clés API. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ── Révélation de la secret key ──────────────────────────────────────────────

  function handleRevealSecret() {
    // La secret key est déjà disponible dans `keys.secret.key_value`
    // (la valeur masquée). Pour la révéler, on affiche la valeur complète
    // stockée dans l'objet keys, qui peut contenir la valeur partielle.
    // Selon l'API (task 7), GET /keys retourne la secret masquée.
    // Le bouton "Révéler" affiche simplement cette valeur sans appel supplémentaire.
    // Si l'API retourne un champ `key_raw` lors du chargement, on l'utilise.
    secretRawRef.current = keys?.secret?.key_raw ?? keys?.secret?.key_value ?? null;
    setSecretRevealed(true);
  }

  // ── Rotation d'une clé ───────────────────────────────────────────────────────

  function openRotationModal(keyType) {
    setRotatingKeyType(keyType);
    setRotationError('');
  }

  function closeRotationModal() {
    if (!rotationLoading) {
      setRotatingKeyType(null);
      setRotationError('');
    }
  }

  async function handleConfirmRotation() {
    if (!rotatingKeyType) return;

    setRotationLoading(true);
    setRotationError('');

    try {
      // req 4.4 : le champ `confirm: true` est obligatoire
      const { data } = await developerApi.post(
        `/projects/${projectId}/keys/rotate`,
        { keyType: rotatingKeyType, confirm: true }
      );

      // La nouvelle valeur brute est retournée une seule fois
      const newKeyValue =
        data?.key ??
        data?.newKey ??
        data?.publishable ??
        data?.secret ??
        data?.value ??
        null;

      // Fermer la modale
      setRotatingKeyType(null);
      setRotationLoading(false);

      // Afficher l'alerte one-shot
      if (newKeyValue) {
        setNewKeyAlert({ keyType: rotatingKeyType, value: newKeyValue });
      }

      // Si on vient de tourner la secret key, réinitialiser l'état de révélation
      if (rotatingKeyType === 'secret') {
        setSecretRevealed(false);
        secretRawRef.current = null;
      }

      // Recharger les clés pour afficher les nouvelles dates / valeurs masquées
      await fetchKeys();
    } catch (err) {
      setRotationLoading(false);
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'La rotation a échoué. Veuillez réessayer.';
      setRotationError(msg);
    }
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="api-keys-title">
      <h2
        id="api-keys-title"
        style={{
          fontSize:     'var(--dev-font-size-xl)',
          fontWeight:   'var(--dev-font-weight-bold)',
          color:        'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-2)',
        }}
      >
        Clés API
      </h2>
      <p
        style={{
          fontSize:     'var(--dev-font-size-sm)',
          color:        'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-6)',
        }}
      >
        Utilisez ces clés pour authentifier vos requêtes vers l'API Palabre.
        Ne partagez jamais votre clé secrète publiquement.
      </p>

      {/* Alerte one-shot après rotation */}
      {newKeyAlert && (
        <NewKeyAlert
          keyType={newKeyAlert.keyType}
          newKeyValue={newKeyAlert.value}
          onClose={() => setNewKeyAlert(null)}
        />
      )}

      {/* Erreur de rotation */}
      {rotationError && (
        <div
          role="alert"
          style={{
            background:   'var(--dev-color-error-light)',
            border:       '1px solid var(--dev-color-error)',
            borderRadius: 'var(--dev-border-radius-md)',
            padding:      'var(--dev-space-4)',
            marginBottom: 'var(--dev-space-5)',
            fontSize:     'var(--dev-font-size-sm)',
            color:        'var(--dev-color-error)',
          }}
        >
          {rotationError}
        </div>
      )}

      {/* État de chargement */}
      {loading && (
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            minHeight:      200,
          }}
          aria-label="Chargement des clés API…"
        >
          <Spinner size={28} />
        </div>
      )}

      {/* Erreur de chargement */}
      {!loading && error && (
        <div
          role="alert"
          style={{
            display:      'flex',
            flexDirection: 'column',
            alignItems:   'center',
            gap:          'var(--dev-space-4)',
            padding:      'var(--dev-space-10)',
            background:   'var(--dev-bg-surface)',
            border:       '1px solid var(--dev-color-error)',
            borderRadius: 'var(--dev-border-radius-lg)',
            textAlign:    'center',
          }}
        >
          <p style={{ color: 'var(--dev-color-error)', fontSize: 'var(--dev-font-size-sm)', margin: 0 }}>
            {error}
          </p>
          <button
            type="button"
            onClick={fetchKeys}
            style={{
              padding:      'var(--dev-space-2) var(--dev-space-5)',
              background:   'var(--dev-color-brand-primary)',
              color:        'white',
              border:       'none',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize:     'var(--dev-font-size-sm)',
              fontWeight:   'var(--dev-font-weight-semibold)',
              cursor:       'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Liste des clés */}
      {!loading && !error && keys && (
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           'var(--dev-space-5)',
          }}
        >
          {/* Clé publishable */}
          {keys.publishable && (
            <KeyRow
              keyType="publishable"
              keyValue={keys.publishable.key_value ?? keys.publishable.value ?? ''}
              createdAt={keys.publishable.created_at}
              lastUsedAt={keys.publishable.last_used_at}
              onRotate={() => openRotationModal('publishable')}
            />
          )}

          {/* Clé secrète */}
          {keys.secret && (
            <KeyRow
              keyType="secret"
              keyValue={keys.secret.key_value ?? keys.secret.value ?? ''}
              secretRaw={secretRawRef.current}
              revealed={secretRevealed}
              onReveal={handleRevealSecret}
              createdAt={keys.secret.created_at}
              lastUsedAt={keys.secret.last_used_at}
              onRotate={() => openRotationModal('secret')}
            />
          )}
        </div>
      )}

      {/* Modale de confirmation de rotation */}
      {rotatingKeyType && (
        <RotationModal
          keyType={rotatingKeyType}
          onConfirm={handleConfirmRotation}
          onCancel={closeRotationModal}
          loading={rotationLoading}
        />
      )}
    </section>
  );
}
