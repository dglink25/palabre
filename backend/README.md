# Backend Palabre — API REST

API Node.js/Express. Auth, profil, onboarding organisations, messagerie E2E, appels, vidéoconférence, service client.

---

## Structure

```
backend/
├── src/
│   ├── app.js                    Express + routes
│   ├── server.js                 HTTP + WebSocket (tunnel, support)
│   ├── config/
│   │   ├── db.js                 Pool PostgreSQL
│   │   ├── firebase.js           Firebase Admin SDK
│   │   ├── mailer.js             Nodemailer
│   │   └── redis.js              Redis (sessions, pub/sub, présence)
│   ├── middleware/
│   │   ├── authMiddleware.js     JWT + chargement user
│   │   ├── upload.js             Multer (photos, médias 25 Mo max)
│   │   ├── rbac.js               Contrôle d'accès par rôle
│   │   └── validators.js         Fonctions de validation
│   └── modules/
│       ├── auth/                 Connexion, OTP, super-admin, passkeys
│       ├── calls/                TURN credentials + historique P2P
│       ├── messaging/            Conversations, messages, clés Signal E2E
│       ├── onboarding/           Dossiers organisations, activation admin
│       ├── org/                  Liaison tenant, invitations membres
│       ├── security/             Passkeys WebAuthn, 2FA, step-up
│       ├── sessions/             Sessions multi-appareils, heartbeat
│       ├── support/              Service client (WebSocket, file d'attente)
│       ├── tenant-provisioning/  DNS, tunnel WireGuard (heartbeat agents)
│       ├── users/                Profil, photo, préférences, FCM tokens
│       └── videoconference/      Rooms Jitsi, session JWT, modération
├── migrations/                   SQL numérotés 001 → 013
├── secrets/                      Secrets fichiers (ignoré git)
├── .env.example                  Template
└── package.json
```

---

## Démarrage

### Via Docker (recommandé)

```bash
# Depuis la racine du projet
./palabre.sh start core
./palabre.sh migrate
```

### En développement local

```bash
# Prérequis : Node.js 20+, PostgreSQL 16, Redis 7
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

---

## Configuration — backend/.env

### 1. Firebase Admin SDK (obligatoire)

Utilisé pour : vérification tokens Google/GitHub/Apple, envoi notifications FCM.

1. Console Firebase → Paramètres du projet → **Comptes de service**
2. **Générer une nouvelle clé privée** → télécharger le JSON
3. Placer dans `backend/secrets/`

```env
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/nom-du-fichier.json
```

---

### 2. Convessa — OTP WhatsApp (obligatoire)

```env
CONVESSA_API_KEY=pk_convessa_xxxxxx
CONVESSA_API_URL=https://convessa.epac-uac-optica-chapter.bj
```

---

### 3. SMTP Gmail (obligatoire)

1. Activez la 2FA : https://myaccount.google.com/security
2. Sécurité → Mots de passe des applications → créer "Palabre"
3. Copiez les 16 caractères

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=votre@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=Palabre <votre@gmail.com>
```

---

### 4. Secrets cryptographiques (obligatoires)

```bash
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 32   # → SUPER_ADMIN_STEP_SECRET
openssl rand -hex 32   # → CONFIRMATION_TOKEN_SECRET
openssl rand -hex 32   # → INTERNAL_SERVICES_SECRET   ← identique dans docker/.env
openssl rand -hex 32   # → ERLANG_COOKIE              ← identique dans docker/.env
openssl rand -hex 64   # → PHOENIX_SECRET_KEY_BASE    ← identique dans docker/.env (min 64 chars)
openssl rand -hex 32   # → TURN_SECRET                ← identique dans docker/.env et tenant/.env
```

---

### 5. Passkeys WebAuthn (obligatoire)

```env
PASSKEY_RP_NAME=Palabre
PASSKEY_RP_ID=localhost              # développement
PASSKEY_ORIGIN=http://localhost:3000

# Production :
# PASSKEY_RP_ID=palabre.mondomaine.com
# PASSKEY_ORIGIN=https://palabre.mondomaine.com
```

> Modifier `PASSKEY_RP_ID` invalide tous les passkeys enregistrés.

---

### 6. Vidéoconférence Jitsi (obligatoire pour la vidéo)

**Option A — Self-hosted (fonctionne sans internet, recommandé pour tenant)**

```env
JITSI_DOMAIN=meet.votre-serveur.local    # domaine ou IP du serveur Jitsi
JITSI_JWT_SECRET=<openssl rand -hex 32>
VIDEO_SESSION_JWT_TTL_SECONDS=86400
VIDEO_RECORDING_STORAGE_PATH=/data/recordings
```

