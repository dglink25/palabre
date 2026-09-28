const { parsePhoneNumberFromString } = require('libphonenumber-js');

/**
 * Valide et normalise un numéro au format E.164 (+229...). Renvoie le
 * numéro normalisé ou null s'il est invalide — à utiliser systématiquement
 * avant d'écrire un numéro en base ou d'envoyer un OTP (section 36 :
 * "validation des données").
 */
function normalizePhone(raw, defaultCountry) {
  if (!raw || typeof raw !== 'string') return null;
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // format E.164
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(raw) {
  return typeof raw === 'string' && EMAIL_RE.test(raw.trim());
}

/**
 * Middleware générique : vérifie qu'un champ req.body.<field> est un
 * numéro de téléphone valide, et le remplace par sa forme normalisée E.164.
 */
function requireValidPhone(field = 'phone') {
  return (req, res, next) => {
    const normalized = normalizePhone(req.body[field], req.body.country);
    if (!normalized) {
      return res.status(400).json({
        error: { code: 'INVALID_PHONE', message: `Le numéro de téléphone (${field}) est invalide.` },
      });
    }
    req.body[field] = normalized;
    next();
  };
}

module.exports = { normalizePhone, isValidEmail, requireValidPhone };
