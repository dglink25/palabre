/**
 * Le SDK Firebase Auth est chargé depuis le CDN officiel de Google au
 * moment de l'exécution, plutôt qu'installé via npm. Le paquet npm
 * "firebase" embarque près de 20 sous-paquets @firebase/* (Firestore,
 * Storage, Messaging, Analytics...) même si l'on n'utilise que Auth - sur
 * une connexion lente ou instable, cela suffit à faire échouer `npm
 * install`. Le CDN ne télécharge que ce qui est réellement utilisé, une
 * seule fois, mis en cache par le navigateur.
 */

const SDK_VERSION = '10.12.2';
const CDN_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let authPromise = null;

async function getFirebaseAuth() {
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase non configuré (variables VITE_FIREBASE_* manquantes). Voir backend/docs/FIREBASE_SETUP.md.');
  }
  if (!authPromise) {
    authPromise = (async () => {
      const [{ initializeApp }, authModule] = await Promise.all([
        import(/* @vite-ignore */ `${CDN_BASE}/firebase-app.js`),
        import(/* @vite-ignore */ `${CDN_BASE}/firebase-auth.js`),
      ]);
      const app = initializeApp(firebaseConfig);
      return { auth: authModule.getAuth(app), authModule };
    })();
  }
  return authPromise;
}

/**
 * Firebase lève des erreurs techniques (ex. "Firebase: Error
 * (auth/popup-closed-by-user).") - jamais montrées telles quelles. On les
 * retraduit en code reconnu par errorMessages.js, comme pour les passkeys.
 */
function translateFirebaseError(err) {
  const code = err && err.code;
  const codeMap = {
    'auth/popup-closed-by-user': 'FEDERATED_CANCELLED',
    'auth/cancelled-popup-request': 'FEDERATED_CANCELLED',
    'auth/user-cancelled': 'FEDERATED_CANCELLED',
    'auth/popup-blocked': 'FEDERATED_POPUP_BLOCKED',
    'auth/network-request-failed': 'FEDERATED_NETWORK_ERROR',
    'auth/account-exists-with-different-credential': 'FEDERATED_ACCOUNT_EXISTS',
  };
  const translated = new Error(err && err.message ? err.message : 'Federated sign-in error');
  translated.code = codeMap[code] || 'FEDERATED_UNKNOWN';
  return translated;
}

async function signInWith(makeProvider) {
  const { auth, authModule } = await getFirebaseAuth();
  const provider = makeProvider(authModule);
  let result;
  try {
    result = await authModule.signInWithPopup(auth, provider);
  } catch (err) {
    throw translateFirebaseError(err);
  }
  const idToken = await result.user.getIdToken();
  return { idToken, email: result.user.email };
}

export const federatedProviders = {
  google: () => signInWith((m) => new m.GoogleAuthProvider()),
  github: () => signInWith((m) => new m.GithubAuthProvider()),
  facebook: () => signInWith((m) => new m.FacebookAuthProvider()),
  apple: () => signInWith((m) => new m.OAuthProvider('apple.com')),
  // Provider OIDC personnalisé, nommé "oidc.tiktok" côté Firebase Console -
  // doit correspondre exactement à providerMap dans config/firebase.js (backend).
  tiktok: () => signInWith((m) => new m.OAuthProvider('oidc.tiktok')),
};
