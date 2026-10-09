# Palabre - Plateforme de communication sécurisée

Plateforme de communication d'entreprise chiffrée (infrastructure E2E Signal Protocol), conçue pour des organisations qui hébergent leur propre instance (tenant local) connectée à un serveur central. Le système embarque un agent IA pour le service client, la gestion de la base de connaissance et la génération automatique de rapports.

---

## Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Démarrage rapide](#démarrage-rapide)
4. [Configuration obligatoire](#configuration-obligatoire)
5. [Configuration optionnelle](#configuration-optionnelle)
6. [Commandes palabre.sh](#commandes-palabresh)
7. [Migrations base de données](#migrations-base-de-données)
8. [Variables d'environnement](#variables-denvironnement)

---

## Architecture

```
palabre/
├── backend/              API REST Node.js/Express (port 4000)
├── ai/                   Agent IA FastAPI : IVR, RAG, rapports PDF (port 8000)
├── services/
│   ├── presence/         Presence temps reel (Erlang/OTP, port 4010)
│   ├── message-router/   WebSocket E2E (Elixir/Phoenix, port 4020)
│   ├── file-server/      Fichiers chiffrés (Node.js, port 4030)
│   └── call-signal/      Signaling WebRTC (Elixir/Phoenix, port 4040)
├── coturn/               Serveur STUN/TURN (port 3478)
├── frontend/
│   ├── web/              React/Vite (admin, org-admin, membres, port 3000)
│   └── mobile/           Flutter (Android + iOS)
├── tenant/               Stack tenant local (WireGuard + services)
├── docker/               Docker Compose central
└── palabre.sh            Script de gestion
```

### Ports exposés (serveur central)

| Service | Port hôte | Description |
|---------|-----------|-------------|
| postgres | 5433 | PostgreSQL avec pgvector (obligatoire pour l'IA) |
| redis | 6380 | File d'attente, pub/sub, sessions |
| backend API | 4001 | API REST + WebSocket support |
| ai | 8000 | Agent IA, IVR, RAG, rapports |
| presence | 4010 | Presence temps reel |
| message-router | 4020 | WebSocket E2E |
| file-server | 4030 | Fichiers chiffrés |
| call-signal | 4040 | Signaling WebRTC |
| frontend web | 3000 | Interface utilisateur |
| coturn STUN/TURN | 3478/udp, 5349/tcp | Relais WebRTC |

### Fonctionnalités IA (service ai, port 8000)

| Fonctionnalite | Description |
|---------------|-------------|
| IVR | Menu vocal interactif service client (options 1-4, 8, 0) |
| Agent chat | Reponses contextuelles via RAG sur la base de connaissance |
| Base de connaissance | Table `connaissance_base` administrable via `/admin/knowledge` |
| Rapports automatiques | PDF + audio generes et envoyes par email apres chaque appel/visioconference |
| Candidats | Suggestions d'amelioration issues des feedbacks utilisateurs |

---

## Prérequis

| Outil | Version min. |
|-------|-------------|
| Docker | 24+ |
| Docker Compose | v2 (inclus dans Docker Desktop) |
| Git | quelconque |

```bash
docker --version
docker compose version
```

---

## Démarrage rapide

```bash
git clone <url> palabre && cd palabre

# 1. Copier les templates de variables
cp backend/.env.example backend/.env
cp docker/.env.example docker/.env

# 2. Remplir les valeurs obligatoires dans backend/.env (voir section ci-dessous)
#    Au minimum : LLM_API_KEY, AI_API_KEY, MAIL_*, JWT_*, FIREBASE_*

# 3. Propager les variables partagees vers tous les services (evite les doublons)
./palabre.sh setup-env

# 4. Démarrer le système central (inclut postgres, redis, backend, ai, services temps reel)
./palabre.sh start core

# 5. Appliquer toutes les migrations SQL
./palabre.sh migrate

# 6. Démarrer le frontend
./palabre.sh start frontend
```

Application : **http://localhost:3000**
API : **http://localhost:4001/api/v1**
Swagger : **http://localhost:4001/docs**
AI health : **http://localhost:8000/health**

### Principe de configuration : source unique

`backend/.env` est la **source unique** de toutes les variables partagees.
La commande `./palabre.sh setup-env` les propage automatiquement vers :
- `services/presence/.env`
- `services/message-router/.env`
- `services/file-server/.env`
- `services/call-signal/.env`
- `ai/.env`

Ne pas modifier directement les `.env` des micro-services  ils seraient ecrases au prochain `setup-env`.

---

## Configuration obligatoire

### 1. Service IA  cle LLM

Le service AI utilise un LLM via une API compatible OpenAI. [Groq](https://console.groq.com) est recommande (gratuit, rapide).

Dans `backend/.env` :
```env
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
LLM_MODEL=llama-3.3-70b-versatile
```

Puis propager : `./palabre.sh setup-env ai`

### 2. Service IA  cle partagee avec le backend

```env
# backend/.env  generer avec : openssl rand -hex 32
AI_API_KEY=change_me_ai_api_key
```

Cette cle est automatiquement copiee dans `ai/.env` sous le nom `API_KEY` lors du `setup-env`. Ne la saisir qu'une seule fois dans `backend/.env`.

### 3. Firebase  authentification fédérée + notifications push

1. Créez un projet sur https://console.firebase.google.com
2. Authentication > Sign-in method > activez : Google, GitHub, Facebook, Apple
3. Paramètres > Comptes de service > **Générer une nouvelle clé privée**
4. Téléchargez le JSON > placez dans `backend/secrets/`
5. Dans `backend/.env` :
```env
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/nom-du-fichier.json
```

Pour le frontend web (FCM notifications push) :
```env
# frontend/web/.env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet
VITE_FIREBASE_APP_ID=1:xxx:web:xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_VAPID_KEY=BNxxxxxxxx   # Firebase > Cloud Messaging > Certificats Push Web
```

### 4. Secrets cryptographiques

Générer chaque valeur avec `openssl rand -hex 32` (ou `64` pour `PHOENIX_SECRET_KEY_BASE`) :

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 32   # SUPER_ADMIN_STEP_SECRET
openssl rand -hex 32   # CONFIRMATION_TOKEN_SECRET
openssl rand -hex 32   # INTERNAL_SERVICES_SECRET
openssl rand -hex 32   # ERLANG_COOKIE
openssl rand -hex 64   # PHOENIX_SECRET_KEY_BASE
openssl rand -hex 32   # TURN_SECRET
openssl rand -hex 32   # AI_API_KEY
```

`INTERNAL_SERVICES_SECRET`, `ERLANG_COOKIE`, `PHOENIX_SECRET_KEY_BASE` et `TURN_SECRET` doivent etre identiques dans `backend/.env` et `docker/.env`.

### 5. SMTP  envoi d'emails (rapports de session inclus)

Les rapports PDF sont envoyes par email a la fin de chaque appel et videoconference.

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=votre@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx   # Mot de passe d'application Gmail
MAIL_FROM=Palabre <votre@gmail.com>
```

### 6. Convessa  OTP WhatsApp

```env
CONVESSA_API_KEY=pk_convessa_xxxxxx
CONVESSA_API_URL=https://convessa.epac-uac-optica-chapter.bj
```

### 7. Vidéoconférence  Jitsi

**Option A  serveur Jitsi auto-heberge (recommande)**
```env
JITSI_DOMAIN=meet.votre-domaine.com
JITSI_JWT_SECRET=<openssl rand -hex 32>
VIDEO_SESSION_JWT_TTL_SECONDS=86400
```

**Option B  JaaS 8x8 (cloud)**
```env
JAAS_APP_ID=vpaas-magic-cookie-xxxxxx
JAAS_KEY_ID=vpaas-magic-cookie-xxxxxx/xxxxxx
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JITSI_DOMAIN=8x8.vc
```

### 8. Passkeys WebAuthn

```env
PASSKEY_RP_NAME=Palabre
PASSKEY_RP_ID=localhost             # En production : votre domaine
PASSKEY_ORIGIN=http://localhost:3000
```

### 9. Fichiers audio

| Fichier | Usage | Emplacement |
|---------|-------|-------------|
| `ringtone.mp3` | Sonnerie appel entrant | `frontend/web/public/audio/ringtone.mp3` |
| `hold-music.mp3` | Musique d'attente service client | `frontend/web/public/audio/hold-music.mp3` |

---

## Configuration optionnelle

### reCAPTCHA
```env
# backend/.env
RECAPTCHA_SECRET_KEY=6Lc...
# frontend/web/.env
VITE_RECAPTCHA_SITE_KEY=6Lc...
```

### DNS PowerDNS (provisionnement tenant automatique)
```env
DNS_PROVIDER=powerdns
POWERDNS_API_URL=http://pdns-server:8053
POWERDNS_API_KEY=<votre-cle>
PALABRE_BASE_DOMAIN=palabre.com
```

### Service voix IA (TTS/STT)  GPU recommande
Le `voice_server` dans `ai/voice_server/` active la synthese vocale des reponses de l'agent.
```env
# ai/.env (ou via setup-env)
VOICE_SERVICE_URL=http://voice-server:7860
VOICE_SERVICE_KEY=<cle optionnelle>
```

---

## Commandes palabre.sh

```bash
# Demarrage
./palabre.sh start core          # postgres, redis, backend, ai, services temps reel, TURN
./palabre.sh start frontend      # Frontend web
./palabre.sh start all           # Tout

# Arret
./palabre.sh stop all

# Logs
./palabre.sh logs backend
./palabre.sh logs ai
./palabre.sh logs message-router

# Etat
./palabre.sh status

# Base de donnees
./palabre.sh migrate             # Applique toutes les migrations

# Configuration (source unique : backend/.env)
./palabre.sh setup-env           # Propage vers tous les micro-services
./palabre.sh setup-env ai        # Propage uniquement vers ai/.env
./palabre.sh setup-env presence  # Propage uniquement vers services/presence/.env

# Shell de debug
./palabre.sh shell backend
./palabre.sh shell ai
```

---

## Migrations base de données

```bash
./palabre.sh migrate
```

| Fichier | Contenu |
|---------|---------|
| `001_core_identity_auth.sql` | Users, sessions, devices, OAuth |
| `002_platform_entities.sql` | Organizations, roles, memberships, ivr_menus |
| `003_auth_extra_and_onboarding.sql` | OTP, invitations, onboarding |
| `004_super_admin.sql` | Compte super-administrateur |
| `005_passkeys.sql` | Passkeys WebAuthn |
| `006_messaging.sql` | Conversations, messages, tables cles Signal |
| `007_org_join.sql` | Codes d'invitation org |
| `008_tenant_agents.sql` | Agents tenant (heartbeat, directives) |
| `009_videoconference.sql` | Rooms, participants, invitations video |
| `010_tenant_provisioning.sql` | Provisionnement DNS + tunnel |
| `011_customer_support.sql` | Service client (file, sessions, appels) |
| `012_p2p_calls.sql` | Appels P2P WebRTC |
| `013_e2e_key_infrastructure.sql` | Infrastructure cles Signal |
| `014_developer_platform.sql` | Plateforme developpeur (projets, cles API) |
| `015_ai_support_ivr.sql` | Base de connaissance IA, config IVR, agent |
| `016_session_reports.sql` | Rapports de sessions (video + appels) |

---

## Variables d'environnement

### Principe : source unique dans `backend/.env`

Les variables suivantes sont definies **une seule fois** dans `backend/.env` et propagees automatiquement par `./palabre.sh setup-env` :

| Variable | Propagee vers |
|----------|--------------|
| `DATABASE_URL` | tous les services + ai |
| `REDIS_URL` | message-router |
| `JWT_ACCESS_SECRET` | message-router, file-server, call-signal |
| `INTERNAL_SERVICES_SECRET` | presence, message-router, call-signal |
| `ERLANG_COOKIE` | presence, message-router, call-signal |
| `PHOENIX_SECRET_KEY_BASE` | message-router, call-signal |
| `PUBLIC_HOST` | message-router, call-signal |
| `FILE_SERVER_PUBLIC_URL` | file-server |
| `AI_API_KEY` | ai (sous le nom `API_KEY`) |
| `LLM_BASE_URL` | ai |
| `LLM_API_KEY` | ai |
| `LLM_MODEL` | ai |

### Variables propres a chaque service

**backend/.env (obligatoires)**

| Variable | Comment l'obtenir |
|----------|-------------------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Console Firebase > Comptes de service |
| `CONVESSA_API_KEY` | Compte Convessa |
| `MAIL_PASSWORD` | Mot de passe app Gmail |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `SUPER_ADMIN_STEP_SECRET` | `openssl rand -hex 32` |
| `CONFIRMATION_TOKEN_SECRET` | `openssl rand -hex 32` |
| `INTERNAL_SERVICES_SECRET` | `openssl rand -hex 32` |
| `ERLANG_COOKIE` | `openssl rand -hex 32` |
| `PHOENIX_SECRET_KEY_BASE` | `openssl rand -hex 64` |
| `TURN_SECRET` | `openssl rand -hex 32` |
| `AI_API_KEY` | `openssl rand -hex 32` |
| `LLM_API_KEY` | Console Groq / OpenRouter / Mistral |
| `JITSI_DOMAIN` | Nom DNS de votre serveur Jitsi |

**frontend/web/.env (obligatoires)**

| Variable | Comment l'obtenir |
|----------|-------------------|
| `VITE_FIREBASE_API_KEY` | Console Firebase > Parametres du projet |
| `VITE_FIREBASE_AUTH_DOMAIN` | idem |
| `VITE_FIREBASE_PROJECT_ID` | idem |
| `VITE_FIREBASE_APP_ID` | idem |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | idem |
| `VITE_FIREBASE_VAPID_KEY` | Firebase > Cloud Messaging > Certificats Push Web |

**ai/.env  genere par setup-env, ne pas modifier directement**

Le fichier `ai/.env` est genere automatiquement depuis `backend/.env`.
Seule la variable `VOICE_SERVICE_URL` doit etre ajoutee manuellement si vous activez le TTS/STT.
