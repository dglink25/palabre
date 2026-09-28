const crypto = require('crypto');

/**
 * Le formulaire public de demande d'inscription (section 8) n'a pas de
 * compte utilisateur derrière lui. Pour permettre au demandeur de reprendre
 * sa saisie "à tout moment sans perte de données" sans pour autant laisser
 * n'importe qui lire/modifier n'importe quelle demande, on lui remet un
 * jeton secret à la création (visible UNE seule fois dans la réponse) —
 * seul son hash est stocké en base, comme un mot de passe.
 */
function generateDraftToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashDraftToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyDraftToken(token, hash) {
  if (!token || !hash) return false;
  const a = Buffer.from(hashDraftToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateDraftToken, hashDraftToken, verifyDraftToken };
