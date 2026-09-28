# Palabre

## Arborescence

```
palabre/
├── backend/          # API Node/Express (auth, profil, sécurité, sessions) — implémenté
│   ├── src/
│   ├── migrations/
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── web/           # Application d'administration React (placeholder)
│   │   └── Dockerfile
│   └── mobile/        # Application React Native par tenant (placeholder)
├── ai/                 # STT / TTS / LLM hébergés localement (placeholder)
│   └── Dockerfile
├── asterisk/           # Passerelle téléphonie analogique / PBX (placeholder)
│   └── Dockerfile
├── mediasoup/           # SFU audio/vidéo (placeholder)
│   └── Dockerfile
├── wireguard/            # Tunnel VPN par tenant (placeholder)
│   └── Dockerfile
├── docker/                # Orchestration seule — docker-compose.yml
│   └── docker-compose.yml
└── palabre.sh              # Commande unique pour démarrer/arrêter un module précis
```

Chaque module vit dans son propre dossier, au même niveau que `docker/`, qui
ne contient que l'orchestration (le fichier `docker-compose.yml`) et rien
d'autre.

## Ce qui est implémenté

Uniquement `backend/` :

1. **Base de données complète**, mise en place par migrations SQL
   (`backend/migrations`), couvrant l'ensemble des entités du cahier des
   charges (section 38-39).
2. **Authentification sans mot de passe**, inscription et connexion
   TOUJOURS séparées (routes distinctes, jamais de paramètre "intent") :
   - `POST /auth/phone/register` vs `POST /auth/phone/login` (OTP WhatsApp,
     Convessa) ;
   - `POST /auth/federated/register` vs `POST /auth/federated/login`
     (Google, GitHub, Facebook, Apple, TikTok via Firebase) ;
   - un identifiant fédéré n'est jamais lié qu'à un seul compte Palabre ;
   - un appareil donné ne peut servir à **créer** qu'un seul compte — la
     **connexion** à un compte existant depuis ce même appareil reste
     possible, avec message explicite en cas de conflit ;
   - vérification d'adresse e-mail par code (`/me/email/...`) ;
   - limitation des tentatives de connexion par identifiant (verrou
     temporaire après plusieurs échecs) + journal `login_attempts`.
3. **Profil** : informations personnelles, photo (upload réel), secteur
   d'activité, langue, fuseau horaire, préférences libres en JSON
   (`/api/v1/me`).
4. **Sécurité** : questions de sécurité, 2FA biométrique (WebAuthn),
   association d'un autre moyen de connexion, contrôle d'accès par rôle
   (`middleware/rbac.js`, prêt pour les futurs modules scoping à une
   organisation).
5. **Sessions multi-appareils façon WhatsApp/Gmail** : refresh token rotatif,
   détection de réutilisation, liste des appareils connectés, révocation à
   distance — **plus** une présence temps réel sur Redis (`session:{deviceId}`,
   TTL renouvelé par `POST /sessions/heartbeat`).
6. **Onboarding — demande d'inscription d'organisation** (section 8-9) :
   formulaire public en 4 étapes, reprenable sans perte de données via un
   jeton de brouillon (`/onboarding/requests`) ; instruction par le
   super-administrateur (`/onboarding/admin/requests`) avec rejet motivé +
   champs à corriger, correction restreinte aux seuls champs signalés, et
   approbation qui crée l'organisation, son administrateur, le jeton de
   contrôle de tenant + le pairage VPN (section 10.1), et un code
   d'activation à usage unique envoyé par e-mail/WhatsApp (équivalent sans
   mot de passe du "changement imposé à la première connexion"). Ne couvre
   pas la génération d'APK ni les codes USSD (modules distincts, non
   demandés ici).
