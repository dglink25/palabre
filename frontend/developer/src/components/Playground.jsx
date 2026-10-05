/**
 * Playground.jsx - Developer Portal
 *
 * Interface interactive permettant d'exécuter des requêtes API en temps réel
 * avec les clés du projet pré-remplies.
 *
 * Fonctionnalités :
 *   - Sélecteur d'endpoint (dropdown) des routes proxy (req 9.3)
 *   - Éditeur JSON pour le body (req 9.3)
 *   - Clés du projet pré-remplies depuis le contexte, non modifiables (req 9.3)
 *   - Bouton "Envoyer" → requête réelle, affichage statut HTTP + JSON formaté (req 9.3)
 *   - Bouton "Copier en cURL" → génère la commande curl équivalente (req 9.3)
 *
 * Requirements couverts : 9.3
 */

import { useState, useMemo, useCallback } from 'react';
import developerApi from '../api/developerApi';

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconSend({ size = 16 }) {
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
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconCopy({ size = 14 }) {
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

function IconCheck({ size = 14 }) {
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

function IconChevronDown({ size = 14 }) {
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return (
    <span
      role="status"
      aria-label="Envoi en cours…"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'dev-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Définition des endpoints disponibles ────────────────────────────────────

const ENDPOINTS = [
  {
    key:         'messages',
    label:       'POST /proxy/messages',
    method:      'POST',
    path:        '/proxy/messages',
    description: "Envoyer un message via l'infrastructure Palabre",
    auth:        'publishable',
    defaultBody: JSON.stringify(
      { to: 'user-id-destinataire', content: 'Bonjour depuis le Playground !' },
      null,
      2
    ),
  },
  {
    key:         'calls',
    label:       'POST /proxy/calls',
    method:      'POST',
    path:        '/proxy/calls',
    description: 'Initier un appel WebRTC (retourne les credentials TURN)',
    auth:        'publishable',
    defaultBody: JSON.stringify(
      { to: 'user-id-destinataire', type: 'audio' },
      null,
      2
    ),
  },
  {
    key:         'video',
    label:       'POST /proxy/video/rooms',
    method:      'POST',
    path:        '/proxy/video/rooms',
    description: 'Créer une room de vidéoconférence',
    auth:        'publishable',
    defaultBody: JSON.stringify(
      { room_name: 'my-meeting-room', max_participants: 10 },
      null,
      2
    ),
  },
  {
    key:         'push',
    label:       'POST /proxy/push',
    method:      'POST',
    path:        '/proxy/push',
    description: 'Envoyer une notification push via FCM',
    auth:        'publishable',
    defaultBody: JSON.stringify(
      { fcm_token: 'token-fcm-de-lappareil', title: 'Nouveau message', body: 'Vous avez reçu un message.' },
      null,
      2
    ),
  },
];

// ─── Utilitaire : générer la commande cURL ────────────────────────────────────

function buildCurlCommand(endpoint, publishableKey, bodyText) {
  const apiUrl = window.location.origin + '/api/v1/developer';
  const escapedBody = bodyText.replace(/'/g, "'\\''");

  return (
    `curl -X ${endpoint.method} '${apiUrl}${endpoint.path}' \\\n` +
    `  -H 'Content-Type: application/json' \\\n` +
    `  -H 'X-Palabre-Key: ${publishableKey || 'pk_live_VOTRE_CLE_ICI'}' \\\n` +
    `  -d '${escapedBody}'`
  );
}

// ─── Utilitaire : validation JSON ─────────────────────────────────────────────

function isValidJson(str) {
  if (!str.trim()) return true; // body vide = OK
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// ─── Badge de méthode HTTP ────────────────────────────────────────────────────

function MethodBadge({ method }) {
  const colors = {
    GET:    { bg: '#dbeafe', color: '#1d4ed8' },
    POST:   { bg: '#dcfce7', color: '#15803d' },
    PATCH:  { bg: '#fef3c7', color: '#b45309' },
    DELETE: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const style = colors[method] ?? colors.POST;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        background: style.bg,
        color: style.color,
        fontSize: 'var(--dev-font-size-xs)',
        fontWeight: 'var(--dev-font-weight-bold)',
        borderRadius: 'var(--dev-border-radius-sm)',
        fontFamily: 'var(--dev-font-family-mono)',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {method}
    </span>
  );
}

// ─── Badge de statut HTTP ─────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status) return null;

  let bg, color;
  if (status >= 200 && status < 300) {
    bg = 'var(--dev-color-success-light)';
    color = 'var(--dev-color-success)';
  } else if (status >= 400 && status < 500) {
    bg = 'var(--dev-color-warning-light)';
    color = 'var(--dev-color-warning)';
  } else {
    bg = 'var(--dev-color-error-light)';
    color = 'var(--dev-color-error)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 'var(--dev-border-radius-full)',
        background: bg,
        color,
        fontSize: 'var(--dev-font-size-xs)',
        fontWeight: 'var(--dev-font-weight-semibold)',
        fontFamily: 'var(--dev-font-family-mono)',
      }}
    >
      {status}
    </span>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * Playground
 *
 * Props :
 *   - project  : objet projet contenant les clés (publishable_key, keys, etc.)
 */
export default function Playground({ project }) {
  const [selectedEndpointKey, setSelectedEndpointKey] = useState(ENDPOINTS[0].key);
  const [bodyText, setBodyText]                       = useState(ENDPOINTS[0].defaultBody);
  const [sending, setSending]                         = useState(false);
  const [response, setResponse]                       = useState(null); // { status, data, error }
  const [copiedCurl, setCopiedCurl]                   = useState(false);
  const [jsonError, setJsonError]                     = useState('');

  // Extraire les clés depuis l'objet projet (plusieurs formes possibles)
  const publishableKey =
    project?.keys?.publishable ||
    project?.publishable_key ||
    project?.api_keys?.find?.((k) => k.key_type === 'publishable')?.key_value ||
    null;

  const selectedEndpoint = ENDPOINTS.find((e) => e.key === selectedEndpointKey) ?? ENDPOINTS[0];

  // Commande cURL mémoïsée
  const curlCommand = useMemo(
    () => buildCurlCommand(selectedEndpoint, publishableKey, bodyText),
    [selectedEndpoint, publishableKey, bodyText]
  );

  // ── Gestion du changement d'endpoint ──────────────────────────────────────

  function handleEndpointChange(e) {
    const key = e.target.value;
    setSelectedEndpointKey(key);
    const ep = ENDPOINTS.find((x) => x.key === key);
    if (ep) setBodyText(ep.defaultBody);
    setResponse(null);
    setJsonError('');
  }

  // ── Gestion du body JSON ──────────────────────────────────────────────────

  function handleBodyChange(e) {
    const val = e.target.value;
    setBodyText(val);
    if (val.trim() && !isValidJson(val)) {
      setJsonError('JSON invalide - vérifiez la syntaxe.');
    } else {
      setJsonError('');
    }
  }

  // ── Envoi de la requête ───────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!isValidJson(bodyText)) {
      setJsonError('Corrigez le JSON avant d\'envoyer.');
      return;
    }

    setSending(true);
    setResponse(null);

    let parsedBody = null;
    if (bodyText.trim()) {
      try { parsedBody = JSON.parse(bodyText); } catch { /* already validated */ }
    }

    try {
      const { data, status } = await developerApi.request({
        method:  selectedEndpoint.method,
        url:     selectedEndpoint.path,
        data:    parsedBody,
        headers: publishableKey
          ? { 'X-Palabre-Key': publishableKey }
          : {},
      });
      setResponse({ status, data });
    } catch (err) {
      const status = err.response?.status ?? 0;
      const data   = err.response?.data ?? { error: err.message };
      setResponse({ status, data, isError: true });
    } finally {
      setSending(false);
    }
  }, [selectedEndpoint, bodyText, publishableKey]);

  // ── Copie de la commande cURL ─────────────────────────────────────────────

  async function handleCopyCurl() {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      // Fallback silencieux
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ─── Avertissement si clé manquante ─────────────────────────────── */}
      {!publishableKey && (
        <div
          role="alert"
          style={{
            padding: 'var(--dev-space-3) var(--dev-space-4)',
            background: 'var(--dev-color-warning-light)',
            border: '1px solid var(--dev-color-warning)',
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-sm)',
            color: 'var(--dev-color-warning)',
            marginBottom: 'var(--dev-space-5)',
          }}
        >
          Les clés du projet ne sont pas chargées. Les requêtes seront envoyées sans
          authentification - allez dans l'onglet <strong>Clés API</strong> pour les voir.
        </div>
      )}

      {/* ─── Sélecteur d'endpoint ────────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--dev-space-4)' }}>
        <label
          htmlFor="pg-endpoint"
          style={{
            display: 'block',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            color: 'var(--dev-text-primary)',
            marginBottom: 'var(--dev-space-2)',
          }}
        >
          Endpoint
        </label>
        <div style={{ position: 'relative' }}>
          <select
            id="pg-endpoint"
            value={selectedEndpointKey}
            onChange={handleEndpointChange}
            style={{
              width: '100%',
              padding: 'var(--dev-space-3) var(--dev-space-10) var(--dev-space-3) var(--dev-space-4)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-sm)',
              color: 'var(--dev-text-primary)',
              background: 'var(--dev-bg-surface)',
              appearance: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--dev-font-family-mono)',
              outline: 'none',
            }}
          >
            {ENDPOINTS.map((ep) => (
              <option key={ep.key} value={ep.key}>
                {ep.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 'var(--dev-space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--dev-text-muted)',
            }}
          >
            <IconChevronDown size={16} />
          </span>
        </div>
        {/* Description de l'endpoint */}
        <p
          style={{
            fontSize: 'var(--dev-font-size-xs)',
            color: 'var(--dev-text-muted)',
            marginTop: 'var(--dev-space-1)',
            marginBottom: 0,
          }}
        >
          <MethodBadge method={selectedEndpoint.method} />
          {' '}
          {selectedEndpoint.description}
        </p>
      </div>

      {/* ─── Clés pré-remplies (lecture seule) ──────────────────────────── */}
      <div style={{ marginBottom: 'var(--dev-space-4)' }}>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            color: 'var(--dev-text-primary)',
            marginBottom: 'var(--dev-space-2)',
          }}
        >
          Authentification
        </label>
        <div
          style={{
            padding: 'var(--dev-space-3) var(--dev-space-4)',
            background: 'var(--dev-color-neutral-100)',
            border: '1px solid var(--dev-border-color)',
            borderRadius: 'var(--dev-border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--dev-space-3)',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              fontWeight: 'var(--dev-font-weight-medium)',
              color: 'var(--dev-text-secondary)',
              flexShrink: 0,
            }}
          >
            X-Palabre-Key
          </span>
          <code
            style={{
              flex: 1,
              fontSize: 'var(--dev-font-size-xs)',
              fontFamily: 'var(--dev-font-family-mono)',
              color: publishableKey
                ? 'var(--dev-color-brand-primary)'
                : 'var(--dev-text-muted)',
              background: 'none',
              padding: 0,
              overflowWrap: 'break-word',
              wordBreak: 'break-all',
            }}
          >
            {publishableKey || 'pk_live_… (clé non chargée)'}
          </code>
          <span
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-text-muted)',
              fontStyle: 'italic',
              flexShrink: 0,
            }}
          >
            lecture seule
          </span>
        </div>
      </div>

      {/* ─── Éditeur JSON ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--dev-space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--dev-space-2)',
          }}
        >
          <label
            htmlFor="pg-body"
            style={{
              fontSize: 'var(--dev-font-size-sm)',
              fontWeight: 'var(--dev-font-weight-medium)',
              color: 'var(--dev-text-primary)',
            }}
          >
            Corps de la requête (JSON)
          </label>
          {jsonError && (
            <span
              role="alert"
              style={{
                fontSize: 'var(--dev-font-size-xs)',
                color: 'var(--dev-color-error)',
              }}
            >
              {jsonError}
            </span>
          )}
        </div>
        <textarea
          id="pg-body"
          value={bodyText}
          onChange={handleBodyChange}
          rows={10}
          spellCheck={false}
          aria-label="Corps de la requête JSON"
          aria-describedby={jsonError ? 'pg-json-error' : undefined}
          style={{
            width: '100%',
            padding: 'var(--dev-space-4)',
            background: 'var(--dev-color-neutral-900)',
            color: jsonError ? '#fca5a5' : '#e2e8f0',
            border: `1px solid ${jsonError ? 'var(--dev-color-error)' : 'var(--dev-color-neutral-700)'}`,
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-xs)',
            fontFamily: 'var(--dev-font-family-mono)',
            lineHeight: 1.7,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            tabSize: 2,
          }}
          onFocus={(e) => {
            if (!jsonError) e.target.style.borderColor = 'var(--dev-border-color-focus)';
          }}
          onBlur={(e) => {
            if (!jsonError) e.target.style.borderColor = 'var(--dev-color-neutral-700)';
          }}
        />
      </div>

      {/* ─── Boutons d'action ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--dev-space-3)',
          flexWrap: 'wrap',
          marginBottom: 'var(--dev-space-6)',
        }}
      >
        {/* Bouton Envoyer */}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !!jsonError}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--dev-space-2)',
            padding: 'var(--dev-space-3) var(--dev-space-5)',
            background:
              sending || jsonError
                ? 'var(--dev-color-neutral-300)'
                : 'var(--dev-color-brand-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-semibold)',
            cursor: sending || jsonError ? 'not-allowed' : 'pointer',
            transition: 'background var(--dev-transition-fast)',
          }}
        >
          {sending ? <Spinner size={16} /> : <IconSend size={16} />}
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>

        {/* Bouton Copier en cURL */}
        <button
          type="button"
          onClick={handleCopyCurl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--dev-space-2)',
            padding: 'var(--dev-space-3) var(--dev-space-5)',
            background: copiedCurl
              ? 'var(--dev-color-success)'
              : 'var(--dev-bg-surface)',
            color: copiedCurl
              ? 'white'
              : 'var(--dev-text-secondary)',
            border: `1px solid ${copiedCurl ? 'var(--dev-color-success)' : 'var(--dev-border-color)'}`,
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            cursor: 'pointer',
            transition:
              'background var(--dev-transition-fast), color var(--dev-transition-fast), border-color var(--dev-transition-fast)',
          }}
        >
          {copiedCurl ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {copiedCurl ? 'Copié !' : 'Copier en cURL'}
        </button>
      </div>

      {/* ─── Commande cURL prévisualisée ────────────────────────────────── */}
      <div
        style={{
          marginBottom: 'var(--dev-space-6)',
          background: 'var(--dev-color-neutral-900)',
          borderRadius: 'var(--dev-border-radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--dev-space-2) var(--dev-space-4)',
            borderBottom: '1px solid var(--dev-color-neutral-700)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--dev-font-size-xs)',
              color: 'var(--dev-color-neutral-400)',
              fontWeight: 'var(--dev-font-weight-medium)',
            }}
          >
            cURL
          </span>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 'var(--dev-space-4)',
            overflowX: 'auto',
            fontSize: 'var(--dev-font-size-xs)',
            lineHeight: 1.7,
            color: '#94a3b8',
            fontFamily: 'var(--dev-font-family-mono)',
            whiteSpace: 'pre',
          }}
        >
          <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 'inherit' }}>
            {curlCommand}
          </code>
        </pre>
      </div>

      {/* ─── Réponse ─────────────────────────────────────────────────────── */}
      {response && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--dev-space-3)',
              marginBottom: 'var(--dev-space-3)',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                fontWeight: 'var(--dev-font-weight-semibold)',
                color: 'var(--dev-text-primary)',
                margin: 0,
              }}
            >
              Réponse
            </h3>
            <StatusBadge status={response.status} />
          </div>

          <div
            style={{
              background: 'var(--dev-color-neutral-900)',
              borderRadius: 'var(--dev-border-radius-md)',
              overflow: 'hidden',
              border: `1px solid ${
                response.isError
                  ? 'var(--dev-color-error)'
                  : 'var(--dev-color-neutral-700)'
              }`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--dev-space-2) var(--dev-space-4)',
                borderBottom: '1px solid var(--dev-color-neutral-700)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--dev-font-size-xs)',
                  color: 'var(--dev-color-neutral-400)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                }}
              >
                JSON
              </span>
              <CopyResponseButton data={response.data} />
            </div>
            <pre
              style={{
                margin: 0,
                padding: 'var(--dev-space-5)',
                overflowX: 'auto',
                maxHeight: 400,
                overflowY: 'auto',
                fontSize: 'var(--dev-font-size-xs)',
                lineHeight: 1.7,
                color: response.isError ? '#fca5a5' : '#86efac',
                fontFamily: 'var(--dev-font-family-mono)',
                whiteSpace: 'pre',
              }}
            >
              <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 'inherit' }}>
                {JSON.stringify(response.data, null, 2)}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : bouton copie de la réponse ──────────────────────────────

function CopyResponseButton({ data }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencieux
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copier la réponse JSON"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: copied
          ? 'var(--dev-color-success)'
          : 'var(--dev-color-neutral-700)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--dev-border-radius-sm)',
        fontSize: 'var(--dev-font-size-xs)',
        cursor: 'pointer',
        transition: 'background var(--dev-transition-fast)',
      }}
    >
      {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
}
