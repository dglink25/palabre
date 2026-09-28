import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/profile', label: 'Profil', dot: 'var(--color-primary-blue)' },
  { to: '/security', label: 'Sécurité', dot: 'var(--color-alert-red)' },
  { to: '/sessions', label: 'Sessions & appareils', dot: 'var(--color-success-green)' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Referme le menu mobile à chaque changement de page - sans ça, il reste
  // ouvert par-dessus la nouvelle page (c'est ce qui rendait l'espace
  // connecté illisible sur mobile).
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const items = user?.isSuperAdmin
    ? [...NAV_ITEMS, { to: '/admin/onboarding', label: "Demandes d'inscription", dot: 'var(--color-warning-amber)' }]
    : NAV_ITEMS;

  return (
    <div className="app-shell">
      {/* Barre supérieure mobile (< 860px) - remplace entièrement la barre
          latérale, jamais affichées en même temps (voir theme.css). */}
      <div className="mobile-topbar">
        <a href="/" className="brand-inline">
          <img src="/logo.png" alt="Palabre" />
          <span>PALABRE</span>
        </a>
        <button className="mobile-menu-toggle" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
          <span />
        </button>
      </div>
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <nav>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-dot" style={{ backgroundColor: item.dot }} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-menu-footer">
          <div className="text-secondary" style={{ marginBottom: 8 }}>{user?.fullName || user?.phone || user?.email}</div>
          <button className="btn btn-secondary btn-block" onClick={logout}>Se déconnecter</button>
        </div>
      </div>

      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="Palabre" />
          <span>PALABRE</span>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-dot" style={{ backgroundColor: item.dot }} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px 24px', marginTop: 24 }}>
          <div className="text-secondary" style={{ marginBottom: 8 }}>{user?.fullName || user?.phone || user?.email}</div>
          <button className="btn btn-secondary btn-block" onClick={logout}>Se déconnecter</button>
        </div>
      </aside>
      <main className="main-content fade-in">
        <Outlet />
      </main>
    </div>
  );
}
