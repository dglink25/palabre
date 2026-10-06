

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import developerApi from '../api/developerApi';

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'quickstart', label: 'Démarrage rapide' },
  { id: 'playground', label: 'Playground'        },
  { id: 'api-ref',    label: 'Référence API'      },
  { id: 'webhooks',   label: 'Webhooks'           },
  { id: 'auth',       label: 'Authentification'   },
];

// ─── Icônes SVG Lucide ────────────────────────────────────────────────────────

function Ic({ d, size = 16, strokeWidth = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {d}
    </svg>
  );
}

const Icons = {
  Book:     () => <Ic d={<><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></>} />,
  Terminal: () => <Ic d={<><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>} />,
  Code:     () => <Ic d={<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>} />,
  Webhook:  () => <Ic d={<><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></>} />,
  Key:      () => <Ic d={<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>} />,
  Copy:     () => <Ic d={<><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>} size={13} />,
  Check:    () => <Ic d={<polyline points="20 6 9 17 4 12"/>} size={13} strokeWidth={2.5} />,
  Send:     () => <Ic d={<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>} size={15} />,
  Play:     () => <Ic d={<><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></>} size={15} />,
  ChevR:    () => <Ic d={<polyline points="9 18 15 12 9 6"/>} size={13} />,
  ChevD:    () => <Ic d={<polyline points="6 9 12 15 18 9"/>} size={13} />,
  Menu:     () => <Ic d={<><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>} />,
  Alert:    () => <Ic d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>} size={15} />,
  ExLink:   () => <Ic d={<><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>} size={13} />,
};

const SECTION_ICONS = {
  quickstart: <Icons.Book />,
  playground: <Icons.Terminal />,
  'api-ref':  <Icons.Code />,
  webhooks:   <Icons.Webhook />,
  auth:       <Icons.Key />,
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return (
    <span role="status" aria-label="Chargement…" style={{
      display: 'inline-block', width: size, height: size,
      border: `${size <= 14 ? 2 : 3}px solid rgba(255,255,255,.3)`,
      borderTopColor: 'white',
      borderRadius: '50%', animation: 'dev-spin .7s linear infinite', flexShrink: 0,
    }} />
  );
}

// ─── Bouton copie générique ───────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copier', dark = false }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch { /* silencieux */ }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? 'Copié !' : label}
      title={done ? 'Copié !' : label}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          5,
        padding:      '4px 10px',
        background:   done
          ? (dark ? '#34A853' : 'rgba(52,168,83,.12)')
          : (dark ? 'rgba(255,255,255,.10)' : '#F1F3F4'),
        color:        done
          ? (dark ? '#fff' : '#34A853')
          : (dark ? '#e2e8f0' : '#5F6368'),
        border:       `1px solid ${done ? (dark ? '#34A853' : '#34A853') : (dark ? 'rgba(255,255,255,.15)' : '#E0E0E0')}`,
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
      {done ? <Icons.Check /> : <Icons.Copy />}
      {done ? 'Copié !' : label}
    </button>
  );
}

// ─── Bloc de code avec en-tête ────────────────────────────────────────────────

function CodeBlock({ lang = 'code', code, maxHeight }) {
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', background: '#1e2433' }}>
      {/* Barre d'en-tête */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '8px 16px',
        background:     '#161b27',
        borderBottom:   '1px solid rgba(255,255,255,.08)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: '#8892a4',
          textTransform: 'uppercase', letterSpacing: '0.7px',
        }}>
          {lang}
        </span>
        <CopyBtn text={code} label="Copier le code" dark />
      </div>
      {/* Code */}
      <pre style={{
        margin: 0, padding: '16px 20px',
        overflowX: 'auto',
        maxHeight: maxHeight || 'none',
        overflowY: maxHeight ? 'auto' : 'visible',
        fontSize: 13, lineHeight: 1.7,
        color: '#e2e8f0',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
        whiteSpace: 'pre',
        tabSize: 2,
      }}>
        <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 'inherit', border: 'none' }}>
          {code}
        </code>
      </pre>
    </div>
  );
}

// ─── Badge HTTP ────────────────────────────────────────────────────────────────

const METHOD_STYLES = {
  GET:    { bg: '#EAF2FD', color: '#1A73E8' },
  POST:   { bg: 'rgba(52,168,83,.12)',  color: '#1e7e34' },
  PATCH:  { bg: 'rgba(251,188,5,.12)',  color: '#8a6700' },
  DELETE: { bg: 'rgba(234,67,53,.12)',  color: '#EA4335' },
};

function MethodBadge({ method }) {
  const s = METHOD_STYLES[method] ?? METHOD_STYLES.POST;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px',
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
      borderRadius: 4,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: '0.04em', flexShrink: 0,
    }}>
      {method}
    </span>
  );
}

