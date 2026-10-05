/**
 * DocumentationPage.jsx - Developer Portal
 *
 * Page de documentation du projet avec navigation latérale par section.
 * Utilisée comme onglet dans ProjectPage (tab=docs).
 *
 * Fonctionnalités :
 *   - Layout avec navigation latérale par section (req 9.3)
 *   - Section Playground : requêtes API interactives avec les clés du projet (req 9.3)
 *   - Section Démarrage rapide : guides avec extraits de code (req 9.4)
 *   - Section Référence API : documentation des endpoints (req 9.3)
 *   - Section Webhooks : documentation des événements + vérification de signature
 *   - Extraits régénérés automatiquement quand les clés changent (req 9.5)
 *
 * Requirements couverts : 9.3, 9.4, 9.5
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Playground  from '../components/Playground.jsx';
import CodeSnippet from '../components/CodeSnippet.jsx';

// ─── Définition des sections de la documentation ─────────────────────────────

const SECTIONS = [
  { id: 'quickstart',  label: 'Démarrage rapide' },
  { id: 'playground',  label: 'Playground'        },
  { id: 'api-ref',     label: 'Référence API'      },
  { id: 'webhooks',    label: 'Webhooks'           },
  { id: 'auth',        label: 'Authentification'   },
];

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconBook({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconTerminal({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconCode({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconWebhook({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 16.016c0 1.648-1.352 3-3 3H5.016A3 3 0 0 1 2 15.984V8a3 3 0 0 1 3-3h10.016" />
      <path d="M14 8l4-4 4 4" />
      <path d="M18 4v8" />
    </svg>
  );
}

function IconKey({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconChevronRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Mapping section → icône ──────────────────────────────────────────────────

const SECTION_ICONS = {
  quickstart: <IconBook size={15} />,
  playground: <IconTerminal size={15} />,
  'api-ref':  <IconCode size={15} />,
  webhooks:   <IconWebhook size={15} />,
  auth:       <IconKey size={15} />,
};

// ─── Badge de méthode HTTP ────────────────────────────────────────────────────

function MethodBadge({ method }) {
  const colors = {
    GET:    { bg: '#dbeafe', color: '#1d4ed8' },
    POST:   { bg: '#dcfce7', color: '#15803d' },
    PATCH:  { bg: '#fef3c7', color: '#b45309' },
    DELETE: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const s = colors[method] ?? colors.POST;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        background: s.bg,
        color: s.color,
        fontSize: '0.7rem',
        fontWeight: 700,
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

// ─── Ligne de tableau d'endpoint ─────────────────────────────────────────────

function EndpointRow({ method, path, description, auth }) {
  const authColors = {
    'SSO JWT':             { bg: '#ede9fe', color: '#6d28d9' },
    'X-Palabre-Key':       { bg: '#dbeafe', color: '#1d4ed8' },
    'X-Palabre-Secret':    { bg: '#fee2e2', color: '#b91c1c' },
    'Aucune':              { bg: 'var(--dev-color-neutral-100)', color: 'var(--dev-text-muted)' },
  };
  const ac = authColors[auth] ?? authColors['Aucune'];

  return (
    <tr>
      <td
        style={{
          padding: 'var(--dev-space-3) var(--dev-space-4)',
          borderBottom: '1px solid var(--dev-border-color)',
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
        }}
      >
        <MethodBadge method={method} />
      </td>
      <td
        style={{
          padding: 'var(--dev-space-3) var(--dev-space-4)',
          borderBottom: '1px solid var(--dev-border-color)',
          fontFamily: 'var(--dev-font-family-mono)',
          fontSize: 'var(--dev-font-size-xs)',
          color: 'var(--dev-color-brand-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        {path}
      </td>
      <td
        style={{
          padding: 'var(--dev-space-3) var(--dev-space-4)',
          borderBottom: '1px solid var(--dev-border-color)',
          fontSize: 'var(--dev-font-size-sm)',
          color: 'var(--dev-text-secondary)',
        }}
      >
        {description}
      </td>
      <td
        style={{
          padding: 'var(--dev-space-3) var(--dev-space-4)',
          borderBottom: '1px solid var(--dev-border-color)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            background: ac.bg,
            color: ac.color,
            fontSize: 'var(--dev-font-size-xs)',
            fontWeight: 'var(--dev-font-weight-medium)',
            borderRadius: 'var(--dev-border-radius-sm)',
            fontFamily: 'var(--dev-font-family-mono)',
          }}
        >
          {auth}
        </span>
      </td>
    </tr>
  );
}

// ─── Section : Démarrage rapide ───────────────────────────────────────────────

function SectionQuickstart({ project }) {
  return (
    <section id="quickstart">
      <h2
        style={{
          fontSize: 'var(--dev-font-size-2xl)',
          fontWeight: 'var(--dev-font-weight-bold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-2)',
          marginTop: 0,
        }}
      >
        Démarrage rapide
      </h2>
      <p
        style={{
          fontSize: 'var(--dev-font-size-base)',
          color: 'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-8)',
          lineHeight: 'var(--dev-line-height-loose)',
        }}
      >
        Intégrez les fonctionnalités de communication Palabre dans votre application en quelques
        minutes. Choisissez votre framework ci-dessous - les extraits utilisent automatiquement
        les vraies clés de votre projet.
      </p>

      <CodeSnippet project={project} />
    </section>
  );
}

// ─── Section : Playground ─────────────────────────────────────────────────────

function SectionPlayground({ project }) {
  return (
    <section id="playground">
      <h2
        style={{
          fontSize: 'var(--dev-font-size-2xl)',
          fontWeight: 'var(--dev-font-weight-bold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-2)',
          marginTop: 0,
        }}
      >
        Playground
      </h2>
      <p
        style={{
          fontSize: 'var(--dev-font-size-base)',
          color: 'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-6)',
          lineHeight: 'var(--dev-line-height-loose)',
        }}
      >
        Testez les endpoints de l'API directement depuis le portail. Les clés de votre
        projet sont pré-remplies - aucune configuration supplémentaire requise.
      </p>

      <div
        style={{
          background: 'var(--dev-bg-surface)',
          border: '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-xl)',
          padding: 'var(--dev-space-6)',
          boxShadow: 'var(--dev-shadow-sm)',
        }}
      >
        <Playground project={project} />
      </div>
    </section>
  );
}

// ─── Section : Référence API ──────────────────────────────────────────────────

function SectionApiRef() {
  const endpoints = [
    { method: 'POST',   path: '/accounts/me',                       description: 'Crée ou retourne le compte développeur (upsert)',               auth: 'SSO JWT'          },
    { method: 'GET',    path: '/accounts/me',                       description: "Retourne le compte développeur de l'utilisateur courant",        auth: 'SSO JWT'          },
    { method: 'GET',    path: '/projects',                          description: 'Liste tous les projets du compte développeur',                   auth: 'SSO JWT'          },
    { method: 'POST',   path: '/projects',                          description: 'Crée un nouveau projet (génère pk_ et sk_ automatiquement)',      auth: 'SSO JWT'          },
    { method: 'GET',    path: '/projects/:id',                      description: "Détails d'un projet (clés, config white-label, webhooks)",        auth: 'SSO JWT'          },
    { method: 'PATCH',  path: '/projects/:id',                      description: 'Met à jour les métadonnées du projet',                           auth: 'SSO JWT'          },
    { method: 'DELETE', path: '/projects/:id',                      description: 'Soft-delete du projet, révoque les clés',                        auth: 'SSO JWT'          },
    { method: 'GET',    path: '/projects/:id/keys',                 description: 'Liste les clés actives du projet (secret masquée)',               auth: 'SSO JWT'          },
    { method: 'POST',   path: '/projects/:id/keys/rotate',          description: "Rotation d'une clé (type dans le body)",                         auth: 'SSO JWT'          },
    { method: 'GET',    path: '/projects/:id/config',               description: 'White_Label_Config publique (utilisée par les SDK)',              auth: 'X-Palabre-Key'    },
    { method: 'POST',   path: '/proxy/messages',                    description: "Envoie un message via l'infra Palabre",                           auth: 'X-Palabre-Key'    },
    { method: 'POST',   path: '/proxy/calls',                       description: 'Initie un appel WebRTC, retourne les credentials TURN',           auth: 'X-Palabre-Key'    },
    { method: 'POST',   path: '/proxy/video/rooms',                 description: 'Crée une room Jitsi, retourne le token de session',               auth: 'X-Palabre-Key'    },
    { method: 'POST',   path: '/proxy/push',                        description: 'Envoie une notification push via FCM',                            auth: 'X-Palabre-Key'    },
    { method: 'GET',    path: '/projects/:id/webhooks',             description: 'Liste les webhooks du projet',                                   auth: 'SSO JWT'          },
    { method: 'POST',   path: '/projects/:id/webhooks',             description: 'Crée un webhook (url HTTPS, events[])',                          auth: 'SSO JWT'          },
    { method: 'PATCH',  path: '/projects/:id/webhooks/:wid',        description: "Met à jour l'url ou les events d'un webhook",                    auth: 'SSO JWT'          },
    { method: 'DELETE', path: '/projects/:id/webhooks/:wid',        description: 'Supprime un webhook',                                            auth: 'SSO JWT'          },
    { method: 'GET',    path: '/projects/:id/webhooks/deliveries',  description: 'Historique des 100 dernières livraisons',                        auth: 'SSO JWT'          },
    { method: 'GET',    path: '/projects/:id/stats',                description: "Statistiques d'usage (filtrage par période)",                    auth: 'SSO JWT'          },
    { method: 'GET',    path: '/docs',                              description: 'Documentation OpenAPI 3.0 JSON',                                  auth: 'Aucune'           },
  ];

  return (
    <section id="api-ref">
      <h2
        style={{
          fontSize: 'var(--dev-font-size-2xl)',
          fontWeight: 'var(--dev-font-weight-bold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-2)',
          marginTop: 0,
        }}
      >
        Référence API
      </h2>
      <p
        style={{
          fontSize: 'var(--dev-font-size-base)',
          color: 'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-6)',
          lineHeight: 'var(--dev-line-height-loose)',
        }}
      >
        Toutes les routes sont préfixées par <code>/api/v1/developer</code>. La
        documentation OpenAPI complète est disponible sur{' '}
        <a href="/api/v1/developer/docs" target="_blank" rel="noopener noreferrer">
          /api/v1/developer/docs
        </a>.
      </p>

      <div
        style={{
          background: 'var(--dev-bg-surface)',
          border: '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--dev-shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--dev-font-size-sm)',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--dev-color-neutral-50)',
                  borderBottom: '1px solid var(--dev-border-color)',
                }}
              >
                {['Méthode', 'Chemin', 'Description', 'Authentification'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: 'var(--dev-space-3) var(--dev-space-4)',
                      textAlign: 'left',
                      fontSize: 'var(--dev-font-size-xs)',
                      fontWeight: 'var(--dev-font-weight-semibold)',
                      color: 'var(--dev-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <EndpointRow key={i} {...ep} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── Section : Webhooks ───────────────────────────────────────────────────────

function SectionWebhooks({ project }) {
  const webhookSecret = '••••••••••••••••'; // affiché comme placeholder

  const eventTypes = [
    { type: 'message.received', description: 'Un message a été reçu par un utilisateur de votre projet.' },
    { type: 'call.started',     description: 'Un appel a commencé.'                                       },
    { type: 'call.ended',       description: "Un appel s'est terminé."                                    },
    { type: 'call.missed',      description: "Un appel entrant n'a pas été décroché."                     },
    { type: 'user.online',      description: 'Un utilisateur est passé en ligne.'                         },
    { type: 'user.offline',     description: 'Un utilisateur est passé hors ligne.'                       },
    { type: 'notification.sent',description: 'Une notification push a été envoyée.'                       },
  ];

  const verificationSnippet = `// Vérification de la signature HMAC-SHA256 d'un webhook
// Node.js
const crypto = require('crypto');

function verifyWebhookSignature(body, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

// Express.js middleware
app.post('/webhooks/palabre', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-palabre-signature'];
  const webhookSecret = process.env.PALABRE_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(req.body.toString(), signature, webhookSecret)) {
    return res.status(403).json({ error: 'Signature invalide' });
  }

  const event = JSON.parse(req.body);
  const eventType = req.headers['x-palabre-event'];

  switch (eventType) {
    case 'message.received':
      console.log('Nouveau message :', event);
      break;
    case 'call.started':
      console.log('Appel démarré :', event);
      break;
    // ...
  }

  res.status(200).send('OK');
});`;

  return (
    <section id="webhooks">
      <h2
        style={{
          fontSize: 'var(--dev-font-size-2xl)',
          fontWeight: 'var(--dev-font-weight-bold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-2)',
          marginTop: 0,
        }}
      >
        Webhooks
      </h2>
      <p
        style={{
          fontSize: 'var(--dev-font-size-base)',
          color: 'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-6)',
          lineHeight: 'var(--dev-line-height-loose)',
        }}
      >
        Les webhooks vous permettent de recevoir des notifications en temps réel
        sur votre serveur quand des événements se produisent. Configurez vos endpoints
        HTTPS dans l'onglet <strong>Webhooks</strong> du projet.
      </p>

      {/* Types d'événements */}
      <h3
        style={{
          fontSize: 'var(--dev-font-size-lg)',
          fontWeight: 'var(--dev-font-weight-semibold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-4)',
          marginTop: 'var(--dev-space-6)',
        }}
      >
        Événements disponibles
      </h3>
      <div
        style={{
          background: 'var(--dev-bg-surface)',
          border: '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-xl)',
          overflow: 'hidden',
          marginBottom: 'var(--dev-space-6)',
          boxShadow: 'var(--dev-shadow-sm)',
        }}
      >
        {eventTypes.map((ev, i) => (
          <div
            key={ev.type}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--dev-space-4)',
              padding: 'var(--dev-space-4)',
              borderBottom:
                i < eventTypes.length - 1
                  ? '1px solid var(--dev-border-color)'
                  : 'none',
            }}
          >
            <code
              style={{
                flexShrink: 0,
                fontSize: 'var(--dev-font-size-xs)',
                fontFamily: 'var(--dev-font-family-mono)',
                color: 'var(--dev-color-brand-primary)',
                background: 'var(--dev-color-neutral-100)',
                padding: '2px 8px',
                borderRadius: 'var(--dev-border-radius-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              {ev.type}
            </code>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-secondary)',
                paddingTop: 2,
              }}
            >
              {ev.description}
            </p>
          </div>
        ))}
      </div>

      {/* En-têtes envoyés */}
      <h3
        style={{
          fontSize: 'var(--dev-font-size-lg)',
          fontWeight: 'var(--dev-font-weight-semibold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-4)',
          marginTop: 'var(--dev-space-6)',
        }}
      >
        En-têtes de la requête
      </h3>
      <div
        style={{
          background: 'var(--dev-bg-surface)',
          border: '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-xl)',
          overflow: 'hidden',
          marginBottom: 'var(--dev-space-6)',
          boxShadow: 'var(--dev-shadow-sm)',
        }}
      >
        {[
          { header: 'X-Palabre-Signature', value: 'sha256=hmac(secret, timestamp.body)' },
          { header: 'X-Palabre-Event',     value: 'message.received | call.started | …'  },
          { header: 'X-Palabre-Timestamp', value: 'timestamp Unix en secondes'            },
          { header: 'Content-Type',        value: 'application/json'                      },
        ].map((row, i, arr) => (
          <div
            key={row.header}
            style={{
              display: 'flex',
              gap: 'var(--dev-space-4)',
              padding: 'var(--dev-space-3) var(--dev-space-4)',
              borderBottom:
                i < arr.length - 1 ? '1px solid var(--dev-border-color)' : 'none',
              flexWrap: 'wrap',
            }}
          >
            <code
              style={{
                flexShrink: 0,
                minWidth: 220,
                fontSize: 'var(--dev-font-size-xs)',
                fontFamily: 'var(--dev-font-family-mono)',
                color: 'var(--dev-color-neutral-800)',
                fontWeight: 'var(--dev-font-weight-semibold)',
                background: 'none',
                padding: 0,
              }}
            >
              {row.header}
            </code>
            <span
              style={{
                fontSize: 'var(--dev-font-size-xs)',
                color: 'var(--dev-text-muted)',
                fontFamily: 'var(--dev-font-family-mono)',
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Vérification de signature */}
      <h3
        style={{
          fontSize: 'var(--dev-font-size-lg)',
          fontWeight: 'var(--dev-font-weight-semibold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-4)',
          marginTop: 'var(--dev-space-6)',
        }}
      >
        Vérification de la signature
      </h3>
      <p
        style={{
          fontSize: 'var(--dev-font-size-sm)',
          color: 'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-4)',
          lineHeight: 'var(--dev-line-height-loose)',
        }}
      >
        Chaque webhook est signé avec HMAC-SHA256. Vérifiez toujours la signature
        avant de traiter l'événement pour vous assurer qu'il provient bien de Palabre.
      </p>
      <div
        style={{
          background: 'var(--dev-color-neutral-900)',
          borderRadius: 'var(--dev-border-radius-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--dev-space-2) var(--dev-space-4)',
            borderBottom: '1px solid var(--dev-color-neutral-700)',
            fontSize: 'var(--dev-font-size-xs)',
            color: 'var(--dev-color-neutral-400)',
          }}
        >
          Node.js / Express
        </div>
        <pre
          style={{
            margin: 0,
            padding: 'var(--dev-space-5)',
            overflowX: 'auto',
            fontSize: 'var(--dev-font-size-xs)',
            lineHeight: 1.7,
            color: '#e2e8f0',
            fontFamily: 'var(--dev-font-family-mono)',
            whiteSpace: 'pre',
          }}
        >
          <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 'inherit' }}>
            {verificationSnippet}
          </code>
        </pre>
      </div>
    </section>
  );
}

