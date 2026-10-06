/**
 * ApiKeyDisplay.jsx - Developer Portal
 *
 * Affichage et gestion des clés API — design institutionnel.
 * Pas de gradient sur les icônes — fond #EAF2FD / couleur #1A73E8.
 * Badges statut border-radius 4px.
 *
 * Requirements couverts : 4.1, 4.2, 4.3, 4.4, 4.6
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import developerApi from '../api/developerApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString));
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconCopy({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconEye({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconRefreshCw({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconAlertTriangle({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconKey({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
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

// ─── Bouton copie ─────────────────────────────────────────────────────────────

function CopyButton({ value, label = 'Copier' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copié !' : label}
      title={copied ? 'Copié !' : label}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          4,
        padding:      '4px 10px',
        background:   copied ? 'rgba(52,168,83,.12)' : '#F1F3F4',
        color:        copied ? '#34A853' : '#5F6368',
        border:       `1px solid ${copied ? '#34A853' : '#E0E0E0'}`,
        borderRadius: 6,
        fontSize:     12,
        fontWeight:   500,
        cursor:       'pointer',
        fontFamily:   'inherit',
        transition:   'all 150ms ease',
        whiteSpace:   'nowrap',
        flexShrink:   0,
      }}
    >
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
}

// ─── Modale de rotation ───────────────────────────────────────────────────────

function RotationModal({ keyType, onConfirm, onCancel, loading }) {
  const cancelRef = useRef(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
    function handleKeyDown(e) { if (e.key === 'Escape' && !loading) onCancel(); }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel]);

  const keyLabel = keyType === 'publishable' ? 'publishable' : 'secrète';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotation-modal-title"
      aria-describedby="rotation-modal-desc"
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
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        style={{
          background:   '#FFFFFF',
          borderRadius: 12,
          boxShadow:    '0 8px 32px rgba(32,33,36,.14)',
          padding:      '28px 32px',
          width:        '100%',
          maxWidth:     440,
        }}
      >
        <div
          style={{
            width:           44,
            height:          44,
            borderRadius:    '50%',
            backgroundColor: 'rgba(251,188,5,.12)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           '#8a6700',
            marginBottom:    16,
          }}
          aria-hidden="true"
        >
          <IconAlertTriangle size={22} />
        </div>

        <h2
          id="rotation-modal-title"
          style={{ fontSize: 18, fontWeight: 700, color: '#202124', margin: '0 0 10px' }}
        >
          Rotation de la clé {keyLabel}
        </h2>

        <p
          id="rotation-modal-desc"
          style={{ fontSize: 14, color: '#5F6368', lineHeight: 1.5, margin: '0 0 8px' }}
        >
          L'ancienne clé sera immédiatement révoquée. Une période de grâce de{' '}
          <strong>60 secondes</strong> est accordée pour les requêtes en transit.
        </p>

        <p style={{ fontSize: 13, fontWeight: 600, color: '#8a6700', margin: '0 0 20px' }}>
          La nouvelle valeur sera affichée une seule fois. Sauvegardez-la immédiatement.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              height:       36,
              padding:      '0 16px',
              background:   '#FFFFFF',
              color:        '#5F6368',
              border:       '1px solid #E0E0E0',
              borderRadius: 8,
              fontSize:     14,
              fontWeight:   500,
              cursor:       loading ? 'not-allowed' : 'pointer',
              fontFamily:   'inherit',
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
              gap:          6,
              height:       36,
              padding:      '0 16px',
              background:   loading ? 'rgba(251,188,5,.12)' : '#FBBC05',
              color:        loading ? '#8a6700' : '#202124',
              border:       'none',
              borderRadius: 8,
              fontSize:     14,
              fontWeight:   600,
              cursor:       loading ? 'not-allowed' : 'pointer',
              fontFamily:   'inherit',
              transition:   'all 150ms ease',
            }}
          >
            {loading && <Spinner size={14} />}
            {loading ? 'Rotation…' : 'Confirmer la rotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alerte one-shot nouvelle clé ─────────────────────────────────────────────

function NewKeyAlert({ keyType, newKeyValue, onClose }) {
  const keyLabel = keyType === 'publishable' ? 'publishable' : 'secrète';
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background:   'rgba(52,168,83,.08)',
        border:       '1px solid #34A853',
        borderLeft:   '3px solid #34A853',
        borderRadius: 8,
        padding:      '16px 20px',
        marginBottom: 20,
      }}
    >
      <p style={{
        fontSize: 13, fontWeight: 600, color: '#34A853',
        margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <IconCheck size={14} />
        Rotation réussie — nouvelle clé {keyLabel}
      </p>
      <p style={{ fontSize: 12, color: '#34A853', margin: '0 0 12px' }}>
        Cette valeur ne sera plus affichée après fermeture. Copiez-la maintenant.
      </p>
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          10,
          background:   '#FFFFFF',
          border:       '1px solid #34A853',
          borderRadius: 6,
          padding:      '10px 14px',
          marginBottom: 12,
          flexWrap:     'wrap',
        }}
      >
        <code
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize:   12,
            color:      '#202124',
            wordBreak:  'break-all',
            flex:       1,
            background: 'none',
            border:     'none',
            padding:    0,
          }}
        >
          {newKeyValue}
        </code>
        <CopyButton value={newKeyValue} label="Copier la clé" />
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          height:       34,
          padding:      '0 16px',
          background:   '#34A853',
          color:        '#FFFFFF',
          border:       'none',
          borderRadius: 6,
          fontSize:     13,
          fontWeight:   600,
          cursor:       'pointer',
          fontFamily:   'inherit',
        }}
      >
        J'ai sauvegardé la clé — fermer
      </button>
    </div>
  );
}

// ─── Ligne de clé ─────────────────────────────────────────────────────────────

function KeyRow({ keyType, keyValue, secretRaw, revealed, onReveal, createdAt, lastUsedAt, onRotate }) {
  const isPublishable = keyType === 'publishable';
  const displayLabel  = isPublishable ? 'Clé publishable' : 'Clé secrète';

  const displayValue = isPublishable
    ? keyValue
    : revealed && secretRaw ? secretRaw : keyValue;

  const copyValue = displayValue;

  return (
    <div
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E0E0E0',
        borderRadius: 8,
        padding:      '20px 24px',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            width:           32,
            height:          32,
            borderRadius:    8,
            backgroundColor: '#EAF2FD',
            color:           '#1A73E8',
            flexShrink:      0,
          }}
          aria-hidden="true"
        >
          <IconKey size={14} />
        </span>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#202124', margin: 0 }}>
            {displayLabel}
          </h3>
          <p style={{ fontSize: 12, color: '#5F6368', margin: 0 }}>
            {isPublishable
              ? 'Utilisable côté client (navigateur, mobile)'
              : 'À utiliser exclusivement côté serveur'}
          </p>
        </div>
      </div>

      {/* Zone de valeur */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          background:   '#F8F9FA',
          border:       '1px solid #E0E0E0',
          borderRadius: 8,
          padding:      '10px 14px',
          marginBottom: 14,
          flexWrap:     'wrap',
        }}
      >
        <code
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize:   13,
            color:      '#202124',
            wordBreak:  'break-all',
            flex:       1,
            minWidth:   0,
            background: 'none',
            border:     'none',
            padding:    0,
          }}
          aria-label={`Valeur de la ${displayLabel}`}
        >
          {displayValue}
        </code>

        {!isPublishable && !revealed && (
          <button
            type="button"
            onClick={onReveal}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              padding:      '4px 10px',
              background:   '#F1F3F4',
              color:        '#5F6368',
              border:       '1px solid #E0E0E0',
              borderRadius: 6,
              fontSize:     12,
              fontWeight:   500,
              cursor:       'pointer',
              fontFamily:   'inherit',
              flexShrink:   0,
            }}
          >
            <IconEye />
            Révéler
          </button>
        )}

        {!isPublishable && revealed && (
          <span
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              padding:      '4px 8px',
              background:   'rgba(251,188,5,.10)',
              color:        '#8a6700',
              borderRadius: 4,
              fontSize:     11,
              fontWeight:   600,
              flexShrink:   0,
            }}
          >
            <IconEyeOff />
            Révélée
          </span>
        )}

        <CopyButton value={copyValue} label={`Copier la ${displayLabel.toLowerCase()}`} />
      </div>

      {/* Méta-données */}
      <dl style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <dt style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 2 }}>Créée le</dt>
          <dd style={{ fontSize: 13, color: '#5F6368', fontWeight: 500, margin: 0 }}>
            {formatDate(createdAt)}
          </dd>
        </div>
        <div>
          <dt style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 2 }}>Dernière utilisation</dt>
          <dd style={{ fontSize: 13, color: '#5F6368', fontWeight: 500, margin: 0 }}>
            {lastUsedAt ? formatDate(lastUsedAt) : 'Jamais utilisée'}
          </dd>
        </div>
      </dl>

      {/* Bouton rotation */}
      <button
        type="button"
        onClick={onRotate}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          6,
          padding:      '6px 14px',
          background:   '#FFFFFF',
          color:        '#8a6700',
          border:       '1px solid #FBBC05',
          borderRadius: 8,
          fontSize:     13,
          fontWeight:   500,
          cursor:       'pointer',
          fontFamily:   'inherit',
          transition:   'background 150ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251,188,5,.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
      >
        <IconRefreshCw size={13} />
        Effectuer une rotation
      </button>
    </div>
  );
}

