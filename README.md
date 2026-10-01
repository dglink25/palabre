# Palabre — Plateforme de communication sécurisée

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
├── backend/              API REST Node.js/Express — auth, onboarding, org, sessions
├── services/
│   ├── presence/         Service de présence temps réel (Erlang/OTP + ETS + Mnesia)
│   ├── message-router/   Routeur WebSocket E2E (Elixir/Phoenix Channels)
│   ├── file-server/      Transfert de fichiers chiffré côté client (Node.js)
│   └── call-signal/      Signaling WebRTC 1:1 et groupe (Elixir/Phoenix)
├── coturn/               Serveur STUN/TURN (coturn) pour les appels WebRTC
├── frontend/
│   ├── web/              Application React (Vite) — admin, org-admin, membres
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
# Editez backend/.env — voir section "Configuration manuelle" ci-dessous
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

Toutes les configurations ci-dessous sont **manuelles** — elles ne peuvent pas être générées automatiquement car elles nécessitent des comptes ou des services externes.

### backend/.env — configurations requises

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

### docker/.env — configurations requises

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

- [backend/README.md](backend/README.md) — API Node.js/Express
- [services/presence/README.md](services/presence/README.md) — Présence Erlang
- [services/message-router/README.md](services/message-router/README.md) — WebSocket Elixir
- [services/file-server/README.md](services/file-server/README.md) — Fichiers chiffrés
- [services/call-signal/README.md](services/call-signal/README.md) — Signaling WebRTC
- [coturn/README.md](coturn/README.md) — Serveur STUN/TURN

---

## Frontend web

Application React (Vite) — `frontend/web/`

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

Application Flutter — `frontend/mobile/`

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
# Via palabre.sh (recommandé — le backend doit tourner)
./palabre.sh migrate

# Ou directement
docker exec palabre-backend node src/db/migrate.js

