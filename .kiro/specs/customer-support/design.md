# Design Document — Service Client Palabre

## Overview

Le service client Palabre est un canal de communication dédié entre tout utilisateur de la plateforme et le super-administrateur Palabre. Il est accessible depuis le site public, chaque espace tenant et l'application mobile Flutter. Tous les échanges transitent exclusivement par le **serveur central** — même si l'utilisateur est sur un tenant local. Le service repose sur les briques existantes : Signal Protocol E2E (messagerie), WebRTC via Coturn (appels audio), Jitsi white-label (vidéoconférence), FCM/APNs (notifications push).

---

## Architecture Système

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (Web React ou Mobile Flutter)                           │
│                                                                 │
│  Support_Widget (flottant, partout)                             │
│    ├── SupportChatPage  — messagerie E2E temps réel             │
│    ├── SupportCallPage  — appel audio + file d'attente          │
│    └── Invitation VideoConférence (rejoindre seulement)         │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS + WSS  → Central_Server uniquement
                     │ (jamais vers un Tenant_Server local)
┌────────────────────▼────────────────────────────────────────────┐
│  CENTRAL_SERVER  (serveur central Palabre)                      │
│                                                                 │
│  /api/v1/support/*         — REST endpoints                     │
│  /support/socket           — WebSocket Phoenix (chat + signaling)│
│                                                                 │
│  support.service.js        — CRUD sessions, files d'attente     │
│  support.call.service.js   — WebRTC signaling, hold/bascule     │
│  support.queue.service.js  — Call_Queue temps réel              │
│                                                                 │
│  Tables : support_sessions, support_messages, support_calls     │
│  Réutilise : audit_logs, notifications, VideoConference_Service │
└──────┬──────────────────────────────────────────────────────────┘
       │ Redis Pub/Sub (temps réel)
┌──────▼──────────────────────────────────────────────────────────┐
│  SUPER_ADMIN Interface  (/admin/support)                        │
│  Vue unifiée : chats actifs, Call_Queue, Hold_State, historique │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modèle de Données

### Migration 011 — `support_sessions`, `support_messages`, `support_calls`

```sql
-- ── Sessions de service client ─────────────────────────────────
CREATE TABLE support_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved','closed')),
  channel         TEXT NOT NULL DEFAULT 'chat'
                    CHECK (channel IN ('chat','call','video')),
  -- Métadonnées
  unread_count    INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_support_session_user UNIQUE (user_id)  -- 1 session active par user
);

CREATE INDEX idx_support_sessions_status   ON support_sessions(status);
CREATE INDEX idx_support_sessions_user     ON support_sessions(user_id);
CREATE INDEX idx_support_sessions_updated  ON support_sessions(updated_at DESC);

-- ── Messages du service client (E2E chiffré) ─────────────────
CREATE TABLE support_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES support_sessions(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'user' = client, 'admin' = super-admin
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('user','admin')),
  -- Ciphertext Signal (jamais déchiffré côté serveur)
  ciphertext      TEXT NOT NULL,
  sender_key_id   TEXT,
  type            TEXT NOT NULL DEFAULT 'text'
                    CHECK (type IN ('text','media_ref','call_signal','system','video_invite')),
  status          TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','delivered','read')),
  client_ts       BIGINT NOT NULL,
  server_ts       BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_session  ON support_messages(session_id, server_ts DESC);
CREATE INDEX idx_support_messages_status   ON support_messages(status) WHERE status != 'read';

-- ── Appels du service client ──────────────────────────────────
CREATE TABLE support_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES support_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','ringing','active','hold','ended','missed')),
  -- Position dans la file d'attente (NULL si actif ou terminé)
  queue_position  INTEGER,
  started_at      TIMESTAMPTZ,
  answered_at     TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_seconds INTEGER,
  -- Raison de fin : user_hangup | admin_hangup | timeout | missed
  end_reason      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_calls_status   ON support_calls(status) WHERE status IN ('queued','active','hold');
CREATE INDEX idx_support_calls_session  ON support_calls(session_id);
CREATE INDEX idx_support_calls_user     ON support_calls(user_id);
```

---

## Composants Backend

### Structure

```
backend/src/modules/support/
├── support.routes.js          # Tous les endpoints REST + WS
├── support.service.js         # CRUD sessions + messages
├── support.call.service.js    # WebRTC signaling + hold/bascule
└── support.queue.service.js   # Call_Queue Redis temps réel

backend/migrations/
└── 011_customer_support.sql
```

### Endpoints REST

```
# Utilisateur (client)
POST   /api/v1/support/sessions           # Ouvrir/récupérer sa session
GET    /api/v1/support/sessions/me        # Sa session + historique messages
GET    /api/v1/support/sessions/me/messages # Messages paginés
POST   /api/v1/support/sessions/me/calls  # Initier un appel audio
POST   /api/v1/support/sessions/me/calls/:callId/hangup  # Raccrocher
GET    /api/v1/support/status             # Statut du service (disponible, file d'attente)

# Super-admin uniquement
GET    /api/v1/support/admin/sessions     # Toutes les sessions actives
GET    /api/v1/support/admin/sessions/:id # Détail session + messages
POST   /api/v1/support/admin/sessions/:id/calls/:callId/answer  # Décrocher
POST   /api/v1/support/admin/sessions/:id/calls/:callId/hold    # Mettre en hold
POST   /api/v1/support/admin/sessions/:id/calls/:callId/resume  # Reprendre depuis hold
POST   /api/v1/support/admin/sessions/:id/calls/:callId/hangup  # Terminer
POST   /api/v1/support/admin/sessions/:id/videoconference       # Lancer vidéo depuis chat
POST   /api/v1/support/admin/sessions/:id/resolve               # Marquer résolu
```

### WebSocket `/support/socket`

```
Events client → serveur :
  support:message     { session_id, ciphertext, sender_key_id, type, client_ts }
  support:call:signal { call_id, event: 'offer|answer|ice|hangup', sdp?, candidate? }
  support:read_ack    { session_id, last_message_ts }

Events serveur → client :
  support:message:new        { message }
  support:message:status     { message_id, status }
  support:call:incoming      { call_id, queue_position }
  support:call:answered      { call_id }
  support:call:hold          { call_id }
  support:call:ended         { call_id, reason }
  support:queue:update       { call_id, position, estimated_wait_min }
  support:video:invite       { room_id, join_url }
  support:admin:online       { available: boolean }
```

### `support.queue.service.js` — File d'attente Redis

```js
// Clé Redis : support:call_queue → Liste ordonnée des callId
// Clé Redis : support:call:{callId} → JSON { userId, status, enqueuedAt }
// Clé Redis : support:admin:active_call → callId en cours
// Clé Redis : support:admin:hold_calls → Set des callId en hold

async function enqueue(callId, userId) {
  await redis.rpush('support:call_queue', callId);
  await redis.set(`support:call:${callId}`, JSON.stringify({ userId, status: 'queued', enqueuedAt: Date.now() }));
  await notifyQueuePositions(); // broadcast positions à tous les appelants en attente
  await notifySuperAdmin();     // notifier le super-admin d'un nouvel appel
}

async function answerNext(adminCallId = null) {
  // adminCallId = appel à prendre depuis la queue (ou le premier si null)
  const callId = adminCallId || await redis.lpop('support:call_queue');
  if (!callId) return null;
  
  // Mettre l'appel actif en hold si présent
  const activeCallId = await redis.get('support:admin:active_call');
  if (activeCallId) {
    await putOnHold(activeCallId);
  }
  
  await redis.set('support:admin:active_call', callId);
  await redis.set(`support:call:${callId}`, JSON.stringify({ status: 'active', answeredAt: Date.now() }));
  return callId;
}

async function putOnHold(callId) {
  await redis.sadd('support:admin:hold_calls', callId);
  await redis.set(`support:call:${callId}`, JSON.stringify({ status: 'hold' }));
  // Signal au client pour lancer la musique d'attente
  await broadcastToCall(callId, { event: 'support:call:hold' });
}

async function resumeFromHold(callId) {
  const activeCallId = await redis.get('support:admin:active_call');
  if (activeCallId) await putOnHold(activeCallId);
  
  await redis.srem('support:admin:hold_calls', callId);
  await redis.set('support:admin:active_call', callId);
  await broadcastToCall(callId, { event: 'support:call:resumed' });
}
```

---

## Composants Frontend Web (React)

### Nouveaux fichiers

```
frontend/web/src/
├── components/
│   └── SupportWidget.jsx           # Widget flottant (partout)
├── pages/
│   ├── support/
│   │   ├── SupportPage.jsx         # Page dédiée client (/support)
│   │   ├── SupportChatPanel.jsx    # Panneau messagerie E2E
│   │   └── SupportCallPanel.jsx    # Panneau appel + file d'attente
│   └── admin/
│       └── AdminSupportPage.jsx    # Dashboard super-admin (/admin/support)
└── lib/
    └── supportApi.js               # Wrappers API support
```

### `SupportWidget.jsx` — Widget flottant

```jsx
// Bouton flottant en bas à droite de toutes les pages
// Affiche le statut du service (vert = disponible, rouge = occupé)
// Ouvre SupportPage en slide-over ou modal selon l'espace disponible
// Injecté dans PublicLayout et Layout (espace connecté)

export default function SupportWidget() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [open, setOpen]     = useState(false);

  // Polling statut toutes les 30s
  useEffect(() => {
    api.get('/support/status').then(setStatus).catch(() => {});
    const t = setInterval(() => api.get('/support/status').then(setStatus).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => user ? setOpen(true) : navigate('/login?redirect=/support')}
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, ... }}
      >
        <HeadsetIcon />
        <span>Service client</span>
        {/* Dot de statut */}
        <span style={{ background: status?.available ? '#16a34a' : '#dc2626' }} />
      </button>

      {/* Panneau slide-over */}
      {open && <SupportPanel onClose={() => setOpen(false)} />}
    </>
  );
}
```

### `AdminSupportPage.jsx` — Dashboard super-admin

```
/admin/support — Accessible uniquement super-admin
┌─────────────────────────────────────────────────────────────────┐
│ Service Client — [3 actifs] [2 en attente] [1 en hold]          │
├──────────────────┬──────────────────────────────────────────────┤
│ SESSIONS ACTIVES │  Chat avec Alice Martin        [Audio] [Vidéo]│
│ ● Alice Martin   │  ──────────────────────────────────────────── │
│   Chat (12:30)   │  Alice: Bonjour, j'ai un souci avec...        │
│ ● Bob Dupont     │  Moi:   Bonjour Alice, je suis là pour...     │
│   Appel (4m23s)  │  Alice: Merci, voici le problème :            │
│                  │  [Zone de saisie réservée super-admin]        │
├──────────────────┤                                               │
│ FILE D'ATTENTE   │                                               │
│ 1. Carole E.     │  APPELS EN COURS :                            │
│    Appel - 2:15  │  ● Bob Dupont (4m23s) [Hold] [Terminer]       │
│ 2. David K.      │  ● Carole E. (en attente #1) [Décrocher]      │
│    Appel - 0:45  │  ● David K. (en attente #2) [Décrocher]       │
│                  │                                               │
│ EN HOLD :        │                                               │
│ - (aucun)        │                                               │
└──────────────────┴───────────────────────────────────────────────┘
```

---

## Composants Frontend Mobile (Flutter)

### Nouveaux fichiers

```
lib/features/support/
├── presentation/
│   ├── pages/
│   │   ├── support_page.dart          # Page principale service client
│   │   ├── support_chat_page.dart     # Messagerie E2E client
│   │   └── admin_support_page.dart    # Dashboard super-admin mobile
│   └── widgets/
│       ├── support_widget.dart        # FAB flottant dans ShellPage
│       ├── support_call_panel.dart    # Appel audio + file d'attente
│       └── support_queue_indicator.dart # Position en file d'attente
```

### Integration dans `ShellPage`

```dart
// Ajouter le SupportWidget comme FAB secondaire dans toutes les pages
floatingActionButton: Column(
  mainAxisAlignment: MainAxisAlignment.end,
  children: [
    const SupportWidget(), // Bouton service client
    const SizedBox(height: 8),
    // FAB principal existant si nécessaire
  ],
),
```

---

## Musique d'attente (Hold / Queue)

### Web — `SupportCallPanel.jsx`

```jsx
// Lecture audio en boucle quand status = 'queued' ou 'hold'
const holdAudioRef = useRef(new Audio('/audio/hold-music.mp3'));

useEffect(() => {
  if (callStatus === 'queued' || callStatus === 'hold') {
    holdAudioRef.current.loop = true;
    holdAudioRef.current.play().catch(() => {});
  } else {
    holdAudioRef.current.pause();
    holdAudioRef.current.currentTime = 0;
  }
  return () => holdAudioRef.current.pause();
}, [callStatus]);
```

### Mobile — `support_call_panel.dart`

```dart
// Package just_audio (déjà dans pubspec.yaml)
final _holdPlayer = AudioPlayer();

void _onStatusChanged(String status) async {
  if (status == 'queued' || status == 'hold') {
    await _holdPlayer.setAsset('assets/audio/hold_music.mp3');
    await _holdPlayer.setLoopMode(LoopMode.one);
    await _holdPlayer.play();
  } else {
    await _holdPlayer.stop();
  }
}
```

---

## Intégration dans les Layouts existants

### Web — `Layout.jsx` et `PublicLayout.jsx`

```jsx
// Ajouter <SupportWidget /> à la fin du body, avant </BrowserRouter>
// Dans App.jsx — après les routes, dans le composant racine
<SupportWidget />
```

### Web — Route admin

```jsx
// Dans App.jsx, sous SuperAdminRoute
<Route path="/admin/support" element={<AdminSupportPage />} />
```

### Mobile — Routes dans `app_router.dart`

```dart
// Dans ShellRoute routes
GoRoute(path: '/support', builder: (_, __) => const SupportPage()),

// Hors shell (plein écran)
GoRoute(path: '/admin/support', builder: (_, __) => const AdminSupportPage()),
```

---

## Flux de données détaillés

### Flux 1 : Initiation d'un Support_Chat

```
Utilisateur clique "Service client"
  → GET /api/v1/support/status           # Vérifier disponibilité
  → POST /api/v1/support/sessions/me     # Créer/récupérer session
  → GET /api/v1/support/sessions/me/messages  # Charger historique
  → Connexion WebSocket /support/socket
  → Envoyer premier message chiffré E2E

Super_Admin reçoit :
  → Event WebSocket : support:message:new
  → Notification push si hors ligne
  → Visible dans /admin/support
```

### Flux 2 : Appel audio avec file d'attente

```
Utilisateur appelle
  → POST /api/v1/support/sessions/me/calls
  → GET /api/v1/support/status → { queueLength: 2 }
  
  Si super-admin occupé :
    Backend : enqueue(callId, userId) → position 3
    Client  : event support:call:incoming { queue_position: 3 }
    Client  : Lecture musique d'attente + message "Vous êtes en position 3"
    
    Super-admin voit : appel entrant en queue
    Super-admin clique "Décrocher Carole" :
      Backend : putOnHold(activeCallId)  → Bob entend musique
      Backend : answerNext(caroleCallId) → connexion établie avec Carole
      Client Bob    : event support:call:hold → musique d'attente
      Client Carole : event support:call:answered → connexion audio
      
  Si super-admin libre :
    WebRTC SDP offer/answer via /support/socket
    Connexion audio établie directement
```

### Flux 3 : Vidéoconférence depuis le chat

```
Super-admin ouvre SupportChatPanel d'Alice
  → Clique "Lancer vidéoconférence"
  → POST /api/v1/support/admin/sessions/:id/videoconference
    Backend : VideoConference_Service.createRoom({ isPublic: false, ... })
    Backend : Insert support_message { type: 'video_invite', payload: { roomId, joinUrl } }
    Alice reçoit : event support:message:new { type: 'video_invite' }
    Alice voit   : bouton "Rejoindre la vidéoconférence"
    Alice clique : VideoRoomPage / VideoRoomScreen → POST /videoconference/rooms/:id/join
```

---

## Variables d'environnement supplémentaires

```env
# Limite de la file d'attente appels support
SUPPORT_CALL_QUEUE_MAX=10
# Délai d'attente max avant message automatique (secondes)
SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS=900
# Fichier audio de musique d'attente
SUPPORT_HOLD_MUSIC_PATH=/app/public/audio/hold-music.mp3
```

---

## Migration dans `app.js`

```js
const supportRoutes = require('./modules/support/support.routes');
app.use('/api/v1/support', supportRoutes);
```

## Gateway WebSocket dans `server.js`

```js
const { attachSupportGateway } = require('./modules/support/support.gateway');
attachSupportGateway(server); // même serveur HTTP que le tunnel gateway
```
