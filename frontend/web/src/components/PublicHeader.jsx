import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/>
  </svg>
);
const IconBuilding = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/>
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconLogin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function PublicHeader() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="pub-header" role="banner">
        {/* Bande bleue supérieure - masquée sur mobile */}
        <div className="pub-header-top">
          <div className="pub-header-top-inner">
            <span>Plateforme souveraine de communication pour les organisations</span>
            <span>
              <a href="mailto:contact@palabre.app">contact@palabre.app</a>
              <span className="pub-header-sep" aria-hidden="true">·</span>
              <span>Cotonou, Bénin</span>
            </span>
          </div>
        </div>

        {/* Barre principale */}
        <div className="pub-header-main">
          {/* Logo */}
          <Link to="/" className="pub-logo" aria-label="Palabre - retour à l'accueil">
            <img src="/logo.png" alt="" width="28" height="28" />
            <span>PALABRE</span>
          </Link>

          {/* Navigation desktop */}
          <nav className="pub-nav" role="navigation" aria-label="Navigation principale">
            <NavLink to="/" end className={({ isActive }) => 'pub-nav-link' + (isActive ? ' active' : '')}
              aria-current={({ isActive }) => isActive ? 'page' : undefined}>
              <IconHome /> Accueil
            </NavLink>
            <NavLink to="/onboarding/new" className={({ isActive }) => 'pub-nav-link' + (isActive ? ' active' : '')}
              aria-current={({ isActive }) => isActive ? 'page' : undefined}>
              <IconBuilding /> Inscrire mon organisation
            </NavLink>
          </nav>

          {/* Actions desktop */}
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

          {/* Burger mobile/tablette */}
          <button
            className="pub-header-burger"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            aria-controls="pub-mobile-menu"
          >
            {menuOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </header>

      {/* ── Menu mobile (drawer depuis la droite) ── */}
      {menuOpen && (
        <div
          id="pub-mobile-menu"
          className="pub-mobile-menu open"
          onClick={closeMenu}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          <div className="pub-mobile-menu-panel" onClick={e => e.stopPropagation()}>
            <button className="pub-mobile-menu-close" onClick={closeMenu} aria-label="Fermer le menu">
              <IconX />
            </button>

            {/* Logo dans le menu */}
            <Link to="/" className="pub-logo" onClick={closeMenu} style={{ marginBottom: 8 }}>
              <img src="/logo.png" alt="" width="28" height="28" />
              <span>PALABRE</span>
            </Link>

            {/* Liens de navigation */}
            <NavLink to="/" end className={({ isActive }) => 'pub-mobile-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
              <IconHome /> Accueil
            </NavLink>
            <NavLink to="/onboarding/new" className={({ isActive }) => 'pub-mobile-nav-link' + (isActive ? ' active' : '')} onClick={closeMenu}>
              <IconBuilding /> Inscrire mon organisation
            </NavLink>

            {/* Actions */}
            <div className="pub-mobile-menu-actions">
              {user ? (
                <Link to="/profile" className="btn" onClick={closeMenu}>
                  <IconUser /> Mon compte
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary" onClick={closeMenu}>
                    <IconLogin /> Connexion
                  </Link>
                  <Link to="/onboarding/new" className="btn" onClick={closeMenu}>
                    <IconBuilding /> Inscription
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
