import { api } from './apiClient';

/**
 * Passkeys reposent sur l'API navigator.credentials du navigateur (standard
 * W3C WebAuthn) - aucune bibliothèque tierce nécessaire côté client. Le
 * serveur (voir passkey.service.js, basé sur @simplewebauthn/server) échange
 * des options/réponses encodées en base64url ; ces quelques fonctions font
 * la conversion entre ArrayBuffer (utilisé par le navigateur) et base64url
 * (utilisé sur le fil).
 */

function base64urlToBuffer(base64url) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCreationOptions(options) {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: { ...options.user, id: base64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: base64urlToBuffer(c.id) })),
  };
}

function decodeRequestOptions(options) {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: base64urlToBuffer(c.id) })),
  };
}

function encodeCreationResponse(credential) {
  if (!credential || !credential.response) {
    const err = new Error('Aucune réponse de l\'authenticateur.');
    err.code = 'PASSKEY_CLIENT_ERROR';
    throw err;
  }
  const r = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64url(r.attestationObject),
      clientDataJSON: bufferToBase64url(r.clientDataJSON),
      transports: r.getTransports ? r.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
}

function encodeAssertionResponse(credential) {
  if (!credential || !credential.response) {
    const err = new Error('Aucune réponse de l\'authenticateur.');
    err.code = 'PASSKEY_CLIENT_ERROR';
    throw err;
  }
  const r = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64url(r.authenticatorData),
      clientDataJSON: bufferToBase64url(r.clientDataJSON),
      signature: bufferToBase64url(r.signature),
      userHandle: r.userHandle ? bufferToBase64url(r.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
}

export function isPasskeySupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

/**
 * Le navigateur lève des DOMException techniques (ex. "The operation either
 * timed out or was not allowed...") - jamais montrées telles quelles à
 * l'utilisateur. On les retraduit en code reconnu par errorMessages.js,
 * pour que le même pipeline `friendlyMessage()` s'applique partout, y
 * compris à ces erreurs natives du navigateur.
 */
function translateWebAuthnError(err) {
  const name = err && err.name;
  const codeByName = {
    NotAllowedError: 'PASSKEY_CANCELLED',
    AbortError: 'PASSKEY_CANCELLED',
    SecurityError: 'PASSKEY_SECURITY_ERROR',
    InvalidStateError: 'PASSKEY_ALREADY_REGISTERED',
    NotSupportedError: 'PASSKEY_NOT_SUPPORTED',
    ConstraintError: 'PASSKEY_CLIENT_ERROR',
    UnknownError: 'PASSKEY_CLIENT_ERROR',
  };
  const translated = new Error(err && err.message ? err.message : 'Passkey error');
  translated.code = codeByName[name] || 'PASSKEY_CLIENT_ERROR';
  return translated;
}

/** Enrôlement d'un nouveau passkey pour le compte connecté (Sécurité). */
export async function registerPasskey(label) {
  const options = await api.post('/security/passkeys/register/options');

  // Guard : si le serveur retourne une réponse inattendue, on lève une erreur
  // lisible plutôt qu'un crash JS opaque sur options.user.id
  if (!options || !options.user || !options.user.id || !options.challenge) {
    const err = new Error('Réponse invalide du serveur lors de la génération des options.');
    err.code = 'PASSKEY_CLIENT_ERROR';
    throw err;
  }

  let credential;
  try {
    credential = await navigator.credentials.create({ publicKey: decodeCreationOptions(options) });
  } catch (err) {
    throw translateWebAuthnError(err);
  }

  // Guard : l'utilisateur a annulé ou l'authenticateur n'a pas répondu
  if (!credential) {
    const err = new Error('Enregistrement annulé.');
    err.code = 'PASSKEY_CANCELLED';
    throw err;
  }

  return api.post('/security/passkeys/register/verify', { response: encodeCreationResponse(credential), label });
}

/** Connexion directe par passkey, sans identifiant saisi (façon GitHub). */
export async function loginWithDiscoverablePasskey(deviceInfo) {
  const result = await api.post('/auth/passkey/login/options', undefined, { auth: false });

  if (!result || !result.options || !result.options.challenge) {
    const err = new Error('Réponse invalide du serveur.');
    err.code = 'PASSKEY_CLIENT_ERROR';
    throw err;
  }

  const { options, requestId } = result;
  let credential;
  try {
    credential = await navigator.credentials.get({ publicKey: decodeRequestOptions(options) });
  } catch (err) {
    throw translateWebAuthnError(err);
  }
  if (!credential) {
    const err = new Error('Connexion annulée.'); err.code = 'PASSKEY_CANCELLED'; throw err;
  }
  return api.post('/auth/passkey/login/verify', {
    requestId,
    response: encodeAssertionResponse(credential),
    ...deviceInfo,
  }, { auth: false });
}

/** Second facteur par passkey après une connexion téléphone/fédérée. */
export async function verifyPasskeyTwoFactor() {
  const options = await api.post('/security/passkeys/2fa/options');

  if (!options || !options.challenge) {
    const err = new Error('Réponse invalide du serveur.');
    err.code = 'PASSKEY_CLIENT_ERROR';
    throw err;
  }

  let credential;
  try {
    credential = await navigator.credentials.get({ publicKey: decodeRequestOptions(options) });
  } catch (err) {
    throw translateWebAuthnError(err);
  }
  if (!credential) {
    const err = new Error('Vérification annulée.'); err.code = 'PASSKEY_CANCELLED'; throw err;
  }
  return api.post('/security/passkeys/2fa/verify', { response: encodeAssertionResponse(credential) });
}
