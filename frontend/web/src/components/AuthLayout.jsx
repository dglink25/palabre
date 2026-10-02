import { useNavigate } from 'react-router-dom';
import AuthIllustration from './AuthIllustration';

/**
 * Mise en page des pages de type "formulaire" (connexion, récupération,
 * onboarding, activation) : un bandeau minimal (logo + retour), un fond de
 * couleur pleine (bleu primaire, aucun dégradé), une carte blanche à
 * gauche et une illustration à droite - inspiré de la composition demandée
 * (schéma à côté du formulaire), avec les couleurs strictes de la charte
 * Palabre. Pas de pied de page ici : ces écrans doivent tenir sans défiler
 * la page ; si le contenu d'un formulaire est dense, seule la carte défile
 * en interne (jamais la page entière).
 */
export default function AuthLayout({ children, cardWidth = 420 }) {
  const navigate = useNavigate();

  return (
    <div className="auth-layout">
      {/* Topbar */}
      <div className="auth-layout-topbar">
        <a href="/" className="brand-inline light" aria-label="Palabre — retour à l'accueil">
          <img src="/logo.png" alt="" aria-hidden="true" width="30" height="30" />
          <span>PALABRE</span>
        </a>
        <button className="btn btn-outline-light" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </div>

      {/* Corps : carte + illustration */}
      <div className="auth-layout-body">
        <div className="auth-layout-card" style={{ maxWidth: cardWidth }}>
          {children}
        </div>
        {/* Illustration masquée sur mobile (< 640px) via CSS */}
        <div className="auth-layout-illustration" aria-hidden="true">
          <AuthIllustration />
        </div>
      </div>
    </div>
  );
}
