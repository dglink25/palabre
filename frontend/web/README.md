# Frontend Web Palabre — React/Vite

Interface web pour tous les types d'utilisateurs : super-administrateur, administrateur d'organisation, membres.

---

## Prérequis

- Node.js 20+
- npm 10+

---

## Démarrage

### Développement local (sans Docker)

```bash
cd frontend/web
cp .env.example .env
# Remplir .env (voir section ci-dessous)
npm install
npm run dev       # http://localhost:3000
```

### Via Docker (recommandé)

```bash
# Depuis la racine du projet
./palabre.sh start frontend
```

---

## Configuration — frontend/web/.env

### 1. URL de l'API (obligatoire)

```env
VITE_API_BASE_URL=http://localhost:4001/api/v1

# Production :
# VITE_API_BASE_URL=https://api.votre-domaine.com/api/v1
```

### 2. WebSocket temps réel (obligatoire)

```env
VITE_MESSAGE_ROUTER_URL=ws://localhost:4020
VITE_WS_BASE_URL=ws://localhost:4001

# Production :
# VITE_MESSAGE_ROUTER_URL=wss://votre-domaine.com:4020
# VITE_WS_BASE_URL=wss://votre-domaine.com
```

### 3. Firebase — connexion sociale (obligatoire)

Ces valeurs sont **publiques** (apparaissent dans le JS du navigateur). Pas des secrets.

1. Console Firebase → Paramètres du projet → Vos applications → **Application Web**
2. Copiez `firebaseConfig`

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet
VITE_FIREBASE_APP_ID=1:xxx:web:xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
```

### 4. Notifications push web — VAPID Key (obligatoire pour FCM web)

Sans cette clé, les notifications push ne fonctionnent pas dans le navigateur.

1. Console Firebase → Paramètres du projet → **Cloud Messaging**
2. Section "Certificats Push Web" → **Générer une paire de clés**
3. Copiez la clé publique

```env
VITE_FIREBASE_VAPID_KEY=BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Cette clé est différente de `VITE_FIREBASE_API_KEY`. Elle est spécifique aux notifications web.

### 5. reCAPTCHA (optionnel)

```env
VITE_RECAPTCHA_SITE_KEY=6Lc...
```

Obtenez une clé sur https://www.google.com/recaptcha/admin (type v2 "Case à cocher").  
Laissez vide pour désactiver en développement.

---

## Fichiers à placer manuellement

### Sonnerie d'appel entrant et musique d'attente

Ces deux fichiers sont servis statiquement par le frontend — **aucune configuration backend requise**.

| Fichier | Usage | Emplacement |
|---------|-------|-------------|
| `ringtone.mp3` | Sonnerie appel entrant (web + appels P2P) | `frontend/web/public/audio/ringtone.mp3` |
| `hold-music.mp3` | Musique d'attente service client | `frontend/web/public/audio/hold-music.mp3` |

**Tu as déjà placé les fichiers au bon endroit** si tu les as mis dans `frontend/web/public/audio/`. C'est le seul emplacement qui compte — le fichier `backend/src/audio/` n'est pas utilisé par le code actuel.

Téléchargements libres :
- Sonneries : https://mixkit.co/free-sound-effects/ring/
- Musique d'ambiance : https://freesound.org

> La variable `SUPPORT_HOLD_MUSIC_PATH` dans `backend/.env` est réservée pour une future intégration Asterisk — elle n'est pas lue par le code actuel.

### Service Worker FCM (déjà présent)

```
frontend/web/public/firebase-messaging-sw.js
```

Ce fichier est déjà dans le repo. Il gère les notifications en arrière-plan. **Ne pas le supprimer.**

### Logo

```
frontend/web/public/logo.png
```

Pour remplacer : déposez un PNG carré. Copiez aussi dans `backend/src/brand/logo.png` pour les emails.

---

## Chiffrement E2E — aucune configuration manuelle

Les clés Signal sont générées **automatiquement** au premier login via WebCrypto API :

- Clé d'identité ECDH P-256 → stockée dans IndexedDB (non-extractable)
- 100 one-time prekeys + 1 signed prekey → clés publiques uploadées au backend
- Sessions AES-256-GCM dérivées localement → messages chiffrés avant envoi
- Déchiffrement automatique à la réception et au chargement de l'historique

**Fallback transparent :** si le pair n'a pas encore de clés (première connexion), le message passe en clair — l'app ne bloque jamais.

Vérifiez que la migration `013_e2e_key_infrastructure.sql` a été exécutée :
```bash
./palabre.sh migrate
```

---

## Interfaces par rôle

| Rôle | Route | Description |
|------|-------|-------------|
| Super-admin | `/admin` | Dossiers, guide installation, gestion globale |
| Org-admin | `/org/dashboard` | Dashboard org, VPN, invitations |
| Membre | `/app` | Messages, appels, contacts |
| Sans org | `/org/join` | Rejoindre une organisation |

---

## Scripts npm

```bash
npm run dev       # Serveur de développement (hot reload)
npm run build     # Build production → dist/
npm run preview   # Prévisualiser le build
```

---

## Notes importantes

**Firebase SDK** — chargé depuis CDN au runtime (pas npm). Connexion réseau requise en développement.

**Passkeys** — liées à l'origine exacte du frontend. Si vous changez le port ou domaine, les passkeys existants ne fonctionnent plus. `PASSKEY_ORIGIN` dans `backend/.env` doit correspondre exactement.

**Vidéoconférence** — le SDK Jitsi est chargé via le proxy backend (`/api/v1/videoconference/client-sdk`). Si `JITSI_DOMAIN` est un serveur local, aucun trafic internet n'est requis pour la vidéo.

**Notifications push** — nécessitent HTTPS en production. En développement localhost fonctionne car WebCrypto et Service Workers sont autorisés sur `http://localhost`.
