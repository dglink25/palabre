import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'palabre_cookie_notice_dismissed';

/**
 * Palabre n'utilise que du stockage local strictement nécessaire au
 * fonctionnement (jetons de session, identifiant d'appareil) - pas de
 * cookies de suivi ni de publicité. Un bandeau "accepter/refuser" pour un
 * consentement qui n'a rien à consentir serait trompeur ; ce bandeau est
 * donc informatif, pas un péage de consentement.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <p>
        Palabre utilise uniquement du stockage local strictement nécessaire au fonctionnement du service
        (maintien de votre session, identifiant d'appareil) - aucun cookie de suivi ni publicitaire.{' '}
        <Link to="/privacy">En savoir plus</Link>.
      </p>
      <div className="actions">
        <button className="btn" onClick={dismiss}>Compris</button>
      </div>
    </div>
  );
}