7. **Documentation API** interactive sur `/docs` (Swagger UI).
8. **Super-administrateur** (`dglink25@gmail.com` / `+2290190956919`, provisionné par la migration `004_super_admin.sql`) :
   - connexion via Google interceptée et remplacée par un parcours à 3 étapes dès que l'e-mail détecté est le sien : code de 12 caractères par e-mail (3 min) → confirmation du numéro complet enregistré (indice : 2 derniers chiffres) → OTP WhatsApp (3 min) → session (`/auth/super-admin/step/*`) ;
   - mêmes réglages de profil que n'importe quel utilisateur (`/me`, `/me/preferences`, etc.) ;
   - **toute modification** qu'il effectue (profil, sécurité, sessions, décisions d'onboarding) exige une double vérification par code e-mail préalable (`/security/step-up/start` puis `/verify`, jeton à joindre en en-tête `X-Confirmation-Token`) ;
   - déconnexion automatique après 15 minutes d'inactivité, renouvelées par chaque requête (pas seulement le heartbeat) — propre à ce compte, les autres utilisateurs n'y sont pas soumis.

`frontend/mobile`, `ai`, `asterisk`, `mediasoup`, `wireguard` sont des
dossiers/services "placeholder", prêts à recevoir leur implémentation lors
des phases suivantes de la roadmap. `frontend/web` est en revanche
implémenté (voir ci-dessous).

## Frontend web (`frontend/web`)

Application React (Vite), consommant exactement les fonctionnalités
backend décrites plus haut — aucune de plus :

- **Connexion / inscription** : téléphone (OTP WhatsApp), fédérée (Google,
  GitHub, Facebook, Apple, TikTok via Firebase, chargé depuis le CDN au
  runtime — voir plus bas), et **passkey en connexion directe** (comme
  GitHub, sans identifiant à saisir) ; inscription et connexion toujours sur
  des écrans/actions séparés ;
- **Parcours super-administrateur** intégré et systématique, quel que soit
  le canal : Google → code e-mail 12 caractères → confirmation du numéro
  complet → OTP WhatsApp (3 étapes) ; téléphone → OTP WhatsApp → code e-mail
  (2 étapes) ;
- **Vérification en deux étapes par passkey** (WebAuthn natif du
  navigateur — Touch ID, Windows Hello, clé de sécurité) ;
- **Récupération de compte** par téléphone ;
- **Onboarding public** : formulaire en 4 étapes reprenable (jeton de
  brouillon), upload de documents, soumission, suivi de statut, correction
  restreinte aux champs signalés après un rejet ;
- **Activation administrateur** après approbation d'une organisation ;
- **Instruction des demandes** (super-admin) : liste filtrée, détail,
  rejet motivé avec champs à corriger, approbation (affiche une seule fois
  le payload à encoder en QR) ;
- **Profil** : informations, photo, vérification d'e-mail, préférences ;
- **Sécurité** : passkeys (ajout/suppression), questions de sécurité,
  moyens de connexion associés ;
- **Sessions & appareils** : liste avec statut en ligne/hors ligne
  (présence Redis), révocation individuelle ou groupée, heartbeat
  automatique en tâche de fond ;
- **Double vérification** transparente pour le super-administrateur : toute
  action de modification déclenche automatiquement la demande de code
  e-mail via une fenêtre modale, sans code spécifique à écrire par page ;
- **Pages publiques** : accueil, conditions d'utilisation, politique de
  confidentialité, bandeau d'information sur le stockage local utilisé ;
- **Messages d'erreur professionnels**, traduits depuis les codes d'erreur
  API (`src/lib/errorMessages.js`) plutôt qu'affichés bruts ;
- **Interface** : charte graphique stricte (`src/theme.css`) avec les
  quatre couleurs vives employées chacune pour son usage propre (bleu =
  actions/navigation, vert = succès/disponibilité, ambre = vigilance, rouge
  = alerte/sécurité), transitions et animations discrètes, mise en page
  responsive (barre latérale → barre horizontale sous 720px).

### Le logo

