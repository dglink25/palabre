/**
 * Couche de stockage sur disque local.
 *
 * Structure des répertoires :
 *   STORAGE_ROOT/
 *     {org_id}/
 *       {yyyy-mm}/
 *         {file_id}.enc    ← blob chiffré opaque
 *
 * Le fichier est TOUJOURS stocké avec l'extension .enc pour rappeler
 * qu'il est chiffré et ne doit jamais être servi en clair.
 *
 * Cette couche est remplaçable par S3/MinIO sans changer les routes :
 * il suffit de remplacer readFile/writeFile par les appels SDK correspondants.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORAGE_ROOT = process.env.FILE_STORAGE_PATH || path.join(__dirname, '../../storage');

/**
 * Sauvegarde un fichier chiffré sur disque.
 * @param {Buffer} encryptedBuffer - blob chiffré (opaque)
 * @param {string} orgId           - organisation (isolation)
 * @param {string} mimeType        - type MIME original (pour les métadonnées)
 * @returns {{ fileId, path, size }}
 */
async function saveFile(encryptedBuffer, orgId, mimeType) {
  const fileId = uuidv4();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const dir = path.join(STORAGE_ROOT, orgId, month);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${fileId}.enc`);
  await fs.promises.writeFile(filePath, encryptedBuffer);

  return {
    fileId,
    storagePath: filePath,
    size: encryptedBuffer.length,
    mimeType,
  };
}

/**
 * Lit un fichier chiffré depuis le disque.
 * @param {string} orgId
 * @param {string} fileId
 * @returns {Buffer}
 */
async function readFile(orgId, fileId) {
  // Cherche le fichier dans tous les sous-dossiers de l'org
  // (le mois de stockage est encapsulé dans le fileId via les métadonnées)
  const orgDir = path.join(STORAGE_ROOT, orgId);
  if (!fs.existsSync(orgDir)) {
    const err = new Error('Fichier introuvable.');
    err.httpStatus = 404;
    err.code = 'FILE_NOT_FOUND';
    throw err;
  }

  // Recherche récursive dans les sous-dossiers mensuels
  const months = fs.readdirSync(orgDir);
  for (const month of months) {
    const filePath = path.join(orgDir, month, `${fileId}.enc`);
    if (fs.existsSync(filePath)) {
      return fs.promises.readFile(filePath);
    }
  }

  const err = new Error('Fichier introuvable.');
  err.httpStatus = 404;
  err.code = 'FILE_NOT_FOUND';
  throw err;
}

/**
 * Supprime un fichier chiffré du disque.
 */
async function deleteFile(orgId, fileId) {
  const orgDir = path.join(STORAGE_ROOT, orgId);
  const months = fs.existsSync(orgDir) ? fs.readdirSync(orgDir) : [];

  for (const month of months) {
    const filePath = path.join(orgDir, month, `${fileId}.enc`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
  }
  return false;
}

/**
 * Retourne la taille occupée par une organisation (en bytes).
 */
function getOrgStorageUsage(orgId) {
  const orgDir = path.join(STORAGE_ROOT, orgId);
  if (!fs.existsSync(orgDir)) return 0;

  let total = 0;
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else total += fs.statSync(fullPath).size;
    }
  };
  walk(orgDir);
  return total;
}

module.exports = { saveFile, readFile, deleteFile, getOrgStorageUsage };
