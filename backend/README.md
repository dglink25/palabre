# Backend Palabre — API REST

API Node.js/Express. Gère l'authentification, les profils, l'onboarding des organisations, la gestion des sessions et la sécurité.

## Contenu

```
backend/
├── src/
│   ├── app.js                    Point d'entrée Express
│   ├── config/
│   │   ├── db.js                 Pool PostgreSQL
│   │   ├── firebase.js           SDK Firebase Admin (vérification tokens)
│   │   ├── mailer.js             Nodemailer (envoi emails)
│   │   └── redis.js              Client Redis (sessions, OTP, présence)
│   ├── middleware/
│   │   ├── authMiddleware.js     Vérification JWT + chargement user + rôle
│   │   ├── captcha.js            Vérification reCAPTCHA v2
│   │   ├── rbac.js               Contrôle d'accès par rôle
│   │   ├── upload.js             Upload fichiers (multer + stockage local)
│   │   └── validators.js         Fonctions de validation partagées
│   ├── modules/
│   │   ├── auth/                 Inscription, connexion, OTP, super-admin
│   │   ├── calls/                Route TURN credentials (WebRTC)
│   │   ├── messaging/            Clés Signal (identité, prékeys)
│   │   ├── onboarding/           Dossiers organisation, activation admin
│   │   ├── org/                  Liaison tenant, invitations membres
│   │   ├── security/             Passkeys, 2FA, step-up, questions sécurité
│   │   ├── sessions/             Gestion sessions, présence, heartbeat
│   │   └── users/                Profil, photo, préférences, email
│   ├── emails/
│   │   └── brand.js              Templates HTML emails (charte Palabre)
│   └── db/
│       ├── migrate.js            Exécute les migrations dans l'ordre
│       ├── reset.js              Supprime et recrée le schéma (dev)
│       └── seed.js               Données de test (dev)
├── migrations/                   Fichiers SQL numérotés
├── secrets/                      Fichiers secrets (ignoré par git)
│   └── .gitignore
├── .env.example                  Template de configuration
├── Dockerfile
└── package.json
```

## Démarrage

### Via Docker (recommandé)

```bash
# Depuis la racine du projet
./palabre.sh start core
./palabre.sh migrate
```

### En développement local (sans Docker)

```bash
# Prérequis : Node.js 20+, PostgreSQL 16, Redis 7
cd backend
cp .env.example .env
# Editez .env (voir Configuration ci-dessous)
npm install
npm run migrate     # exécute les migrations
npm run dev         # démarre avec nodemon (hot reload)
```

### Variables npm disponibles

```bash
npm run dev         # Démarrage développement (nodemon)
npm start           # Démarrage production
npm run migrate     # Exécuter les migrations SQL
npm run db:reset    # Reset complet de la base (DÉTRUIT LES DONNÉES)
npm run db:seed     # Insérer des données de test
```

## Configuration — backend/.env

Copiez `.env.example` et renseignez les valeurs. Voici ce qui nécessite une action manuelle :

### Obligatoire — Firebase (authentification fédérée)

**Action manuelle requise.**

1. Créer un projet sur https://console.firebase.google.com
2. Activer Authentication → Sign-in method → activer : Google, GitHub, Facebook, Apple, Twitter/TikTok
3. Paramètres du projet → Comptes de service → Générer une nouvelle clé privée
4. Télécharger le fichier JSON → le placer dans `backend/secrets/`
5. Configurer :

```env
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/nom-du-fichier.json
```

### Obligatoire — Convessa (OTP WhatsApp)

**Action manuelle requise.** Créez un compte sur https://convessa.epac-uac-optica-chapter.bj

```env
CONVESSA_API_KEY=pk_convessa_xxxxxx
CONVESSA_API_URL=https://convessa.epac-uac-optica-chapter.bj
```

### Obligatoire — SMTP (emails)

**Action manuelle requise.**