// ─── Section : Authentification ───────────────────────────────────────────────

function SectionAuth({ project }) {
  const publishableKey =
    project?.keys?.publishable ||
    project?.publishable_key ||
    project?.api_keys?.find?.((k) => k.key_type === 'publishable')?.key_value ||
    'pk_live_VOTRE_CLE_ICI';

  return (
    <section id="auth">
      <h2
        style={{
          fontSize: 'var(--dev-font-size-2xl)',
          fontWeight: 'var(--dev-font-weight-bold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-2)',
          marginTop: 0,
        }}
      >
        Authentification
      </h2>
      <p
        style={{
          fontSize: 'var(--dev-font-size-base)',
          color: 'var(--dev-text-secondary)',
          marginBottom: 'var(--dev-space-6)',
          lineHeight: 'var(--dev-line-height-loose)',
        }}
      >
        L'API utilise deux types de clés selon le contexte d'appel.
      </p>

      {/* Carte Publishable Key */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 'var(--dev-space-5)',
          marginBottom: 'var(--dev-space-6)',
        }}
      >
        {[
          {
            title:   'Publishable Key',
            prefix:  'pk_live_',
            header:  'X-Palabre-Key',
            color:   'var(--dev-color-brand-primary)',
            bg:      '#dbeafe',
            desc:    'Clé publique utilisable côté client (navigateur, application mobile). Donne accès aux routes /proxy/*.',
            routes:  ['/proxy/messages', '/proxy/calls', '/proxy/video/rooms', '/proxy/push'],
          },
          {
            title:   'Secret Key',
            prefix:  'sk_live_',
            header:  'X-Palabre-Secret',
            color:   '#b91c1c',
            bg:      '#fee2e2',
            desc:    "Clé privée à utiliser exclusivement côté serveur. Ne l'exposez jamais dans votre code client.",
            routes:  ['Opérations sensibles côté serveur'],
          },
        ].map((card) => (
          <div
            key={card.title}
            style={{
              background: 'var(--dev-bg-surface)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-xl)',
              padding: 'var(--dev-space-5)',
              boxShadow: 'var(--dev-shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dev-space-3)',
                marginBottom: 'var(--dev-space-3)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  background: card.bg,
                  color: card.color,
                  fontSize: 'var(--dev-font-size-xs)',
                  fontWeight: 'var(--dev-font-weight-semibold)',
                  borderRadius: 'var(--dev-border-radius-full)',
                  fontFamily: 'var(--dev-font-family-mono)',
                  letterSpacing: '0.04em',
                }}
              >
                {card.prefix}…
              </span>
              <strong
                style={{
                  fontSize: 'var(--dev-font-size-base)',
                  fontWeight: 'var(--dev-font-weight-semibold)',
                  color: 'var(--dev-text-primary)',
                }}
              >
                {card.title}
              </strong>
            </div>
            <p
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-secondary)',
                marginBottom: 'var(--dev-space-3)',
                lineHeight: 'var(--dev-line-height-normal)',
              }}
            >
              {card.desc}
            </p>
            <div
              style={{
                padding: 'var(--dev-space-2) var(--dev-space-3)',
                background: 'var(--dev-color-neutral-100)',
                borderRadius: 'var(--dev-border-radius-md)',
                marginBottom: 'var(--dev-space-3)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--dev-font-size-xs)',
                  color: 'var(--dev-text-muted)',
                }}
              >
                En-tête HTTP requis
              </p>
              <code
                style={{
                  fontSize: 'var(--dev-font-size-xs)',
                  fontFamily: 'var(--dev-font-family-mono)',
                  color: card.color,
                  background: 'none',
                  padding: 0,
                }}
              >
                {card.header}: {card.title === 'Publishable Key' ? publishableKey : 'sk_live_…'}
              </code>
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 var(--dev-space-1) 0',
                  fontSize: 'var(--dev-font-size-xs)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                  color: 'var(--dev-text-secondary)',
                }}
              >
                Routes autorisées
              </p>
              {card.routes.map((r) => (
                <div
                  key={r}
                  style={{
                    fontSize: 'var(--dev-font-size-xs)',
                    fontFamily: 'var(--dev-font-family-mono)',
                    color: 'var(--dev-color-brand-primary)',
                  }}
                >
                  {r}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Codes d'erreur */}
      <h3
        style={{
          fontSize: 'var(--dev-font-size-lg)',
          fontWeight: 'var(--dev-font-weight-semibold)',
          color: 'var(--dev-text-primary)',
          marginBottom: 'var(--dev-space-4)',
          marginTop: 'var(--dev-space-6)',
        }}
      >
        Codes d'erreur d'authentification
      </h3>
      <div
        style={{
          background: 'var(--dev-bg-surface)',
          border: '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--dev-shadow-sm)',
        }}
      >
        {[
          { code: '401', error: 'NO_API_KEY',           message: 'En-tête X-Palabre-Key manquant'          },
          { code: '401', error: 'INVALID_API_KEY',      message: 'Clé API invalide ou révoquée'             },
          { code: '401', error: 'NO_SECRET_KEY',        message: 'En-tête X-Palabre-Secret manquant'        },
          { code: '401', error: 'INVALID_SECRET_KEY',   message: 'Clé secrète invalide ou révoquée'         },
          { code: '429', error: 'RATE_LIMIT_EXCEEDED',  message: 'Limite de 1 000 requêtes/minute dépassée' },
        ].map((row, i, arr) => (
          <div
            key={row.error}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--dev-space-4)',
              padding: 'var(--dev-space-3) var(--dev-space-4)',
              borderBottom:
                i < arr.length - 1 ? '1px solid var(--dev-border-color)' : 'none',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 36,
                textAlign: 'center',
                fontSize: 'var(--dev-font-size-xs)',
                fontWeight: 'var(--dev-font-weight-bold)',
                fontFamily: 'var(--dev-font-family-mono)',
                color:
                  row.code === '401'
                    ? '#b91c1c'
                    : row.code === '429'
                    ? '#b45309'
                    : 'var(--dev-text-primary)',
              }}
            >
              {row.code}
            </span>
            <code
              style={{
                flexShrink: 0,
                minWidth: 200,
                fontSize: 'var(--dev-font-size-xs)',
                fontFamily: 'var(--dev-font-family-mono)',
                color: 'var(--dev-color-neutral-700)',
                background: 'none',
                padding: 0,
              }}
            >
              {row.error}
            </code>
            <span
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-secondary)',
              }}
            >
              {row.message}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── DocumentationPage ────────────────────────────────────────────────────────