// ─── ApiKeyDisplay ────────────────────────────────────────────────────────────

export default function ApiKeyDisplay({ projectId }) {
  const [keys,    setKeys]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [secretRevealed, setSecretRevealed] = useState(false);
  const secretRawRef = useRef(null);

  const [rotatingKeyType,  setRotatingKeyType]  = useState(null);
  const [rotationLoading,  setRotationLoading]  = useState(false);
  const [rotationError,    setRotationError]    = useState('');
  const [newKeyAlert,      setNewKeyAlert]      = useState(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await developerApi.get(`/projects/${projectId}/keys`);
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

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  function handleRevealSecret() {
    secretRawRef.current = keys?.secret?.key_raw ?? keys?.secret?.key_value ?? null;
    setSecretRevealed(true);
  }

  function openRotationModal(keyType) {
    setRotatingKeyType(keyType);
    setRotationError('');
  }

  function closeRotationModal() {
    if (!rotationLoading) { setRotatingKeyType(null); setRotationError(''); }
  }

  async function handleConfirmRotation() {
    if (!rotatingKeyType) return;
    setRotationLoading(true);
    setRotationError('');
    try {
      const { data } = await developerApi.post(
        `/projects/${projectId}/keys/rotate`,
        { keyType: rotatingKeyType, confirm: true }
      );
      const newKeyValue =
        data?.key ?? data?.newKey ?? data?.publishable ?? data?.secret ?? data?.value ?? null;
      setRotatingKeyType(null);
      setRotationLoading(false);
      if (newKeyValue) setNewKeyAlert({ keyType: rotatingKeyType, value: newKeyValue });
      if (rotatingKeyType === 'secret') { setSecretRevealed(false); secretRawRef.current = null; }
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

  return (
    <section aria-labelledby="api-keys-title">
      <h2
        id="api-keys-title"
        style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}
      >
        Clés API
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 20px' }}>
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
            padding:      '10px 14px',
            background:   'rgba(234,67,53,.06)',
            border:       '1px solid #EA4335',
            borderLeft:   '3px solid #EA4335',
            borderRadius: 8,
            color:        '#EA4335',
            fontSize:     14,
            marginBottom: 16,
          }}
        >
          {rotationError}
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <Spinner size={28} />
        </div>
      )}

      {/* Erreur chargement */}
      {!loading && error && (
        <div
          role="alert"
          style={{
            padding:      '10px 14px',
            background:   'rgba(234,67,53,.06)',
            border:       '1px solid #EA4335',
            borderLeft:   '3px solid #EA4335',
            borderRadius: 8,
            color:        '#EA4335',
            fontSize:     14,
            marginBottom: 16,
          }}
        >
          {error}
          <button
            type="button"
            onClick={fetchKeys}
            style={{
              marginLeft:     8,
              background:     'none',
              border:         'none',
              color:          '#EA4335',
              cursor:         'pointer',
              textDecoration: 'underline',
              fontSize:       'inherit',
              fontFamily:     'inherit',
              padding:        0,
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Clés */}
      {!loading && !error && keys && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {keys.publishable && (
            <KeyRow
              keyType="publishable"
              keyValue={keys.publishable.key_value ?? keys.publishable}
              createdAt={keys.publishable.created_at}
              lastUsedAt={keys.publishable.last_used_at}
              onRotate={() => openRotationModal('publishable')}
            />
          )}
          {keys.secret && (
            <KeyRow
              keyType="secret"
              keyValue={keys.secret.key_value ?? keys.secret}
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

      {/* Modale rotation */}
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