> Si `JITSI_DOMAIN` ne finit **pas** par `.jit.si` ni `.8x8.vc`, le proxy SDK ne tente jamais de charger depuis internet → 100% LAN.

**Option B — JaaS 8x8 (cloud)**

Obtenez vos credentials sur https://jaas.8x8.vc :

```env
JAAS_APP_ID=vpaas-magic-cookie-xxxxxx
JAAS_KEY_ID=vpaas-magic-cookie-xxxxxx/xxxxxx
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JITSI_DOMAIN=8x8.vc
```

---

### 7. TURN/STUN (appels WebRTC — obligatoire en production)

```env
TURN_HOST=localhost        # IP ou domaine du serveur Coturn
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_SECRET=<openssl rand -hex 32>   # même valeur que coturn + tenant
TURN_REALM=palabre.app
```

> Les credentials TURN sont générés dynamiquement (HMAC-SHA1 sur timestamp) — aucun credential statique ne transite vers les clients.

---

### 8. Infra E2E Signal Protocol (automatique)

Les tables `signal_identities`, `signal_prekeys`, `signal_sessions` sont créées par la migration `013_e2e_key_infrastructure.sql`. Aucune configuration supplémentaire requise — les clés sont générées par les clients et uploadées via `/api/v1/messaging/signal/*`.

Routes disponibles :
- `POST /api/v1/messaging/signal/identity` — enregistrer la clé d'identité d'un appareil
- `POST /api/v1/messaging/signal/prekeys` — uploader les prékeys publiques
- `GET  /api/v1/messaging/signal/prekeys/:userId/:deviceId` — récupérer le bundle d'un pair
- `GET  /api/v1/messaging/signal/prekeys/count` — stock de prékeys restantes

---

### 9. Service client (support)

```env
SUPPORT_CALL_QUEUE_MAX=10                # capacité de la file
SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS=600   # timeout avant abandon
SUPPORT_HOLD_MUSIC_PATH=/audio/hold-music.mp3
```

**Fichier audio d'attente :**  
Placez un MP3 dans le volume monté et ajustez `SUPPORT_HOLD_MUSIC_PATH`.

---

### 10. Optionnel

```env
RECAPTCHA_SECRET_KEY=      # Google reCAPTCHA v2 (vide = désactivé)

DNS_PROVIDER=mock          # 'powerdns' si provisionnement DNS automatique
POWERDNS_API_URL=http://pdns:8053
POWERDNS_API_KEY=
PALABRE_BASE_DOMAIN=palabre.com
```

---

## Migrations

| Fichier | Contenu |
|---------|---------|
| `001` | Users, sessions, devices, OAuth |
| `002` | Organisations, rôles, memberships |
| `003` | OTP, invitations, onboarding |
| `004` | Super-administrateur |
| `005` | Passkeys WebAuthn |
| `006` | Conversations, messages, clés Signal (tables initiales) |
| `007` | Codes d'invitation org |
| `008` | Agents tenant |
| `009` | Vidéoconférence |
| `010` | Provisionnement tenant (DNS, tunnel) |
| `011` | Service client |
| `012` | Appels P2P WebRTC |
| `013` | Infrastructure E2E complète (sessions Signal, rotations clés, vue stock) |

```bash
# Appliquer toutes les migrations
npm run migrate

# Reset complet (⚠ supprime toutes les données)
npm run db:reset
```

---

## Routes principales

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/auth/phone/request` | OTP WhatsApp |
| POST | `/api/v1/auth/federated/login` | Connexion sociale Firebase |
| GET  | `/api/v1/me` | Profil utilisateur |
| POST | `/api/v1/me/fcm-token` | Enregistrer token push FCM |
| DELETE | `/api/v1/me/fcm-token` | Supprimer token push |
| GET  | `/api/v1/calls/turn-credentials` | Credentials TURN dynamiques |
| POST | `/api/v1/calls` | Initier un appel P2P |
| POST | `/api/v1/videoconference/rooms` | Créer une room |
| POST | `/api/v1/videoconference/rooms/:id/join` | Rejoindre une room |
| POST | `/api/v1/videoconference/rooms/:id/session` | Résoudre la config Jitsi |
| POST | `/api/v1/messaging/signal/identity` | Clé d'identité E2E |
| POST | `/api/v1/messaging/signal/prekeys` | Prékeys E2E |
| GET  | `/api/v1/docs` | Swagger interactif |
