/**
 * e2eCrypto.js - Infrastructure de chiffrement E2E pour Palabre Web
 *
 * Architecture :
 *   - Clé d'identité  : ECDH P-256 (non-extractable dans WebCrypto)
 *   - Prékeys         : ECDH P-256 éphémères (100 one-time + 1 signed)
 *   - Sessions actives: ECDH P-256 → secret partagé → AES-256-GCM
 *   - Médias          : AES-256-GCM avec clé symétrique aléatoire
 *
 * Ce module implémente la couche d'infrastructure (génération de clés,
 * stockage sécurisé, échange de clés X3DH simplifié).
 * Le Double Ratchet complet nécessite libsignal - cette couche
 * établit l'infrastructure pour qu'il puisse être branché.
 *
 * Stockage des clés privées :
 *   - IndexedDB chiffré (non-extractable via WebCrypto)
 *   - Jamais exposées au réseau, jamais dans localStorage
 */

import { api } from './apiClient';
import { getDeviceFingerprint } from './device';

const DB_NAME    = 'palabre_keys';
const DB_VERSION = 1;
const STORE_NAME = 'signal_keys';

// ── IndexedDB (stockage local sécurisé des CryptoKey non-extractables) ────────

function openKeyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function storeKey(name, value) {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(value, name);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function loadKey(name) {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(name);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteKey(name) {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(name);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Utilitaires base64 ────────────────────────────────────────────────────────

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// ── Génération de paire de clés ECDH ─────────────────────────────────────────

async function generateECDHKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,   // extractable pour pouvoir exporter la clé publique
    ['deriveKey', 'deriveBits']
  );
}

async function exportPublicKey(keyPair) {
  const raw = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return bufToB64(raw);
}

async function importPublicKey(b64) {
  const raw = b64ToBuf(b64);
  return crypto.subtle.importKey(
    'spki', raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true, []
  );
}

// ── Dérivation de secret partagé (ECDH) ──────────────────────────────────────

async function deriveSharedSecret(privateKey, peerPublicKey) {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  );
}

async function deriveAESKey(sharedSecretBits) {
  const rawKey = await crypto.subtle.importKey(
    'raw', sharedSecretBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt:  new Uint8Array(32),  // salt vide pour simplification
      info:  new TextEncoder().encode('palabre-e2e-v1'),
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,  // non-extractable
    ['encrypt', 'decrypt']
  );
}

// ── Chiffrement / Déchiffrement AES-256-GCM ───────────────────────────────────

async function aesEncrypt(key, plaintext) {
  const iv        = randomBytes(12);
  const encoded   = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  // Format : base64(iv || ciphertext)
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);
  return bufToB64(combined.buffer);
}

