import { Link } from 'react-router-dom';

// URL configurable vers l'app Palabre principale
const PALABRE_URL = import.meta.env.VITE_PALABRE_BASE_URL || 'http://localhost:3000';

// ─── Icône flèche (identique au PublicFooter) ─────────────────────────────────

const ArrowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

// ─── Composant lien du footer ─────────────────────────────────────────────────

function FooterLink({ to, href, children }) {
  if (href) {
    return (
      <a href={href} className="pub-footer-link" target="_blank" rel="noopener noreferrer">
        <ArrowIcon />{children}
      </a>
    );
  }
  return (
    <Link to={to} className="pub-footer-link">
      <ArrowIcon />{children}
    </Link>
  );
}

// ─── DeveloperFooter ──────────────────────────────────────────────────────────

export default function DeveloperFooter() {
  return (
    <footer className="pub-footer" role="contentinfo">

      {/* ── Grille principale ── */}
      <div className="pub-footer-grid">

        {/* Colonne marque */}
        <div className="pub-footer-brand">
          <div className="pub-footer-brand-logo">
            <img src="/logo.png" alt="" aria-hidden="true" width="32" height="32" loading="lazy" />
            <span>PALABRE</span>
          </div>
          <p>
            Plateforme CPaaS pour intégrer la communication chiffrée de bout en bout
            dans vos applications - messagerie, appels WebRTC, vidéoconférence et push.
          </p>
          <div className="pub-footer-contact">
            <span className="pub-footer-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Cotonou, Bénin
            </span>
            <a href="mailto:developers@palabre.app" className="pub-footer-contact-item pub-footer-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              developers@palabre.app
            </a>
          </div>
        </div>

        {/* Portail développeur */}
        <div className="pub-footer-col">
          <h4>Portail</h4>
          <ul>
            <li><FooterLink to="/">Accueil</FooterLink></li>
            <li><FooterLink to="/signup">Créer un compte</FooterLink></li>
            <li><FooterLink to="/login">Se connecter</FooterLink></li>
            <li><FooterLink to="/dashboard">Tableau de bord</FooterLink></li>
            <li><FooterLink to="/docs">Documentation</FooterLink></li>
            
          </ul>
        </div>

        {/* Ressources */}
        <div className="pub-footer-col">
          <h4>Ressources</h4>
          <ul>
            <li><FooterLink href="/api/v1/developer/docs">API OpenAPI 3.0</FooterLink></li>
            <li>
              <a href="https://www.npmjs.com/package/palabre-sdk" className="pub-footer-link"
                target="_blank" rel="noopener noreferrer">
                <ArrowIcon />SDK JavaScript
              </a>
            </li>
            <li>
              <a href="https://pub.dev/packages/palabre_flutter" className="pub-footer-link"
                target="_blank" rel="noopener noreferrer">
                <ArrowIcon />SDK Flutter
              </a>
            </li>
            <li><FooterLink href={`${PALABRE_URL}`}>Palabre</FooterLink></li>
          </ul>
        </div>

        {/* Liens utiles + Réseaux */}
        <div className="pub-footer-col">
          <h4>Liens utiles</h4>
          <ul>
            <li>
            <FooterLink to="/terms">Conditions d'utilisation</FooterLink>
            </li>
            <li>
              <FooterLink to="/privacy">Politique de confidentialité</FooterLink>
            </li>
          </ul>

          <h4 style={{ marginTop: '2rem' }}>Nos réseaux</h4>
          <div className="pub-footer-social">
            <a href="https://facebook.com" className="pub-footer-link"
              target="_blank" rel="noopener noreferrer" aria-label="Palabre sur Facebook">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
              </svg>
              Facebook
            </a>
            <a href="https://youtube.com" className="pub-footer-link"
              target="_blank" rel="noopener noreferrer" aria-label="Palabre sur YouTube">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
              </svg>
              YouTube
            </a>
            <a href="https://linkedin.com" className="pub-footer-link"
              target="_blank" rel="noopener noreferrer" aria-label="Palabre sur LinkedIn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
              LinkedIn
            </a>
          </div>
        </div>
      </div>

      {/* ── Séparateur ── */}
      <div className="pub-footer-sep" aria-hidden="true" />

      {/* ── Barre copyright ── */}
      <div className="pub-footer-bottom">
        &copy; {new Date().getFullYear()} Palabre for Developers - Tous droits réservés.
      </div>

    </footer>
  );
}
