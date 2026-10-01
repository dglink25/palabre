# Design Document — Système de Vidéoconférence Palabre

## Overview

Ce document décrit la conception technique du système de vidéoconférence Palabre. Le moteur sous-jacent est Jitsi (via JaaS — Jitsi-as-a-Service ou instance Jitsi auto-hébergée), entièrement encapsulé derrière une `VideoConference_Gateway` qui garantit l'opacité totale vis-à-vis des clients. L'intégration suit strictement les patterns existants de la plateforme (Node.js/Express, React, PostgreSQL, Redis, JWT, `requireAuth` + `requireOrgRole`, `audit_logs`, `notifications`).

Deux modes d'utilisation coexistent :
1. **Vidéoconférence tenant** — intégrée dans l'espace communication de chaque organisation, accessible via `/app/videoconference`
2. **Vidéoconférence publique** — accessible depuis la page d'accueil après authentification, via `/videoconference`

---

## Architecture Système

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (React)                                                 │
│  /app/videoconference   /app/videoconference/:roomId            │
│  /videoconference                                               │
│                                                                 │
│  VideoConferenceGatewayComponent (iframe Palabre-branded)       │
│  ← reçoit uniquement : roomId (UUID), roomToken (JWT Palabre)   │
│  ← jamais de nom de salle Jitsi, jamais de domaine Jitsi        │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS  /api/v1/videoconference/*
                     │
┌────────────────────▼────────────────────────────────────────────┐
│  BACKEND Node.js/Express  (port 4000)                           │
│                                                                 │
│  VideoConference_Gateway                                        │
│  ├── videoconference.routes.js  → /api/v1/videoconference/      │
│  ├── videoconference.service.js → CRUD rooms + JWT JaaS         │
│  ├── scheduler.service.js       → cron/Redis delayed jobs       │
│  └── recording.service.js       → gestion enregistrements       │
│                                                                 │
│  Middleware existing: requireAuth, requireOrgRole               │
│  DB existing: audit_logs, notifications, memberships, orgs      │
└──────┬────────────────────────────────────────────┬────────────┘
       │ SQL (pg Pool)                              │ JaaS REST API
       │                                            │ (HTTPS, JWT RS256)
┌──────▼────────┐                         ┌────────▼──────────────┐
│  PostgreSQL   │                         │  Jitsi/JaaS           │
│  video_rooms  │                         │  (opaque — invisible  │
│  video_room_  │                         │   du client)          │
│  participants │                         └───────────────────────┘
│  video_room_  │
│  invitations  │
│  (migration   │
│   009)        │
└───────────────┘
```

### Services existants réutilisés
- **Coturn** (port 3478) — TURN/STUN déjà opérationnel, réutilisé pour WebRTC Jitsi
- **message-router** (port 4020) — WebSocket Phoenix pour les notifications temps réel (salle d'attente, admission)
- **presence** (port 4010) — Elixir/Phoenix pour statuts en ligne
- **notifications** table (migration 002) — réutilisée pour invitations et rappels persistants
- **audit_logs** table (migration 001) — réutilisée pour tous les événements de Room

---

## Modèle de Données

### Migration 009 — `video_rooms`, `video_room_participants`, `video_room_invitations`

```sql
-- ============================================================
-- Migration 009 — Vidéoconférence (white-label Jitsi/JaaS)
-- ============================================================

-- ── Rooms de vidéoconférence ──────────────────────────────────
CREATE TABLE video_rooms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL pour les Public_VideoConferences (pas de tenant)
  org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  host_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','active','ended','cancelled')),
  access_policy           TEXT NOT NULL DEFAULT 'closed'
                            CHECK (access_policy IN ('open','closed')),
  -- Nom de salle Jitsi interne — JAMAIS exposé au client
  jitsi_room_name         TEXT NOT NULL UNIQUE,
  -- NULL si création immédiate
  scheduled_at            TIMESTAMPTZ,
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  estimated_duration_min  INTEGER CHECK (estimated_duration_min BETWEEN 1 AND 480),
  max_participants        INTEGER NOT NULL DEFAULT 300
                            CHECK (max_participants BETWEEN 1 AND 300),
  -- Métadonnées pour l'historique admin
  actual_participant_count INTEGER,
  recording_available     BOOLEAN NOT NULL DEFAULT false,
  recording_storage_path  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_rooms_org        ON video_rooms(org_id)         WHERE org_id IS NOT NULL;
CREATE INDEX idx_video_rooms_host       ON video_rooms(host_user_id);
CREATE INDEX idx_video_rooms_status     ON video_rooms(status)         WHERE status IN ('scheduled','active');
CREATE INDEX idx_video_rooms_scheduled  ON video_rooms(scheduled_at)   WHERE status = 'scheduled';

-- ── Participants à une vidéoconférence ────────────────────────
CREATE TABLE video_room_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'participant'
                CHECK (role IN ('host','moderator','participant')),
  -- waiting → admitted (active) ou excluded
  status      TEXT NOT NULL DEFAULT 'invited'
                CHECK (status IN ('invited','waiting','active','excluded','left')),
  -- JWT Palabre signé pour cette session (opaque pour le client côté payload Jitsi)
  session_token_hash TEXT,
  joined_at   TIMESTAMPTZ,
  left_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

CREATE INDEX idx_vrp_room     ON video_room_participants(room_id, status);
CREATE INDEX idx_vrp_user     ON video_room_participants(user_id);
CREATE INDEX idx_vrp_waiting  ON video_room_participants(room_id) WHERE status = 'waiting';

-- ── Invitations à une vidéoconférence ─────────────────────────
CREATE TABLE video_room_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Token de lien partageable (hash, jamais en clair en base)
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, invitee_user_id)
);

CREATE INDEX idx_vri_room     ON video_room_invitations(room_id);
CREATE INDEX idx_vri_invitee  ON video_room_invitations(invitee_user_id);
CREATE INDEX idx_vri_token    ON video_room_invitations(token_hash) WHERE revoked_at IS NULL;
```

### Tables existantes réutilisées

| Table | Usage |
|---|---|
| `notifications` | Invitations persistantes, rappels 15 min, notifications d'admission |
| `audit_logs` | Tous les événements Room (création, début, admission, exclusion, enregistrement, fin) |
| `memberships` | Vérification appartenance tenant pour access_policy=open |
| `organizations` | Isolation multi-tenant |

---

## Composants Backend

### Structure des fichiers

```
backend/src/modules/videoconference/
├── videoconference.routes.js      # Toutes les routes /api/v1/videoconference/
├── videoconference.service.js     # CRUD rooms, JWT JaaS, contrôle participants
├── scheduler.service.js           # Cron/Redis delayed jobs pour rooms planifiées
└── recording.service.js           # Gestion des enregistrements

backend/migrations/
└── 009_videoconference.sql        # Tables video_rooms, participants, invitations
```

### `videoconference.routes.js` — Endpoints

```
POST   /api/v1/videoconference/rooms              # Créer une room (tenant ou publique)
GET    /api/v1/videoconference/rooms              # Lister rooms du tenant (historique)
GET    /api/v1/videoconference/rooms/:roomId      # Détail d'une room + token de session
PATCH  /api/v1/videoconference/rooms/:roomId      # Modifier une room planifiée
DELETE /api/v1/videoconference/rooms/:roomId      # Annuler une room planifiée

POST   /api/v1/videoconference/rooms/:roomId/join          # Rejoindre une room
POST   /api/v1/videoconference/rooms/:roomId/leave         # Quitter une room
POST   /api/v1/videoconference/rooms/:roomId/admit/:userId # Admettre un participant (salle d'attente)
POST   /api/v1/videoconference/rooms/:roomId/kick/:userId  # Exclure un participant
POST   /api/v1/videoconference/rooms/:roomId/mute/:userId  # Muter un participant (signal Jitsi)
POST   /api/v1/videoconference/rooms/:roomId/invite        # Inviter des participants
POST   /api/v1/videoconference/rooms/:roomId/recording/start  # Démarrer enregistrement
POST   /api/v1/videoconference/rooms/:roomId/recording/stop   # Arrêter enregistrement

GET    /api/v1/videoconference/invite/:token      # Rejoindre via lien d'invitation

# Route publique — page d'accueil
POST   /api/v1/videoconference/public/rooms       # Créer une room publique (auth requise)
```

**Middleware appliqué :**
- Toutes les routes : `requireAuth`
- Routes tenant (avec `organizationId`) : `requireOrgRole(['org_admin','org_member','standard_user','call_center_agent','field_agent'])`
- Actions de modération (admit, kick, mute) : vérification rôle `host` ou `moderator` en base

### `videoconference.service.js` — Logique métier clé

#### Génération du JWT JaaS (White-Label)

```js
// Ce JWT est signé avec la clé JAAS_PRIVATE_KEY (RS256)
// Il est transmis à Jitsi côté serveur uniquement — jamais au client
function generateJaaSToken({ jitsiRoomName, user, isModerator, orgId }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: process.env.JAAS_APP_ID,
    sub: process.env.JAAS_APP_ID,        // requis par JaaS
    aud: 'jitsi',
    iat: now,
    exp: now + 86400,                    // 24h max (R9.1)
    room: jitsiRoomName,                 // interne — jamais exposé au client
    context: {
      user: {
        id:        user.id,              // identifiant Palabre opaque
        name:      user.fullName,
        email:     user.email,
        moderator: isModerator,
      },
      features: {
        recording:  isModerator,
        'live-streaming': false,
        outbound:   false,
      },
    },
  };
  // RS256 avec JAAS_PRIVATE_KEY
  return jwt.sign(payload, process.env.JAAS_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: process.env.JAAS_KEY_ID,
  });
}
```

#### Token de session retourné au client

Le client reçoit uniquement un **token Palabre** (JWT signé avec `JWT_ACCESS_SECRET`) qui contient :
```json
{
  "roomId": "uuid-palabre-opaque",
  "sub":    "user-id",
  "iat":    1234567890,
  "exp":    1234654290
}
```
Il ne contient **aucune** référence Jitsi. La résolution `roomId → jitsi_room_name` + génération du token JaaS se fait **exclusivement côté backend** au moment où le frontend iframe appelle l'endpoint de join.

#### Isolation multi-tenant

```js
async function assertRoomBelongsToTenant(roomId, orgId) {
  const { rows } = await pool.query(
    'SELECT id FROM video_rooms WHERE id = $1 AND org_id = $2',
    [roomId, orgId]
  );
  if (!rows[0]) {
    const err = new Error('Accès refusé.');
    err.code = 'CROSS_TENANT_ACCESS_DENIED';
    err.httpStatus = 403;
    throw err;
  }
}
```

#### Flux de join (access_policy=closed)

```
Client → POST /join
  └─ Backend :
       1. requireAuth + vérifier appartenance tenant
       2. Vérifier status room (active ou scheduled)
       3. Vérifier exclusion (status='excluded' → PARTICIPANT_EXCLUDED)
       4. Si access_policy='closed' et pas d'invitation valide :
          → upsert video_room_participants(status='waiting')
          → notifier Host via notifications + message-router WS
          → retourner { status: 'waiting' }
       5. Si access_policy='open' ou invitation valide :
          → Vérifier capacité (<300)
          → upsert video_room_participants(status='active', joined_at=now)
          → générer token de session Palabre (JWT court durée)
          → retourner { status: 'admitted', sessionToken: '...', roomId: '...' }
          (jamais jitsi_room_name, jamais token JaaS)
```

### `scheduler.service.js` — Planification

Utilise **Redis** pour les jobs différés (pattern `SETEX` + processus de polling) et **`node-cron`** ou un simple interval :

```
Processus planificateur (démarré avec l'app) :
  - Toutes les 60s : SELECT rooms WHERE status='scheduled' AND scheduled_at <= now() + 2min
  - Pour chaque room à activer :
    1. UPDATE status='active'
    2. Pour chaque participant invité : INSERT INTO notifications(...) + push WS
  - Toutes les 60s : SELECT rooms WHERE status='scheduled' AND scheduled_at = now() + 15min (±30s)
    → rappel 15 minutes avant (R8.3)
```

### `recording.service.js` — Enregistrements

```
POST /recording/start :
  1. Vérifier que host/moderator
  2. Appel JaaS Recording API pour démarrer l'enregistrement sur la salle Jitsi
  3. Audit log : RECORDING_STARTED
  4. UPDATE video_rooms SET recording_available=true

POST /recording/stop :
  1. Appel JaaS Recording API pour arrêter
  2. Récupérer URL du fichier enregistré (webhook JaaS ou polling)
  3. UPDATE video_rooms SET recording_storage_path=..., recording_available=true
  4. Notifier Host : enregistrement disponible (notifications table)
  5. Audit log : RECORDING_ENDED
```

---

## Composants Frontend

### Structure des fichiers

```
frontend/web/src/
├── pages/
│   ├── app/
│   │   ├── VideoConferencePage.jsx       # Liste rooms tenant + création
│   │   └── VideoRoomPage.jsx             # Session active (iframe + contrôles)
│   └── videoconference/
│       └── PublicVideoConferencePage.jsx # Création publique depuis /videoconference
├── components/
│   └── videoconference/
│       ├── VideoConferenceGateway.jsx    # Iframe Palabre (white-label Jitsi)
│       ├── CreateRoomModal.jsx           # Formulaire création/planification
│       ├── RoomCard.jsx                  # Carte room dans la liste
│       ├── ParticipantsList.jsx          # Liste participants temps réel
│       ├── WaitingRoomPanel.jsx          # Panneau salle d'attente (Host)
│       └── InviteModal.jsx              # Invitation participants
└── lib/
    └── videoconferenceApi.js            # Wrappers API videoconference
```

### `VideoConferenceGateway.jsx` — White-Label IFrame

C'est le composant central qui encapsule Jitsi sans exposer aucune référence :

```jsx
/**
 * VideoConferenceGateway
 * 
 * Ce composant reçoit uniquement { sessionToken, roomId } du backend.
 * Il appelle un endpoint proxy backend pour obtenir la configuration
 * Jitsi nécessaire à l'iframe — aucun nom de salle Jitsi ni domaine
 * Jitsi n'est jamais présent dans le DOM ou les requêtes réseau visibles.
 * 
 * Flux :
 *   1. Mount → POST /api/v1/videoconference/rooms/:roomId/session
 *      → backend valide sessionToken, génère JWT JaaS, retourne { config }
 *   2. Initialise JitsiMeetExternalAPI via script injecté dynamiquement
 *      depuis le domaine backend (pas depuis meet.jit.si)
 *   3. Configure l'API avec les overrides UI (suppression logos, watermarks)
 */
