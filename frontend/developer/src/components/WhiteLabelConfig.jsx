/**
 * WhiteLabelConfig.jsx - Developer Portal
 *
 * Formulaire de configuration White-Label d'un Developer_Project.
 *
 * Fonctionnalités :
 *   - Champ upload logo avec prévisualisation immédiate (FileReader base64)
 *   - Color pickers pour couleur primaire et secondaire
 *     avec validation format hexadécimal (#RRGGBB)
 *   - Champ texte display_name
 *   - Prévisualisation en temps réel d'un widget de chat fictif
 *   - Bouton "Sauvegarder" : PATCH /projects/:id, confirmation inline
 *
 * Requirements couverts : 11.1, 11.5
 *
 * @param {object} props
 * @param {string} props.projectId  - ID du projet à configurer
 * @param {object} props.project    - données courantes (préremplissage)
 */

import React, { useState, useRef, useCallback } from 'react';
import developerApi from '../api/developerApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const DEFAULT_PRIMARY   = '#2563eb';
const DEFAULT_SECONDARY = '#7c3aed';
const DEFAULT_NAME      = 'Mon Application';

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.4)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'dev-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise une valeur hex en s'assurant qu'elle commence par '#'. */
function normalizeHex(value) {
  if (!value) return '';
  return value.startsWith('#') ? value : `#${value}`;
}

/** Retourne true si la valeur est un code hexadécimal #RRGGBB valide. */
function isValidHex(value) {
  return HEX_RE.test(value);
}

// ─── Color picker avec saisie manuelle ───────────────────────────────────────

function ColorField({ id, label, value, onChange }) {
  const [textValue, setTextValue] = useState(value);
  const [touched, setTouched]     = useState(false);

  // Synchronise l'affichage texte quand la valeur externe change
  // (ex. reset du formulaire)
  React.useEffect(() => {
    setTextValue(value);
  }, [value]);

  function handlePickerChange(e) {
    const hex = e.target.value;
    setTextValue(hex);
    setTouched(false);
    onChange(hex);
  }

  function handleTextChange(e) {
    const raw = e.target.value;
    setTextValue(raw);
    setTouched(true);
    const normalized = normalizeHex(raw);
    if (isValidHex(normalized)) {
      onChange(normalized);
    }
  }

  function handleTextBlur() {
    setTouched(true);
    const normalized = normalizeHex(textValue);
    if (isValidHex(normalized)) {
      setTextValue(normalized);
      onChange(normalized);
    }
  }

  const showError  = touched && !isValidHex(normalizeHex(textValue));
  const displayHex = isValidHex(normalizeHex(value)) ? value : DEFAULT_PRIMARY;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dev-space-1)' }}>
      <label htmlFor={id} style={{
        fontSize: 'var(--dev-font-size-sm)',
        fontWeight: 'var(--dev-font-weight-medium)',
        color: 'var(--dev-text-primary)',
      }}>
        {label}
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dev-space-2)' }}>
        {/* Native color picker */}
        <input
          type="color"
          value={displayHex}
          onChange={handlePickerChange}
          aria-label={`Sélecteur de couleur pour ${label}`}
          style={{
            width: 40,
            height: 40,
            padding: 2,
            border: '1px solid var(--dev-border-color)',
            borderRadius: 'var(--dev-border-radius-md)',
            cursor: 'pointer',
            background: 'none',
            flexShrink: 0,
          }}
        />

        {/* Text input for manual entry */}
        <input
          id={id}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder="#000000"
          maxLength={7}
          aria-describedby={showError ? `${id}-error` : undefined}
          aria-invalid={showError}
          style={{
            flex: 1,
            padding: 'var(--dev-space-2) var(--dev-space-3)',
            border: `1px solid ${showError ? 'var(--dev-color-error)' : 'var(--dev-border-color)'}`,
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-sm)',
            fontFamily: 'var(--dev-font-family-mono)',
            color: 'var(--dev-text-primary)',
            background: 'var(--dev-bg-surface)',
            outline: 'none',
            transition: 'border-color var(--dev-transition-fast)',
          }}
          onFocus={(e) => {
            if (!showError) {
              e.target.style.borderColor = 'var(--dev-border-color-focus)';
            }
          }}
        />
      </div>

      {showError && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{
            fontSize: 'var(--dev-font-size-xs)',
            color: 'var(--dev-color-error)',
            margin: 0,
          }}
        >
          Format invalide. Utilisez un code hexadécimal comme <code>#2563eb</code>.
        </p>
      )}
    </div>
  );
}

