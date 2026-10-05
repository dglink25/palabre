/**
 * PortalLayout.jsx — Developer Portal
 *
 * Shell applicatif du portail développeur.
 * Identique visuellement à l'app Palabre principale :
 *   - Même sidebar blanche avec bordure droite grise
 *   - Même logo (logo.png)
 *   - Même typographie Inter
 *   - Même système de couleurs (#1A73E8, #202124, #5F6368, #E0E0E0)
 *   - Icônes SVG professionnelles — zéro emoji, zéro sticker
 *   - Topbar mobile fixe identique à celle de Palabre
 */

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── Icônes SVG (pro, stroke-only, design Lucide) ────────────────────────────

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10.5 12l7.5-7.5 2 2-1 1 1 1-1.5 1.5-1-1L16 10.5" />
    </svg>
  );
}

function IconWebhook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ─── Items de navigation ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Projets',       icon: <IconGrid />      },
  { to: '/keys',      label: 'Clés API',      icon: <IconKey />       },
  { to: '/webhooks',  label: 'Webhooks',      icon: <IconWebhook />   },
  { to: '/docs',      label: 'Documentation', icon: <IconBook />      },
];

// ─── Styles sidebar ───────────────────────────────────────────────────────────

const S = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E0E0E0',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflow: 'hidden',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 24px',
    borderBottom: '1px solid #E0E0E0',
    flexShrink: 0,
    textDecoration: 'none',
  },
  brandImg: { width: 32, height: 32 },
  brandText: {
    fontWeight: 700,
    fontSize: 21,
    letterSpacing: '0.5px',
    color: '#202124',
  },
  brandBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: '#1A73E8',
    backgroundColor: 'rgba(26,115,232,.10)',
    padding: '1px 6px',
    borderRadius: 3,
    marginLeft: 4,
    alignSelf: 'center',
  },
  navArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    color: '#9aa0a6',
    padding: '12px 24px 4px',
  },
  footer: {
    borderTop: '1px solid #E0E0E0',
    padding: '12px 16px',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 150ms ease',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: '#1A73E8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  userName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: '#202124',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    fontSize: 11,
    color: '#5F6368',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    color: '#5F6368',
    cursor: 'pointer',
    transition: 'background 150ms ease, color 150ms ease',
    marginTop: 4,
  },
  main: {
    flex: 1,
    padding: 32,
    maxWidth: 960,
    overflowY: 'auto',
  },
  /* Mobile topbar */
  mobileTopbar: {
    display: 'none',
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 70,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    padding: '0 16px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E0E0E0',
  },
  mobileBrand: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  mobileMenuBtn: {
    width: 40, height: 40,
    border: '1px solid #E0E0E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  mobileMenu: {
    position: 'fixed',
    top: 56, left: 0, right: 0, bottom: 0,
    zIndex: 69,
    backgroundColor: '#FFFFFF',
    overflowY: 'auto',
  },
};

// ─── Composant NavItem ────────────────────────────────────────────────────────

function NavItem({ to, label, icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 24px',
        color: isActive ? '#1A73E8' : '#5F6368',
        textDecoration: 'none',
        borderLeft: `3px solid ${isActive ? '#1A73E8' : 'transparent'}`,
        fontFamily: 'var(--font-stack)',
        fontSize: 14,
        fontWeight: isActive ? 700 : 400,
        backgroundColor: isActive ? 'rgba(26,115,232,.06)' : 'transparent',
        transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
      })}
    >
      <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      {label}
    </NavLink>
  );
}

// ─── PortalLayout ─────────────────────────────────────────────────────────────

export default function PortalLayout({ children }) {
  const { account, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const name  = account?.user?.full_name  || account?.user?.name  || 'Développeur';
  const email = account?.user?.email      || '';
  const photo = account?.user?.photo_url  || account?.user?.avatar || null;

  function handleLogout() {
    logout?.();
    navigate('/login');
  }

  // ── Sidebar desktop ──────────────────────────────────────────────────────────
  const sidebar = (
    <aside style={S.sidebar} aria-label="Navigation principale">
      {/* Logo + nom */}
      <a href="/dashboard" style={S.brand}>
        <img src="/logo.png" alt="Palabre" style={S.brandImg} />
        <span style={S.brandText}>Palabre</span>
        <span style={S.brandBadge}>Dev</span>
      </a>

      {/* Navigation */}
      <nav style={S.navArea} aria-label="Menu développeur">
        <p style={S.navLabel}>Menu</p>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Footer utilisateur */}
      <div style={S.footer}>
        {/* Infos utilisateur */}
        <div style={S.userRow}>
          <div style={S.avatar}>
            {photo
              ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ display: 'flex' }}><IconUser /></span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.userName}>{name}</p>
            {email && <p style={S.userEmail}>{email}</p>}
          </div>
        </div>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={handleLogout}
          style={S.logoutBtn}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8F9FA'; e.currentTarget.style.color = '#202124'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#5F6368'; }}
        >
          <span style={{ width: 15, height: 15, display: 'flex' }}><IconLogOut /></span>
          Déconnexion
        </button>
      </div>
    </aside>
  );

  // ── Mobile topbar + menu ────────────────────────────────────────────────────
  const mobileTopbar = (
    <>
      <header
        style={{ ...S.mobileTopbar, display: 'flex' }}
        className="mobile-topbar-visible"
      >
        <a href="/dashboard" style={S.mobileBrand}>
          <img src="/logo.png" alt="Palabre" style={{ width: 26, height: 26 }} />
          <span style={{ fontWeight: 700, fontSize: 18, color: '#202124' }}>Palabre</span>
          <span style={{ ...S.brandBadge, marginLeft: 2 }}>Dev</span>
        </a>
        <button
          type="button"
          style={S.mobileMenuBtn}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileOpen}
        >
          <span style={{ width: 20, height: 20, display: 'flex', color: '#202124' }}>
            {mobileOpen ? <IconX /> : <IconMenu />}
          </span>
        </button>
      </header>

      {mobileOpen && (
        <div style={S.mobileMenu} role="dialog" aria-modal="true" aria-label="Menu mobile">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              onClick={() => setMobileOpen(false)}
            />
          ))}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E0E0E0', marginTop: 8 }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{ ...S.logoutBtn, padding: '10px 0', fontSize: 15 }}
            >
              <span style={{ width: 16, height: 16, display: 'flex' }}><IconLogOut /></span>
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* CSS inline pour gérer le breakpoint mobile sans JS */}
      <style>{`
        @media (max-width: 860px) {
          .portal-sidebar        { display: none !important; }
          .mobile-topbar-visible { display: flex !important; }
          .portal-shell          { padding-top: 56px; }
          .portal-main           { padding: 20px !important; }
        }
        @media (min-width: 861px) {
          .mobile-topbar-visible { display: none !important; }
        }
        .nav-link-item:hover { background-color: #F8F9FA !important; }
      `}</style>

      <div style={S.shell} className="portal-shell">
        {/* Sidebar desktop */}
        <div className="portal-sidebar">{sidebar}</div>

        {/* Topbar mobile */}
        {mobileTopbar}

        {/* Contenu */}
        <main style={S.main} className="portal-main">
          {children}
        </main>
      </div>
    </>
  );
}
