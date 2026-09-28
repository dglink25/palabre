# Configuration Firebase / Google Cloud Console - Authentification fédérée

Le backend (`src/config/firebase.js`) ne fait que **vérifier** un `idToken`
déjà émis par Firebase après connexion au provider. Toute la configuration
des providers (Google, GitHub, Facebook, Apple, TikTok) se fait en dehors du
code, dans les consoles ci-dessous. Sans cette étape, `verifyFirebaseIdToken`
n'aura jamais de token valide à vérifier.

## 1. Créer le projet Firebase

1. https://console.firebase.google.com → **Ajouter un projet** → nommez-le
   `palabre` (ou `palabre-prod` / `palabre-staging` si plusieurs
   environnements).
2. Ce projet Firebase est automatiquement lié à un projet **Google Cloud**
   du même nom - c'est ce projet GCP que vous retrouverez dans la Google
   Cloud Console pour les étapes OAuth ci-dessous.
3. Dans **Authentication → Sign-in method**, activez un par un les
   providers utilisés par Palabre (Google, GitHub, Facebook, Apple ;
   TikTok est traité à part, voir section 6).

## 2. Google

1. Firebase Console → Authentication → Sign-in method → **Google** → Activer.
2. Firebase crée automatiquement un client OAuth "Web" dans Google Cloud
   Console (**APIs & Services → Identifiants**). Rien d'autre à faire côté
   Google pour le cas web.
3. Pour l'app mobile Android : dans **Project Settings → Vos applications**,
   ajoutez l'app Android avec son **nom de package** et son
   **empreinte SHA-1** (`./gradlew signingReport` en debug, et l'empreinte
   de la clé de release avant publication) - Google Sign-In sur Android en a
   besoin pour valider l'app appelante.
4. Téléchargez `google-services.json` (Android) / `GoogleService-Info.plist`
   (iOS) depuis Project Settings et intégrez-les au projet mobile.

## 3. GitHub

1. https://github.com/settings/developers → **New OAuth App**.
2. **Authorization callback URL** : copiez l'URL fournie par Firebase
   Console → Authentication → Sign-in method → GitHub (au format
   `https://<project-id>.firebaseapp.com/__/auth/handler`).
3. Reportez le **Client ID** et le **Client Secret** générés par GitHub dans
   Firebase Console → Sign-in method → GitHub, puis Enregistrer.

## 4. Facebook

1. https://developers.facebook.com/apps → **Créer une application** → type
   "Consommateur".
2. Dans le produit **Facebook Login**, ajoutez l'URI de redirection OAuth
   fournie par Firebase Console → Sign-in method → Facebook (même format
   `.../__/auth/handler`).
3. Reportez l'**App ID** et l'**App Secret** de Facebook dans Firebase
   Console → Sign-in method → Facebook.
4. Pour la mise en production, l'app Facebook doit passer en mode "Live"
   (revue de l'app par Meta) sinon seuls les comptes testeurs déclarés
   pourront se connecter.

## 5. Apple

1. Nécessite un compte **Apple Developer Program** (payant).
2. https://developer.apple.com/account → **Certificates, Identifiers &
   Profiles** :
   - créez un **App ID** avec la capacité "Sign in with Apple" ;
   - créez un **Services ID** (c'est lui l'équivalent du "client ID" côté
     web) ;
   - créez une **clé privée** (.p8) dédiée à Sign in with Apple.
3. Dans Firebase Console → Sign-in method → Apple, renseignez le Services
   ID, l'Apple Team ID, le Key ID et le contenu de la clé .p8.
4. Renseignez l'URI de redirection Firebase (`.../__/auth/handler`) dans la
   configuration du Services ID côté Apple.

## 6. TikTok (provider OIDC personnalisé)

TikTok Login n'est pas un provider natif de Firebase Auth : il faut le
configurer comme **provider OIDC générique**.

1. https://developers.tiktok.com → créez une app, activez le produit
   "Login Kit", récupérez le **Client Key** et le **Client Secret**.
2. Renseignez l'URI de redirection Firebase (`.../__/auth/handler`) dans la
   configuration de l'app TikTok.
3. Firebase Console → Authentication → Sign-in method → **Ajouter un
   fournisseur → OpenID Connect (OIDC)** :
   - Nom du provider : donnez-lui l'identifiant `oidc.tiktok` (c'est cet
     identifiant qui est attendu par `providerMap` dans
     `src/config/firebase.js` - si vous le nommez différemment, mettez à
     jour ce fichier en conséquence) ;
   - Issuer URL : `https://www.tiktok.com/`  ;
   - Client ID / Client Secret : ceux fournis par TikTok à l'étape 1.

## 7. Clé de service (côté serveur, pour le backend Palabre)

Le backend n'utilise **aucune** des clés ci-dessus directement : il ne fait
que vérifier les tokens via une **clé de service** Firebase Admin, distincte.

1. Firebase Console → Paramètres du projet → **Comptes de service** →
   **Générer une nouvelle clé privée** → télécharge un fichier JSON.
2. Copiez ce fichier dans `backend/secrets/` (dossier ignoré par git, monté en
   lecture seule dans le conteneur sous `/run/secrets/` - voir
   `docker/docker-compose.yml`). Ne jamais le commiter ailleurs.
3. Dans `backend/.env`, mettez son nom exact, par exemple :
   `FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/palable-320b4-firebase-adminsdk-fbsvc-76c8806392.json`
4. Recréez le conteneur pour prendre en compte le montage :
   `./palabre.sh restart backend`.
   Sans cette étape, l'erreur « Cannot find module '/run/secrets/...' »
   apparaît dès qu'un utilisateur tente une connexion Google/GitHub/etc.

## 8. Ce que fait le client (mobile / web), pas le backend

Le flux est toujours : **le client s'authentifie auprès du provider via le
SDK Firebase**, obtient un `idToken` Firebase, puis l'envoie au backend
Palabre (`POST /auth/federated/register` ou `/auth/federated/login`, voir
`auth.routes.js`). Le backend ne fait que vérifier ce token - il ne pilote
jamais lui-même l'écran de connexion Google/GitHub/Facebook/Apple/TikTok.
