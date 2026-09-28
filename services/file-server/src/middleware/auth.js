/**
 * Middleware d'authentification JWT pour le file server.
 *
 * Vérifie le même token JWT émis par le backend Node.js principal.
 * Claims utilisés :
 *   sub  → user_id
 *   org  → org_id (isolation multi-tenant)
 *   exp  → expiration
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me_access_secret';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token manquant.' } });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.orgId  = payload.org;
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré.' } });
  }
}

module.exports = { authMiddleware };
