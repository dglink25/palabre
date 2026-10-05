/**
 * CodeSnippet.jsx - Developer Portal
 *
 * Affiche des extraits de code pour différents frameworks avec les
 * vraies clés du projet injectées. Les extraits sont régénérés
 * automatiquement quand les clés changent.
 *
 * Fonctionnalités :
 *   - Onglets React / Vue / Flutter / Laravel / Django (req 9.4)
 *   - Clés réelles du projet injectées dans les snippets (req 9.4)
 *   - Bouton copie par snippet (req 9.4)
 *   - Régénération automatique quand les clés changent (req 9.5)
 *
 * Requirements couverts : 9.4, 9.5
 */

import { useState, useMemo } from 'react';

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

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

// ─── Définition des onglets de framework ─────────────────────────────────────

const FRAMEWORKS = [
  { key: 'react',   label: 'React',   lang: 'javascript' },
  { key: 'vue',     label: 'Vue.js',  lang: 'javascript' },
  { key: 'flutter', label: 'Flutter', lang: 'dart'       },
  { key: 'laravel', label: 'Laravel', lang: 'php'        },
  { key: 'django',  label: 'Django',  lang: 'python'     },
];

// ─── Générateurs de snippets ──────────────────────────────────────────────────

/**
 * Retourne les extraits de code pour chaque framework avec les clés injectées.
 * Cette fonction est mémoïsée (useMemo) et sera recalculée à chaque changement
 * de clé (req 9.5).
 */
