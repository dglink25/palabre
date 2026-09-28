const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Stockage local sur disque (monté en volume Docker). Suffisant pour le
 * MVP ; à remplacer par un stockage objet (S3-compatible) en production
 * multi-instance sans changer les routes (seule cette fabrique change).
 */
function makeUploader(subfolder, { maxSizeMB = 10, allowedMimePrefixes = ['image/', 'application/pdf'] } = {}) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  ensureDir(dir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = allowedMimePrefixes.some((prefix) => file.mimetype.startsWith(prefix));
      if (!ok) return cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
      cb(null, true);
    },
  });
}

function publicUrlFor(subfolder, filename) {
  const base = process.env.APP_BASE_URL || '';
  return `${base}/uploads/${subfolder}/${filename}`;
}

module.exports = { makeUploader, publicUrlFor, UPLOAD_ROOT };