export default function VideoConferenceGateway({ roomId, sessionToken, onLeave }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let api;
    
    async function initConference() {
      // Résoudre la config depuis le backend (jitsi_room_name jamais dans la réponse)
      const { domain, roomToken, displayName } = await api.post(
        `/videoconference/rooms/${roomId}/session`,
        { sessionToken }
      );
      // domain = domaine Jitsi auto-hébergé (ex: "meet.palabre-internal.com")
      // roomToken = JWT JaaS signé côté backend (contient le room name interne)
      // displayName = nom affiché de la conférence (titre Palabre)
      
      api = new window.JitsiMeetExternalAPI(domain, {
        roomName: roomToken, // JaaS utilise le JWT comme roomName pour l'auth
        jwt: roomToken,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          // Suppression totale de la marque Jitsi
          disableDeepLinking: true,
          enableWelcomePage: false,
          enableClosePage: false,
          disableInviteFunctions: true, // invitations gérées par Palabre
          toolbarButtons: [
            'microphone', 'camera', 'closedcaptions', 'desktop',
            'fullscreen', 'fodeviceselection', 'hangup', 'chat',
            'recording', 'raisehand', 'videoquality', 'filmstrip',
            'participants-pane', 'tileview',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          SHOW_POWERED_BY: false,
          DISPLAY_WELCOME_FOOTER: false,
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
          APP_NAME: 'Palabre',
          NATIVE_APP_NAME: 'Palabre',
          PROVIDER_NAME: 'Palabre',
          LANG_DETECTION: false,
          CONNECTION_INDICATOR_DISABLED: false,
          VIDEO_QUALITY_LABEL_DISABLED: false,
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_ALWAYS_VISIBLE: false,
        },
        userInfo: { displayName },
      });
      
      apiRef.current = api;
      api.addEventListener('readyToClose', onLeave);
      api.addEventListener('participantLeft', handleParticipantLeft);
    }
    
    initConference();
    return () => { apiRef.current?.dispose(); };
  }, [roomId, sessionToken]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}
      // Attribut HTML qui ne révèle pas Jitsi
      data-palabre-room={roomId}
    />
  );
}
```

**Note architecture :** Le script `JitsiMeetExternalAPI` est chargé depuis le backend Palabre (proxy du script Jitsi) via un `<script>` tag dont l'URL est opaque (`/api/v1/videoconference/client-sdk`). Le domaine Jitsi n'apparaît jamais dans le code frontend.

### `VideoConferencePage.jsx` — Liste tenant

```jsx
// Route : /app/videoconference (OrgMemberOrAdminRoute)
// Affiche :
//   - Bouton "Nouvelle réunion" (immédiate) + "Planifier"
//   - Liste des rooms actives du tenant
//   - Historique des rooms terminées (admin only)
//   - Rooms planifiées à venir
```

### `VideoRoomPage.jsx` — Session active

```jsx
// Route : /app/videoconference/:roomId (OrgMemberOrAdminRoute)
// Affiche :
//   - VideoConferenceGateway (plein écran)
//   - Panneau flottant : liste participants, salle d'attente (si host)
//   - Contrôles Palabre overlay (les contrôles Jitsi sont remplacés par ceux-ci
//     via postMessage/JitsiMeetExternalAPI)
```

### `PublicVideoConferencePage.jsx` — Page publique

```jsx
// Route : /videoconference (ProtectedRoute)
// Affiche le formulaire de création :
//   - Titre de la réunion
//   - Immédiat / Planifier (date + heure + durée estimée)
//   - Access policy (ouvert/fermé)
//   - Inviter des participants (search par nom/email)
//   - Bouton "Lancer" ou "Planifier"
```

---

## Design de l'Interface Utilisateur

### Principes visuels
- **Style institutionnel** : fond blanc/gris clair, accents `var(--color-primary-blue)`, typographie sobre
- **Pas de couleur Jitsi** : remplacer les éléments visuels Jitsi par la charte graphique Palabre
- **Pattern existant** : suivre exactement le style de `CallsPage.jsx` et `Layout.jsx`

### Page de liste des vidéoconférences (`/app/videoconference`)

```
┌─────────────────────────────────────────────────────┐
│  Vidéoconférences                      [+ Nouvelle]  │
│  Réunions et conférences de votre organisation       │
├─────────────────────────────────────────────────────┤
│  🟢 EN COURS                                        │
│  ┌──────────────────────────────────────────────┐   │
│  │ Réunion hebdomadaire équipe                  │   │
│  │ Démarré il y a 12 min · 8 participants       │   │
│  │                              [Rejoindre →]   │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  📅 À VENIR                                         │
│  ┌──────────────────────────────────────────────┐   │
│  │ Présentation produit Q4         Demain 14:00  │   │
│  │ Planifié par Alice Martin · 45 participants   │   │
│  │                         [Détails] [Rejoindre] │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  📋 HISTORIQUE (admin uniquement)                   │
│  ┌──────────────────────────────────────────────┐   │
│  │ Formation onboarding    12 oct. · 2h14 · 23  │   │
│  │ Séminaire annuel        08 oct. · 4h02 · 87  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Session active (`/app/videoconference/:roomId`)

