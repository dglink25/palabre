/**
 * Routes de téléchargement et gestion des fichiers.
 *
 * GET    /files/:orgId/:fileId   — télécharge le blob chiffré
 * DELETE /files/:orgId/:fileId   — supprime un fichier (expéditeur ou admin org)
 * GET    /files/:orgId/usage     — espace disque utilisé par l'organisation
 *
 * Sécurité multi-tenant :
 *   - Un utilisateur ne peut accéder qu'aux fichiers de SON organisation (req.orgId)
 *   - La vérification orgId param === req.orgId empêche l'accès cross-tenant
 */

const express = require('express');
const { readFile, deleteFile, getOrgStorageUsage } = require('../storage/diskStorage');
const { downloadLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// ── Téléchargement ──────────────────────────────────────────────────────────

router.get('/:orgId/:fileId', downloadLimiter, async (req, res, next) => {
  try {
    const { orgId, fileId } = req.params;

    // Isolation multi-tenant stricte
    if (orgId !== req.orgId) {
      const err = new Error('Accès refusé.');
      err.httpStatus = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // Validation basique du fileId (UUID format)
    if (!/^[0-9a-f-]{36}$/.test(fileId)) {
      const err = new Error('Identifiant de fichier invalide.');
      err.httpStatus = 400;
      err.code = 'INVALID_FILE_ID';
      throw err;
    }

    const buffer = await readFile(orgId, fileId);

    // On sert le blob chiffré tel quel.
    // Content-Type: application/octet-stream car le contenu est opaque.
    // Le client déchiffre après réception.
    res.set({
      'Content-Type':        'application/octet-stream',
      'Content-Length':      buffer.length,
      'Content-Disposition': `attachment; filename="${fileId}.enc"`,
      // Cache 1 heure côté client — le blob ne change jamais (immuable par fileId)
      'Cache-Control':       'private, max-age=3600, immutable',
      // Sécurité : empêcher l'interprétation du contenu
      'X-Content-Type-Options': 'nosniff',
    });

    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── Suppression ─────────────────────────────────────────────────────────────

router.delete('/:orgId/:fileId', async (req, res, next) => {
  try {
    const { orgId, fileId } = req.params;

    if (orgId !== req.orgId) {
      const err = new Error('Accès refusé.');
      err.httpStatus = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const deleted = await deleteFile(orgId, fileId);
    res.json({ ok: deleted, fileId });
  } catch (err) {
    next(err);
  }
});

// ── Usage stockage ───────────────────────────────────────────────────────────

router.get('/:orgId/usage', async (req, res, next) => {
  try {
    const { orgId } = req.params;

    if (orgId !== req.orgId) {
      const err = new Error('Accès refusé.');
      err.httpStatus = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const bytes = getOrgStorageUsage(orgId);
    res.json({
      orgId,
      usedBytes: bytes,
      usedMB:    Math.round(bytes / 1024 / 1024 * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
