import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * En-tête public, toujours visible (sticky) sur toutes les pages non
 * connectées — accueil, connexion, récupération, onboarding. Pas de liens
 * "Conditions d'utilisation" / "Confidentialité" ici : par convention,
 * ces liens vivent uniquement dans le pied de page (voir PublicFooter).
 */
export default function PublicHeader() {
  const { user } = useAuth();

  return (
    <header className="public-header">
      <Link to="/" className="brand-inline">
        <img src="/logo.png" alt="Palabre" />
        <span>PALABRE</span>
      </Link>
      <nav className="public-header-actions">
        {user ? (
          <Link to="/profile" className="btn">Mon compte</Link>
        ) : (
          <>
            <Link to="/onboarding/new" className="btn btn-secondary">Inscrire mon organisation</Link>
            <Link to="/login" className="btn">Se connecter</Link>
          </>
        )}
      </nav>
    </header>
  );
}