```
┌─────────────────────────────────────────────────────┐
│  [Logo Palabre]  Réunion hebdomadaire équipe  🔴 REC │
├───────────────────────────────┬─────────────────────┤
│                               │  Participants (8)    │
│                               │  ● Alice Martin      │
│    [Flux vidéo principal]     │    🎤 📹             │
│                               │  ● Bob Dupont        │
│                               │    🔇 📹             │
│   [Vue en mosaïque]          │                      │
│                               │  ⏳ En attente (2)   │
│                               │  > Carole E.  [✓][✗] │
│                               │  > David K.   [✓][✗] │
├───────────────────────────────┴─────────────────────┤
│  [🎤] [📹] [🖥️ Partager] [💬 Chat] [👥] [⚫ Quitter] │
└─────────────────────────────────────────────────────┘
```

### Modal de création de réunion

```
┌─────────────────────────────────────────────────────┐
│  Nouvelle réunion                                [✕] │
├─────────────────────────────────────────────────────┤
│  Titre de la réunion *                               │
│  [_______________________________________]           │
│                                                     │
│  ○ Démarrer maintenant                              │
│  ● Planifier                                        │
│     Date  [dd/mm/yyyy]  Heure  [hh:mm]              │
│     Durée estimée  [___] minutes                    │
│                                                     │
│  Accès                                              │
│  ○ Ouvert (tous les membres peuvent rejoindre)      │
│  ● Fermé  (invitation requise)                      │
│                                                     │
│  Inviter des participants                           │
│  [Rechercher par nom ou email...]                   │
│  ┌──── Alice Martin ────┐  ┌──── Bob Dupont ────┐  │
│  │ alice@...      [✕]   │  │ bob@...       [✕]  │  │
│  └──────────────────────┘  └────────────────────┘  │
│                                                     │
│                    [Annuler]  [Créer la réunion →]  │
└─────────────────────────────────────────────────────┘
```

