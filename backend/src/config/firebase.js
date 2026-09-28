/**
 * Firebase Admin est utilisé uniquement pour VÉRIFIER, côté serveur, l'ID token
 * produit par le client après une connexion fédérée (Google, GitHub, Facebook,
 * Apple, TikTok - configurés comme providers dans le projet Firebase / Google
 * Cloud Console). Palabre ne gère aucun secret propre à ces providers : c'est
 * Firebase qui fédère, notre backend ne fait que valider l'identité obtenue.
 */
const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) {
    console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT_PATH non défini - la connexion fédérée sera indisponible.');
    return admin;
  }

  let serviceAccount;
  try {
    serviceAccount = require(path);
  } catch (e) {
    // Le détail (chemin du fichier, cause) reste dans les logs serveur -
    // jamais renvoyé au navigateur (information interne, et message peu
    // exploitable pour un utilisateur final).
    console.error(`[firebase] impossible de charger la clé de service à "${path}" :`, e.message);
    const err = new Error('Le service de connexion externe est momentanément indisponible.');
    err.code = 'FEDERATED_UNAVAILABLE';
    err.httpStatus = 503;
    throw err;
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
  return admin;
}

/**
 * Vérifie un ID token Firebase envoyé par le client mobile/web après une
 * authentification Google / GitHub / Facebook / Apple / TikTok.
 * Retourne les informations d'identité fédérée normalisées.
 */
async function verifyFirebaseIdToken(idToken) {
  const app = initFirebase();
  const decoded = await app.auth().verifyIdToken(idToken);

  // Le "sign_in_provider" indique le fournisseur fédéré réellement utilisé.
  const providerRaw = decoded.firebase && decoded.firebase.sign_in_provider;
  const providerMap = {
    'google.com': 'google',
    'github.com': 'github',
    'facebook.com': 'facebook',
    'apple.com': 'apple',
    'oidc.tiktok': 'tiktok', // provider OIDC personnalisé configuré pour TikTok
  };
  const provider = providerMap[providerRaw] || providerRaw;

  return {
    provider,
    providerUid: decoded.uid,
    email: decoded.email || null,
    emailVerified: !!decoded.email_verified,
    name: decoded.name || null,
    photoUrl: decoded.picture || null,
  };
}

module.exports = { initFirebase, verifyFirebaseIdToken };
