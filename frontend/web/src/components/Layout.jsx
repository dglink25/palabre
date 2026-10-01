import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NetworkModeIndicator from './NetworkModeIndicator';
import { networkDetector } from '../lib/networkDetector';

// ── Icônes SVG professionnelles ───────────────────────────────────────────────
const Ico = ({ path, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    {Array.isArray(path)
      ? path.map((d, i) => <path key={i} d={d} />)
      : <path d={path} />}
  </svg>
);

const ICONS = {
  dashboard: ['M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z', 'M9 21V12h6v9'],
  requests:  ['M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z'],
  guide:     ['M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'],
  org:       ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  vpn:       ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  apk:       ['M12 18.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1z', 'M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z'],
  profile:   ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  security:  ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  sessions:  ['M9 3H5a2 2 0 0 0-2 2v4', 'M15 3h4a2 2 0 0 1 2 2v4', 'M3 9h18', 'M9 21H5a2 2 0 0 1-2-2v-4', 'M15 21h4a2 2 0 0 0 2-2v-4'],
  logout:    ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  menu:      ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close:     ['M18 6L6 18', 'M6 6l12 12'],
  chevron:   ['M9 18l6-6-6-6'],
  invite:    ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  join:      ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'M10 17l5-5-5-5', 'M15 12H3'],
  link:      ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  // Communication (membres)
  home:      ['M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z', 'M9 21V12h6v9'],
  messages:  ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  calls:     ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  contacts:  ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  newconv:   ['M12 5v14', 'M5 12h14'],
  video:     ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
};

// ── Lien de navigation sidebar ────────────────────────────────────────────────
function SideNavItem({ to, iconKey, label, end = false }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `snav-link${isActive ? ' snav-active' : ''}`}
    >
      <Ico path={ICONS[iconKey]} size={17} />
      <span className="snav-label">{label}</span>
    </NavLink>
  );
}

function SideSection({ label }) {
  return <div className="snav-section">{label}</div>;
}