// ─── Prévisualisation du widget de chat ───────────────────────────────────────

function ChatWidgetPreview({ displayName, colorPrimary, colorSecondary, logoUrl }) {
  const name    = displayName || DEFAULT_NAME;
  const primary = isValidHex(colorPrimary)   ? colorPrimary   : DEFAULT_PRIMARY;
  const second  = isValidHex(colorSecondary) ? colorSecondary : DEFAULT_SECONDARY;

  // Messages fictifs pour la prévisualisation
  const messages = [
    { id: 1, from: 'agent',   text: `Bonjour ! Comment puis-je vous aider aujourd'hui ?` },
    { id: 2, from: 'visitor', text: 'J\'aurais besoin d\'une information.' },
    { id: 3, from: 'agent',   text: 'Bien sûr, je suis là pour vous aider !' },
  ];

  return (
    <div
      aria-label="Prévisualisation du widget de chat"
      style={{
        width: '100%',
        maxWidth: 320,
        borderRadius: 'var(--dev-border-radius-xl)',
        overflow: 'hidden',
        boxShadow: 'var(--dev-shadow-xl)',
        border: '1px solid var(--dev-border-color)',
        fontFamily: 'var(--dev-font-family-sans)',
        background: 'var(--dev-bg-surface)',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${primary}, ${second})`,
          padding: 'var(--dev-space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--dev-space-3)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--dev-border-radius-md)',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + status */}
        <div>
          <p style={{
            margin: 0,
            color: 'white',
            fontWeight: 'var(--dev-font-weight-semibold)',
            fontSize: 'var(--dev-font-size-sm)',
          }}>
            {name}
          </p>
          <p style={{
            margin: 0,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 'var(--dev-font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              display: 'inline-block',
            }} />
            En ligne
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        padding: 'var(--dev-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--dev-space-3)',
        background: 'var(--dev-color-neutral-50)',
        minHeight: 140,
      }}>
        {messages.map((msg) => {
          const isAgent = msg.from === 'agent';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isAgent ? 'flex-start' : 'flex-end',
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '6px 12px',
                borderRadius: isAgent
                  ? '4px 12px 12px 12px'
                  : '12px 4px 12px 12px',
                background: isAgent
                  ? 'var(--dev-bg-surface)'
                  : primary,
                color: isAgent
                  ? 'var(--dev-text-primary)'
                  : 'white',
                fontSize: 'var(--dev-font-size-xs)',
                lineHeight: 'var(--dev-line-height-normal)',
                boxShadow: 'var(--dev-shadow-sm)',
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input fictif */}
      <div style={{
        padding: 'var(--dev-space-3) var(--dev-space-4)',
        borderTop: '1px solid var(--dev-border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--dev-space-2)',
        background: 'var(--dev-bg-surface)',
      }}>
        <div style={{
          flex: 1,
          height: 32,
          borderRadius: 'var(--dev-border-radius-full)',
          background: 'var(--dev-color-neutral-100)',
          border: '1px solid var(--dev-border-color)',
        }} />
        <button
          type="button"
          aria-label="Envoyer (aperçu)"
          tabIndex={-1}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: primary,
            border: 'none',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
          }}
        >
          <IconMessage />
        </button>
      </div>

      {/* Powered-by (white-label : nom du projet remplace Palabre) */}
      <div style={{
        padding: '4px var(--dev-space-4)',
        borderTop: '1px solid var(--dev-border-color)',
        background: 'var(--dev-color-neutral-50)',
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 10,
          color: 'var(--dev-text-muted)',
          letterSpacing: '0.03em',
        }}>
          Propulsé par <strong style={{ color: 'var(--dev-text-secondary)' }}>{name}</strong>
        </span>
      </div>
    </div>
  );
}

// ─── WhiteLabelConfig ─────────────────────────────────────────────────────────

export default function WhiteLabelConfig({ projectId, project }) {
  // ── État du formulaire (prérempli avec les données du projet) ────────────────
  const [displayName,     setDisplayName]     = useState(project?.display_name    ?? '');
  const [colorPrimary,    setColorPrimary]    = useState(project?.color_primary   ?? DEFAULT_PRIMARY);
  const [colorSecondary,  setColorSecondary]  = useState(project?.color_secondary ?? DEFAULT_SECONDARY);
  const [logoUrl,         setLogoUrl]         = useState(project?.logo_url        ?? '');
  const [logoPreview,     setLogoPreview]     = useState(project?.logo_url        ?? '');

  // ── État UI ──────────────────────────────────────────────────────────────────
  const [saving,          setSaving]          = useState(false);
  const [successMsg,      setSuccessMsg]      = useState('');
  const [errorMsg,        setErrorMsg]        = useState('');

  const fileInputRef = useRef(null);
  const successTimer = useRef(null);

  // ── Upload logo ──────────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation type MIME
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Le fichier sélectionné n\'est pas une image valide.');
      return;
    }

    // Validation taille (max 2 Mo)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('L\'image ne doit pas dépasser 2 Mo.');
      return;
    }

    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setLogoPreview(dataUrl);
      // Pour l'envoi à l'API, on utilise le data URL comme logo_url
      // (l'API pourrait ensuite le stocker et retourner une vraie URL)
      setLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = useCallback(() => {
    setLogoUrl('');
    setLogoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────────

  function getFormErrors() {
    const errors = [];
    if (!isValidHex(colorPrimary)) {
      errors.push('La couleur primaire doit être au format hexadécimal (#RRGGBB).');
    }
    if (!isValidHex(colorSecondary)) {
      errors.push('La couleur secondaire doit être au format hexadécimal (#RRGGBB).');
    }
    return errors;
  }

  // ── Sauvegarde ────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();

    setErrorMsg('');
    setSuccessMsg('');

    const errors = getFormErrors();
    if (errors.length > 0) {
      setErrorMsg(errors.join(' '));
      return;
    }

    setSaving(true);

    try {
      await developerApi.patch(`/projects/${projectId}`, {
        display_name:     displayName.trim() || null,
        color_primary:    colorPrimary,
        color_secondary:  colorSecondary,
        logo_url:         logoUrl || null,
      });

      setSuccessMsg('Configuration sauvegardée avec succès.');

      // Auto-hide après 4 secondes
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Une erreur est survenue lors de la sauvegarde.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <section aria-label="Configuration White-Label">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 'var(--dev-space-10)',
        alignItems: 'start',
      }}>

        {/* ─── Formulaire ──────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            background: 'var(--dev-bg-surface)',
            border: '1px solid var(--dev-border-color)',
            borderRadius: 'var(--dev-border-radius-xl)',
            padding: 'var(--dev-space-8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dev-space-6)',
          }}
        >
          <h2 style={{
            fontSize: 'var(--dev-font-size-xl)',
            fontWeight: 'var(--dev-font-weight-semibold)',
            color: 'var(--dev-text-primary)',
            margin: 0,
          }}>
            Apparence du widget
          </h2>
          <p style={{
            fontSize: 'var(--dev-font-size-sm)',
            color: 'var(--dev-text-secondary)',
            margin: 0,
            marginTop: 'calc(-1 * var(--dev-space-4))',
          }}>
            Personnalisez l'interface visible par vos utilisateurs finaux. Les modifications
            sont propagées aux SDK actifs sous 5 minutes.
          </p>

          {/* ── Upload logo ──────────────────────────────────────────────── */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{
              fontSize: 'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-medium)',
              color: 'var(--dev-text-primary)',
              marginBottom: 'var(--dev-space-3)',
              display: 'block',
            }}>
              Logo
            </legend>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dev-space-4)' }}>
              {/* Aperçu logo */}
              <div
                aria-label="Aperçu du logo"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--dev-border-radius-lg)',
                  border: '2px dashed var(--dev-border-color)',
                  background: 'var(--dev-color-neutral-50)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  color: 'var(--dev-text-muted)',
                }}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Aperçu du logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <IconUpload />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dev-space-2)' }}>
                {/* Input file caché */}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="logo-upload"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  aria-label="Uploader un logo"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--dev-space-2)',
                    padding: 'var(--dev-space-2) var(--dev-space-4)',
                    background: 'var(--dev-bg-surface)',
                    border: '1px solid var(--dev-border-color)',
                    borderRadius: 'var(--dev-border-radius-md)',
                    fontSize: 'var(--dev-font-size-sm)',
                    fontWeight: 'var(--dev-font-weight-medium)',
                    color: 'var(--dev-text-primary)',
                    cursor: 'pointer',
                    transition: 'background var(--dev-transition-fast)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--dev-color-neutral-50)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--dev-bg-surface)'}
                >
                  <IconUpload />
                  {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
                </button>

                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--dev-space-1)',
                      padding: 'var(--dev-space-1) var(--dev-space-3)',
                      background: 'none',
                      border: 'none',
                      fontSize: 'var(--dev-font-size-xs)',
                      color: 'var(--dev-color-error)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    <IconX />
                    Supprimer le logo
                  </button>
                )}

                <p style={{
                  fontSize: 'var(--dev-font-size-xs)',
                  color: 'var(--dev-text-muted)',
                  margin: 0,
                }}>
                  PNG, JPG, GIF, WebP ou SVG - 2 Mo max
                </p>
              </div>
            </div>
          </fieldset>

          {/* ── Nom d'affichage ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dev-space-1)' }}>
            <label htmlFor="display-name" style={{
              fontSize: 'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-medium)',
              color: 'var(--dev-text-primary)',
            }}>
              Nom d'affichage
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={DEFAULT_NAME}
              maxLength={100}
              style={{
                padding: 'var(--dev-space-2) var(--dev-space-3)',
                border: '1px solid var(--dev-border-color)',
                borderRadius: 'var(--dev-border-radius-md)',
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-primary)',
                background: 'var(--dev-bg-surface)',
                outline: 'none',
                transition: 'border-color var(--dev-transition-fast)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--dev-border-color-focus)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--dev-border-color)'; }}
            />
            <p style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-text-muted)',
              margin: 0,
            }}>
              Remplace "Palabre" dans l'interface visible par vos utilisateurs.
            </p>
          </div>

          {/* ── Couleurs ──────────────────────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--dev-space-4)',
          }}>
            <ColorField
              id="color-primary"
              label="Couleur primaire"
              value={colorPrimary}
              onChange={setColorPrimary}
            />
            <ColorField
              id="color-secondary"
              label="Couleur secondaire"
              value={colorSecondary}
              onChange={setColorSecondary}
            />
          </div>

          {/* ── Messages de feedback ───────────────────────────────────────── */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: 'var(--dev-space-3) var(--dev-space-4)',
                background: 'var(--dev-color-error-light)',
                border: '1px solid var(--dev-color-error)',
                borderRadius: 'var(--dev-border-radius-md)',
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-color-error)',
              }}
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dev-space-2)',
                padding: 'var(--dev-space-3) var(--dev-space-4)',
                background: 'var(--dev-color-success-light)',
                border: '1px solid var(--dev-color-success)',
                borderRadius: 'var(--dev-border-radius-md)',
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-color-success)',
              }}
            >
              <IconCheck />
              {successMsg}
            </div>
          )}

          {/* ── Bouton Sauvegarder ─────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={saving}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dev-space-2)',
              padding: 'var(--dev-space-3) var(--dev-space-6)',
              background: saving
                ? 'var(--dev-color-brand-primary-hover)'
                : 'var(--dev-color-brand-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.85 : 1,
              transition: 'background var(--dev-transition-fast), opacity var(--dev-transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.background = 'var(--dev-color-brand-primary-hover)';
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.background = 'var(--dev-color-brand-primary)';
            }}
          >
            {saving ? (
              <>
                <Spinner size={16} />
                Sauvegarde…
              </>
            ) : (
              <>
                <IconCheck />
                Sauvegarder
              </>
            )}
          </button>
        </form>

        {/* ─── Prévisualisation ─────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 'var(--dev-space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--dev-space-4)',
        }}>
          <p style={{
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            color: 'var(--dev-text-secondary)',
            margin: 0,
            textAlign: 'center',
          }}>
            Prévisualisation en temps réel
          </p>
          <ChatWidgetPreview
            displayName={displayName}
            colorPrimary={colorPrimary}
            colorSecondary={colorSecondary}
            logoUrl={logoPreview}
          />
        </div>
      </div>
    </section>
  );
}