---

## Flux de données détaillés

### Flux 1 : Création + lancement immédiat (tenant)

```
Utilisateur clique "Nouvelle réunion"
  → POST /api/v1/videoconference/rooms
    Body: { title, accessPolicy: 'closed', immediate: true, invitees: [userId, ...] }
    Headers: Authorization: Bearer <accessToken>
  
  Backend (videoconference.service.js) :
    1. requireAuth → req.user.id, req.user.org_id
    2. Générer jitsi_room_name = 'pb_' + crypto.randomBytes(16).toString('hex')
       (interne — jamais retourné au client)
    3. INSERT video_rooms(org_id, host_user_id, title, status='active',
                          access_policy, jitsi_room_name, started_at=now)
    4. INSERT video_room_participants(room_id, user_id=host, role='host', status='active')
    5. Pour chaque invitee_id :
       - INSERT video_room_invitations(room_id, invitee_user_id, token_hash, expires_at=+30j)
       - INSERT notifications(user_id=invitee, type='video_invitation', payload={roomId, title, hostName})
    6. INSERT audit_logs(action='VIDEO_ROOM_CREATED', target_id=roomId, org_id, actor_user_id)
  
  → Réponse 201 :
    { roomId: "uuid-opaque", title, status: 'active', joinUrl: '/app/videoconference/uuid' }
    (JAMAIS jitsi_room_name, JAMAIS domaine Jitsi)

Utilisateur redirigé vers /app/videoconference/:roomId
  → GET /api/v1/videoconference/rooms/:roomId
    → { id, title, status, accessPolicy, participantCount, hostId, scheduledAt, ... }
    
  → VideoRoomPage monte VideoConferenceGateway
  → POST /api/v1/videoconference/rooms/:roomId/session
    Body: { sessionToken: <JWT Palabre court durée> }
    
    Backend :
      1. Valider sessionToken (JWT_ACCESS_SECRET)
      2. Vérifier appartenance tenant + room
      3. Générer JWT JaaS (RS256) avec jitsi_room_name (récupéré en base)
      4. Retourner { domain: 'meet.palabre.app', roomToken: <JWT JaaS>, displayName: title }
    
  → VideoConferenceGateway initialise JitsiMeetExternalAPI
     (le domain 'meet.palabre.app' est le serveur Jitsi auto-hébergé ou JaaS proxy)
```