const AUTH_STYLES = {
  'SSO JWT':          { bg: 'rgba(109,40,217,.10)', color: '#6d28d9' },
  'X-Palabre-Key':    { bg: '#EAF2FD', color: '#1A73E8' },
  'X-Palabre-Secret': { bg: 'rgba(234,67,53,.10)',  color: '#EA4335' },
  'Aucune':           { bg: '#F1F3F4', color: '#5F6368' },
};

function AuthBadge({ auth }) {
  const s = AUTH_STYLES[auth] ?? AUTH_STYLES['Aucune'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px',
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
      borderRadius: 4,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {auth}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Démarrage rapide
// ─────────────────────────────────────────────────────────────────────────────

const FRAMEWORKS = [
  { key: 'react',   label: 'React',   lang: 'JavaScript' },
  { key: 'vue',     label: 'Vue.js',  lang: 'JavaScript' },
  { key: 'flutter', label: 'Flutter', lang: 'Dart' },
  { key: 'laravel', label: 'Laravel', lang: 'PHP' },
  { key: 'django',  label: 'Django',  lang: 'Python' },
];

function buildSnippets(pk, name) {
  const key  = pk   || 'pk_live_VOTRE_CLE';
  const proj = name || 'mon-projet';
  return {
    react: `// npm install palabre-sdk

import { useEffect, useState } from 'react';
import PalabreSDK from 'palabre-sdk';

function usePalabre() {
  const [sdk,   setSdk]   = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    PalabreSDK.init('${key}')
      .then(instance => { setSdk(instance); setReady(true); })
      .catch(err => console.error('Init failed:', err.message));
  }, []);

  return { sdk, ready };
}

// Dans votre composant :
function Chat() {
  const { sdk, ready } = usePalabre();

  const send = async () => {
    await sdk.chat.send('user-id', 'Bonjour !');
  };

  sdk?.on('message', msg => console.log('Reçu :', msg));

  return (
    <button onClick={send} disabled={!ready}>
      Envoyer
    </button>
  );
}`,
    vue: `// npm install palabre-sdk

// composables/usePalabre.js
import { ref, onMounted } from 'vue';
import PalabreSDK from 'palabre-sdk';

export function usePalabre() {
  const sdk   = ref(null);
  const ready = ref(false);

  onMounted(async () => {
    sdk.value   = await PalabreSDK.init('${key}');
    ready.value = true;
    sdk.value.on('message', msg => console.log('Reçu :', msg));
  });

  return { sdk, ready };
}

// Dans votre composant :
// const { sdk, ready } = usePalabre();
// await sdk.value.chat.send('user-id', 'Bonjour !');`,
    flutter: `# pubspec.yaml :  palabre_flutter: ^0.1.0

import 'package:palabre_flutter/palabre_flutter.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  PalabreSDK? _sdk;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final sdk = await PalabreSDK.init(publishableKey: '${key}');
    sdk.chat.onMessage = (m) => debugPrint('Reçu : \${m}');
    setState(() => _sdk = sdk);
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: _sdk == null ? null : () => _sdk!.chat.send('user-id', 'Bonjour !'),
      child: const Text('Envoyer'),
    );
  }
}`,
    laravel: `# composer require guzzlehttp/guzzle

// config/palabre.php
return [
    'publishable_key' => env('PALABRE_KEY', '${key}'),
    'secret_key'      => env('PALABRE_SECRET', 'sk_live_...'),
    'api_url'         => 'https://api.palabre.app/api/v1/developer',
];

// app/Services/PalabreService.php
class PalabreService
{
    public function sendMessage(string $to, string $content): array
    {
        $response = Http::withHeaders([
            'X-Palabre-Secret' => config('palabre.secret_key'),
        ])->post(config('palabre.api_url').'/proxy/messages', [
            'to' => $to, 'content' => $content,
        ]);
        $response->throw();
        return $response->json();
    }
}`,
    django: `# pip install requests

# settings.py
PALABRE_KEY    = '${key}'
PALABRE_SECRET = 'sk_live_VOTRE_CLE_SECRETE'
PALABRE_URL    = 'https://api.palabre.app/api/v1/developer'

import requests
from django.conf import settings

class PalabreClient:
    def send_message(self, to: str, content: str) -> dict:
        r = requests.post(
            f'{settings.PALABRE_URL}/proxy/messages',
            headers={'X-Palabre-Secret': settings.PALABRE_SECRET},
            json={'to': to, 'content': content},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()`,
  };
}

function SectionQuickstart({ project }) {
  const [fw, setFw] = useState('react');

  const pk = project?.keys?.publishable
    || project?.publishable_key
    || project?.api_keys?.find?.(k => k.key_type === 'publishable')?.key_value
    || null;

  const snippets = useMemo(() => buildSnippets(pk, project?.name), [pk, project?.name]);
  const active = FRAMEWORKS.find(f => f.key === fw);

  return (
    <section id="quickstart">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>
        Démarrage rapide
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 24px', lineHeight: 1.6 }}>
        Intégrez Palabre en quelques lignes. Choisissez votre framework — les extraits
        utilisent les clés réelles de votre projet.
      </p>

      {/* Avertissement clé manquante */}
      {!pk && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 16,
          background: 'rgba(251,188,5,.08)', border: '1px solid #FBBC05',
          borderLeft: '3px solid #FBBC05', borderRadius: 8,
          fontSize: 13, color: '#8a6700',
        }}>
          <Icons.Alert />
          Clés non chargées — allez dans l'onglet <strong style={{ marginLeft: 4 }}>Clés API</strong> pour les voir.
        </div>
      )}

      {/* Sélecteur de framework */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 0,
      }}>
        <nav
          role="tablist"
          aria-label="Sélectionner un framework"
          style={{
            display: 'flex', gap: 0,
            background: '#F1F3F4', borderRadius: 8, padding: 3, flexWrap: 'wrap',
          }}
        >
          {FRAMEWORKS.map(f => {
            const isA = f.key === fw;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={isA}
                type="button"
                onClick={() => setFw(f.key)}
                style={{
                  padding: '5px 14px',
                  background: isA ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isA ? 600 : 400,
                  color: isA ? '#1A73E8' : '#5F6368',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isA ? '0 1px 3px rgba(32,33,36,.12)' : 'none',
                  transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bloc de code */}
      <div style={{ marginTop: 12 }}>
        <CodeBlock lang={active?.lang || 'Code'} code={snippets[fw]} maxHeight={460} />
      </div>

      {/* Installation */}
      <div style={{
        marginTop: 20,
        background: '#FFFFFF', border: '1px solid #E0E0E0',
        borderRadius: 8, padding: '16px 20px',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#202124', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Installation
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fw === 'flutter' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#202124', background: '#F8F9FA', padding: '4px 10px', borderRadius: 6, border: '1px solid #E0E0E0' }}>
                flutter pub add palabre_flutter
              </code>
              <CopyBtn text="flutter pub add palabre_flutter" label="Copier la commande" />
            </div>
          ) : fw === 'laravel' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#202124', background: '#F8F9FA', padding: '4px 10px', borderRadius: 6, border: '1px solid #E0E0E0' }}>
                composer require guzzlehttp/guzzle
              </code>
              <CopyBtn text="composer require guzzlehttp/guzzle" label="Copier la commande" />
            </div>
          ) : fw === 'django' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#202124', background: '#F8F9FA', padding: '4px 10px', borderRadius: 6, border: '1px solid #E0E0E0' }}>
                pip install requests
              </code>
              <CopyBtn text="pip install requests" label="Copier la commande" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#202124', background: '#F8F9FA', padding: '4px 10px', borderRadius: 6, border: '1px solid #E0E0E0' }}>
                npm install palabre-sdk
              </code>
              <CopyBtn text="npm install palabre-sdk" label="Copier la commande" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Playground
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINTS = [
  { key: 'messages', method: 'POST', path: '/proxy/messages',    label: 'Envoyer un message',          body: { to: 'user-id-destinataire', content: 'Bonjour depuis le Playground !' } },
  { key: 'calls',    method: 'POST', path: '/proxy/calls',        label: 'Initier un appel WebRTC',     body: { to: 'user-id-destinataire', type: 'audio' } },
  { key: 'video',    method: 'POST', path: '/proxy/video/rooms',  label: 'Créer une room vidéo',        body: { room_name: 'ma-reunion', max_participants: 10 } },
  { key: 'push',     method: 'POST', path: '/proxy/push',         label: 'Envoyer une notification push', body: { fcm_token: 'fcm-token-ici', title: 'Nouveau message', body: 'Contenu…' } },
];

function buildCurl(ep, key, body) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.palabre.app';
  const escaped = body.replace(/'/g, "'\\''");
  return `curl -X ${ep.method} '${origin}/api/v1/developer${ep.path}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'X-Palabre-Key: ${key || 'pk_live_VOTRE_CLE'}' \\\n  -d '${escaped}'`;
}

function isJson(s) {
  if (!s.trim()) return true;
  try { JSON.parse(s); return true; } catch { return false; }
}

function SectionPlayground({ project }) {
  const [epKey,    setEpKey]    = useState('messages');
  const [body,     setBody]     = useState(JSON.stringify(ENDPOINTS[0].body, null, 2));
  const [jsonErr,  setJsonErr]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [response, setResponse] = useState(null);
  const [copyCurl, setCopyCurl] = useState(false);

  const pk = project?.keys?.publishable
    || project?.publishable_key
    || project?.api_keys?.find?.(k => k.key_type === 'publishable')?.key_value
    || null;

  const ep   = ENDPOINTS.find(e => e.key === epKey) ?? ENDPOINTS[0];
  const curl = useMemo(() => buildCurl(ep, pk, body), [ep, pk, body]);

  function selectEp(key) {
    setEpKey(key);
    const found = ENDPOINTS.find(e => e.key === key);
    if (found) setBody(JSON.stringify(found.body, null, 2));
    setResponse(null);
    setJsonErr('');
  }

  function onBodyChange(e) {
    const v = e.target.value;
    setBody(v);
    setJsonErr(v.trim() && !isJson(v) ? 'JSON invalide — vérifiez la syntaxe.' : '');
  }

  const execute = useCallback(async () => {
    if (!isJson(body)) { setJsonErr('Corrigez le JSON avant d\'envoyer.'); return; }
    setSending(true); setResponse(null);
    let parsed = null;
    if (body.trim()) try { parsed = JSON.parse(body); } catch { /* validated */ }
    try {
      const { data, status } = await developerApi.request({
        method: ep.method, url: ep.path, data: parsed,
        headers: pk ? { 'X-Palabre-Key': pk } : {},
      });
      setResponse({ status, data, ok: true });
    } catch (err) {
      setResponse({ status: err.response?.status ?? 0, data: err.response?.data ?? { error: err.message }, ok: false });
    } finally { setSending(false); }
  }, [ep, body, pk]);

  async function copyCurlFn() {
    try { await navigator.clipboard.writeText(curl); setCopyCurl(true); setTimeout(() => setCopyCurl(false), 2000); }
    catch { /* silencieux */ }
  }

  const statusColor = (s) => s >= 200 && s < 300 ? '#34A853' : s >= 400 ? '#EA4335' : '#5F6368';

  return (
    <section id="playground">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>
        Playground
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 20px', lineHeight: 1.6 }}>
        Testez les endpoints de l'API en temps réel. La clé publishable de votre projet
        est injectée automatiquement — aucune configuration requise.
      </p>

      <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
        {/* Sélecteur d'endpoint */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E0E0E0', background: '#F8F9FA' }}>
          <label htmlFor="pg-ep" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            Endpoint
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ENDPOINTS.map(e => {
              const isA = e.key === epKey;
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => selectEp(e.key)}
                  style={{
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          7,
                    padding:      '6px 14px',
                    background:   isA ? '#1A73E8' : '#FFFFFF',
                    color:        isA ? '#FFFFFF' : '#5F6368',
                    border:       `1px solid ${isA ? '#1A73E8' : '#E0E0E0'}`,
                    borderRadius: 6,
                    fontSize:     13,
                    fontWeight:   isA ? 600 : 400,
                    cursor:       'pointer',
                    fontFamily:   'inherit',
                    transition:   'all 150ms ease',
                    whiteSpace:   'nowrap',
                  }}
                >
                  <MethodBadge method={e.method} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{e.path}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: '#5F6368', margin: '8px 0 0' }}>{ep.label}</p>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Authentification */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 6px' }}>
              Authentification (lecture seule)
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '8px 12px', background: '#F8F9FA',
              border: '1px solid #E0E0E0', borderRadius: 6,
            }}>
              <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#5F6368', background: 'none', border: 'none', padding: 0 }}>
                X-Palabre-Key:
              </code>
              <code style={{
                flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                color: pk ? '#1A73E8' : '#9aa0a6',
                background: 'none', border: 'none', padding: 0,
                wordBreak: 'break-all',
              }}>
                {pk || 'pk_live_… (non chargée — voir onglet Clés API)'}
              </code>
            </div>
          </div>

          {/* Éditeur JSON */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
                Corps de la requête (JSON)
              </p>
              {jsonErr && (
                <span role="alert" style={{ fontSize: 12, color: '#EA4335', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icons.Alert />
                  {jsonErr}
                </span>
              )}
            </div>
            <textarea
              id="pg-body"
              value={body}
              onChange={onBodyChange}
              rows={9}
              spellCheck={false}
              aria-label="Corps de la requête JSON"
              style={{
                width: '100%', padding: '12px 14px',
                background: '#1e2433', color: jsonErr ? '#fca5a5' : '#e2e8f0',
                border: `1px solid ${jsonErr ? '#EA4335' : 'rgba(255,255,255,.1)'}`,
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineHeight: 1.7, resize: 'vertical', outline: 'none',
                boxSizing: 'border-box', tabSize: 2,
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={execute}
              disabled={sending || !!jsonErr}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          7,
                height:       40,
                padding:      '0 20px',
                background:   (sending || jsonErr) ? '#dadce0' : '#1A73E8',
                color:        (sending || jsonErr) ? '#5F6368' : '#FFFFFF',
                border:       'none',
                borderRadius: 8,
                fontSize:     14,
                fontWeight:   600,
                cursor:       (sending || jsonErr) ? 'not-allowed' : 'pointer',
                fontFamily:   'inherit',
                transition:   'background 150ms ease',
              }}
            >
              {sending ? <Spinner size={15} /> : <Icons.Play />}
              {sending ? 'Exécution…' : 'Exécuter la requête'}
            </button>

            <button
              type="button"
              onClick={copyCurlFn}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          7,
                height:       40,
                padding:      '0 16px',
                background:   copyCurl ? 'rgba(52,168,83,.10)' : '#FFFFFF',
                color:        copyCurl ? '#34A853' : '#5F6368',
                border:       `1px solid ${copyCurl ? '#34A853' : '#E0E0E0'}`,
                borderRadius: 8,
                fontSize:     13,
                fontWeight:   500,
                cursor:       'pointer',
                fontFamily:   'inherit',
                transition:   'all 150ms ease',
              }}
            >
              {copyCurl ? <Icons.Check /> : <Icons.Copy />}
              {copyCurl ? 'Copié !' : 'Copier en cURL'}
            </button>
          </div>

          {/* Aperçu cURL */}
          <div style={{ borderRadius: 8, overflow: 'hidden', background: '#1e2433' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 14px',
              background: '#161b27', borderBottom: '1px solid rgba(255,255,255,.08)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                cURL — aperçu de la commande
              </span>
              <CopyBtn text={curl} label="Copier cURL" dark />
            </div>
            <pre style={{
              margin: 0, padding: '12px 14px',
              fontSize: 12, lineHeight: 1.6,
              color: '#94a3b8',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'pre', overflowX: 'auto',
            }}>
              {curl}
            </pre>
          </div>

          {/* Réponse */}
          {response && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
                  Réponse
                </p>
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: response.ok ? 'rgba(52,168,83,.12)' : 'rgba(234,67,53,.12)',
                  color: statusColor(response.status),
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  HTTP {response.status}
                </span>
              </div>

              <div style={{ borderRadius: 8, overflow: 'hidden', background: '#1e2433' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 14px', background: '#161b27',
                  borderBottom: '1px solid rgba(255,255,255,.08)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    JSON
                  </span>
                  <CopyBtn text={JSON.stringify(response.data, null, 2)} label="Copier la réponse" dark />
                </div>
                <pre style={{
                  margin: 0, padding: '14px 16px',
                  fontSize: 12, lineHeight: 1.7,
                  color: response.ok ? '#86efac' : '#fca5a5',
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: 'pre', overflowX: 'auto',
                  maxHeight: 360, overflowY: 'auto',
                }}>
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Référence API
// ─────────────────────────────────────────────────────────────────────────────

const API_ROUTES = [
  { method: 'POST',   path: '/accounts/me',                      desc: 'Crée ou retourne le compte développeur',                   auth: 'SSO JWT' },
  { method: 'GET',    path: '/accounts/me',                      desc: "Retourne le compte développeur courant",                   auth: 'SSO JWT' },
  { method: 'GET',    path: '/projects',                         desc: 'Liste les projets du compte',                              auth: 'SSO JWT' },
  { method: 'POST',   path: '/projects',                         desc: 'Crée un projet — génère pk_ et sk_ automatiquement',       auth: 'SSO JWT' },
  { method: 'GET',    path: '/projects/:id',                     desc: 'Détails du projet (clés, white-label, webhooks)',           auth: 'SSO JWT' },
  { method: 'PATCH',  path: '/projects/:id',                     desc: 'Met à jour les métadonnées du projet',                     auth: 'SSO JWT' },
  { method: 'DELETE', path: '/projects/:id',                     desc: 'Soft-delete du projet — révoque les clés',                 auth: 'SSO JWT' },
  { method: 'GET',    path: '/projects/:id/keys',                desc: 'Liste les clés actives (secret masquée)',                   auth: 'SSO JWT' },
  { method: 'POST',   path: '/projects/:id/keys/rotate',         desc: "Rotation d'une clé avec période de grâce de 60s",          auth: 'SSO JWT' },
  { method: 'GET',    path: '/projects/:id/config',              desc: 'White-Label Config publique utilisée par les SDK',          auth: 'X-Palabre-Key' },
  { method: 'POST',   path: '/proxy/messages',                   desc: "Envoie un message via l'infrastructure E2E Palabre",        auth: 'X-Palabre-Key' },
  { method: 'POST',   path: '/proxy/calls',                      desc: 'Initie un appel WebRTC — retourne credentials TURN',        auth: 'X-Palabre-Key' },
  { method: 'POST',   path: '/proxy/video/rooms',                desc: 'Crée une room Jitsi — retourne token de session',           auth: 'X-Palabre-Key' },
  { method: 'POST',   path: '/proxy/push',                       desc: 'Envoie une notification push via FCM',                     auth: 'X-Palabre-Key' },
  { method: 'GET',    path: '/projects/:id/webhooks',            desc: 'Liste les webhooks du projet',                             auth: 'SSO JWT' },
  { method: 'POST',   path: '/projects/:id/webhooks',            desc: 'Crée un webhook (URL HTTPS obligatoire)',                   auth: 'SSO JWT' },
  { method: 'PATCH',  path: '/projects/:id/webhooks/:wid',       desc: "Met à jour l'URL ou les événements d'un webhook",           auth: 'SSO JWT' },
  { method: 'DELETE', path: '/projects/:id/webhooks/:wid',       desc: 'Supprime un webhook et son historique',                     auth: 'SSO JWT' },
  { method: 'GET',    path: '/projects/:id/webhooks/deliveries', desc: 'Historique des 100 dernières livraisons',                   auth: 'SSO JWT' },
  { method: 'GET',    path: '/projects/:id/stats',               desc: "Statistiques d'usage (today / 7d / 30d / 90d)",            auth: 'SSO JWT' },
  { method: 'GET',    path: '/docs',                             desc: 'Documentation OpenAPI 3.0 JSON',                           auth: 'Aucune' },
];

function SectionApiRef() {
  return (
    <section id="api-ref">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>
        Référence API
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 16px', lineHeight: 1.6 }}>
        Toutes les routes sont préfixées par{' '}
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>/api/v1/developer</code>.{' '}
        <a
          href="/api/v1/developer/docs"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1A73E8', display: 'inline-flex', alignItems: 'center', gap: 3 }}
        >
          Documentation OpenAPI complète <Icons.ExLink />
        </a>
      </p>

      <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                {['Méthode', 'Chemin', 'Description', 'Authentification'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: '#5F6368',
                    textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {API_ROUTES.map((r, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid #E0E0E0' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <MethodBadge method={r.method} />
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <code style={{
                      fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                      color: '#1A73E8', background: 'none', border: 'none', padding: 0,
                    }}>
                      {r.path}
                    </code>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#5F6368' }}>
                    {r.desc}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <AuthBadge auth={r.auth} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Webhooks
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { type: 'message.received',  desc: 'Un message a été reçu par un utilisateur de votre projet.' },
  { type: 'call.started',      desc: 'Un appel audio ou vidéo vient de démarrer.' },
  { type: 'call.ended',        desc: "Un appel s'est terminé normalement." },
  { type: 'call.missed',       desc: "Un appel entrant n'a pas été décroché." },
  { type: 'user.online',       desc: 'Un utilisateur est passé en ligne.' },
  { type: 'user.offline',      desc: 'Un utilisateur est passé hors ligne.' },
  { type: 'notification.sent', desc: 'Une notification push FCM a été envoyée.' },
];

const WEBHOOK_HEADERS = [
  { header: 'X-Palabre-Signature', value: 'sha256=hmac(webhookSecret, "$timestamp.$body")' },
  { header: 'X-Palabre-Event',     value: 'message.received | call.started | …' },
  { header: 'X-Palabre-Timestamp', value: 'timestamp Unix (secondes)' },
  { header: 'Content-Type',        value: 'application/json' },
];

const WEBHOOK_VERIFY = `// Node.js — vérification HMAC-SHA256
const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Comparaison timing-safe pour éviter les attaques par timing
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

// Express.js — utilisez express.raw() pour conserver le corps brut
app.post('/webhooks/palabre',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-palabre-signature'];
    const secret    = process.env.PALABRE_WEBHOOK_SECRET;

    if (!verifyWebhookSignature(req.body.toString(), signature, secret)) {
      return res.status(403).json({ error: 'Signature invalide' });
    }

    const event     = JSON.parse(req.body);
    const eventType = req.headers['x-palabre-event'];

    switch (eventType) {
      case 'message.received': /* … */ break;
      case 'call.started':     /* … */ break;
    }

    res.sendStatus(200);
  }
);`;

function SectionWebhooks() {
  return (
    <section id="webhooks">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>
        Webhooks
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 24px', lineHeight: 1.6 }}>
        Les webhooks permettent à votre serveur de recevoir des notifications signées
        en temps réel. Configurez vos endpoints dans l'onglet{' '}
        <strong>Webhooks</strong> du projet.
      </p>

      {/* Événements */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#202124', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Événements disponibles
      </h3>
      <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        {EVENT_TYPES.map((ev, i) => (
          <div key={ev.type} style={{
            display: 'flex', alignItems: 'flex-start', gap: 16,
            padding: '12px 16px',
            borderBottom: i < EVENT_TYPES.length - 1 ? '1px solid #E0E0E0' : 'none',
          }}>
            <code style={{
              flexShrink: 0, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              color: '#1A73E8', background: '#EAF2FD',
              padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
            }}>
              {ev.type}
            </code>
            <p style={{ margin: 0, fontSize: 13, color: '#5F6368', paddingTop: 2, lineHeight: 1.5 }}>
              {ev.desc}
            </p>
          </div>
        ))}
      </div>

      {/* En-têtes */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#202124', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        En-têtes envoyés par Palabre
      </h3>
      <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
              <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>En-tête</th>
              <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Valeur</th>
            </tr>
          </thead>
          <tbody>
            {WEBHOOK_HEADERS.map((row, i) => (
              <tr key={row.header} style={{ borderBottom: i < WEBHOOK_HEADERS.length - 1 ? '1px solid #E0E0E0' : 'none' }}>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                  <code style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#202124', background: '#F8F9FA', padding: '2px 8px', borderRadius: 4, border: '1px solid #E0E0E0' }}>
                    {row.header}
                  </code>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#5F6368' }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vérification */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#202124', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Vérification de la signature
      </h3>
      <p style={{ fontSize: 13, color: '#5F6368', margin: '0 0 12px', lineHeight: 1.6 }}>
        Vérifiez toujours la signature <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>X-Palabre-Signature</code> avant de traiter un événement.
        Utilisez le corps <strong>brut</strong> (non parsé) pour la vérification.
      </p>
      <CodeBlock lang="Node.js / Express" code={WEBHOOK_VERIFY} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Authentification
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_ERRORS = [
  { code: 401, key: 'NO_API_KEY',          msg: "En-tête X-Palabre-Key manquant" },
  { code: 401, key: 'INVALID_API_KEY',     msg: "Clé API invalide ou révoquée" },
  { code: 401, key: 'NO_SECRET_KEY',       msg: "En-tête X-Palabre-Secret manquant" },
  { code: 401, key: 'INVALID_SECRET_KEY',  msg: "Clé secrète invalide ou révoquée" },
  { code: 429, key: 'RATE_LIMIT_EXCEEDED', msg: "Limite de 1 000 requêtes/minute dépassée" },
];

function SectionAuth({ project }) {
  const pk = project?.keys?.publishable
    || project?.publishable_key
    || project?.api_keys?.find?.(k => k.key_type === 'publishable')?.key_value
    || 'pk_live_VOTRE_CLE';

  const cards = [
    {
      title:  'Publishable Key',
      prefix: 'pk_live_…',
      header: 'X-Palabre-Key',
      value:  pk,
      usage:  'Côté client : navigateur, application mobile.',
      routes: ['/proxy/messages', '/proxy/calls', '/proxy/video/rooms', '/proxy/push'],
      color:  '#1A73E8', bg: '#EAF2FD',
    },
    {
      title:  'Secret Key',
      prefix: 'sk_live_…',
      header: 'X-Palabre-Secret',
      value:  'sk_live_…',
      usage:  'Côté serveur uniquement. Ne jamais exposer dans du code client.',
      routes: ['Opérations serveur sensibles'],
      color:  '#EA4335', bg: 'rgba(234,67,53,.08)',
    },
  ];

  return (
    <section id="auth">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>
        Authentification
      </h2>
      <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 24px', lineHeight: 1.6 }}>
        L'API Palabre utilise deux types de clés selon le contexte d'appel.
        La rotation des clés est disponible dans l'onglet <strong>Clés API</strong>.
      </p>

      {/* Cartes clés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        {cards.map(card => (
          <div key={card.title} style={{
            background: '#FFFFFF', border: '1px solid #E0E0E0',
            borderRadius: 8, padding: '20px',
            borderTop: `3px solid ${card.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4,
                background: card.bg, color: card.color,
                fontSize: 11, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {card.prefix}
              </span>
              <strong style={{ fontSize: 14, color: '#202124' }}>{card.title}</strong>
            </div>
            <p style={{ fontSize: 13, color: '#5F6368', margin: '0 0 12px', lineHeight: 1.5 }}>
              {card.usage}
            </p>
            <div style={{
              padding: '8px 12px', background: '#F8F9FA',
              border: '1px solid #E0E0E0', borderRadius: 6, marginBottom: 12,
            }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#9aa0a6', fontWeight: 600 }}>
                En-tête HTTP
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <code style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  color: card.color, background: 'none', border: 'none', padding: 0,
                  wordBreak: 'break-all', flex: 1,
                }}>
                  {card.header}: {card.value}
                </code>
                <CopyBtn text={`${card.header}: ${card.value}`} label="Copier" />
              </div>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9aa0a6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Routes autorisées
            </p>
            {card.routes.map(r => (
              <div key={r} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#1A73E8', lineHeight: 1.8 }}>
                {r}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Codes d'erreur */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#202124', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Codes d'erreur d'authentification
      </h3>
      <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
              <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>Code</th>
              <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>Clé d'erreur</th>
              <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {AUTH_ERRORS.map((row, i) => (
              <tr key={row.key} style={{ borderBottom: i < AUTH_ERRORS.length - 1 ? '1px solid #E0E0E0' : 'none' }}>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: row.code === 401 ? '#EA4335' : '#8a6700',
                  }}>
                    {row.code}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                  <code style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#202124', background: '#F8F9FA', padding: '2px 8px', borderRadius: 4, border: '1px solid #E0E0E0' }}>
                    {row.key}
                  </code>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: '#5F6368' }}>
                  {row.msg}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocumentationPage — Layout principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentationPage({ projectId, project }) {
  const [activeSection, setActiveSection] = useState('quickstart');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef(null);

  // Scroll vers la section cliquée
  useEffect(() => {
    const el = document.getElementById(activeSection);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSection]);

  // Surlignage auto de la section visible au scroll
  useEffect(() => {
    function onScroll() {
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 140) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function navClick(id) { setActiveSection(id); setMobileNavOpen(false); }

  const activeLabel = SECTIONS.find(s => s.id === activeSection)?.label ?? '';

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', minHeight: 600, position: 'relative' }}>

      {/* ── Sidebar desktop ── */}
      <aside
        aria-label="Navigation de la documentation"
        className="doc-sidebar"
        style={{
          width: 200, flexShrink: 0,
          position: 'sticky', top: 20,
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          paddingRight: 20,
          borderRight: '1px solid #E0E0E0',
          marginRight: 32,
          display: 'none', /* géré par CSS responsive */
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9aa0a6', margin: '0 0 10px' }}>
          Sur cette page
        </p>
        <nav role="navigation" aria-label="Sections">
          {SECTIONS.map(s => {
            const isA = s.id === activeSection;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navClick(s.id)}
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         8,
                  width:       '100%',
                  padding:     '7px 10px',
                  background:  isA ? '#EAF2FD' : 'transparent',
                  border:      'none',
                  borderLeft:  `2px solid ${isA ? '#1A73E8' : 'transparent'}`,
                  borderRadius: '0 6px 6px 0',
                  marginBottom: 2,
                  fontSize:    13,
                  fontWeight:  isA ? 600 : 400,
                  color:       isA ? '#1A73E8' : '#5F6368',
                  cursor:      'pointer',
                  textAlign:   'left',
                  fontFamily:  'inherit',
                  transition:  'all 150ms ease',
                }}
              >
                <span style={{ color: isA ? '#1A73E8' : '#9aa0a6', flexShrink: 0 }}>
                  {SECTION_ICONS[s.id]}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Navigation mobile ── */}
      <div
        className="doc-mobile-nav"
        style={{ display: 'block', width: '100%', marginBottom: 16 }}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(v => !v)}
          aria-expanded={mobileNavOpen}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            width:          '100%',
            padding:        '9px 14px',
            background:     '#FFFFFF',
            border:         '1px solid #E0E0E0',
            borderRadius:   8,
            fontSize:       13,
            fontWeight:     500,
            color:          '#202124',
            cursor:         'pointer',
            fontFamily:     'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {SECTION_ICONS[activeSection]}
            {activeLabel}
          </span>
          {mobileNavOpen ? <Icons.ChevD /> : <Icons.ChevR />}
        </button>

        {mobileNavOpen && (
          <div style={{
            marginTop: 6, background: '#FFFFFF',
            border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(32,33,36,.10)',
          }}>
            {SECTIONS.map(s => {
              const isA = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navClick(s.id)}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        10,
                    width:      '100%',
                    padding:    '11px 16px',
                    background: isA ? '#EAF2FD' : 'transparent',
                    border:     'none',
                    borderBottom: '1px solid #E0E0E0',
                    fontSize:   13,
                    fontWeight: isA ? 600 : 400,
                    color:      isA ? '#1A73E8' : '#5F6368',
                    cursor:     'pointer',
                    textAlign:  'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ color: isA ? '#1A73E8' : '#9aa0a6' }}>
                    {SECTION_ICONS[s.id]}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Contenu principal ── */}
      <main ref={contentRef} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          <SectionQuickstart project={project} />
          <SectionPlayground project={project} />
          <SectionApiRef />
          <SectionWebhooks />
          <SectionAuth project={project} />
        </div>
      </main>

      {/* CSS responsive sidebar / mobile */}
      <style>{`
        @media (min-width: 768px) {
          .doc-sidebar     { display: block !important; }
          .doc-mobile-nav  { display: none  !important; }
        }
      `}</style>
    </div>
  );
}
