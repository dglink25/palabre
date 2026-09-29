import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Icônes SVG inline ─────────────────────────────────────────────────────────
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  dashboard:   'M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z',
  profile:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  security:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  sessions:    'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  requests:    'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z',
  org:         'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  vpn:         'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  apk:         'M12 18h.01M8 21h8a2 2 0 0 0 2-2v-2H6v2a2 2 0 0 0 2 2zM3 9l3-3m12 3l-3-3M3 9h18M3 9v6a2 2 0 0 0 2 2h1M21 9v6a2 2 0 0 0-2 2h-1',
  logout:      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  guide:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
};

// ── Lien de navigation ────────────────────────────────────────────────────────
function NavItem({ to, icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      <Icon d={Icons[icon]} />
      <span>{label}</span>
    </NavLink>
  );
}

// ── Séparateur de section ─────────────────────────────────────────────────────
function NavSection({ label }) {
  return (
    <div style={{
      padding: '16px 24px 6px 24px',
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      color: 'var(--color-text-secondary)',
    }}>
      {label}
    </div>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────
export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isSuperAdmin = !!user?.isSuperAdmin;
  const isOrgAdmin   = !isSuperAdmin && !!user?.orgId;

  // ── Items selon le rôle ───────────────────────────────────────────────────
  const sharedItems = [
    { to: '/profile',  icon: 'profile',  label: 'Profil',             end: true  },
    { to: '/security', icon: 'security', label: 'Securite'                       },
    { to: '/sessions', icon: 'sessions', label: 'Sessions & appareils'           },
  ];

  const superAdminItems = [
    { to: '/admin',              icon: 'dashboard', label: 'Tableau de bord',   end: true },
    { to: '/admin/onboarding',   icon: 'requests',  label: 'Dossiers'                     },
    { to: '/admin/installation', icon: 'guide',     label: 'Guide installation'           },
  ];

  const orgAdminItems = [
    { to: '/org/dashboard', icon: 'org',     label: 'Organisation',    end: true },
    { to: '/org/vpn',       icon: 'vpn',     label: 'Tunnel VPN'                },
    { to: '/org/apk',       icon: 'apk',     label: 'Application mobile'        },
  ];

  const navContent = (
    <>
      {isSuperAdmin && (
        <>
          <NavSection label="Super-admin" />
          {superAdminItems.map((item) => <NavItem key={item.to} {...item} />)}
        </>
      )}

      {isOrgAdmin && (
        <>
          <NavSection label="Organisation" />
          {orgAdminItems.map((item) => <NavItem key={item.to} {...item} />)}
        </>
      )}

      <NavSection label="Mon compte" />
      {sharedItems.map((item) => <NavItem key={item.to} {...item} />)}
    </>
  );

  const userLine = user?.fullName || user?.phone || user?.email || 'Utilisateur';
  const userInitial = userLine.charAt(0).toUpperCase();

  return (
    <div className="app-shell">

      {/* ── Topbar mobile ── */}
      <div className="mobile-topbar">
        <a href="/" className="brand-inline">
          <img src="/logo.png" alt="Palabre" />
          <span>PALABRE</span>
        </a>
        <button
          className="mobile-menu-toggle"
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
        </button>
      </div>

      {/* ── Menu mobile ── */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <nav>{navContent}</nav>
        <div className="mobile-menu-footer">
          <div className="text-secondary" style={{ marginBottom: 8 }}>{userLine}</div>
          <button className="btn btn-secondary btn-block" onClick={logout}>
            Se deconnecter
          </button>
        </div>
      </div>

      {/* ── Sidebar desktop ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="brand">
          <img src="/logo.png" alt="Palabre" />
          <span>PALABRE</span>
        </div>

        {/* Navigation — scrollable si contenu long */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navContent}
        </nav>

        {/* Identité utilisateur + déconnexion — toujours visible en bas */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'var(--color-primary-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                : userInitial
              }
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {userLine}
              </div>
              {isSuperAdmin && (
                <div style={{ fontSize: 11, color: 'var(--color-alert-red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Super-admin
                </div>
              )}
              {isOrgAdmin && (
                <div style={{ fontSize: 11, color: 'var(--color-primary-blue)', fontWeight: 600 }}>
                  Admin organisation
                </div>
              )}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-block"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={logout}
          >
            <Icon d={Icons.logout} size={15} />
            Se deconnecter
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <main className="main-content fade-in">
        <Outlet />
      </main>
    </div>
  );
}