### Flux 2 : Rejoindre une room fermée (salle d'attente)

```
Participant clique "Rejoindre" sur une room à access_policy='closed'
  → POST /api/v1/videoconference/rooms/:roomId/join
  
  Backend :
    1. Vérifier pas d'invitation valide (token expiré/révoqué)
    2. Vérifier pas 'excluded'
    3. Vérifier room.status = 'active'
    4. UPSERT video_room_participants(status='waiting')
    5. INSERT notifications(user_id=host, type='waiting_room', payload={participantId, roomId})
    6. Si Host connecté → push WS via message-router : { event: 'participant_waiting', ... }
  
  → Réponse 200 : { status: 'waiting', message: 'En attente d\'admission' }
  → Frontend affiche "En attente de l'hôte..."

Host voit la notification dans WaitingRoomPanel
  → POST /api/v1/videoconference/rooms/:roomId/admit/:participantId
  
  Backend :
    1. Vérifier role='host'|'moderator' pour req.user
    2. UPDATE video_room_participants(status='active', joined_at=now)
    3. Générer sessionToken pour le participant
    4. Push WS au participant : { event: 'admitted', sessionToken }
    5. INSERT audit_logs(action='PARTICIPANT_ADMITTED', ...)
  
  → Participant reçoit le push WS → VideoConferenceGateway initialise Jitsi
```