Le fichier fourni est déjà en place à **`frontend/web/public/logo.png`**
(utilisé par le navigateur, favicon compris) et **`backend/src/brand/logo.png`**
(utilisé dans l'en-tête des e-mails, servi via `/brand/logo.png`). Pour le
remplacer par une nouvelle version, déposez le nouveau fichier PNG carré aux
deux emplacements en conservant le nom `logo.png` — aucune autre
modification n'est nécessaire, toutes les pages et tous les e-mails le
référencent par ce chemin.

### Connexion fédérée sans dépendance npm lourde

`src/lib/firebase.js` charge le SDK Firebase Auth **depuis le CDN officiel
de Google au runtime**, plutôt que via le paquet npm `firebase` : ce
dernier entraîne près de 20 sous-paquets `@firebase/*` (Firestore, Storage,
Messaging, Analytics...) même si seul `Auth` est utilisé, ce qui peut faire
échouer `npm install` sur une connexion lente ou instable. Aucune
configuration supplémentaire n'est nécessaire ; seules les variables
`VITE_FIREBASE_*` doivent être renseignées.

### Démarrage

```bash
cd frontend/web
cp .env.example .env   # renseigner VITE_API_BASE_URL et les VITE_FIREBASE_*
npm install
npm run dev             # http://localhost:3000, contre un backend déjà démarré
```

Via Docker : `./palabre.sh start frontend-web` (les variables `VITE_*` sont
alors lues depuis `docker/.env` — copiez `docker/.env.example`).

> **Important pour les passkeys** : WebAuthn lie chaque passkey à une
> origine précise (`PASSKEY_ORIGIN` côté backend, ex. `http://localhost:3000`)
> et à un `PASSKEY_RP_ID` (le nom d'hôte, ex. `localhost`). Si vous changez
> le port ou le domaine du frontend, mettez à jour ces deux variables dans
> `backend/.env` — sinon les passkeys existants cesseront de fonctionner.

## Passkeys (WebAuthn) — remplace l'ancien mécanisme "empreinte d'appareil"

Le cahier des charges demandait un second facteur par empreinte digitale.
La première version de ce backend utilisait un mécanisme "maison"
(WebCrypto + clé ECDSA), documenté comme une approximation de WebAuthn.
Cette version le remplace par de **vrais passkeys**, conformes au standard
W3C, via la bibliothèque de référence `@simplewebauthn/server` côté
backend et l'API native `navigator.credentials` côté frontend (aucune
dépendance supplémentaire côté client) :

- un passkey sert à la fois de **second facteur** et de **moyen de
  connexion direct** (comme le bouton "Se connecter avec un passkey" de
  GitHub) ;
- le défi cryptographique de chaque connexion est désormais **généré et
  retenu côté serveur** (Redis, 5 minutes), ce qui ferme la faille de rejeu
  que l'ancien mécanisme laissait ouverte (elle était documentée comme
  limite connue dans une version précédente de ce README) ;
- la clé privée ne quitte jamais l'appareil de l'utilisateur (Secure
  Enclave, TPM, ou clé de sécurité physique) ; le serveur ne stocke que la
  clé publique (table `passkeys`) ;
- la vérification en deux étapes est désormais **réellement imposée côté
  serveur** (`requireTwoFactorIfEnabled`) sur les actions sensibles
  (modification de profil, photo, préférences, e-mail, questions de
  sécurité, ajout/suppression de passkey, révocation de session, décisions
  d'onboarding) — et non plus seulement suggérée par un écran côté
  frontend.

## Démarrage

```bash
cd backend
cp .env.example .env
# renseigner CONVESSA_API_KEY, les secrets JWT, et le chemin vers la clé de
# service Firebase (FIREBASE_SERVICE_ACCOUNT_PATH)
cd ..

./palabre.sh start core      # postgres + redis + backend
docker compose -f docker/docker-compose.yml exec backend npm run migrate

# API disponible sur http://localhost:4000/api/v1
# Documentation sur     http://localhost:4000/docs
```

Autres commandes, exécutées depuis la racine `palabre/` :

```bash
./palabre.sh start backend       # démarre uniquement le backend
./palabre.sh stop backend        # arrête uniquement le backend
./palabre.sh start telephony     # mediasoup + asterisk (placeholders)
./palabre.sh start all           # toute l'architecture
./palabre.sh logs backend        # logs en direct d'un module
./palabre.sh status              # état de tous les conteneurs
```

> Remarque : `npm install` nécessite un accès réseau qui n'était pas
> disponible dans l'environnement de génération ; les dépendances seront
> installées au premier `docker compose build` chez vous.