# Reset complet (SUPPRIME toutes les données)
docker exec palabre-backend node src/db/reset.js
```

---

## Variables d'environnement

### Résumé — ce qui est obligatoire vs optionnel

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






































































Tu es un directeur artistique senior, UX/UI designer senior et développeur frontend senior spécialisé dans les landing pages SaaS premium, les plateformes B2B et les produits technologiques destinés à des utilisateurs non techniques.

Je travaille sur Palabre, une plateforme SaaS multi-organisation de communication souveraine destinée aux entreprises, ONG, administrations, associations, réseaux de terrain et organisations professionnelles au Bénin et en Afrique francophone.

Je possède déjà une landing page fonctionnelle, mais je veux maintenant la transformer en une landing page beaucoup plus moderne, visuelle, premium, claire et mémorable, avec une qualité comparable aux meilleurs SaaS internationaux.

IMPORTANT :

Ne me pose pas de question avant de commencer.

Analyse le contenu existant ci-dessous.

Réutilise les informations pertinentes, mais améliore fortement la présentation.

Ne détruis pas les fonctionnalités existantes du site.

Travaille directement dans le projet existant.

Respecte la stack et l'architecture déjà présentes dans le projet.

Ne fais pas une simple modification cosmétique : repense réellement la hiérarchie visuelle et l'expérience utilisateur.

Le résultat doit être immédiatement visible et exploitable.

==================================================

POSITIONNEMENT DU PRODUIT
==================================================

Nom :
PALABRE

Catégorie :
Plateforme SaaS souveraine de communication pour les organisations.

Promesse principale :

"Une seule plateforme pour communiquer, appeler, gérer votre standard et votre support."

Palabre regroupe dans une même plateforme :

Messagerie instantanée

Appels audio

Appels vidéo

Téléphonie VoIP

Standard téléphonique

Centre d'appels

SVI / serveur vocal interactif

Assistance IA

Gestion des utilisateurs

Gestion des organisations

Sécurité

Journal d'audit

Contrôle des données

Infrastructure souveraine

Le produit est multi-tenant :
chaque organisation dispose de son propre espace isolé, de ses utilisateurs, de ses paramètres, de ses communications et de ses données.

Le produit n'est PAS une application destinée uniquement aux informaticiens.

Le public doit pouvoir comprendre la proposition de valeur sans connaître :

les VPN

les protocoles réseau

la VoIP

le chiffrement

les architectures cloud

le multi-tenant

Kubernetes

les infrastructures techniques

Ces éléments peuvent exister en arrière-plan, mais ils ne doivent jamais constituer le cœur du discours visuel de la homepage.

==================================================
2. PUBLIC CIBLE
La landing page doit parler en priorité à :

dirigeants d'entreprise

directeurs généraux

responsables administratifs

responsables informatiques

responsables RH

ONG

administrations

associations

institutions

entreprises disposant d'équipes terrain

centres de support

structures ayant plusieurs agences

organisations ayant besoin d'un standard téléphonique

organisations souhaitant centraliser leurs communications

Une personne non technique doit comprendre en quelques secondes :

"Palabre permet à mon organisation de communiquer avec ses équipes et ses clients depuis un seul endroit."

==================================================
3. OBJECTIF DE LA LANDING PAGE
L'objectif principal est de provoquer cette réaction :

"Enfin une plateforme qui regroupe tout ce dont notre organisation a besoin pour communiquer."

La page doit donner envie de :

découvrir la plateforme ;

voir comment elle fonctionne ;

comprendre ses avantages ;

faire confiance au produit ;

inscrire son organisation.

CTA principal :

"Inscrire mon organisation"

CTA secondaire :

"Découvrir Palabre"

ou

"Voir comment ça marche"

==================================================
4. DIRECTION ARTISTIQUE
Je veux un design :

premium

moderne

africain sans tomber dans les clichés

professionnel

chaleureux

rassurant

élégant

technologique mais humain

très visuel

aéré

avec une excellente typographie

avec des animations fluides

avec une vraie personnalité graphique

Évite absolument :

design générique Bootstrap

look dashboard partout

blocs de texte interminables

illustrations techniques complexes

personnages cartoon génériques

robots humanoïdes

images de code

serveurs informatiques en gros plan

schémas réseau compliqués

illustrations "cybersécurité" cliché

cadenas géants

visuels futuristes artificiels

stock photos corporate américaines trop génériques

surcharge de gradients

surcharge de cartes

effets glassmorphism excessifs

Je veux une identité qui puisse donner l'impression d'une vraie startup SaaS internationale basée en Afrique.

==================================================
5. IMPORTANT : LES VISUELS
Je n'ai PAS les images.

Tu dois donc identifier et intégrer toi-même des visuels pertinents disponibles légalement et adaptés au projet.

Si le projet permet une recherche web ou l'utilisation d'images externes, recherche des images correspondant réellement à chaque section.

Ne mets jamais une image uniquement parce qu'elle est jolie.

Chaque image doit raconter quelque chose.

Les visuels doivent représenter autant que possible :

des équipes africaines au travail

des bureaux modernes en Afrique

des responsables en réunion

des personnes utilisant un téléphone professionnel

des équipes réparties dans plusieurs lieux

des environnements professionnels béninois ou africains lorsque possible

des interactions humaines

des centres de support

des équipes terrain

des entreprises et organisations

des communications professionnelles

PRIORITÉ :

vrais visuels professionnels ;

photographies authentiques ;

illustrations premium ;

captures d'écran UI réalistes ;

animations abstraites uniquement lorsqu'elles ont un vrai rôle narratif.

NE PAS utiliser de personnages fictifs comme élément principal de marque.

==================================================
6. NOMBRE DE VISUELS
Je veux au minimum 10 vrais visuels / éléments visuels animés répartis intelligemment sur la landing page.

Minimum recommandé :

VISUEL 1 :
Hero principal.

VISUEL 2 :
Animation montrant une conversation/message.

VISUEL 3 :
Animation montrant un appel audio/vidéo.

VISUEL 4 :
Animation montrant une organisation et ses équipes.

VISUEL 5 :
Visuel du centre d'appels.

VISUEL 6 :
Visuel représentant plusieurs agences/sites connectés.

VISUEL 7 :
Visuel illustrant le contrôle des données.

VISUEL 8 :
Visuel illustrant la simplicité d'utilisation.

VISUEL 9 :
Visuel illustrant la sécurité.

VISUEL 10 :
Visuel final autour de l'appel à l'action.

Tu peux en ajouter davantage si cela améliore réellement l'expérience.

==================================================
7. HERO — SECTION LA PLUS IMPORTANTE
Le Hero doit être spectaculaire mais professionnel.

Il doit immédiatement communiquer :

"Palabre rassemble les communications de votre organisation dans une seule plateforme."

Structure :

Petit badge au-dessus du titre :

"Communication souveraine pour les organisations"

Grand titre :

"Tout votre monde professionnel.
Une seule plateforme."

Alternative possible :

"Communiquez avec vos équipes.
Gérez vos appels.
Gardez le contrôle."

Sous-titre :

"Messagerie, appels, visioconférence, téléphonie et centre d'appels réunis dans une plateforme pensée pour les organisations du Bénin et de l'Afrique francophone."

CTA principal :

"Inscrire mon organisation"

CTA secondaire :

"Découvrir la plateforme"

==================================================
8. HERO VISUEL
Le hero ne doit surtout PAS afficher un simple dashboard statique.

Créer une composition visuelle premium.

Idée :

Une grande interface centrale représentant Palabre, avec plusieurs éléments flottants autour :

message entrant

appel entrant

notification d'équipe

vidéo

utilisateur

téléphone

centre d'appels

indicateur de disponibilité

Ces éléments doivent donner l'impression que toute la communication de l'organisation converge vers Palabre.

Animation :

apparition progressive

petits mouvements flottants

notifications qui apparaissent

appel qui sonne

message qui arrive

transition douce

micro-interactions au hover

L'animation doit rester élégante et légère.

PAS d'animation excessive.

==================================================
9. PREMIÈRE SECTION APRÈS LE HERO
Créer une section qui explique immédiatement le problème.

Titre :

"Vos communications ne devraient pas être dispersées."

Texte :

"Aujourd'hui, une organisation utilise souvent plusieurs outils pour discuter avec ses équipes, appeler ses clients, organiser des réunions ou gérer son standard. Palabre réunit ces usages dans un seul environnement."

Créer une composition visuelle montrant plusieurs outils génériques dispersés :

messages

téléphone

visioconférence

standard

support

Puis une animation qui fait converger tous ces éléments vers :

PALABRE

Message visuel :

"Une organisation.
Un espace.
Toutes vos communications."

==================================================
10. SECTION "TOUT AU MÊME ENDROIT"
Titre :

"Tout ce dont votre organisation a besoin pour communiquer."

Créer 6 grands blocs visuels, beaucoup plus visuels que textuels.

Messagerie

"Discutez en équipe, en privé ou en groupe."

Appels audio & vidéo

"Appelez vos collaborateurs et vos partenaires depuis la même plateforme."

Téléphonie

"Connectez vos communications internes à votre téléphonie professionnelle."

Centre d'appels

"Organisez les appels entrants et sortants de votre équipe."

Assistance IA

"Facilitez le traitement des demandes et l'assistance de vos équipes."

Administration

"Gardez une vue claire sur vos utilisateurs et votre organisation."

Chaque bloc doit avoir :

une belle illustration

une micro-animation

une icône moderne

très peu de texte

un hover élégant

==================================================
11. SECTION MULTI-ORGANISATION
C'est une caractéristique importante du produit.

Mais NE PAS expliquer techniquement le multi-tenant.

Ne pas écrire :

"Architecture multi-tenant"

À la place :

"Chaque organisation possède son propre espace."

Sous-texte :

"Votre organisation dispose de son environnement dédié, avec ses utilisateurs, ses conversations, ses appels et ses paramètres."

Créer une animation montrant :

Organisation A → ses utilisateurs

Organisation B → ses utilisateurs

Organisation C → ses utilisateurs

Chaque organisation est visuellement séparée.

Puis montrer que chacune dispose de son propre espace Palabre.

Le visuel doit être extrêmement simple à comprendre.

==================================================
12. SECTION ÉQUIPES
Titre :

"Que vos équipes soient au même bureau ou sur le terrain."

Créer un visuel avec plusieurs environnements :

bureau à Cotonou

équipe terrain

agence régionale

responsable au téléphone

équipe support

Les différents groupes communiquent à travers Palabre.

Ne pas faire un schéma technique.

Faire une scène humaine et professionnelle.

Message :

"Restez connecté, même lorsque vos équipes sont réparties sur plusieurs sites."

==================================================
13. SECTION TÉLÉPHONIE
Créer une section très visuelle.

Titre :

"Votre téléphone professionnel, dans votre plateforme."

Montrer une interface d'appel moderne :

Appel entrant

"Client — Service commercial"

Boutons :

Accepter
Refuser

Puis une animation vers :

"Standard"

"File d'attente"

"Collaborateur disponible"

Le but est que quelqu'un comprenne immédiatement que Palabre ne se limite pas à une messagerie.

==================================================
14. SECTION CENTRE D'APPELS
Titre :

"Transformez vos appels en véritable service client."

Visuel principal :

Une interface de centre d'appels simple et élégante.

Montrer :

appels entrants

collaborateurs disponibles

appels en attente

file d'attente

statut des agents

appel en cours

Ajouter un petit élément IA :

"Assistant IA"

"Résumé de l'appel"

Mais ne pas donner l'impression d'un produit purement IA.

L'IA est une fonctionnalité, pas la promesse principale.

==================================================
15. SECTION SIMPLICITÉ
Titre :

"Pas besoin d'être informaticien."

Texte :

"Palabre est conçu pour que votre organisation puisse commencer simplement, sans transformer votre quotidien en projet informatique."

Créer une animation en 3 étapes :

Créez votre organisation

Invitez votre équipe

Commencez à communiquer

Visuellement :

Étape 1 → organisation

Étape 2 → utilisateurs

Étape 3 → communication

Animation fluide entre les étapes.

==================================================
16. SECTION FAIBLE CONNECTIVITÉ
Cette section doit être très importante pour le contexte africain.

Titre :

"Pensé pour les réalités du terrain."

Texte :

"Les équipes ne travaillent pas toujours avec une connexion parfaite. Palabre est pensé pour offrir une expérience de communication adaptée aux réalités des organisations et des équipes terrain."

Visuel :

Un collaborateur sur le terrain avec son téléphone.

Montrer visuellement :

Connexion faible → communication qui continue

Mais attention :

NE PAS promettre techniquement quelque chose qui n'est pas réellement implémenté.

Si le produit ne garantit pas encore un fonctionnement hors ligne, ne pas écrire "fonctionne sans Internet".

Utiliser uniquement des formulations exactes et défendables.

==================================================
17. SECTION SOUVERAINETÉ
Cette section doit être très élégante.

Titre :

"Vos communications appartiennent à votre organisation."

Sous-titre :

"Vous gardez le contrôle de vos données, de vos utilisateurs et de votre environnement."

Créer un visuel humain et non technique.

Éviter le classique cadenas.

Utiliser plutôt une métaphore visuelle :

Une organisation au centre.

Autour :

Utilisateurs
Messages
Appels
Fichiers
Données

Et tout reste dans son espace.

Message :

"Votre espace.
Vos utilisateurs.
Vos données.
Votre contrôle."

==================================================
18. SECTION SÉCURITÉ
Titre :

"Une communication professionnelle pensée pour la confiance."

Présenter sous forme de 4 bénéfices :

Chiffrement

Authentification renforcée

Contrôle des utilisateurs

Journal d'audit

Ne pas surcharger de jargon.

Créer des animations très discrètes.

Exemple :

Un utilisateur se connecte → authentification → accès sécurisé.

==================================================
19. SECTION CONFORMITÉ
Titre :

"Conçu avec les exigences de protection des données à l'esprit."

Mentionner de manière factuelle :

loi n° 2017-20 portant code du numérique au Bénin

principes de protection des données

RGPD lorsque pertinent

APDP

IMPORTANT :

Ne jamais affirmer une certification ou une conformité juridique absolue si elle n'est pas réellement vérifiée.

Utiliser une formulation prudente et exacte.

==================================================
20. SECTION COMMENT ÇA MARCHE
Créer une timeline visuelle.

Étape 1 :

"Inscrivez votre organisation"

Étape 2 :

"Votre dossier est étudié"

Étape 3 :

"Votre espace est activé"

Étape 4 :

"Invitez votre équipe"

Étape 5 :

"Commencez à communiquer"

Créer une animation lors du scroll.

==================================================
21. SECTION COMPARAISON
Créer une section visuelle :

"Au lieu de jongler entre plusieurs outils..."

À gauche :

Messagerie
Téléphonie
Visioconférence
Standard
Support

À droite :

PALABRE

Tout au même endroit.

Ne pas citer agressivement WhatsApp, Zoom ou d'autres concurrents.

Le but est de montrer la simplification, pas d'attaquer les concurrents.

==================================================
22. SECTION POUR QUI ?
Créer 6 catégories visuelles :

Entreprises

ONG

Administrations

Associations

Équipes terrain

Centres de support

Chaque catégorie doit avoir une image ou illustration professionnelle différente.

Ne pas utiliser de personnages cartoon.

==================================================
23. SECTION PREUVE / CONFIANCE
Si aucune donnée réelle n'est disponible :

NE PAS inventer :

nombre de clients

nombre d'utilisateurs

taux de disponibilité

témoignages

logos clients

certifications

chiffres de performance

À la place, créer une section :

"Pensé pour les organisations d'ici."

Mettre en avant :

Bénin

Afrique francophone

infrastructure maîtrisée

accompagnement local

environnement organisationnel dédié

==================================================
24. CTA FINAL
Créer un énorme bloc final.

Titre :

"Et si toutes vos communications étaient enfin au même endroit ?"

Texte :

"Découvrez comment Palabre peut devenir l'espace de communication de votre organisation."

CTA :

"Inscrire mon organisation"

CTA secondaire :

"Découvrir Palabre"

Ajouter une animation visuelle montrant progressivement :

Messages
Appels
Équipe
Centre d'appels
→ PALABRE

==================================================

les ils nous font doivent être depuis db les organisations inscrits et approuvéecs
