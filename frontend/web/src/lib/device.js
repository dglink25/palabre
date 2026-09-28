const STORAGE_KEY = 'palabre_device_fingerprint';

/**
 * Le backend exige un `deviceFingerprint` stable pour appliquer la règle
 * "un appareil ne peut créer qu'un seul compte" (voir device.service.js
 * côté backend). Pour un navigateur, on génère un identifiant aléatoire une
 * seule fois et on le persiste - il identifie CE navigateur sur CETTE
 * machine, pas l'utilisateur.
 */
export function getDeviceFingerprint() {
  let value = localStorage.getItem(STORAGE_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, value);
  }
  return value;
}

export function getDeviceInfo() {
  return {
    deviceFingerprint: getDeviceFingerprint(),
    platform: 'web',
    model: navigator.userAgent.slice(0, 150),
  };
}
