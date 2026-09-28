/**
 * Vérification anti-robot (Google reCAPTCHA v2, case à cocher) sur les
 * formulaires publics les plus exposés à l'abus automatisé : demande
 * d'inscription d'organisation, envoi d'OTP téléphone, démarrage de
 * récupération de compte. Chargé côté client depuis le CDN Google (voir
 * components/Recaptcha.jsx) — aucune dépendance npm des deux côtés.
 *
 * Si RECAPTCHA_SECRET_KEY n'est pas défini, la vérification est ignorée
 * (mode développement), à l'image du comportement du mailer en l'absence
 * de configuration SMTP.
 */
async function requireCaptcha(req, res, next) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return next();

  const token = req.body.captchaToken;
  if (!token) {
    return res.status(400).json({ error: { code: 'CAPTCHA_REQUIRED', message: 'Merci de confirmer que vous n\'êtes pas un robot.' } });
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: params });
    const data = await verifyRes.json();
    if (!data.success) {
      return res.status(400).json({ error: { code: 'CAPTCHA_INVALID', message: 'Vérification anti-robot invalide. Réessayez.' } });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireCaptcha };
