const jwt = require('jsonwebtoken');
const emailService = require('../auth/email.service');

/**
 * ======================================================================
 * DOUBLE VÉRIFICATION DES MODIFICATIONS DU SUPER-ADMINISTRATEUR
 * ======================================================================
 * Toute action de modification (POST/PATCH/PUT/DELETE sur une ressource,
 * hors connexion/déconnexion et hors heartbeat de présence) exige un jeton
 * de confirmation frais, obtenu en validant un code envoyé par e-mail.
 *
 * Flux :
 *   1. POST /security/step-up/start   → envoie un code à l'e-mail du compte
 *   2. POST /security/step-up/verify  → renvoie un confirmationToken (JWT)
 *   3. La requête de modification porte l'en-tête X-Confirmation-Token
 *
 * Le jeton reste valable une courte fenêtre (par défaut 5 min) plutôt qu'à
 * usage unique strict : exiger un nouveau code e-mail avant CHAQUE clic
 * serait inutilisable en pratique. Il reste lié à l'utilisateur ET à la
 * session ayant fait la demande (un jeton volé sur une autre session ne
 * fonctionne pas).
 */

const CONFIRMATION_TOKEN_SECRET = process.env.CONFIRMATION_TOKEN_SECRET || `${process.env.JWT_ACCESS_SECRET}_confirmation`;
const CONFIRMATION_TOKEN_TTL = process.env.CONFIRMATION_TOKEN_TTL || '5m';

async function startConfirmation(user) {
  return emailService.sendVerification(user.email, 'confirm_action');
}

async function verifyConfirmation(user, sessionId, code) {
  await emailService.verifyCode(user.email, 'confirm_action', code);
  const confirmationToken = jwt.sign(
    { sub: user.id, sid: sessionId, purpose: 'write_confirmation' },
    CONFIRMATION_TOKEN_SECRET,
    { expiresIn: CONFIRMATION_TOKEN_TTL }
  );
  return { confirmationToken, ttl: CONFIRMATION_TOKEN_TTL };
}

/**
 * Middleware à poser sur les routes de modification. N'a d'effet que pour
 * le super-administrateur — les autres utilisateurs ne sont pas concernés
 * par cette exigence.
 */
function requireWriteConfirmation(req, res, next) {
  if (!req.user || !req.user.is_super_admin) return next();

  const token = req.headers['x-confirmation-token'];
  if (!token) {
    return res.status(428).json({
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message: 'Cette modification exige une double vérification. Démarrez POST /security/step-up/start puis /verify, et renvoyez le jeton obtenu dans l\'en-tête X-Confirmation-Token.',
      },
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, CONFIRMATION_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ error: { code: 'CONFIRMATION_INVALID', message: 'Jeton de confirmation invalide ou expiré.' } });
  }

  if (payload.sub !== req.user.id || payload.sid !== req.sessionId) {
    return res.status(401).json({ error: { code: 'CONFIRMATION_INVALID', message: 'Jeton de confirmation invalide pour cette session.' } });
  }

  next();
}

module.exports = { startConfirmation, verifyConfirmation, requireWriteConfirmation };
