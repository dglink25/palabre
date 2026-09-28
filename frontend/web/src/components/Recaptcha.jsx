import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

let scriptPromise = null;
function loadRecaptchaScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (window.grecaptcha && window.grecaptcha.render) return resolve(window.grecaptcha);
    window.__onPalabreRecaptchaLoad = () => resolve(window.grecaptcha);
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=__onPalabreRecaptchaLoad';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Vérification anti-robot sur les formulaires publics exposés à l'abus
 * (envoi d'OTP, démarrage de récupération, soumission d'une demande
 * d'inscription). Si VITE_RECAPTCHA_SITE_KEY n'est pas configuré, le
 * composant ne rend rien et `onVerify` n'est jamais appelé — le backend
 * ignore alors aussi la vérification (mode développement, voir
 * middleware/captcha.js).
 */
export default function Recaptcha({ onVerify }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;
    let cancelled = false;
    loadRecaptchaScript().then((grecaptcha) => {
      if (cancelled || !containerRef.current || containerRef.current.childElementCount > 0) return;
      grecaptcha.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        'expired-callback': () => onVerify(''),
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div className="recaptcha-container" ref={containerRef} />;
}

export function isRecaptchaConfigured() {
  return !!SITE_KEY;
}
