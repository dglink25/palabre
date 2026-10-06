/**
 * WhiteLabelConfig.jsx - Developer Portal
 *
 * Formulaire de configuration White-Label — design institutionnel.
 * Prévisualisation du widget sans gradient dans le header.
 * Icônes Lucide stroke-only, badges border-radius 4px.
 *
 * Requirements couverts : 11.1, 11.5
 */

import React, { useState, useRef, useCallback } from 'react';
import developerApi from '../api/developerApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const HEX_RE          = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_PRIMARY = '#1A73E8';
const DEFAULT_NAME    = 'Mon Application';

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 14 }) {
  return (
    <span
      role="status"
      aria-label="Chargement…"
      style={{
        display:        'inline-block',
        width:          size,
        height:         size,
        border:         '2px solid rgba(255,255,255,.3)',
        borderTopColor: '#fff',
        borderRadius:   '50%',
        animation:      'dev-spin 0.7s linear infinite',
        flexShrink:     0,
      }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHex(value) {
  if (!value) return '';
  return value.startsWith('#') ? value : `#${value}`;
}

function isValidHex(value) {
  return HEX_RE.test(value);
}

// ─── Color field ──────────────────────────────────────────────────────────────

function ColorField({ id, label, value, onChange }) {
  const [textValue, setTextValue] = useState(value);
  const [touched,   setTouched]   = useState(false);

  React.useEffect(() => { setTextValue(value); }, [value]);

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
    if (isValidHex(normalized)) onChange(normalized);
  }

  function handleTextBlur() {
    setTouched(true);
    const normalized = normalizeHex(textValue);
    if (isValidHex(normalized)) { setTextValue(normalized); onChange(normalized); }
  }

  const showError  = touched && !isValidHex(normalizeHex(textValue));
  const displayHex = isValidHex(normalizeHex(value)) ? value : DEFAULT_PRIMARY;

  const inputStyle = {
    flex:         1,
    padding:      '8px 10px',
    border:       `1px solid ${showError ? '#EA4335' : '#E0E0E0'}`,
    borderRadius: 8,
    fontSize:     13,
    fontFamily:   "'JetBrains Mono', 'Fira Code', monospace",
    color:        '#202124',
    background:   '#FFFFFF',
    outline:      'none',
    transition:   'border-color 150ms ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 13, fontWeight: 500, color: '#202124' }}
      >
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={displayHex}
          onChange={handlePickerChange}
          aria-label={`Sélecteur pour ${label}`}
          style={{
            width:        36,
            height:       36,
            padding:      2,
            border:       '1px solid #E0E0E0',
            borderRadius: 8,
            cursor:       'pointer',
            background:   'none',
            flexShrink:   0,
          }}
        />
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
          style={inputStyle}
          onFocus={(e) => { if (!showError) e.target.style.borderColor = '#1A73E8'; }}
        />
      </div>
      {showError && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{ fontSize: 12, color: '#EA4335', margin: 0 }}
        >
          Format invalide — utilisez <code>#RRGGBB</code>
        </p>
      )}
    </div>
  );
}

// ─── Prévisualisation widget ──────────────────────────────────────────────────

