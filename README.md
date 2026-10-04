# Palabre — Plateforme de communication sécurisée

Plateforme de communication d'entreprise chiffrée (infrastructure E2E Signal Protocol), conçue pour des organisations qui hébergent leur propre instance (tenant local) connectée à un serveur central.

---

## Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Démarrage rapide](#démarrage-rapide)
4. [Configuration manuelle obligatoire](#configuration-manuelle-obligatoire)
5. [Configuration manuelle optionnelle](#configuration-manuelle-optionnelle)
6. [Commandes palabre.sh](#commandes-palabresh)
7. [Migrations base de données](#migrations-base-de-données)
8. [Variables d'environnement — récapitulatif](#variables-denvironnement--récapitulatif)

---

## Architecture

```
palabre/
├── backend/              API REST Node.js/Express
├── services/
│   ├── presence/         Présence temps réel (Erlang/OTP)
│   ├── message-router/   WebSocket E2E (Elixir/Phoenix Channels)
│   ├── file-server/      Fichiers chiffrés (Node.js)
│   └── call-signal/      Signaling WebRTC (Elixir/Phoenix)
├── coturn/               Serveur STUN/TURN (Coturn)
├── frontend/
│   ├── web/              React/Vite (admin, org-admin, membres)
│   └── mobile/           Flutter (Android + iOS)
├── tenant/               Stack tenant local (WireGuard + services)
├── ai/                   STT / TTS / LLM locaux
├── docker/               Docker Compose central
└── palabre.sh            Script de gestion
```

### Ports exposés (serveur central)

| Service | Port hôte |
|---------|-----------|
| postgres | 5433 |
| redis | 6380 |
| backend API | 4001 |
| frontend web | 3000 |
| presence | 4010 |
| message-router WebSocket | 4020 |
| file-server | 4030 |
| call-signal | 4040 |
| coturn STUN/TURN | 3478/udp, 5349/tcp |

---

## Prérequis

| Outil | Version min. |
|-------|-------------|
| Docker | 24+ |
| Docker Compose | v2 (inclus dans Docker) |
| Git | quelconque |

```bash
docker --version
docker compose version
```

---

## Démarrage rapide

```bash
git clone <url> palabre && cd palabre

# 1. Copier et remplir les variables (voir section ci-dessous)
cp backend/.env.example backend/.env
cp docker/.env.example docker/.env

# 2. Démarrer les services centraux
./palabre.sh start core

# 3. Lancer toutes les migrations (inclut la 013 — infra clés E2E)
./palabre.sh migrate

# 4. Démarrer le frontend
./palabre.sh start frontend
```

Application : **http://localhost:3000**  
API : **http://localhost:4001/api/v1**  
Swagger : **http://localhost:4001/docs**

---

## Configuration manuelle obligatoire

### 1. Firebase — authentification fédérée + notifications push

Utilisé pour : connexions Google/GitHub/Facebook/Apple, vérification des tokens mobiles, et notifications push FCM.

**Étapes :**

1. Créez un projet sur https://console.firebase.google.com
2. Authentication → Sign-in method → activez : **Google, GitHub, Facebook, Apple**
3. Paramètres du projet → Comptes de service → **Générer une nouvelle clé privée**
4. Téléchargez le JSON → placez-le dans `backend/secrets/`
5. Dans `backend/.env` :
```env
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/nom-du-fichier.json
```

**Pour le frontend web — FCM (notifications push) :**

6. Paramètres du projet → Cloud Messaging → **Certificats Push Web**
7. Cliquez sur **"Générer une paire de clés"** → copiez la clé VAPID
8. Dans `frontend/web/.env` :
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet
VITE_FIREBASE_APP_ID=1:xxx:web:xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_VAPID_KEY=BNxxxxxxxxxxxxxxxx   # ← OBLIGATOIRE pour les notifications web
```

> Sans `VITE_FIREBASE_VAPID_KEY`, les notifications push ne fonctionnent pas dans le navigateur.

**Pour le mobile Flutter :**

9. Projet Firebase → Ajouter une application Android → package `com.palabre.app`
10. Téléchargez `google-services.json` → placez dans `frontend/mobile/android/app/`
11. Projet Firebase → Ajouter une application iOS → bundle `com.palabre.app`
12. Téléchargez `GoogleService-Info.plist` → placez dans `frontend/mobile/ios/Runner/`

> iOS uniquement : importez votre certificat APNs `.p8` dans Firebase Console → Paramètres → Cloud Messaging.

---

### 2. Fichiers audio (sonnerie + musique d'attente)

Les fichiers audio sont servis **statiquement par le frontend web** — pas par le backend.

| Fichier | Usage | Emplacement exact |
|---------|-------|-------------------|
| `ringtone.mp3` | Sonnerie appel entrant (appels P2P + service client) | `frontend/web/public/audio/ringtone.mp3` |
| `hold-music.mp3` | Musique d'attente service client | `frontend/web/public/audio/hold-music.mp3` |

**Si tu as déjà placé les fichiers dans `frontend/web/public/audio/`, c'est correct.** Ne mets pas ces fichiers dans `backend/src/audio/` — ce dossier n'est pas utilisé par le code actuel.

Téléchargements libres :
- Sonneries : https://mixkit.co/free-sound-effects/ring/
- Musique d'ambiance : https://freesound.org

> La variable `SUPPORT_HOLD_MUSIC_PATH` dans `backend/.env` est réservée pour une future intégration Asterisk — elle n'est pas lue par le code actuel.

---

### 3. Secrets cryptographiques

Générez chaque valeur avec `openssl rand -hex 32` (ou `64` pour `PHOENIX_SECRET_KEY_BASE`) :

```bash
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 32   # → SUPER_ADMIN_STEP_SECRET
openssl rand -hex 32   # → CONFIRMATION_TOKEN_SECRET
openssl rand -hex 32   # → INTERNAL_SERVICES_SECRET
openssl rand -hex 32   # → ERLANG_COOKIE
openssl rand -hex 64   # → PHOENIX_SECRET_KEY_BASE (minimum 64 caractères)
openssl rand -hex 32   # → TURN_SECRET
```

> `INTERNAL_SERVICES_SECRET`, `ERLANG_COOKIE`, `PHOENIX_SECRET_KEY_BASE` et `TURN_SECRET` doivent être **identiques** dans `backend/.env` et `docker/.env`.

---

### 4. Convessa — OTP WhatsApp

Obtenez votre clé sur https://convessa.epac-uac-optica-chapter.bj :

```env
CONVESSA_API_KEY=pk_convessa_xxxxxx
CONVESSA_API_URL=https://convessa.epac-uac-optica-chapter.bj
```

---

### 5. SMTP — envoi d'emails

**Gmail avec mot de passe d'application :**

1. Activez la 2FA sur https://myaccount.google.com/security
2. Sécurité → Mots de passe des applications → "Palabre"
3. Copiez le mot de passe de 16 caractères

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=votre@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=Palabre <votre@gmail.com>
```

---

### 6. Passkeys WebAuthn

```env
PASSKEY_RP_NAME=Palabre
PASSKEY_RP_ID=localhost              # développement
PASSKEY_ORIGIN=http://localhost:3000

# Production :
# PASSKEY_RP_ID=palabre.mondomaine.com
# PASSKEY_ORIGIN=https://palabre.mondomaine.com
```

> Changer `PASSKEY_RP_ID` invalide tous les passkeys existants des utilisateurs.

---

### 7. Vidéoconférence — Jitsi

**Option A — Serveur Jitsi auto-hébergé (recommandé, fonctionne sans internet)**

```env
JITSI_DOMAIN=meet.votre-domaine.com    # IP ou nom DNS de votre serveur Jitsi
JITSI_JWT_SECRET=<openssl rand -hex 32>
VIDEO_SESSION_JWT_TTL_SECONDS=86400
```

> Si `JITSI_DOMAIN` ne finit pas par `.jit.si` ni `.8x8.vc`, le backend ne tente **jamais** de charger le SDK depuis internet — 100% LAN.

**Option B — JaaS 8x8 (cloud, nécessite internet)**

Obtenez vos credentials sur https://jaas.8x8.vc :

```env
JAAS_APP_ID=vpaas-magic-cookie-xxxxxx
JAAS_KEY_ID=vpaas-magic-cookie-xxxxxx/xxxxxx
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JITSI_DOMAIN=8x8.vc
```

---

### 8. Tenant — TURN local et données persistantes

Dans `tenant/.env` (généré par `setup.sh`) :

```env
TURN_SECRET=<identique au serveur central>
TURN_REALM=local.palabre.app
TURN_EXTERNAL_IP=      # IP publique si derrière NAT (laisser vide en LAN pur)
AGENT_DATA_DIR=/data/agent   # Volume Docker pour la file hors-ligne
```

> `AGENT_DATA_DIR` est le dossier où l'agent persiste sa file de messages hors-ligne sur disque. Il doit correspondre au volume monté dans `docker-compose.yml`.

---

## Configuration manuelle optionnelle

### reCAPTCHA

Obtenez une clé sur https://www.google.com/recaptcha/admin (type v2 checkbox) :

```env
# backend/.env
RECAPTCHA_SECRET_KEY=6Lc...

# frontend/web/.env
VITE_RECAPTCHA_SITE_KEY=6Lc...
```

Laissez vide en développement pour désactiver.

---

### DNS PowerDNS (provisionnement tenant automatique)

Si vous avez un serveur PowerDNS pour créer automatiquement les sous-domaines tenant :

```env
DNS_PROVIDER=powerdns     # 'mock' par défaut
POWERDNS_API_URL=http://pdns-server:8053
POWERDNS_API_KEY=<votre-cle>
PALABRE_BASE_DOMAIN=palabre.com
DNS_TTL=300
```

---

## Commandes palabre.sh

```bash
# Démarrage
./palabre.sh start core          # Postgres, Redis, Backend, services temps réel, TURN
./palabre.sh start frontend      # Frontend web
./palabre.sh start all           # Tout

# Arrêt
./palabre.sh stop all

# Logs
./palabre.sh logs backend
./palabre.sh logs message-router

# État
./palabre.sh status

# Base de données
./palabre.sh migrate             # Toutes les migrations (001 → 013)
```

---

## Migrations base de données

| Fichier | Contenu |
|---------|---------|
| `001_core_identity_auth.sql` | Users, sessions, devices, OAuth |
| `002_platform_entities.sql` | Organizations, roles, memberships |
| `003_auth_extra_and_onboarding.sql` | OTP, invitations, onboarding |
| `004_super_admin.sql` | Compte super-administrateur |
| `005_passkeys.sql` | Passkeys WebAuthn |
| `006_messaging.sql` | Conversations, messages, tables clés Signal |
| `007_org_join.sql` | Codes d'invitation org |
| `008_tenant_agents.sql` | Agents tenant (heartbeat, directives) |
| `009_videoconference.sql` | Rooms, participants, invitations vidéo |
| `010_tenant_provisioning.sql` | Provisionnement DNS + tunnel |
| `011_customer_support.sql` | Service client (file, sessions) |
| `012_p2p_calls.sql` | Appels P2P WebRTC (historique) |
| `013_e2e_key_infrastructure.sql` | Infra clés Signal (sessions, rotations, vue stock) |

```bash
# Appliquer toutes les migrations
./palabre.sh migrate

# Reset complet (SUPPRIME toutes les données)
docker exec palabre-backend node src/db/reset.js
```

---

## Variables d'environnement — récapitulatif

### backend/.env

| Variable | Obligatoire | Comment l'obtenir |
|----------|-------------|-------------------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Oui | Console Firebase → Comptes de service |
| `CONVESSA_API_KEY` | Oui | Compte Convessa |
| `MAIL_PASSWORD` | Oui | Mot de passe app Gmail |
| `JWT_ACCESS_SECRET` | Oui | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Oui | `openssl rand -hex 32` |
| `SUPER_ADMIN_STEP_SECRET` | Oui | `openssl rand -hex 32` |
| `CONFIRMATION_TOKEN_SECRET` | Oui | `openssl rand -hex 32` |
| `INTERNAL_SERVICES_SECRET` | Oui | `openssl rand -hex 32` |
| `ERLANG_COOKIE` | Oui | `openssl rand -hex 32` |
| `PHOENIX_SECRET_KEY_BASE` | Oui | `openssl rand -hex 64` |
| `TURN_SECRET` | Oui | `openssl rand -hex 32` |
| `JITSI_DOMAIN` | Oui | Nom DNS de votre serveur Jitsi |
| `JITSI_JWT_SECRET` | Si Jitsi self-hosted | `openssl rand -hex 32` |
| `JAAS_APP_ID` + `JAAS_KEY_ID` + `JAAS_PRIVATE_KEY` | Si JaaS 8x8 | Console JaaS |
| `RECAPTCHA_SECRET_KEY` | Non | Google reCAPTCHA v2 |
| `POWERDNS_API_KEY` | Non (si DNS_PROVIDER=powerdns) | Serveur PowerDNS |

### frontend/web/.env

| Variable | Obligatoire | Comment l'obtenir |
|----------|-------------|-------------------|
| `VITE_FIREBASE_API_KEY` | Oui | Console Firebase → Paramètres du projet |
| `VITE_FIREBASE_AUTH_DOMAIN` | Oui | idem |
| `VITE_FIREBASE_PROJECT_ID` | Oui | idem |
| `VITE_FIREBASE_APP_ID` | Oui | idem |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Oui | idem |
| `VITE_FIREBASE_VAPID_KEY` | Oui | Firebase → Cloud Messaging → Certificats Push Web |
| `VITE_RECAPTCHA_SITE_KEY` | Non | Google reCAPTCHA v2 |

### frontend/mobile (--dart-define au build)

| Variable | Obligatoire | Valeur exemple |
|----------|-------------|----------------|
| `API_BASE_URL` | Oui | `https://api.votre-domaine.com/api/v1` |
| `MESSAGE_ROUTER_URL` | Oui | `wss://votre-domaine.com:4020/socket/websocket` |
| `CALL_SIGNAL_URL` | Oui | `wss://votre-domaine.com:4040/signal/websocket` |
| `FILE_SERVER_URL` | Oui | `https://files.votre-domaine.com` |

Fichiers à placer manuellement :
- `frontend/mobile/android/app/google-services.json`
- `frontend/mobile/ios/Runner/GoogleService-Info.plist`

### tenant/.env (généré par setup.sh)

| Variable | Obligatoire | Note |
|----------|-------------|------|
| `ORG_ID` | Oui | Fourni dans le QR code d'approbation |
| `CONTROL_TOKEN` | Oui | Fourni dans le QR code d'approbation |
| `WG_PRIVATE_KEY` + `WG_PUBLIC_KEY` | Oui | Fournis dans le QR code |
| `TURN_SECRET` | Oui | Même valeur que le serveur central |
| `AGENT_DATA_DIR` | Oui | `/data/agent` (volume Docker) |
| `TURN_EXTERNAL_IP` | Si NAT | IP publique du serveur tenant |
| `AGENT_PUBLIC_URL` | Si routage inter-org | URL accessible depuis le central |