/**
 * DocumentationPage
 *
 * Props (reçues depuis ProjectPage via TabContent) :
 *   - projectId : string - identifiant du projet courant
 *   - project   : objet - données du projet (clés, config, etc.)
 */
export default function DocumentationPage({ projectId, project }) {
  const [activeSection, setActiveSection] = useState('quickstart');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef(null);

  // Scroll vers la section active quand elle change
  useEffect(() => {
    const el = document.getElementById(activeSection);
    if (el && contentRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection]);

  // Détection de la section visible au scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    function onScroll() {
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  function handleNavClick(sectionId) {
    setActiveSection(sectionId);
    setMobileNavOpen(false);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        alignItems: 'flex-start',
        minHeight: 600,
        position: 'relative',
      }}
    >
      {/* ─── Navigation latérale (desktop) ──────────────────────────────── */}
      <aside
        aria-label="Navigation de la documentation"
        style={{
          width: 220,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          maxHeight: '80vh',
          overflowY: 'auto',
          paddingRight: 'var(--dev-space-5)',
          borderRight: '1px solid var(--dev-border-color)',
          marginRight: 'var(--dev-space-8)',
          display: 'none', // masqué sur mobile, affiché via media query
        }}
        className="doc-sidebar"
      >
        <p
          style={{
            fontSize: 'var(--dev-font-size-xs)',
            fontWeight: 'var(--dev-font-weight-semibold)',
            color: 'var(--dev-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 'var(--dev-space-3)',
            marginTop: 0,
          }}
        >
          Sur cette page
        </p>
        <nav role="navigation" aria-label="Sections de la documentation">
          {SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleNavClick(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--dev-space-2)',
                  width: '100%',
                  padding: 'var(--dev-space-2) var(--dev-space-3)',
                  background: isActive
                    ? 'var(--dev-color-neutral-100)'
                    : 'transparent',
                  border: 'none',
                  borderLeft: isActive
                    ? '2px solid var(--dev-color-brand-primary)'
                    : '2px solid transparent',
                  borderRadius: '0 var(--dev-border-radius-sm) var(--dev-border-radius-sm) 0',
                  marginBottom: 'var(--dev-space-1)',
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: isActive
                    ? 'var(--dev-font-weight-semibold)'
                    : 'var(--dev-font-weight-normal)',
                  color: isActive
                    ? 'var(--dev-color-brand-primary)'
                    : 'var(--dev-text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition:
                    'background var(--dev-transition-fast), color var(--dev-transition-fast)',
                }}
              >
                <span
                  style={{
                    color: isActive
                      ? 'var(--dev-color-brand-primary)'
                      : 'var(--dev-text-muted)',
                    flexShrink: 0,
                  }}
                >
                  {SECTION_ICONS[section.id]}
                </span>
                {section.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── Navigation mobile (bouton + menu déroulant) ────────────────── */}
      <div
        style={{
          display: 'block', // affiché sur mobile, masqué sur desktop via style ci-dessous
          width: '100%',
          marginBottom: 'var(--dev-space-5)',
        }}
        className="doc-mobile-nav"
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-expanded={mobileNavOpen}
          aria-controls="doc-mobile-menu"
          style={{
            display: 'flex',
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
            width: '100%',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--dev-space-2)' }}>
            {SECTION_ICONS[activeSection]}
            {SECTIONS.find((s) => s.id === activeSection)?.label ?? 'Navigation'}
          </span>
          <IconChevronRight
            size={16}
            style={{
              transform: mobileNavOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform var(--dev-transition-fast)',
            }}
          />
        </button>

        {mobileNavOpen && (
          <div
            id="doc-mobile-menu"
            style={{
              marginTop: 'var(--dev-space-2)',
              background: 'var(--dev-bg-surface)',
              border: '1px solid var(--dev-border-color)',
              borderRadius: 'var(--dev-border-radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--dev-shadow-md)',
            }}
          >
            {SECTIONS.map((section) => {
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleNavClick(section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--dev-space-3)',
                    width: '100%',
                    padding: 'var(--dev-space-3) var(--dev-space-4)',
                    background: isActive
                      ? 'var(--dev-color-neutral-100)'
                      : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--dev-border-color)',
                    fontSize: 'var(--dev-font-size-sm)',
                    fontWeight: isActive
                      ? 'var(--dev-font-weight-semibold)'
                      : 'var(--dev-font-weight-normal)',
                    color: isActive
                      ? 'var(--dev-color-brand-primary)'
                      : 'var(--dev-text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: isActive ? 'var(--dev-color-brand-primary)' : 'var(--dev-text-muted)' }}>
                    {SECTION_ICONS[section.id]}
                  </span>
                  {section.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Contenu principal ───────────────────────────────────────────── */}
      <main
        ref={contentRef}
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
        }}
      >
        {/* Sections rendues séquentiellement avec un séparateur */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dev-space-16)' }}>
          <SectionQuickstart project={project} />
          <SectionPlayground project={project} />
          <SectionApiRef />
          <SectionWebhooks project={project} />
          <SectionAuth project={project} />
        </div>
      </main>

      {/* ─── CSS inline pour le responsive ───────────────────────────────── */}
      <style>{`
        @media (min-width: 768px) {
          .doc-sidebar     { display: block !important; }
          .doc-mobile-nav  { display: none  !important; }
        }
      `}</style>
    </div>
  );
}