function ChatWidgetPreview({ displayName, colorPrimary, logoUrl }) {
  const name    = displayName || DEFAULT_NAME;
  const primary = isValidHex(colorPrimary) ? colorPrimary : DEFAULT_PRIMARY;

  const messages = [
    { id: 1, from: 'agent',   text: `Bonjour ! Comment puis-je vous aider ?` },
    { id: 2, from: 'visitor', text: 'J\'ai une question à vous poser.' },
    { id: 3, from: 'agent',   text: 'Bien sûr, je suis disponible !' },
  ];

  return (
    <div
      aria-label="Prévisualisation du widget"
      style={{
        width:        '100%',
        maxWidth:     300,
        borderRadius: 10,
        overflow:     'hidden',
        boxShadow:    '0 4px 16px rgba(32,33,36,.12)',
        border:       '1px solid #E0E0E0',
        fontFamily:   "'Inter', sans-serif",
        background:   '#FFFFFF',
      }}
    >
      {/* Header — fond plat couleur primaire */}
      <div
        style={{
          backgroundColor: primary,
          padding:         '14px 16px',
          display:         'flex',
          alignItems:      'center',
          gap:             10,
        }}
      >
        <div
          style={{
            width:           32,
            height:          32,
            borderRadius:    6,
            backgroundColor: 'rgba(255,255,255,.20)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            overflow:        'hidden',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700 }}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p style={{ margin: 0, color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}>{name}</p>
          <p style={{
            margin: 0,
            color:  'rgba(255,255,255,.8)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#4ade80', display: 'inline-block',
            }} />
            En ligne
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        padding:         12,
        display:         'flex',
        flexDirection:   'column',
        gap:             10,
        background:      '#F8F9FA',
        minHeight:       120,
      }}>
        {messages.map((msg) => {
          const isAgent = msg.from === 'agent';
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isAgent ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth:     '80%',
                padding:      '6px 10px',
                borderRadius: isAgent ? '4px 10px 10px 10px' : '10px 4px 10px 10px',
                background:   isAgent ? '#FFFFFF' : primary,
                color:        isAgent ? '#202124' : '#FFFFFF',
                fontSize:     12,
                lineHeight:   1.4,
                boxShadow:    '0 1px 2px rgba(32,33,36,.06)',
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input fictif */}
      <div style={{
        padding:        '10px 12px',
        borderTop:      '1px solid #E0E0E0',
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        background:     '#FFFFFF',
      }}>
        <div style={{
          flex:         1,
          height:       28,
          borderRadius: 999,
          background:   '#F1F3F4',
          border:       '1px solid #E0E0E0',
        }} />
        <button
          type="button"
          aria-label="Envoyer (aperçu)"
          tabIndex={-1}
          style={{
            width:           28,
            height:          28,
            borderRadius:    '50%',
            backgroundColor: primary,
            border:          'none',
            cursor:          'default',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           '#FFFFFF',
            flexShrink:      0,
          }}
        >
          <IconSend />
        </button>
      </div>

      {/* Powered by */}
      <div style={{
        padding:     '4px 12px',
        borderTop:   '1px solid #E0E0E0',
        background:  '#F8F9FA',
        textAlign:   'center',
      }}>
        <span style={{ fontSize: 10, color: '#9aa0a6' }}>
          Propulsé par <strong style={{ color: '#5F6368' }}>{name}</strong>
        </span>
      </div>
    </div>
  );
}

// ─── WhiteLabelConfig ─────────────────────────────────────────────────────────

export default function WhiteLabelConfig({ projectId, project }) {
  const [displayName,    setDisplayName]    = useState(project?.display_name    ?? '');
  const [colorPrimary,   setColorPrimary]   = useState(project?.color_primary   ?? DEFAULT_PRIMARY);
  const [colorSecondary, setColorSecondary] = useState(project?.color_secondary ?? '#1557b0');
  const [logoUrl,        setLogoUrl]        = useState(project?.logo_url        ?? '');
  const [logoPreview,    setLogoPreview]    = useState(project?.logo_url        ?? '');

  const [saving,      setSaving]      = useState(false);
  const [successMsg,  setSuccessMsg]  = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const fileInputRef = useRef(null);
  const successTimer = useRef(null);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Le fichier sélectionné n\'est pas une image valide.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('L\'image ne doit pas dépasser 2 Mo.');
      return;
    }
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setLogoPreview(dataUrl);
      setLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = useCallback(() => {
    setLogoUrl('');
    setLogoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  function getFormErrors() {
    const errors = [];
    if (!isValidHex(colorPrimary)) errors.push('La couleur primaire doit être au format #RRGGBB.');
    if (!isValidHex(colorSecondary)) errors.push('La couleur secondaire doit être au format #RRGGBB.');
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const errors = getFormErrors();
    if (errors.length > 0) { setErrorMsg(errors.join(' ')); return; }
    setSaving(true);
    try {
      await developerApi.patch(`/projects/${projectId}`, {
        display_name:    displayName.trim() || null,
        color_primary:   colorPrimary,
        color_secondary: colorSecondary,
        logo_url:        logoUrl || null,
      });
      setSuccessMsg('Configuration sauvegardée.');
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

  const inputStyle = {
    width:        '100%',
    padding:      '9px 12px',
    border:       '1px solid #E0E0E0',
    borderRadius: 8,
    fontFamily:   'inherit',
    fontSize:     14,
    color:        '#202124',
    background:   '#FFFFFF',
    outline:      'none',
    transition:   'border-color 150ms ease',
    boxSizing:    'border-box',
  };

  return (
    <section aria-label="Configuration White-Label">
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>
        Apparence du widget
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 24px' }}>
        Personnalisez l'interface visible par vos utilisateurs finaux. Les modifications
        sont propagées aux SDK actifs sous 5 minutes.
      </p>

      <div style={{
        display:             'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap:                 32,
        alignItems:          'start',
      }}>

        {/* Formulaire */}
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            background:   '#FFFFFF',
            border:       '1px solid #E0E0E0',
            borderRadius: 8,
            padding:      '24px',
            display:      'flex',
            flexDirection: 'column',
            gap:          20,
          }}
        >

          {/* Upload logo */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{
              fontSize: 13, fontWeight: 500, color: '#202124',
              marginBottom: 10, display: 'block',
            }}>
              Logo
            </legend>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Aperçu */}
              <div
                aria-label="Aperçu du logo"
                style={{
                  width:        64,
                  height:       64,
                  borderRadius: 8,
                  border:       '1px dashed #E0E0E0',
                  background:   '#F8F9FA',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  overflow:     'hidden',
                  flexShrink:   0,
                  color:        '#9aa0a6',
                }}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Aperçu"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <IconUpload />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          6,
                    padding:      '7px 14px',
                    background:   '#FFFFFF',
                    border:       '1px solid #E0E0E0',
                    borderRadius: 8,
                    fontSize:     13,
                    fontWeight:   500,
                    color:        '#202124',
                    cursor:       'pointer',
                    fontFamily:   'inherit',
                    transition:   'background 150ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F9FA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                >
                  <IconUpload />
                  {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
                </button>

                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    style={{
                      display:      'inline-flex',
                      alignItems:   'center',
                      gap:          4,
                      padding:      '4px 0',
                      background:   'none',
                      border:       'none',
                      fontSize:     12,
                      color:        '#EA4335',
                      cursor:       'pointer',
                      fontFamily:   'inherit',
                    }}
                  >
                    <IconX />
                    Supprimer
                  </button>
                )}

                <p style={{ fontSize: 11, color: '#9aa0a6', margin: 0 }}>
                  PNG, JPG, GIF, WebP ou SVG — 2 Mo max
                </p>
              </div>
            </div>
          </fieldset>

          {/* Nom d'affichage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label
              htmlFor="display-name"
              style={{ fontSize: 13, fontWeight: 500, color: '#202124' }}
            >
              Nom d'affichage
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={DEFAULT_NAME}
              maxLength={100}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = '#1A73E8'; }}
              onBlur={(e)  => { e.target.style.borderColor = '#E0E0E0'; }}
            />
            <p style={{ fontSize: 12, color: '#9aa0a6', margin: 0 }}>
              Remplace "Palabre" dans l'interface utilisateur.
            </p>
          </div>

          {/* Couleurs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

          {/* Feedback */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding:      '10px 14px',
                background:   'rgba(234,67,53,.06)',
                border:       '1px solid #EA4335',
                borderLeft:   '3px solid #EA4335',
                borderRadius: 8,
                fontSize:     13,
                color:        '#EA4335',
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
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                padding:      '10px 14px',
                background:   'rgba(52,168,83,.08)',
                border:       '1px solid #34A853',
                borderLeft:   '3px solid #34A853',
                borderRadius: 8,
                fontSize:     13,
                color:        '#34A853',
              }}
            >
              <IconCheck />
              {successMsg}
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={saving}
            style={{
              alignSelf:    'flex-start',
              display:      'inline-flex',
              alignItems:   'center',
              gap:          6,
              height:       40,
              padding:      '0 18px',
              background:   saving ? '#1557b0' : '#1A73E8',
              color:        '#FFFFFF',
              border:       'none',
              borderRadius: 8,
              fontSize:     14,
              fontWeight:   600,
              cursor:       saving ? 'not-allowed' : 'pointer',
              opacity:      saving ? 0.85 : 1,
              fontFamily:   'inherit',
              transition:   'background 150ms ease',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#1557b0'; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#1A73E8'; }}
          >
            {saving ? <Spinner size={14} /> : <IconCheck />}
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </form>

        {/* Prévisualisation */}
        <div style={{
          position:      'sticky',
          top:           24,
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
          alignItems:    'center',
        }}>
          <p style={{ fontSize: 12, color: '#5F6368', margin: 0, fontWeight: 500 }}>
            Prévisualisation
          </p>
          <ChatWidgetPreview
            displayName={displayName}
            colorPrimary={colorPrimary}
            logoUrl={logoPreview}
          />
        </div>
      </div>
    </section>
  );
}
