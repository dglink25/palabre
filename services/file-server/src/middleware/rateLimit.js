const rateLimit = require('express-rate-limit');

/**
 * Rate limiting spécifique à l'upload.
 * Plus restrictif que le global : 20 uploads/min par utilisateur.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'UPLOAD_RATE_LIMIT', message: 'Trop d\'uploads. Réessayez dans une minute.' } },
});

/**
 * Rate limiting téléchargement : 200 GET/min par utilisateur.
 */
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'DOWNLOAD_RATE_LIMIT', message: 'Trop de téléchargements.' } },
});

module.exports = { uploadLimiter, downloadLimiter };