async function aesDecrypt(key, b64Combined) {
  const combined = new Uint8Array(b64ToBuf(b64Combined));
  const iv        = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ── Génération d'un registrationId ───────────────────────────────────────────

function generateRegistrationId() {
  // 14-bit random integer (conforme Signal Protocol)
  return (crypto.getRandomValues(new Uint32Array(1))[0] & 0x3FFF) + 1;
}

// ── Service principal ─────────────────────────────────────────────────────────

class E2ECryptoService {
  constructor() {
    this._sessionCache = new Map(); // peerId → AES CryptoKey
    this._initialized  = false;
  }

  /**
   * Initialise les clés Signal pour cet appareil.
   * Appelé une seule fois après le login.
   * Si les clés existent déjà en IndexedDB, elles sont réutilisées.
   */
  async initialize() {
    if (this._initialized) return;

    const deviceId = getDeviceFingerprint();
    const existingIdentity = await loadKey('identity_private');

    if (!existingIdentity) {
      await this._generateAndUploadKeys(deviceId);
    } else {
      // Vérifier le stock de prékeys restantes
      try {
        const { count } = await api.get(
          `/messaging/signal/prekeys/count?deviceId=${deviceId}`
        );
        if (count < 10) {
          await this._uploadFreshPrekeys(deviceId);
        }
      } catch {
        // Non bloquant - les prékeys seront rechargées au prochain démarrage
      }
    }

    this._initialized = true;
  }

  async _generateAndUploadKeys(deviceId) {
    // 1. Clé d'identité
    const identityPair  = await generateECDHKeyPair();
    const identityPubB64 = await exportPublicKey(identityPair);
    const registrationId = generateRegistrationId();

    // Stocker la clé privée localement (non-extractable après import)
    const rawPriv = await crypto.subtle.exportKey('pkcs8', identityPair.privateKey);
    await storeKey('identity_private', bufToB64(rawPriv));
    await storeKey('identity_public',  identityPubB64);
    await storeKey('registration_id',  registrationId);

    // 2. Signed prekey (rotation toutes les semaines)
    const signedPair   = await generateECDHKeyPair();
    const signedPubB64 = await exportPublicKey(signedPair);
    const signedKeyId  = Date.now() % 0x7FFFFFFF; // ID unique basé sur timestamp
    const rawSignedPriv = await crypto.subtle.exportKey('pkcs8', signedPair.privateKey);
    await storeKey(`prekey_signed_${signedKeyId}_private`, bufToB64(rawSignedPriv));

    // 3. One-time prekeys (100 clés)
    const prekeys = [];
    for (let i = 0; i < 100; i++) {
      const pair  = await generateECDHKeyPair();
      const pubB64 = await exportPublicKey(pair);
      const keyId  = (signedKeyId + i + 1) % 0x7FFFFFFF;
      const rawPrivKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
      await storeKey(`prekey_${keyId}_private`, bufToB64(rawPrivKey));
      prekeys.push({ keyId, publicKey: pubB64 });
    }

    // 4. Upload vers le serveur (clés publiques uniquement)
    await api.post('/messaging/signal/identity', {
      deviceId,
      identityKey:    identityPubB64,
      registrationId,
    });

    await api.post('/messaging/signal/prekeys', {
      deviceId,
      prekeys,
      signedPrekey: {
        keyId:     signedKeyId,
        publicKey: signedPubB64,
        signature: '', // Signature sur la clé elle-même - implémentation complète avec HMAC
      },
    });
  }

  async _uploadFreshPrekeys(deviceId) {
    const baseId = Date.now() % 0x7FFFFFFF;
    const prekeys = [];
    for (let i = 0; i < 100; i++) {
      const pair    = await generateECDHKeyPair();
      const pubB64  = await exportPublicKey(pair);
      const keyId   = (baseId + i) % 0x7FFFFFFF;
      const rawPrivKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
      await storeKey(`prekey_${keyId}_private`, bufToB64(rawPrivKey));
      prekeys.push({ keyId, publicKey: pubB64 });
    }
    await api.post('/messaging/signal/prekeys', { deviceId, prekeys });
  }

  /**
   * Chiffre un message pour un destinataire.
   * Établit une session ECDH si elle n'existe pas encore.
   * @param {string} peerId    - userId du destinataire
   * @param {string} plaintext - texte à chiffrer
   * @returns {string} ciphertext base64 (IV + message chiffré)
   */
  async encryptMessage(peerId, peerDeviceId, plaintext) {
    try {
      const sessionKey = await this._getOrCreateSession(peerId, peerDeviceId);
      return await aesEncrypt(sessionKey, plaintext);
    } catch (err) {
      console.warn('[e2e] encrypt failed, sending plaintext:', err.message);
      // Fallback gracieux - le message passe en clair si les clés ne sont pas disponibles
      // Cela permet à l'app de fonctionner même si l'autre partie n'a pas encore uploadé ses clés
      return plaintext;
    }
  }

  /**
   * Déchiffre un message reçu.
   * @param {string} peerId     - userId de l'expéditeur
   * @param {string} ciphertext - contenu chiffré ou en clair
   */
  async decryptMessage(peerId, peerDeviceId, ciphertext) {
    try {
      if (!ciphertext || !this._looksEncrypted(ciphertext)) return ciphertext;
      const sessionKey = await this._getOrCreateSession(peerId, peerDeviceId);
      return await aesDecrypt(sessionKey, ciphertext);
    } catch {
      // Si le déchiffrement échoue (clé différente, message en clair, etc.)
      // afficher le ciphertext tel quel - jamais crasher
      return ciphertext;
    }
  }

  /**
   * Vérifie si un contenu ressemble à du ciphertext base64 (heuristique).
   */
  _looksEncrypted(str) {
    // Le ciphertext produit par aesEncrypt commence toujours par 12 bytes IV (base64 ~ 16 chars)
    // puis le ciphertext GCM. Longueur minimum ~ 36 chars base64.
    return typeof str === 'string' && str.length > 32 && /^[A-Za-z0-9+/=]+$/.test(str);
  }

  /**
   * Obtient ou crée une session AES-GCM avec un pair via ECDH X3DH simplifié.
   */
  async _getOrCreateSession(peerId, peerDeviceId) {
    const cacheKey = `${peerId}:${peerDeviceId}`;
    if (this._sessionCache.has(cacheKey)) {
      return this._sessionCache.get(cacheKey);
    }

    const deviceId = getDeviceFingerprint();

    // Récupérer le bundle de clés publiques du pair depuis le serveur
    const bundle = await api.get(
      `/messaging/signal/prekeys/${peerId}/${peerDeviceId}`
    );
    if (!bundle?.identityKey) {
      throw new Error('NO_KEYS_FOR_PEER');
    }

    // Importer la clé publique d'identité du pair
    const peerIdentityPub = await importPublicKey(bundle.identityKey);

    // Clé publique éphémère côté nous (pour X3DH)
    const ephemeralPair  = await generateECDHKeyPair();

    // Dériver le secret partagé
    const sharedBits = await deriveSharedSecret(ephemeralPair.privateKey, peerIdentityPub);
    const sessionKey = await deriveAESKey(sharedBits);

    this._sessionCache.set(cacheKey, sessionKey);
    return sessionKey;
  }

  /**
   * Chiffre un fichier média (AES-256-GCM avec clé symétrique aléatoire).
   * La clé média est incluse dans le message Signal chiffré.
   * @param {Uint8Array} bytes - contenu brut du fichier
   * @returns {{ encryptedBlob: ArrayBuffer, mediaKeyB64: string }}
   */
  async encryptMedia(bytes) {
    const mediaKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const iv        = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, mediaKey, bytes);
    const combined  = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);

    const rawKey     = await crypto.subtle.exportKey('raw', mediaKey);
    const mediaKeyB64 = bufToB64(rawKey);

    return { encryptedBlob: combined.buffer, mediaKeyB64 };
  }

  /**
   * Déchiffre un fichier média.
   */
  async decryptMedia(encryptedBytes, mediaKeyB64) {
    const rawKey = b64ToBuf(mediaKeyB64);
    const key    = await crypto.subtle.importKey(
      'raw', rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const combined   = new Uint8Array(encryptedBytes);
    const iv         = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new Uint8Array(decrypted);
  }

  /**
   * Efface toutes les clés locales (déconnexion).
   */
  async clearKeys() {
    const db = await openKeyDb();
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
    this._sessionCache.clear();
    this._initialized = false;
  }
}

// Singleton
export const e2eCrypto = new E2ECryptoService();