function buildSnippets(publishableKey, projectName) {
  const pk = publishableKey || 'pk_live_VOTRE_CLE_ICI';
  const name = projectName || 'mon-projet';

  return {
    react: `// Installation
// npm install palabre-sdk

import { useEffect, useState } from 'react';
import PalabreSDK from 'palabre-sdk';

// Hook personnalisé pour Palabre
function usePalabre() {
  const [sdk, setSdk] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    PalabreSDK.init('${pk}')
      .then((instance) => {
        setSdk(instance);
        setReady(true);
      })
      .catch((err) => setError(err.message));
  }, []);

  return { sdk, ready, error };
}

// Utilisation dans un composant
function ChatComponent() {
  const { sdk, ready, error } = usePalabre();

  if (error) return <p>Erreur : {error}</p>;
  if (!ready) return <p>Connexion…</p>;

  async function sendMessage() {
    await sdk.chat.send('user-id-destinataire', 'Bonjour !');
  }

  // Écouter les messages entrants
  sdk.on('message', (msg) => {
    console.log('Nouveau message :', msg);
  });

  return <button onClick={sendMessage}>Envoyer</button>;
}`,

    vue: `// Installation
// npm install palabre-sdk

// src/composables/usePalabre.js
import { ref, onMounted } from 'vue';
import PalabreSDK from 'palabre-sdk';

export function usePalabre() {
  const sdk = ref(null);
  const ready = ref(false);
  const error = ref(null);

  onMounted(async () => {
    try {
      sdk.value = await PalabreSDK.init('${pk}');
      ready.value = true;
    } catch (err) {
      error.value = err.message;
    }
  });

  return { sdk, ready, error };
}

// Utilisation dans un composant Vue
// <script setup>
import { usePalabre } from '@/composables/usePalabre';

const { sdk, ready, error } = usePalabre();

async function sendMessage() {
  if (!ready.value) return;
  await sdk.value.chat.send('user-id-destinataire', 'Bonjour !');
}

// Écouter les événements entrants
watch(ready, (isReady) => {
  if (isReady) {
    sdk.value.on('message', (msg) => {
      console.log('Nouveau message :', msg);
    });
  }
});
// </script>`,

    flutter: `# Installation
# Dans pubspec.yaml :
# dependencies:
#   palabre_flutter: ^0.1.0
# Puis : flutter pub get

import 'package:palabre_flutter/palabre_flutter.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  PalabreSDK? _sdk;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _initSdk();
  }

  Future<void> _initSdk() async {
    try {
      final sdk = await PalabreSDK.init(
        publishableKey: '${pk}',
      );
      sdk.chat.onMessage = (message) {
        debugPrint('Nouveau message : \${message.content}');
      };
      setState(() {
        _sdk = sdk;
        _ready = true;
      });
    } on PalabreException catch (e) {
      debugPrint('Erreur Palabre : \${e.message}');
    }
  }

  Future<void> _sendMessage() async {
    if (_sdk == null) return;
    await _sdk!.chat.send('user-id-destinataire', 'Bonjour !');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chat - ${name}')),
      body: Center(
        child: ElevatedButton(
          onPressed: _ready ? _sendMessage : null,
          child: Text(_ready ? 'Envoyer' : 'Connexion…'),
        ),
      ),
    );
  }
}`,

    laravel: `<?php
// Installation : composer require palabre/sdk-php (ou via Guzzle + requêtes manuelles)

// config/palabre.php
return [
    'publishable_key' => env('PALABRE_PUBLISHABLE_KEY', '${pk}'),
    'secret_key'      => env('PALABRE_SECRET_KEY', 'sk_live_...'),
    'api_url'         => env('PALABRE_API_URL', 'https://api.palabre.app/api/v1/developer'),
];

// .env
// PALABRE_PUBLISHABLE_KEY=${pk}
// PALABRE_SECRET_KEY=sk_live_VOTRE_CLE_SECRETE

// app/Services/PalabreService.php
namespace App\\Services;

use Illuminate\\Support\\Facades\\Http;
use Illuminate\\Support\\Facades\\Config;

class PalabreService
{
    private string $apiUrl;
    private string $secretKey;

    public function __construct()
    {
        \$this->apiUrl   = Config::get('palabre.api_url');
        \$this->secretKey = Config::get('palabre.secret_key');
    }

    /**
     * Envoie un message via l'infrastructure Palabre.
     */
    public function sendMessage(string \$to, string \$content): array
    {
        \$response = Http::withHeaders([
            'X-Palabre-Secret' => \$this->secretKey,
            'Content-Type'     => 'application/json',
        ])->post("\$this->apiUrl/proxy/messages", [
            'to'      => \$to,
            'content' => \$content,
        ]);

        \$response->throw();
        return \$response->json();
    }

    /**
     * Vérifie la signature d'un webhook entrant.
     */
    public function verifyWebhook(string \$body, string \$signature, string \$secret): bool
    {
        \$expected = 'sha256=' . hash_hmac('sha256', \$body, \$secret);
        return hash_equals(\$expected, \$signature);
    }
}

// Exemple d'utilisation dans un contrôleur :
// \$palabre = app(PalabreService::class);
// \$palabre->sendMessage('user-456', 'Bonjour depuis Laravel !');`,

    django: `# Installation : pip install requests

# settings.py
PALABRE_PUBLISHABLE_KEY = '${pk}'
PALABRE_SECRET_KEY      = 'sk_live_VOTRE_CLE_SECRETE'  # depuis les variables d'env
PALABRE_API_URL         = 'https://api.palabre.app/api/v1/developer'

# palabre_service.py
import hashlib
import hmac
import requests
from django.conf import settings


class PalabreService:
    """Client Python pour l'API Palabre Developer."""

    def __init__(self):
        self.api_url   = settings.PALABRE_API_URL
        self.secret_key = settings.PALABRE_SECRET_KEY

    def _headers(self) -> dict:
        return {
            'X-Palabre-Secret': self.secret_key,
            'Content-Type': 'application/json',
        }

    def send_message(self, to: str, content: str) -> dict:
        """Envoie un message via l'infrastructure Palabre."""
        response = requests.post(
            f'{self.api_url}/proxy/messages',
            headers=self._headers(),
            json={'to': to, 'content': content},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def verify_webhook(body: bytes, signature: str, secret: str) -> bool:
        """Vérifie la signature HMAC-SHA256 d'un webhook entrant."""
        expected = 'sha256=' + hmac.new(
            secret.encode(), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


# Exemple d'utilisation dans une vue Django :
# palabre = PalabreService()
# palabre.send_message('user-456', 'Bonjour depuis Django !')

# Vue webhook (urls.py + views.py)
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def webhook_receiver(request):
    """Reçoit et vérifie les webhooks Palabre."""
    if request.method != 'POST':
        return HttpResponse(status=405)

    signature = request.headers.get('X-Palabre-Signature', '')
    webhook_secret = 'VOTRE_SECRET_WEBHOOK'  # depuis les variables d'env

    if not PalabreService.verify_webhook(request.body, signature, webhook_secret):
        return HttpResponseForbidden('Signature invalide')

    payload = json.loads(request.body)
    event_type = request.headers.get('X-Palabre-Event')

    # Traiter l'événement
    print(f'Événement reçu : {event_type}', payload)
    return HttpResponse(status=200)`,
  };
}

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * CodeSnippet
 *
 * Props :
 *   - project  : objet projet contenant les clés (publishable_key, keys, etc.)
 *   - section  : section courante pour contextualiser les snippets (optionnel)
 */
