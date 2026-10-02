/**
 * Route d'upload de fichiers chiffrés.
 *
 * POST /files/upload
 *
 * Le client doit :
 *   1. Chiffrer le fichier localement (AES-256-CBC côté client)
 *   2. Envoyer le blob chiffré en multipart/form-data
 *   3. Inclure les métadonnées dans les champs du formulaire
 *
 * Form fields :
 *   file           - blob chiffré (binaire)
 *   mimeType       - type MIME ORIGINAL avant chiffrement ("image/jpeg", "video/mp4"...)
 *   originalSize   - taille originale avant chiffrement (bytes)
 *   mediaType      - "image" | "video" | "audio" | "document"
 *   thumbnail      - (optionnel) miniature chiffrée séparément (pour les images/vidéos)
 *
 * Réponse :
 *   {
 *     fileId:   "uuid",
 *     url:      "http://file-server/files/{orgId}/{fileId}",
 *     size:     1234,       ← taille du blob chiffré
 *     expiresAt: null       ← null = pas d'expiration (géré par TTL organisation)
 *   }
 *
 * Le serveur NE DÉCHIFFRE JAMAIS le blob.
 */

const express = require('express');
const multer = require('multer');
const mime = require('mime-types');
const { saveFile } = require('../storage/diskStorage');
const { uploadLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Limites d'upload par type de média
const MAX_SIZES = {
  image:    16 * 1024 * 1024,   // 16 MB
  video:    64 * 1024 * 1024,   // 64 MB
  audio:    16 * 1024 * 1024,   // 16 MB
  document: 100 * 1024 * 1024,  // 100 MB
  default:  16 * 1024 * 1024,
};

// Multer : stockage en mémoire (buffer) - on écrit nous-mêmes sur disque
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max absolu
  fileFilter: (_req, file, cb) => {
    // Accepter tous les types - le contenu est chiffré de toute façon
    // On vérifie juste que le Content-Type est déclaré
    if (!file.mimetype) {
      return cb(new Error('Content-Type manquant.'));
    }
    cb(null, true);
  },
});

router.post('/', uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('Fichier manquant.');
      err.httpStatus = 400;
      err.code = 'FILE_REQUIRED';
      throw err;
    }

    const { mimeType, originalSize, mediaType = 'document' } = req.body;

    // Vérification de la taille selon le type de média déclaré
    const maxSize = MAX_SIZES[mediaType] || MAX_SIZES.default;
    if (req.file.size > maxSize) {
      const err = new Error(`Fichier trop volumineux pour le type ${mediaType} (max ${maxSize / 1024 / 1024} MB).`);
      err.httpStatus = 413;
      err.code = 'FILE_TOO_LARGE';
      throw err;
    }

    // Sauvegarder le blob chiffré
    const { fileId, size } = await saveFile(
      req.file.buffer,
      req.orgId,
      mimeType || req.file.mimetype
    );

    // Si une miniature chiffrée est fournie, la sauvegarder aussi
    let thumbnailFileId = null;
    if (req.body.thumbnail) {
      const thumbnailBuffer = Buffer.from(req.body.thumbnail, 'base64');
      const thumb = await saveFile(thumbnailBuffer, req.orgId, 'image/jpeg');
      thumbnailFileId = thumb.fileId;
    }

    const host = process.env.FILE_SERVER_PUBLIC_URL || `http://localhost:${process.env.FILE_SERVER_PORT || 4030}`;

    res.status(201).json({
      fileId,
      url:           `${host}/files/${req.orgId}/${fileId}`,
      thumbnailUrl:  thumbnailFileId ? `${host}/files/${req.orgId}/${thumbnailFileId}` : null,
      size,
      originalSize:  originalSize ? parseInt(originalSize, 10) : null,
      mediaType,
      mimeType:      mimeType || req.file.mimetype,
      uploadedAt:    new Date().toISOString(),
      expiresAt:     null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
