import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Intersection Observer hook pour révéler les sections au scroll ── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('revealed'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const IconMsg = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconPhone = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconHeadset = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
  </svg>
);
const IconShield = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IconLock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconClipboard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const IconKey = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const FEATURES = [
  { Icon: IconMsg,     title: 'Messagerie instantanée',     text: 'Conversations individuelles et de groupe chiffrées de bout en bout, avec historique persistant et partage de fichiers.', color: 'var(--color-primary-blue)' },
  { Icon: IconPhone,   title: 'Appels audio & vidéo',       text: 'Appels HD sur réseau VoIP souverain. Aucune donnée ne transite par des serveurs tiers.',                                  color: 'var(--color-success-green)' },
  { Icon: IconHeadset, title: "Centre d'appels intégré",    text: "File d'attente, SVI configurable et assistance IA pour votre support client ou opérationnel.",                             color: 'var(--color-warning-amber)' },
  { Icon: IconShield,  title: 'Sécurité de niveau entreprise', text: "Passkeys, double vérification, VPN par organisation, journal d'audit complet et contrôle total de vos données.",      color: 'var(--color-alert-red)' },
];

const TRUST_ITEMS = [
  { Icon: IconShield,    title: 'Zéro connaissance tierce',          text: 'Vos messages ne sont jamais lus par Palabre. Le chiffrement de bout en bout garantit que seuls les participants peuvent en lire le contenu.' },
  { Icon: IconGlobe,     title: 'Souveraineté numérique',            text: 'Infrastructure hébergée localement. Aucune dépendance à des plateformes étrangères pour votre communication interne.' },
  { Icon: IconClipboard, title: 'Conformité RGPD / APDP',            text: 'Traitement conforme à la loi n° 2017-20 portant code du numérique au Bénin et aux principes du RGPD européen.' },
  { Icon: IconKey,       title: 'Authentification sans mot de passe', text: 'Passkeys biométriques, OTP WhatsApp et double vérification pour une connexion robuste sans les risques des mots de passe.' },
];

function TrustCard({ Icon, title, text, delay }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal-item trust-card" style={{ '--delay': `${delay}ms` }}>
      <span className="trust-card-icon"><Icon /></span>
      <div>
        <h3 className="trust-card-title">{title}</h3>
        <p className="trust-card-text">{text}</p>
      </div>
    </div>
  );
}
const STEPS = [
  { n: '2', title: 'Validation du dossier', text: 'Votre dossier est instruit. En cas de correction, vous êtes notifié avec les éléments précis à fournir.' },
  { n: '3', title: 'Activation du compte administrateur', text: 'Recevez votre identifiant et code d\'activation par e-mail et WhatsApp pour démarrer immédiatement.' },
  { n: '4', title: 'Invitez votre équipe', text: 'Vos collaborateurs rejoignent l\'organisation sécurisée et commencent à communiquer.' },
];

const STATS = [
  { value: '100 %', label: 'Hébergement souverain' },
  { value: 'E2E', label: 'Chiffrement de bout en bout' },
  { value: '< 2 min', label: 'Temps de démarrage' },
  { value: 'RGPD', label: 'Conforme protection des données' },
];

function FeatureCard({ Icon, title, text, color, delay }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="feature-card reveal-item" style={{ '--feature-color': color, '--delay': `${delay}ms` }}>
      <div style={{ color, marginBottom: 14 }}><Icon /></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function StepCard({ n, title, text, delay }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="step-card reveal-item" style={{ '--delay': `${delay}ms` }}>
      <div className="step-number">{n}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const statsRef = useReveal();
  const ctaBandRef = useReveal();

  return (
    <div>
      {/* ── Hero ── */}
      <section className="hero fade-in">
        <img src="/logo.png" alt="Palabre" />
        <h1>La plateforme de communication souveraine pour votre organisation</h1>
        <p>
          Messagerie, téléphonie et centre d'appels réunis dans un seul système, heberge et controle par
          vous, pense pour le Benin et l'Afrique francophone.
        </p>
        <div className="cta-row">
          {user ? (
            <Link to="/profile" className="btn">Aller à mon espace</Link>
          ) : (
            <Link to="/login" className="btn">Se connecter</Link>
          )}
          <Link to="/onboarding/new" className="btn btn-secondary">Inscrire mon organisation</Link>
        </div>
      </section>

      {/* ── Chiffres clés ── */}
      <section ref={statsRef} className="stats-band reveal-item">
        {STATS.map((s) => (
          <div key={s.label} className="stat-item">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── Fonctionnalités ── */}
      <section style={{ padding: '0 0 48px 0' }}>
        <h2 className="section-title" style={{ paddingTop: 48 }}>Tout ce dont votre organisation a besoin</h2>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 80} />
          ))}
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="steps-section" style={{ background: 'var(--color-offwhite)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="section-title" style={{ paddingTop: 48 }}>Comment ça marche</h2>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <StepCard key={s.n} {...s} delay={i * 100} />
          ))}
        </div>
      </section>

      {/* ── Bloc confiance / sécurité ── */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '56px 24px' }}>
        <h2 className="section-title" style={{ textAlign: 'left', padding: 0, marginBottom: 32 }}>
          Vos données, sous votre contrôle
        </h2>
        <div className="trust-grid">
          {TRUST_ITEMS.map((item, i) => (
            <TrustCard key={item.title} {...item} delay={i * 100} />
          ))}
        </div>
        <p className="trust-footer-note">
          Consultez notre <Link to="/privacy">politique de confidentialité</Link> et nos <Link to="/terms">conditions d'utilisation</Link> pour en savoir plus sur la protection de vos données.
        </p>
      </section>

      {/* ── CTA final ── */}
      <section ref={ctaBandRef} className="cta-band reveal-item">
        <h2>Prêt à centraliser la communication de votre organisation ?</h2>
        <p>La demande d'inscription prend quelques minutes et peut être reprise à tout moment.</p>
        <Link to="/onboarding/new" className="btn btn-block-inline">Inscrire mon organisation</Link>
      </section>
    </div>
  );
}