### Flux 3 : Vidéoconférence publique depuis /videoconference

```
Utilisateur non auth clique sur "Créer une réunion" en page d'accueil
  → Redirect vers /login?redirect=/videoconference&intent=create
  → Après auth → /videoconference (ProtectedRoute)
  → PublicVideoConferencePage affiche le formulaire

Utilisateur auth soumet le formulaire
  → POST /api/v1/videoconference/public/rooms
    Body: { title, accessPolicy, invitees, scheduled: false }
    
  Backend :
    1. requireAuth (pas de org_id requis)
    2. Générer jitsi_room_name interne
    3. INSERT video_rooms(org_id=NULL, host_user_id, ...)
    4. Générer lien partageable : /join/:invitationToken
    5. Pour chaque invitee : INSERT notifications + video_room_invitations
    6. INSERT audit_logs(action='PUBLIC_VIDEO_ROOM_CREATED', ...)
  
  → Réponse : { roomId, joinUrl: '/videoconference/:roomId', shareLink }
```

### Flux 4 : Participant externe (hors réseau tenant via Tunnel)

```
Participant externe possède une Invitation valide
  → GET /api/v1/videoconference/invite/:token
  
  Backend :
    1. Valider token (hash en base, non expiré, non révoqué)
    2. requireAuth (via header Authorization ou redirect /login)
    3. Vérifier que req.user.id = invitee_user_id
    4. Retourner { roomId, title, hostName }
  
  → Frontend : /app/videoconference/:roomId
  → POST /join → Backend détecte le participant hors réseau tenant
    (via vérification tenant_agents.agent_url vs req IP ou flag dans JWT)
    → Utilise le serveur Coturn existant comme TURN relay
    → JWT JaaS généré identique (même niveau d'accès)
    → WebRTC établi via TURN (coturn) → flux relayé au cluster Jitsi
```

