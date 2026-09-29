# Frontend Web Palabre

Application React (Vite) — interface web pour tous les types d'utilisateurs : super-administrateur, administrateur d'organisation et membres.

## Contenu

```
frontend/web/
├── public/
│   └── logo.png              Logo Palabre (favicon + header)
├── src/
│   ├── App.jsx               Routeur principal (routes par rôle)
│   ├── theme.css             Charte graphique complète
│   ├── components/
│   │   ├── Layout.jsx        Sidebar + topbar responsive
│   │   ├── RouteGuards.jsx   Guards par rôle (SuperAdmin, OrgAdmin, Member)
│   │   ├── AuthLayout.jsx    Layout page de connexion
│   │   ├── PublicLayout.jsx  Layout pages publiques
│   │   ├── PhoneInput.jsx    Sélecteur téléphone + pays
│   │   ├── SocialButton.jsx  Boutons connexion sociale (SVG inline)
│   │   └── ui.jsx            Alert, Spinner, Badge
│   ├── context/
│   │   └── AuthContext.jsx   Session, profil, heartbeat
│   ├── lib/
│   │   ├── apiClient.js      Client HTTP + refresh JWT auto
│   │   ├── firebase.js       SDK Firebase (chargé en CDN, pas npm)
│   │   ├── webauthn.js       Passkeys (API native navigator.credentials)
│   │   ├── errorMessages.js  Traduction codes erreur API → messages FR
│   │   └── device.js         Fingerprint appareil
│   └── pages/
│       ├── auth/             Connexion, 2FA, récupération
│       ├── onboarding/       Wizard inscription org, statut, activation
│       ├── admin/            Dashboard super-admin, dossiers
│       ├── org/              Dashboard org-admin, VPN, invitations
│       ├── app/              Espace membre : accueil, discussions, appels, contacts
│       ├── profile/          Profil utilisateur
│       ├── security/         Passkeys, 2FA, moyens de connexion
│       └── sessions/         Sessions actives, révocation
├── .env.example
├── Dockerfile
├── package.json
└── vite.config.js
```

## Prérequis

- Node.js 20+
- npm 10+

## Démarrage en développement (sans Docker)

```bash
cd frontend/web

# 1. Copier et configurer les variables
cp .env.example .env

# 2. Installer les dépendances
npm install

# 3. Démarrer le serveur de développement
npm run dev
```

L'application démarre sur **http://localhost:3000**

> Le backend doit être en cours d'exécution (`./palabre.sh start core` depuis la racine).

## Démarrage via Docker

```bash
# Depuis la racine du projet
cp docker/.env.example docker/.env
# Editez docker/.env (variables VITE_*)
./palabre.sh start frontend
```

## Configuration — .env

### Obligatoire — URL de l'API

```env
VITE_API_BASE_URL=http://localhost:4001/api/v1
```

En production :
```env
VITE_API_BASE_URL=https://api.votre-domaine.com/api/v1
```

### Obligatoire — Firebase (connexion sociale)

**Action manuelle requise.**

1. Allez sur https://console.firebase.google.com
2. Sélectionnez votre projet
3. Paramètres du projet (icône engrenage) → Vos applications → application Web
4. Copiez les valeurs `firebaseConfig`

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet
VITE_FIREBASE_APP_ID=1:123:web:abc...
```

> Ces valeurs sont **publiques** (elles apparaissent dans le code JavaScript du navigateur). Ce ne sont pas des secrets. Le secret Firebase (clé de service) est uniquement dans `backend/.env`.

### Optionnel — reCAPTCHA

**Action manuelle si activé.** Obtenez une clé sur https://www.google.com/recaptcha/admin (type v2 "Case à cocher").

```env
VITE_RECAPTCHA_SITE_KEY=6Lc...
```

Laissez vide pour désactiver le CAPTCHA (développement local). Le backend doit aussi avoir `RECAPTCHA_SECRET_KEY` configuré si vous l'activez.

## Interfaces par rôle

| Rôle | Route d'accueil | Accès |
|------|----------------|-------|
| Super-administrateur | `/admin` | Dashboard, dossiers onboarding, guide installation |
| Administrateur d'organisation | `/org/dashboard` | Org, VPN, invitations membres, guide install |
| Membre (org lié) | `/app` | Messages, appels, contacts |
| Utilisateur sans org | `/org/join` | Rejoindre une organisation |

## Scripts npm

```bash
npm run dev        # Serveur de développement (hot reload)
npm run build      # Build de production (dist/)
npm run preview    # Prévisualiser le build de production
```

## Logo

Le fichier `public/logo.png` est utilisé pour :
- Le favicon du navigateur
- Le header de l'application
- Les emails envoyés par le backend (copie dans `backend/src/brand/logo.png`)

Pour remplacer le logo : déposez un nouveau fichier PNG carré aux deux emplacements en conservant le nom `logo.png`. Aucune autre modification n'est nécessaire.

## Notes sur Firebase

Le SDK Firebase est chargé **depuis le CDN Google au runtime** (pas via npm). Cela évite l'installation des 20+ sous-paquets `@firebase/*` inutiles (Firestore, Analytics, etc.) alors que seul Firebase Auth est utilisé. La connexion réseau au CDN est requise en développement.

## Notes sur les Passkeys

WebAuthn lie chaque passkey à une origine précise. Si vous changez le port ou le domaine du frontend, les passkeys existants cesseront de fonctionner. La variable `PASSKEY_ORIGIN` dans `backend/.env` doit correspondre exactement à l'URL du frontend (ex. `http://localhost:3000`).