Gmail avec mot de passe d'application :
1. Activez la 2FA sur https://myaccount.google.com/security
2. Sécurité → Mots de passe des applications → créer "Palabre"
3. Copiez le mot de passe de 16 caractères

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=votre@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=Palabre <votre@gmail.com>
```

### Obligatoire — Secrets cryptographiques

**Générez avec des commandes.** Ne partagez jamais ces valeurs.

```bash
# Exécutez chaque commande et copiez la sortie dans .env
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 32   # → SUPER_ADMIN_STEP_SECRET
openssl rand -hex 32   # → CONFIRMATION_TOKEN_SECRET
openssl rand -hex 32   # → INTERNAL_SERVICES_SECRET
openssl rand -hex 32   # → ERLANG_COOKIE
openssl rand -hex 64   # → PHOENIX_SECRET_KEY_BASE (min 64 caractères)
openssl rand -hex 32   # → TURN_SECRET
```

```env
JWT_ACCESS_SECRET=<sortie openssl>
JWT_REFRESH_SECRET=<sortie openssl>
SUPER_ADMIN_STEP_SECRET=<sortie openssl>
CONFIRMATION_TOKEN_SECRET=<sortie openssl>
INTERNAL_SERVICES_SECRET=<sortie openssl>
ERLANG_COOKIE=<sortie openssl>
PHOENIX_SECRET_KEY_BASE=<sortie openssl>
TURN_SECRET=<sortie openssl>
```

> Ces mêmes valeurs (`INTERNAL_SERVICES_SECRET`, `ERLANG_COOKIE`, `PHOENIX_SECRET_KEY_BASE`, `TURN_SECRET`) doivent être identiques dans `docker/.env`.

### Obligatoire — Super-administrateur

**Action manuelle.** Correspond au compte dans la migration `004_super_admin.sql`.

```env
SUPER_ADMIN_EMAIL=votre@email.com
```

### Obligatoire — Passkeys WebAuthn

```env
PASSKEY_RP_NAME=Palabre
PASSKEY_RP_ID=localhost             # Développement local
PASSKEY_ORIGIN=http://localhost:3000

# Production :
# PASSKEY_RP_ID=palabre.mondomaine.com
# PASSKEY_ORIGIN=https://palabre.mondomaine.com
```

> Attention : changer `PASSKEY_RP_ID` invalide tous les passkeys existants.

### Optionnel — reCAPTCHA

**Action manuelle si activé.** Obtenez une clé sur https://www.google.com/recaptcha/admin (v2 checkbox).

```env
RECAPTCHA_SECRET_KEY=6Lc...
```

Laissez vide pour désactiver (développement).

### Optionnel — URLs des services (développement local)

```env
APP_BASE_URL=http://localhost:4001
FRONTEND_BASE_URL=http://localhost:3000
MESSAGE_ROUTER_PUBLIC_URL=ws://localhost:4020
FILE_SERVER_PUBLIC_URL=http://localhost:4030
TURN_HOST=localhost
TURN_PORT=3478
TURN_REALM=palabre.app
```

## Routes API principales

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/auth/phone/register` | Inscription par téléphone |
| POST | `/api/v1/auth/phone/login` | Connexion par téléphone |
| POST | `/api/v1/auth/federated/register` | Inscription sociale (Firebase) |
| POST | `/api/v1/auth/federated/login` | Connexion sociale |
| POST | `/api/v1/auth/phone/otp` | Demander un OTP WhatsApp |
| GET | `/api/v1/me` | Profil utilisateur connecté |
| PATCH | `/api/v1/me` | Mettre à jour le profil |
| GET | `/api/v1/sessions` | Sessions actives |
| POST | `/api/v1/sessions/heartbeat` | Renouveler la présence |
| POST | `/api/v1/onboarding/requests` | Créer un dossier d'inscription |
| POST | `/api/v1/onboarding/invitations/activate` | Activer un compte org_admin |
| GET | `/api/v1/org/me` | Infos de l'organisation de l'admin |
| POST | `/api/v1/org/join` | Rejoindre une organisation |
| GET | `/api/v1/docs` | Documentation Swagger interactive |

## Migrations

```bash
# Appliquer toutes les migrations
npm run migrate
# ou : docker exec palabre-backend node src/db/migrate.js

# Reset COMPLET (supprime toutes les tables et recrée)
npm run db:reset
# ou : docker exec palabre-backend node src/db/reset.js
```