---

## Sécurité

### Stratégie de masquage Jitsi (White-Label)

| Niveau | Mesure |
|---|---|
| **URLs** | Jamais `meet.jit.si` ni `8x8.vc` dans les réponses API ou le DOM |
| **JWT** | Le JWT JaaS (contient `jitsi_room_name`) n'est jamais retourné au client |
| **Script SDK** | `external_api.js` servi via proxy backend à `/api/v1/videoconference/client-sdk` |
| **IFrame src** | Généré dynamiquement par `JitsiMeetExternalAPI`, non visible dans le DOM React |
| **Headers HTTP** | Backend filtre les requêtes contenant `jitsi`, `8x8.vc`, `meet.jit.si` (R1.4) |
| **CSP** | `Content-Security-Policy` configuré pour autoriser uniquement le domaine Jitsi interne |
| **Room name** | `jitsi_room_name` stocké uniquement en base — colonne non sélectionnée dans les requêtes retournées au client |

### JWT par tenant (R9.1)

```js
// Une clé HMAC distincte par tenant, dérivée de JWT_ACCESS_SECRET + org_id
function getTenantJwtKey(orgId) {
  return crypto
    .createHmac('sha256', process.env.JWT_ACCESS_SECRET)
    .update(orgId || 'public')
    .digest('hex');
}
```

### Isolation multi-tenant

Chaque requête sur `/api/v1/videoconference/rooms/*` vérifie :
1. `requireAuth` → `req.user.org_id`
2. `SELECT FROM video_rooms WHERE id=$1 AND org_id=$2` → erreur `CROSS_TENANT_ACCESS_DENIED` si mismatch
3. Les `video_room_participants`, `video_room_invitations` héritent de l'isolation via la FK `room_id`

### Audit complet

Chaque action insère dans `audit_logs` :
```js
{
  organization_id: room.org_id,
  actor_user_id:   req.user.id,
  action:          'VIDEO_ROOM_CREATED' | 'VIDEO_SESSION_STARTED' |
                   'PARTICIPANT_ADMITTED' | 'PARTICIPANT_EXCLUDED' |
                   'RECORDING_STARTED' | 'RECORDING_ENDED' |
                   'VIDEO_SESSION_ENDED',
  target_type:     'video_room',
  target_id:       room.id,
  metadata:        { title, participantId?, duration? }
}
```

---

## Variables d'environnement à ajouter

```env
# --- Jitsi / JaaS ---
JAAS_APP_ID=              # ID de l'application JaaS (ou vide si self-hosted)
JAAS_KEY_ID=              # ID de la clé RSA pour signer les JWT JaaS
JAAS_PRIVATE_KEY=         # Clé privée RSA (PEM) pour JWT JaaS

# URL du serveur Jitsi auto-hébergé (si pas JaaS)
# Format : domaine uniquement, sans https:// ni path
JITSI_DOMAIN=meet.palabre.app

# Si mode JaaS (8x8), cette valeur est ignorée (JAAS_APP_ID est utilisé)
# Si mode self-hosted, JWT signé avec JITSI_JWT_SECRET (HS256)
JITSI_JWT_SECRET=change_me_jitsi_jwt_secret

# Durée max d'une session vidéo (sécurité, défaut 24h)
VIDEO_SESSION_JWT_TTL_SECONDS=86400

# Stockage des enregistrements
VIDEO_RECORDING_STORAGE_PATH=/data/recordings
```

---

## Intégration dans la navigation existante

### `Layout.jsx` — Ajout dans `ICONS` et `memberItems` / `orgItems`

```js
// Dans ICONS :
video: ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],

// Dans memberItems (section Communication) :
{ to: '/app/videoconference', key: 'video', label: 'Vidéoconférence' },

// Dans orgItems (section Communication pour org_admin) :
{ to: '/app/videoconference', key: 'video', label: 'Vidéoconférence' },
```

### `App.jsx` — Nouvelles routes

```jsx
// Sous OrgMemberOrAdminRoute (espace communication tenant) :
<Route path="/app/videoconference"         element={<VideoConferencePage />} />
<Route path="/app/videoconference/:roomId" element={<VideoRoomPage />} />

// Sous ProtectedRoute (vidéoconférence publique, tout utilisateur auth) :
<Route path="/videoconference"             element={<PublicVideoConferencePage />} />
<Route path="/videoconference/:roomId"     element={<VideoRoomPage />} />

// Public (lien d'invitation partageable, redirect vers login si non auth) :
<Route path="/join/:invitationToken"       element={<JoinByInvitationPage />} />
```

---

## Traitement des erreurs

| Code d'erreur | HTTP | Contexte |
|---|---|---|
| `UNAUTHORIZED` | 401 | Non authentifié |
| `CROSS_TENANT_ACCESS_DENIED` | 403 | Room d'un autre tenant |
| `UNAUTHORIZED_TENANT` | 403 | Non membre du tenant (room ouverte) |
| `PARTICIPANT_EXCLUDED` | 403 | Participant exclu par le Host |
| `ROOM_FULL` | 409 | 300 participants atteints |
| `ROOM_NOT_ACTIVE` | 409 | Room pas encore active (planifiée) |
| `INVALID_SCHEDULE_TIME` | 400 | Date < 5 min dans le futur |
| `TOKEN_INVALID` | 401 | JWT de session expiré ou invalide |
| `INVITEE_NOT_FOUND` | 404 | Utilisateur cible de l'invitation introuvable |
| `SCREEN_SHARE_ALREADY_ACTIVE` | 409 | Partage d'écran déjà en cours |
| `BAD_REQUEST` | 400 | Paramètre révélant Jitsi détecté (R1.4) |

---

## Considérations de performance

- **300 participants** : garanti par l'architecture SFU de Jitsi (serveur JaaS ou self-hosted avec `prosody` + `jicofo` + `jvb`)
- **Adaptation qualité** : délégué au composant Jitsi Video Bridge (JVB) — nativement supporté via `simulcast` et `bandwidth estimation`
- **Reconnexion automatique** : `JitsiMeetExternalAPI` expose l'événement `connectionFailed` — le frontend tente 3 reconnexions espacées de 3s via `api.executeCommand('hangup')` + re-init
- **Coturn existant** : réutilisé tel quel pour les participants externes — les credentials TURN sont déjà gérés par `turn.routes.js`
- **Redis** : utilisé par le scheduler pour les jobs différés (rappels 15 min) et le pub/sub des notifications salle d'attente

---

## Résumé des dépendances à ajouter

```json
// backend/package.json — aucune dépendance externe supplémentaire requise
// jsonwebtoken : déjà présent (auth)
// crypto : natif Node.js (HMAC)
// node-cron : à ajouter pour le scheduler
{
  "node-cron": "^3.0.3"
}

// frontend/web/package.json
{
  "@jitsi/react-sdk": "^1.5.0"
  // OU utilisation directe de l'External API (aucune dépendance npm)
  // via script proxy backend — recommandé pour le white-label
}
```

**Note :** L'utilisation directe du script `external_api.js` (sans npm) via le proxy backend est **préférable** pour le white-label, car elle évite que le nom "jitsi" apparaisse dans `node_modules` visible côté dev tools.
