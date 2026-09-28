import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* SVG icons inline — pas d'emojis, pas de dépendance externe */
const IconHome = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/>
  </svg>
);
const IconBuilding = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/>
  </svg>
);
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconLogin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);

export default function PublicHeader() {
  const { user } = useAuth();

  return (
    <header className="pub-header">
      {/* Bande bleue supérieure */}
      <div className="pub-header-top">
        <div className="pub-header-top-inner">
          <span>Plateforme souveraine de communication pour les organisations</span>
          <span>
            <a href="mailto:contact@palabre.app">contact@palabre.app</a>
            <span className="pub-header-sep">·</span>
            Cotonou, Bénin
          </span>
        </div>
      </div>

      {/* Barre principale */}
      <div className="pub-header-main">
        <Link to="/" className="pub-logo">
          <img src="/logo.png" alt="Palabre" />
          <span>PALABRE</span>
        </Link>

        <nav className="pub-nav">
          <NavLink to="/" end className={({ isActive }) => 'pub-nav-link' + (isActive ? ' active' : '')}>
            <IconHome /> Accueil
          </NavLink>
          <NavLink to="/onboarding/new" className={({ isActive }) => 'pub-nav-link' + (isActive ? ' active' : '')}>
            <IconBuilding /> Inscrire mon organisation
          </NavLink>
        </nav>

        <div className="pub-header-actions">
          {user ? (
            <Link to="/profile" className="btn btn-sm">
              <IconUser /> Mon compte
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm btn-secondary">
                <IconLogin /> Connexion
              </Link>
              <Link to="/onboarding/new" className="btn btn-sm">
                <IconBuilding /> Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
