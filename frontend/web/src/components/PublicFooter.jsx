import { Link } from 'react-router-dom';

const ARROW = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 6 }}>
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

function FooterLink({ to, href, children }) {
  const style = {
    display: 'inline-flex', alignItems: 'center',
    color: 'rgba(255,255,255,0.72)',
    textDecoration: 'none',
    fontSize: 14,
    lineHeight: 1.5,
    transition: 'color 0.15s',
    padding: '3px 0',
  };
  const hoverOn  = e => e.currentTarget.style.color = '#fff';
  const hoverOff = e => e.currentTarget.style.color = 'rgba(255,255,255,0.72)';

  if (href) return (
    <a href={href} target="_blank" rel="noreferrer"
      style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
      {ARROW}{children}
    </a>
  );
  return (
    <Link to={to} style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
      {ARROW}{children}
    </Link>
  );
}

const DARK = '#111827';   // fond principal du footer
const BLUE = '#1A73E8';   // barre du bas — bleu Palabre exact

export default function PublicFooter() {
  return (
    <footer style={{ background: DARK, color: '#fff', marginTop: 'auto' }}>

      {/* ── Grille principale ── */}
      <div style={{
        maxWidth: 1160, margin: '0 auto',
        padding: '56px 32px 40px 32px',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gap: '40px 32px',
      }}>

        {/* Colonne marque */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <img src="/logo.png" alt="Palabre" width="32" height="32"
              style={{ borderRadius: 6 }} />
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: 1, color: '#fff' }}>
              PALABRE
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.75, marginBottom: 20, maxWidth: 300 }}>
            Plateforme de communication chiffree de bout en bout pour les organisations d'Afrique francophone.
          </p>

          {/* Contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Cotonou, Benin
            </span>
            <a href="mailto:contact@palabre.app"
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              contact@palabre.app
            </a>
          </div>
        </div>

        {/* Menu */}
        <div>
          <h4 style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', marginBottom: 18, marginTop: 0 }}>
            Menu
          </h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><FooterLink to="/">Accueil</FooterLink></li>
            <li><FooterLink to="/onboarding/new">Inscrire mon organisation</FooterLink></li>
            <li><FooterLink to="/login">Se connecter</FooterLink></li>
            <li><FooterLink to="/activate">Activer mon compte</FooterLink></li>
            <li><FooterLink to="/recovery">Recuperer mon compte</FooterLink></li>
          </ul>
        </div>

        {/* Formations / Fonctionnalites */}
        <div>
          <h4 style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', marginBottom: 18, marginTop: 0 }}>
            Fonctionnalites
          </h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><FooterLink to="/">Messagerie E2E</FooterLink></li>
            <li><FooterLink to="/">Appels audio et video</FooterLink></li>
            <li><FooterLink to="/">Organisations multi-tenant</FooterLink></li>
            <li><FooterLink to="/">Tunnel VPN WireGuard</FooterLink></li>
            <li><FooterLink to="/">Chiffrement Signal</FooterLink></li>
          </ul>
        </div>

        {/* Reseaux sociaux + Légal */}
        <div>
          <h4 style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', marginBottom: 18, marginTop: 0 }}>
            Liens utiles
          </h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><FooterLink to="/terms">Conditions d'utilisation</FooterLink></li>
            <li><FooterLink to="/privacy">Politique de confidentialite</FooterLink></li>
          </ul>

          <h4 style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', marginBottom: 14, marginTop: 28 }}>
            Nos reseaux
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Facebook',  href: 'https://facebook.com', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
              { label: 'YouTube',   href: 'https://youtube.com',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#111827"/></svg> },
              { label: 'LinkedIn',  href: 'https://linkedin.com', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
            ].map(({ label, href, icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.72)', fontSize: 14, textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.72)'}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{icon}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Séparateur ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {/* ── Barre de copyright — fond bleu Palabre exact ── */}
      <div style={{
        background: BLUE,
        textAlign: 'center',
        padding: '14px 24px',
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: 500,
      }}>
        &copy; {new Date().getFullYear()} Palabre &mdash; Tous droits reserves.
      </div>

      {/* ── Responsive ── */}
      <style>{`
        @media (max-width: 860px) {
          .palabre-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 540px) {
          .palabre-footer-grid { grid-template-columns: 1fr !important; padding: 32px 20px 28px !important; }
        }
      `}</style>
    </footer>
  );
}
