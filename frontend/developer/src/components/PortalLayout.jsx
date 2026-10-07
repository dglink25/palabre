/**
 * PortalLayout.jsx - Developer Portal
 *
 * Shell applicatif institutionnel.
 * Comportement selon l'état d'authentification :
 *   - Connecté    : tous les items de nav cliquables + footer utilisateur + déconnexion
 *   - Non connecté: items protégés grisés/non cliquables + bouton "Se connecter" en bas
 *   - Documentation : accessible sans connexion
 */

import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── Icônes SVG Lucide ────────────────────────────────────────────────────────

const Svg = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

function IconGrid()    { return <Svg><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Svg>; }
function IconKey()     { return <Svg><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></Svg>; }
function IconWebhook() { return <Svg><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></Svg>; }
function IconBook()    { return <Svg><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></Svg>; }
function IconLogOut()  { return <Svg><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>; }
function IconMenu()    { return <Svg><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></Svg>; }
function IconX()       { return <Svg><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>; }
function IconUser()    { return <Svg><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>; }
function IconLogin()   { return <Svg><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></Svg>; }

// ─── Items de navigation ──────────────────────────────────────────────────────

// Requièrent une authentification
const NAV_AUTH = [
  { to: '/dashboard', label: 'Projets',  icon: <IconGrid />    },
  { to: '/keys',      label: 'Clés API', icon: <IconKey />     },
  { to: '/webhooks',  label: 'Webhooks', icon: <IconWebhook /> },
];

// Accessible sans connexion
const NAV_PUBLIC = [
  { to: '/docs', label: 'Documentation', icon: <IconBook /> },
];

// ─── Composants nav ───────────────────────────────────────────────────────────

