/**
 * firebase.js - Developer Portal
 *
 * Charge le SDK Firebase Auth depuis le CDN Google (évite d'alourdir le bundle
 * avec les 20+ sous-paquets @firebase/*) et expose les méthodes de connexion
 * fédérée utilisées sur la LoginPage.
 *
 * Providers supportés : Google, GitHub
 *
 * Requirements : 1.2
 */

const SDK_VERSION = '10.12.2';
const CDN_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const firebaseConfig = {
  apiKey:    import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:     import.meta.env.VITE_FIREBASE_APP_ID,
};

let authPromise = null;

async function getFirebaseAuth() {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      'Firebase non configuré. Vérifiez les variables VITE_FIREBASE_* dans .env.'
    );
  }
  if (!authPromise) {
    authPromise = (async () => {
      const [{ initializeApp }, authModule] = await Promise.all([
        import(/* @vite-ignore */ `${CDN_BASE}/firebase-app.js`),
        import(/* @vite-ignore */ `${CDN_BASE}/firebase-auth.js`),
      ]);
      const app = initializeApp(firebaseConfig, 'developer-portal');
      return { auth: authModule.getAuth(app), authModule };
    })();
  }
  return authPromise;
}

/**
 * Traduit les codes d'erreur Firebase en messages lisibles.
 */
function translateFirebaseError(err) {
  const codeMessages = {
    'auth/popup-closed-by-user':     'Connexion annulée. La fenêtre a été fermée.',
    'auth/cancelled-popup-request':  'Connexion annulée.',
    'auth/user-cancelled':           'Connexion annulée par l\'utilisateur.',
    'auth/popup-blocked':            'La fenêtre popup a été bloquée. Autorisez les popups pour ce site.',
    'auth/network-request-failed':   'Erreur réseau. Vérifiez votre connexion internet.',
    'auth/account-exists-with-different-credential':
      'Ce compte existe déjà avec un autre mode de connexion.',
  };

  const message = codeMessages[err?.code]
    || err?.message
    || 'Erreur d\'authentification inconnue.';

  const translated = new Error(message);
  translated.code  = err?.code || 'FEDERATED_UNKNOWN';
  return translated;
}

/**
 * Lance une popup Firebase pour le provider donné et retourne le idToken.
 */
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

/**
 * Providers fédérés disponibles.
 * Utilisez federatedProviders['google']() ou federatedProviders['github']().
 */
export const federatedProviders = {
  google: () => signInWith((m) => new m.GoogleAuthProvider()),
  github: () => signInWith((m) => new m.GithubAuthProvider()),
};