export default function CodeSnippet({ project }) {
  const [activeFramework, setActiveFramework] = useState('react');
  const [copiedFramework, setCopiedFramework] = useState(null);

  // Extraire la publishable key depuis l'objet projet.
  // Supporte les formes : project.keys?.publishable, project.publishable_key, etc.
  const publishableKey =
    project?.keys?.publishable ||
    project?.publishable_key ||
    project?.api_keys?.find?.((k) => k.key_type === 'publishable')?.key_value ||
    null;

  // Les snippets sont recalculés automatiquement quand publishableKey change (req 9.5)
  const snippets = useMemo(
    () => buildSnippets(publishableKey, project?.name),
    [publishableKey, project?.name]
  );

  async function handleCopy(frameworkKey) {
    try {
      await navigator.clipboard.writeText(snippets[frameworkKey]);
      setCopiedFramework(frameworkKey);
      setTimeout(() => setCopiedFramework(null), 2000);
    } catch {
      // Fallback silencieux
    }
  }

  const activeSnippet = snippets[activeFramework] ?? '';

  return (
    <div>
      {/* En-tête avec onglets de framework */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--dev-space-3)',
          marginBottom: 'var(--dev-space-4)',
        }}
      >
        {/* Onglets */}
        <nav
          role="tablist"
          aria-label="Frameworks disponibles"
          style={{
            display: 'flex',
            gap: 0,
            background: 'var(--dev-color-neutral-100)',
            borderRadius: 'var(--dev-border-radius-md)',
            padding: 2,
            flexWrap: 'wrap',
          }}
        >
          {FRAMEWORKS.map((fw) => {
            const isActive = fw.key === activeFramework;
            return (
              <button
                key={fw.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`snippet-panel-${fw.key}`}
                type="button"
                onClick={() => setActiveFramework(fw.key)}
                style={{
                  padding: 'var(--dev-space-1) var(--dev-space-3)',
                  background: isActive ? 'var(--dev-bg-surface)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dev-border-radius-sm)',
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: isActive
                    ? 'var(--dev-font-weight-semibold)'
                    : 'var(--dev-font-weight-medium)',
                  color: isActive
                    ? 'var(--dev-color-brand-primary)'
                    : 'var(--dev-text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? 'var(--dev-shadow-sm)' : 'none',
                  transition:
                    'background var(--dev-transition-fast), color var(--dev-transition-fast)',
                }}
              >
                {fw.label}
              </button>
            );
          })}
        </nav>

        {/* Bouton copie */}
        <button
          type="button"
          onClick={() => handleCopy(activeFramework)}
          aria-label={`Copier le snippet ${FRAMEWORKS.find((f) => f.key === activeFramework)?.label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--dev-space-2)',
            padding: 'var(--dev-space-2) var(--dev-space-3)',
            background:
              copiedFramework === activeFramework
                ? 'var(--dev-color-success)'
                : 'var(--dev-color-neutral-700)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--dev-border-radius-md)',
            fontSize: 'var(--dev-font-size-xs)',
            fontWeight: 'var(--dev-font-weight-medium)',
            cursor: 'pointer',
            transition: 'background var(--dev-transition-fast)',
          }}
        >
          {copiedFramework === activeFramework ? (
            <>
              <IconCheck size={13} />
              Copié !
            </>
          ) : (
            <>
              <IconCopy size={13} />
              Copier
            </>
          )}
        </button>
      </div>

      {/* Avertissement si clé manquante */}
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
            marginBottom: 'var(--dev-space-4)',
          }}
        >
          Les clés du projet ne sont pas encore chargées. Les snippets affichent
          des valeurs indicatives - allez dans l'onglet <strong>Clés API</strong> pour
          les voir.
        </div>
      )}

      {/* Bloc de code */}
      <div
        role="tabpanel"
        id={`snippet-panel-${activeFramework}`}
        aria-label={`Snippet ${FRAMEWORKS.find((f) => f.key === activeFramework)?.label}`}
        style={{
          position: 'relative',
          background: 'var(--dev-color-neutral-900)',
          borderRadius: 'var(--dev-border-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: 'var(--dev-space-6)',
            overflowX: 'auto',
            fontSize: 'var(--dev-font-size-xs)',
            lineHeight: 1.7,
            color: '#e2e8f0',
            fontFamily: 'var(--dev-font-family-mono)',
            whiteSpace: 'pre',
            tabSize: 2,
          }}
        >
          <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 'inherit' }}>
            {activeSnippet}
          </code>
        </pre>
      </div>
    </div>
  );
}