function NavItem({ to, label, icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px',
        color: isActive ? '#1A73E8' : '#5F6368',
        textDecoration: 'none',
        borderLeft: `3px solid ${isActive ? '#1A73E8' : 'transparent'}`,
        fontFamily: "'Inter', sans-serif",
        fontSize: 14, fontWeight: isActive ? 600 : 400,
        backgroundColor: isActive ? '#EAF2FD' : 'transparent',
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

/** Item grisé - non cliquable quand non authentifié */
function NavItemDisabled({ label, icon }) {
  return (
    <div
      aria-disabled="true"
      title="Connectez-vous pour accéder à cette section"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px',
        color: '#C5C7CA',
        borderLeft: '3px solid transparent',
        fontSize: 14, fontWeight: 400,
        cursor: 'not-allowed',
        userSelect: 'none',
        opacity: 0.5,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

// ─── PortalLayout ─────────────────────────────────────────────────────────────

export default function PortalLayout({ children }) {
  const { account, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLoggedIn = !!account;
  const name  = account?.user?.full_name || account?.user?.name || '';
  const email = account?.user?.email    || '';
  const photo = account?.user?.photo_url || account?.user?.avatar || null;

  function handleLogout() {
    logout?.();
    navigate('/login');
  }

  // ── Section footer sidebar ────────────────────────────────────────────────

  function SidebarFooter() {
    if (isLoggedIn) {
      return (
        <div style={{ borderTop: '1px solid #E0E0E0', padding: '12px 14px' }}>
          {/* Infos utilisateur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              backgroundColor: '#1A73E8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
            }}>
              {photo
                ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ display: 'flex', color: '#fff', width: 16, height: 16 }}><IconUser /></span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#202124', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name || 'Développeur'}
              </p>
              {email && (
                <p style={{ fontSize: 11, color: '#5F6368', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </p>
              )}
            </div>
          </div>
          {/* Déconnexion */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', padding: '7px 8px',
              background: 'none', border: 'none', borderRadius: 6,
              fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500,
              color: '#5F6368', cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F8F9FA'; e.currentTarget.style.color = '#202124'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#5F6368'; }}
          >
            <span style={{ width: 15, height: 15, display: 'flex' }}><IconLogOut /></span>
            Déconnexion
          </button>
        </div>
      );
    }

    // Non connecté
    return (
      <div style={{ borderTop: '1px solid #E0E0E0', padding: '14px' }}>
        <p style={{ fontSize: 11, color: '#9aa0a6', margin: '0 0 8px', textAlign: 'center' }}>
          Connectez-vous pour accéder à tous les outils
        </p>
        <Link
          to="/login"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            width: '100%', padding: '9px 12px',
            background: '#1A73E8', color: '#FFFFFF',
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1557b0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1A73E8'; }}
        >
          <span style={{ width: 15, height: 15, display: 'flex' }}><IconLogin /></span>
          Se connecter
        </Link>
        <Link
          to="/signup"
          style={{
            display: 'block', textAlign: 'center',
            marginTop: 8, fontSize: 12,
            color: '#1A73E8', fontWeight: 500, textDecoration: 'none',
          }}
        >
          Créer un compte
        </Link>
      </div>
    );
  }

  // ── Contenu sidebar ──────────────────────────────────────────────────────

  const sidebarContent = (
    <>
      {/* Logo */}
      <Link
        to={isLoggedIn ? '/dashboard' : '/'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '18px 20px', borderBottom: '1px solid #E0E0E0',
          textDecoration: 'none', flexShrink: 0,
        }}
      >
        <img src="/logo.png" alt="Palabre" style={{ width: 30, height: 30 }} />
        <span style={{ fontWeight: 700, fontSize: 18, color: '#202124', letterSpacing: '0.2px' }}>
          Palabre
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
          color: '#1A73E8', backgroundColor: '#EAF2FD',
          padding: '1px 6px', borderRadius: 3, marginLeft: 2,
        }}>
          Dev
        </span>
      </Link>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} aria-label="Menu développeur">
        <p style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.8px', color: '#9aa0a6', padding: '14px 20px 4px',
        }}>
          Menu
        </p>

        {/* Items protégés */}
        {NAV_AUTH.map(item =>
          isLoggedIn
            ? <NavItem key={item.to} {...item} />
            : <NavItemDisabled key={item.to} label={item.label} icon={item.icon} />
        )}

        {/* Documentation - toujours accessible */}
        {NAV_PUBLIC.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <SidebarFooter />
    </>
  );

  return (
    <>
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
      `}</style>

      <div className="portal-shell" style={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>

        {/* Sidebar desktop */}
        <aside
          className="portal-sidebar"
          style={{
            width: 240, backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E0E0E0',
            flexShrink: 0, display: 'flex', flexDirection: 'column',
            position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
          }}
          aria-label="Navigation principale"
        >
          {sidebarContent}
        </aside>

        {/* Topbar mobile */}
        <header
          className="mobile-topbar-visible"
          style={{
            display: 'none', position: 'fixed',
            top: 0, left: 0, right: 0, zIndex: 70,
            alignItems: 'center', justifyContent: 'space-between',
            height: 56, padding: '0 16px',
            backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0E0E0',
          }}
        >
          <Link to={isLoggedIn ? '/dashboard' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/logo.png" alt="Palabre" style={{ width: 26, height: 26 }} />
            <span style={{ fontWeight: 700, fontSize: 17, color: '#202124' }}>Palabre</span>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
              color: '#1A73E8', backgroundColor: '#EAF2FD',
              padding: '1px 6px', borderRadius: 3, marginLeft: 2,
            }}>Dev</span>
          </Link>
          <button
            type="button"
            style={{
              width: 36, height: 36,
              border: '1px solid #E0E0E0', backgroundColor: '#FFFFFF',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
          >
            <span style={{ width: 18, height: 18, display: 'flex', color: '#202124' }}>
              {mobileOpen ? <IconX /> : <IconMenu />}
            </span>
          </button>
        </header>

        {/* Menu mobile overlay */}
        {mobileOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu mobile"
            style={{
              position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 69,
              backgroundColor: '#FFFFFF', overflowY: 'auto', borderTop: '1px solid #E0E0E0',
            }}
          >
            {/* Items protégés */}
            {NAV_AUTH.map(item =>
              isLoggedIn
                ? <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
                : <NavItemDisabled key={item.to} label={item.label} icon={item.icon} />
            )}

            {/* Documentation */}
            {NAV_PUBLIC.map(item => (
              <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
            ))}

            {/* Footer mobile */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #E0E0E0', marginTop: 8 }}>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500,
                    color: '#5F6368', cursor: 'pointer', padding: 0,
                  }}
                >
                  <span style={{ width: 16, height: 16, display: 'flex' }}><IconLogOut /></span>
                  Déconnexion
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 16px', background: '#1A73E8', color: '#FFFFFF',
                      borderRadius: 8, fontFamily: "'Inter', sans-serif",
                      fontSize: 14, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '9px 16px', background: '#FFFFFF', color: '#1A73E8',
                      border: '1px solid #1A73E8', borderRadius: 8,
                      fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    Créer un compte
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <main className="portal-main" style={{ flex: 1, padding: 32, maxWidth: 960 }}>
          {children}
        </main>
      </div>
    </>
  );
}
