/**
 * ======================================================================
 * FACTEUR "EMPREINTE D'APPAREIL" (2FA) - CryptoKey non-extractable
 * ======================================================================
 * Le backend (security.service.js) vérifie une signature ECDSA P-256 avec
 * une clé publique PEM (format SPKI), via Node `crypto.createVerify`, qui
 * attend une signature au format DER - alors que l'API WebCrypto du
 * navigateur produit ses signatures ECDSA au format brut IEEE P1363
 * (r || s concaténés). Ce module génère la paire de clés, exporte la clé
 * publique en PEM, et convertit chaque signature en DER avant envoi.
 *
 * Important : ceci n'est PAS le protocole WebAuthn du W3C (qui utiliserait
 * des clés COSE/CBOR et signerait authenticatorData+clientDataHash, pas un
 * defi arbitraire) - c'est un mécanisme "clé liée à l'appareil" plus simple
 * délibérément choisi côté backend pour rester indépendant du matériel.
 * La clé privée ne quitte jamais l'appareil (non-extractable, stockée dans
 * IndexedDB), mais un vrai geste biométrique du système d'exploitation
 * n'est garanti que via un futur passage au WebAuthn natif.
 */

const DB_NAME = 'palabre-device-keys';
const STORE_NAME = 'keys';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeKeyPair(credentialId, keyPair) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(keyPair, credentialId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKeyPair(credentialId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(credentialId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function derInteger(bytes) {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let trimmed = bytes.slice(i);
  if (trimmed[0] & 0x80) trimmed = new Uint8Array([0, ...trimmed]);
  return new Uint8Array([0x02, trimmed.length, ...trimmed]);
}

function rawSignatureToDer(rawSig) {
  const bytes = new Uint8Array(rawSig);
  const half = bytes.length / 2;
  const r = derInteger(bytes.slice(0, half));
  const s = derInteger(bytes.slice(half));
  const body = new Uint8Array([...r, ...s]);
  return new Uint8Array([0x30, body.length, ...body]);
}

function toPem(base64, label) {
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/**
 * Génère la paire de clés pour ce navigateur, l'enregistre localement, et
 * renvoie la clé publique au format attendu par
 * POST /security/2fa/credentials.
 */
export async function enrollDeviceCredential() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // clé privée non-extractable
    ['sign', 'verify']
  );
  const credentialId = crypto.randomUUID();
  await storeKeyPair(credentialId, keyPair);

  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyPem = toPem(bufToBase64(spki), 'PUBLIC KEY');

  return { credentialId, publicKey: publicKeyPem };
}

export async function listLocalCredentialIds() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Signe un défi (chaîne quelconque) avec la clé privée locale correspondant
 * à `credentialId`, pour POST /auth/2fa/verify. Renvoie la signature en
 * DER, encodée en base64.
 */
export async function signChallenge(credentialId, challenge) {
  const keyPair = await loadKeyPair(credentialId);
  if (!keyPair) {
    throw new Error('Aucune clé locale pour cet identifiant sur cet appareil.');
  }
  const rawSig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(challenge)
  );
  const der = rawSignatureToDer(rawSig);
  return bufToBase64(der);
}