// ── Layout principal ──────────────────────────────────────────────────────────
export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Configurer le NetworkDetector dès que le profil utilisateur est chargé.
  // Si l'utilisateur appartient à une organisation, on récupère le FQDN du tenant
  // depuis le serveur central, puis on tente une connexion directe (LAN).
  // Le FQDN (ex: acme.palabre.com) est résolu en IP locale via le DNS local
  // du Tenant_Server quand l'appareil est sur le réseau interne.
  useEffect(() => {
    if (user?.orgId) {
      const relayBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';
      const token = localStorage.getItem('palabre_access_token') || '';

      // Récupérer le FQDN du tenant depuis le serveur central
      fetch(`${relayBase}/tenants/resolve/${user.orgId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.tenantUrl) {
            // tenantUrl = https://{org}.palabre.com
            // En réseau local : ce FQDN pointe vers l'IP LAN via DNS local
            // Hors réseau : la probe échoue → relais automatique
            networkDetector.configure({
              tenantUrl: data.tenantUrl,   // FQDN local
              relayUrl:  relayBase,         // Serveur central (relais)
            });
          }
        })
        .catch(() => { /* pas de tenant configuré → mode relais */ });
    }
  }, [user?.orgId]);

  const isSuperAdmin = !!user?.isSuperAdmin;
  // org_admin : a un orgId, pas super-admin, et role = 'org_admin' (ou role null = legacy)
  const isOrgAdmin   = !isSuperAdmin && !!user?.orgId && (user?.role === 'org_admin' || user?.role === null);
  const isMember     = !isSuperAdmin && !!user?.orgId && user?.role !== 'org_admin' && user?.role !== null;

  const superItems = [
    { to: '/admin',              key: 'dashboard', label: 'Tableau de bord', end: true },
    { to: '/admin/onboarding',   key: 'requests',  label: 'Dossiers' },
  ];
  const orgItems = [
    { to: '/org/dashboard', key: 'org',      label: 'Organisation', end: true },
    { to: '/org/vpn',       key: 'vpn',      label: 'Tunnel VPN' },
    { to: '/org/invite',    key: 'invite',   label: 'Invitations membres' },
    { to: '/org/guide',     key: 'guide',    label: 'Guide installation' },
  ];
  const memberItems = [
    { to: '/app',                   key: 'home',     label: 'Accueil', end: true },
    { to: '/app/conversations',     key: 'messages', label: 'Discussions' },
    { to: '/app/conversations/new', key: 'newconv',  label: 'Nouvelle conversation' },
    { to: '/app/calls',             key: 'calls',    label: 'Appels' },
    { to: '/app/videoconference',   key: 'video',    label: 'Vidéoconférence' },
    { to: '/app/contacts',          key: 'contacts', label: 'Contacts' },
  ];
  const accountItems = [
    { to: '/profile',  key: 'profile',  label: 'Mon profil', end: true },
    { to: '/security', key: 'security', label: 'Securite' },
    { to: '/sessions', key: 'sessions', label: 'Sessions' },
  ];

  const navTree = (
    <>
      {isSuperAdmin && (
        <>
          <SideSection label="Administration" />
          {superItems.map(i => <SideNavItem key={i.to} to={i.to} iconKey={i.key} label={i.label} end={i.end} />)}
        </>
      )}
      {isOrgAdmin && (
        <>
          <SideSection label="Organisation" />
          {orgItems.map(i => <SideNavItem key={i.to} to={i.to} iconKey={i.key} label={i.label} end={i.end} />)}
          <SideSection label="Communication" />
          {memberItems.map(i => <SideNavItem key={i.to} to={i.to} iconKey={i.key} label={i.label} end={i.end} />)}
        </>
      )}
      {isMember && (
        <>
          <SideSection label="Communication" />
          {memberItems.map(i => <SideNavItem key={i.to} to={i.to} iconKey={i.key} label={i.label} end={i.end} />)}
        </>
      )}
      <SideSection label="Mon compte" />
      {accountItems.map(i => <SideNavItem key={i.to} to={i.to} iconKey={i.key} label={i.label} end={i.end} />)}
    </>
  );

  const userName = user?.fullName || user?.phone || user?.email || 'Utilisateur';
  const userInitial = userName.charAt(0).toUpperCase();
  const roleLabel = isSuperAdmin ? 'Super-administrateur' : isOrgAdmin ? 'Admin organisation' : isMember ? 'Membre' : 'Utilisateur';

  return (
    <div className="shell">

      {/* ── Sidebar ── */}
      <aside className={`shell-sidebar${open ? ' shell-sidebar-open' : ''}`}>

        {/* Logo — cliquable vers accueil */}
        <Link to="/" className="shell-logo" onClick={() => setOpen(false)}>
          <img src="/logo.png" alt="Palabre" width="32" height="32" />
          <span>PALABRE</span>
        </Link>

        {/* Navigation */}
        <nav className="shell-nav">{navTree}</nav>

        {/* Indicateur mode réseau (Direct / Relay) */}
        <NetworkModeIndicator />

        {/* Identité + déconnexion */}
        <div className="shell-user">
          <div className="shell-user-avatar">
            {user?.photoUrl
              ? <img src={user.photoUrl} alt="" />
              : <span>{userInitial}</span>}
          </div>
          <div className="shell-user-info">
            <div className="shell-user-name">{userName}</div>
            <div className="shell-user-role">{roleLabel}</div>
          </div>
          <button className="shell-logout-btn" onClick={logout} title="Se deconnecter">
            <Ico path={ICONS.logout} size={16} />
          </button>
        </div>
      </aside>

      {/* ── Overlay mobile ── */}
      {open && <div className="shell-overlay" onClick={() => setOpen(false)} />}

      {/* ── Zone principale ── */}
      <div className="shell-body">

        {/* Topbar mobile */}
        <header className="shell-topbar">
          <button className="shell-hamburger" onClick={() => setOpen(v => !v)}>
            <Ico path={open ? ICONS.close : ICONS.menu} size={22} />
          </button>
          <Link to="/" className="shell-topbar-logo">
            <img src="/logo.png" alt="Palabre" width="24" height="24" />
            <span>PALABRE</span>
          </Link>
          <div className="shell-topbar-user">
            <div className="shell-user-avatar shell-user-avatar-sm">
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="" />
                : <span>{userInitial}</span>}
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="shell-main fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
