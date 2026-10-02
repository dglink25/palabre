# Palabre - Plateforme de communication sécurisée

Palabre est une plateforme de communication d'entreprise chiffrée de bout en bout (protocole Signal), conçue pour des organisations qui souhaitent héberger leur propre instance (tenant local) connectée à un serveur central en production.

---

## Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Démarrage rapide](#démarrage-rapide)
4. [Configuration manuelle](#configuration-manuelle)
5. [Commandes palabre.sh](#commandes-palabresh)
6. [Services](#services)
7. [Frontend web](#frontend-web)
8. [Application mobile](#application-mobile)
9. [Rôles et flux utilisateurs](#rôles-et-flux-utilisateurs)
10. [Migrations base de données](#migrations-base-de-données)
11. [Variables d'environnement](#variables-denvironnement)

---

## Architecture

```
palabre/
├── backend/              API REST Node.js/Express - auth, onboarding, org, sessions
├── services/
│   ├── presence/         Service de présence temps réel (Erlang/OTP + ETS + Mnesia)
│   ├── message-router/   Routeur WebSocket E2E (Elixir/Phoenix Channels)
│   ├── file-server/      Transfert de fichiers chiffré côté client (Node.js)
│   └── call-signal/      Signaling WebRTC 1:1 et groupe (Elixir/Phoenix)
├── coturn/               Serveur STUN/TURN (coturn) pour les appels WebRTC
├── frontend/
│   ├── web/              Application React (Vite) - admin, org-admin, membres
│   └── mobile/           Application Flutter multiplateforme
├── mediasoup/            SFU audio/vidéo (placeholder)
├── asterisk/             Passerelle téléphonie PBX (placeholder)
├── ai/                   STT / TTS / LLM hébergés localement (placeholder)
├── wireguard/            VPN tenant-to-server (placeholder, géré par le backend)
├── docker/
│   ├── docker-compose.yml
│   └── .env.example
├── palabre.sh            Script de gestion des services
└── README.md             Ce fichier
```

### Profils Docker Compose

| Profil | Services inclus |
|--------|----------------|
| `core` | postgres, redis, backend, presence, message-router, file-server, call-signal, coturn |
| `frontend` | frontend-web |
| `telephony` | mediasoup, asterisk |
| `realtime` | presence, message-router, file-server, call-signal, coturn |
| `all` | tout ce qui précède |

### Ports exposés

| Service | Port hôte | Port conteneur |
|---------|-----------|----------------|
| postgres | 5433 | 5432 |
| redis | 6380 | 6379 |
| backend API | 4001 | 4000 |
| frontend web | 3000 | 3000 |
| presence | 4010 | 4010 |
| message-router | 4020 | 4020 |
| file-server | 4030 | 4030 |
| call-signal | 4040 | 4040 |
| coturn STUN/TURN | hôte direct | 3478/udp, 5349/tcp |

---

## Prérequis

| Outil | Version minimale | Installation |
|-------|-----------------|--------------|
| Docker | 24+ | https://docs.docker.com/engine/install/ |
| Docker Compose | v2 (intégré à Docker) | inclus dans Docker Desktop / Engine |
| Git | quelconque | package manager système |

> Pas besoin de Node.js, Elixir ou Erlang sur la machine hôte. Tout s'exécute dans des conteneurs.

Vérification :
```bash
docker --version
docker compose version
```

---

## Démarrage rapide

### 1. Cloner le dépôt
```bash
git clone <url-du-depot> palabre
cd palabre
```

### 2. Configurer les variables d'environnement

**Backend** (obligatoire) :
```bash
cp backend/.env.example backend/.env
# Editez backend/.env - voir section "Configuration manuelle" ci-dessous
```

**Docker Compose** (variables de build frontend + services temps réel) :
```bash
cp docker/.env.example docker/.env
# Editez docker/.env
```

### 3. Démarrer le système central
```bash
./palabre.sh start core
```

Cela démarre : postgres, redis, backend, presence, message-router, file-server, call-signal, coturn.

### 4. Lancer les migrations
```bash
./palabre.sh migrate
```

### 5. Démarrer le frontend web
```bash
./palabre.sh start frontend
```

L'application est disponible sur **http://localhost:3000**
L'API sur **http://localhost:4001/api/v1**
La documentation Swagger sur **http://localhost:4001/docs**

---

## Configuration manuelle

Toutes les configurations ci-dessous sont **manuelles** - elles ne peuvent pas être générées automatiquement car elles nécessitent des comptes ou des services externes.

### backend/.env - configurations requises

#### 1. Clé Firebase (authentification fédérée Google, GitHub, etc.)

**Pourquoi :** le backend vérifie les tokens Firebase des connexions sociales.

**Comment :**
1. Allez sur https://console.firebase.google.com
2. Créez un projet (ou utilisez un existant)
3. Paramètres du projet → Comptes de service → Générer une nouvelle clé privée
4. Téléchargez le fichier JSON
5. Placez-le dans `backend/secrets/` (ex. `backend/secrets/firebase-service-account.json`)
6. Dans `backend/.env`, vérifiez :
```env
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/firebase-service-account.json
```

> Le dossier `backend/secrets/` est ignoré par git (voir `.gitignore`) et monté en lecture seule dans le conteneur.

#### 2. Clé API Convessa (OTP WhatsApp)

**Pourquoi :** envoi des codes OTP par WhatsApp pour la connexion sans mot de passe.

**Comment :** obtenez votre clé sur https://convessa.epac-uac-optica-chapter.bj
```env
CONVESSA_API_KEY=pk_convessa_xxxxxx
CONVESSA_API_URL=https://convessa.epac-uac-optica-chapter.bj
```

#### 3. Serveur SMTP (emails)

**Pourquoi :** envoi des codes d'activation, notifications d'onboarding, codes super-admin.

**Option Gmail :**
1. Activez l'authentification à 2 facteurs sur votre compte Gmail
2. Allez dans Sécurité → Mots de passe des applications
3. Générez un mot de passe pour "Courrier"
```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=votre@gmail.com
MAIL_PASSWORD=votre_mot_de_passe_application_16_caracteres
MAIL_FROM=Palabre <votre@gmail.com>
```

#### 4. Secrets JWT

**Pourquoi :** signent les tokens d'accès et de rafraîchissement.

Générez des valeurs aléatoires solides :
```bash
# Commande pour générer chaque secret
openssl rand -hex 32
```
```env
JWT_ACCESS_SECRET=<valeur_generee_1>
JWT_REFRESH_SECRET=<valeur_generee_2>
```

#### 5. Secret super-admin et confirmation

```bash
openssl rand -hex 32   # pour SUPER_ADMIN_STEP_SECRET
openssl rand -hex 32   # pour CONFIRMATION_TOKEN_SECRET
```
```env
SUPER_ADMIN_EMAIL=votre@email.com
SUPER_ADMIN_STEP_SECRET=<valeur_generee>
CONFIRMATION_TOKEN_SECRET=<valeur_generee>
```

#### 6. Secrets services temps réel

```bash
openssl rand -hex 32   # INTERNAL_SERVICES_SECRET
openssl rand -hex 32   # ERLANG_COOKIE
openssl rand -hex 64   # PHOENIX_SECRET_KEY_BASE (min 64 chars)
openssl rand -hex 32   # TURN_SECRET
```
```env
INTERNAL_SERVICES_SECRET=<valeur>
ERLANG_COOKIE=<valeur>
PHOENIX_SECRET_KEY_BASE=<valeur_min_64_chars>
TURN_SECRET=<valeur>
```

#### 7. Passkeys WebAuthn

```env
PASSKEY_RP_NAME=Palabre
PASSKEY_RP_ID=localhost          # nom d'hôte SANS port
PASSKEY_ORIGIN=http://localhost:3000   # URL exacte du frontend
```

> En production, remplacez `localhost` par votre domaine. Ex : `PASSKEY_RP_ID=palabre.mondomaine.com`

#### 8. reCAPTCHA (optionnel)

Obtenez une clé sur https://www.google.com/recaptcha/admin (type v2 checkbox) :
```env
RECAPTCHA_SECRET_KEY=<votre_cle>
```
Laissez vide pour désactiver le CAPTCHA (développement local).

---

### docker/.env - configurations requises

#### Variables Firebase pour le frontend

Récupérées dans la Console Firebase → Paramètres du projet → Applications web :
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet
VITE_FIREBASE_APP_ID=1:123:web:abc
```

#### IP publique pour Coturn (production uniquement)

```env
TURN_EXTERNAL_IP=203.0.113.42   # votre IP publique du VPS
```
En développement local, laissez vide.

---

## Commandes palabre.sh

```bash
# Démarrage
./palabre.sh start core          # Système central complet (hors frontend)
./palabre.sh start frontend      # Frontend web
./palabre.sh start all           # Tout
./palabre.sh start telephony     # Mediasoup + Asterisk
./palabre.sh start realtime      # Services temps réel uniquement
./palabre.sh start <service>     # Un service précis (ex: backend, redis)

# Arrêt
./palabre.sh stop core           # Arrêter le système central
./palabre.sh stop all            # Tout arrêter (docker compose down)

# Redémarrage (rebuild inclus)
./palabre.sh restart core

# Logs en direct
./palabre.sh logs backend
./palabre.sh logs message-router
./palabre.sh logs presence

# Etat
./palabre.sh status              # Liste tous les conteneurs et leur état

# Base de données
./palabre.sh migrate             # Exécuter toutes les migrations SQL

# Shell dans un conteneur
./palabre.sh shell backend       # /bin/sh dans palabre-backend
./palabre.sh shell postgres      # /bin/sh dans palabre-postgres
```

---

## Services

Voir les READMEs individuels :

- [backend/README.md](backend/README.md) - API Node.js/Express
- [services/presence/README.md](services/presence/README.md) - Présence Erlang
- [services/message-router/README.md](services/message-router/README.md) - WebSocket Elixir
- [services/file-server/README.md](services/file-server/README.md) - Fichiers chiffrés
- [services/call-signal/README.md](services/call-signal/README.md) - Signaling WebRTC
- [coturn/README.md](coturn/README.md) - Serveur STUN/TURN

---

## Frontend web

Application React (Vite) - `frontend/web/`

Démarrage en développement (sans Docker) :
```bash
cd frontend/web
cp .env.example .env   # renseigner VITE_API_BASE_URL et VITE_FIREBASE_*
npm install
npm run dev            # http://localhost:3000
```

Démarrage via Docker :
```bash
./palabre.sh start frontend
```

Interfaces disponibles :
- Super-administrateur → `/admin`
- Administrateur d'organisation → `/org/dashboard`
- Membre → `/app`
- Sans organisation → `/org/join`

---

## Application mobile

Application Flutter - `frontend/mobile/`

```bash
cd frontend/mobile
flutter pub get
flutter run              # sur émulateur ou appareil connecté
```

L'application est universelle (un seul APK/IPA). L'utilisateur lie son organisation au premier lancement en scannant le QR code ou en saisissant l'identifiant + code fournis par l'admin.

---

## Rôles et flux utilisateurs

| Rôle | Redirection après connexion | Accès |
|------|-----------------------------|-------|
| `super_admin` | `/admin` | Gestion globale, dossiers, installation |
| `org_admin` | `/org/dashboard` | Dashboard org, VPN, invitations, guide install |
| `org_member` | `/app` | Messages, appels, contacts |
| Aucune org | `/org/join` | Rejoindre une organisation |

### Activation d'un compte org_admin

1. Super-admin approuve le dossier → email/WhatsApp avec identifiant org + code d'activation
2. Admin va sur `/activate` → saisit l'identifiant org et le code
3. Choisit son moyen de connexion (téléphone, email, ou Google)
4. Redirected vers `/org/dashboard`

### Rejoindre une organisation (membre)

1. Connexion → redirigé vers `/org/join`
2. Soit saisie manuelle (identifiant + code invitation), soit scan du QR code
3. Confirmé → redirigé vers `/app`

---

## Migrations base de données

Les migrations sont dans `backend/migrations/`, numérotées séquentiellement :

| Fichier | Contenu |
|---------|---------|
| `001_core_identity_auth.sql` | Users, sessions, devices, OAuth, recovery |
| `002_platform_entities.sql` | Organizations, roles, memberships |
| `003_auth_extra_and_onboarding.sql` | OTP, invitations, onboarding requests |
| `004_super_admin.sql` | Compte super-administrateur |
| `005_passkeys.sql` | Passkeys WebAuthn |
| `006_messaging.sql` | Conversations, messages E2E |
| `007_org_join.sql` | Code d'invitation org, rôle org_member |

Exécution :
```bash
# Via palabre.sh (recommandé - le backend doit tourner)
./palabre.sh migrate

# Ou directement
docker exec palabre-backend node src/db/migrate.js

# Reset complet (SUPPRIME toutes les données)
docker exec palabre-backend node src/db/reset.js
```

---

## Variables d'environnement

### Résumé - ce qui est obligatoire vs optionnel

| Variable | Fichier | Obligatoire | Génération |
|----------|---------|-------------|------------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | backend/.env | Oui | Manuel (console Firebase) |
| `CONVESSA_API_KEY` | backend/.env | Oui | Manuel (compte Convessa) |
| `MAIL_PASSWORD` | backend/.env | Oui | Manuel (mot de passe app Gmail) |
| `JWT_ACCESS_SECRET` | backend/.env | Oui | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | backend/.env | Oui | `openssl rand -hex 32` |
| `SUPER_ADMIN_STEP_SECRET` | backend/.env | Oui | `openssl rand -hex 32` |
| `CONFIRMATION_TOKEN_SECRET` | backend/.env | Oui | `openssl rand -hex 32` |
| `INTERNAL_SERVICES_SECRET` | backend/.env + docker/.env | Oui | `openssl rand -hex 32` |
| `ERLANG_COOKIE` | backend/.env + docker/.env | Oui | `openssl rand -hex 32` |
| `PHOENIX_SECRET_KEY_BASE` | backend/.env + docker/.env | Oui | `openssl rand -hex 64` |
| `TURN_SECRET` | backend/.env + docker/.env | Oui | `openssl rand -hex 32` |
| `VITE_FIREBASE_*` | docker/.env | Oui | Manuel (console Firebase) |
| `TURN_EXTERNAL_IP` | docker/.env | Production seulement | IP publique du VPS |
| `RECAPTCHA_SECRET_KEY` | backend/.env | Non | Manuel (Google reCAPTCHA) |

> **Règle importante :** `INTERNAL_SERVICES_SECRET`, `ERLANG_COOKIE` et `PHOENIX_SECRET_KEY_BASE` doivent avoir la **même valeur** dans `backend/.env` et `docker/.env`.
