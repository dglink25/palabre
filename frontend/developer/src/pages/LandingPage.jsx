/**
 * LandingPage.jsx — Palabre for Developers
 *
 * Page d'accueil publique du portail développeur.
 * Style institutionnel Stripe/Twilio : couleurs Palabre exactes,
 * animations au scroll (Intersection Observer), sections héro,
 * fonctionnalités, intégrations, CTA.
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Hook révélation au scroll ────────────────────────────────────────────────

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('lp-revealed');
          obs.disconnect();
        }
      },
      { threshold: 0.10 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Icônes SVG Lucide ────────────────────────────────────────────────────────

function Icon({ d, size = 24, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const Icons = {
  Code:     () => <Icon d={<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>} />,
  Key:      () => <Icon d={<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>} />,
  Webhook:  () => <Icon d={<><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></>} />,
  Msg:      () => <Icon d={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>} />,
  Phone:    () => <Icon d={<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>} />,
  Video:    () => <Icon d={<><path d="M23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>} />,
  Push:     () => <Icon d={<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>} />,
  Shield:   () => <Icon d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>} />,
  Zap:      () => <Icon d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>} />,
  Globe:    () => <Icon d={<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>} />,
  Chart:    () => <Icon d={<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>} />,
  ArrowR:   () => <Icon d={<><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>} size={16} strokeWidth={2} />,
  Check:    () => <Icon d={<polyline points="20 6 9 17 4 12"/>} size={16} strokeWidth={2.5} />,
  Flutter:  () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 2L3 13.5l3.5 3.5L21 3.5z" stroke="#1A73E8" strokeWidth="1.5" fill="none"/>
      <path d="M6.5 17L14 9.5l3.5 3.5-4 4L17 20.5l-3.5 3.5-7-7z" stroke="#1A73E8" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
};

// ─── Données ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Icons.Msg />,
    title: 'Messagerie E2E',
    desc: 'Intégrez la messagerie chiffrée de bout en bout dans votre application en 3 lignes de code.',
    color: '#1A73E8',
  },
  {
    icon: <Icons.Phone />,
    title: 'Appels WebRTC',
    desc: 'Credentials TURN, signalisation et gestion des appels audio/vidéo P2P via notre infrastructure.',
    color: '#34A853',
  },
  {
    icon: <Icons.Video />,
    title: 'Vidéoconférence',
    desc: 'Rooms Jitsi instantanées avec tokens de session signés, jusqu\'à 300 participants.',
    color: '#1A73E8',
  },
  {
    icon: <Icons.Push />,
    title: 'Notifications push',
    desc: 'Envoyez des notifications FCM aux utilisateurs de votre application via une API unifiée.',
    color: '#FBBC05',
  },
  {
    icon: <Icons.Webhook />,
    title: 'Webhooks signés',
    desc: 'Recevez les événements en temps réel avec vérification HMAC-SHA256 et retry automatique.',
    color: '#EA4335',
  },
  {
    icon: <Icons.Chart />,
    title: 'Statistiques d\'usage',
    desc: 'Tableau de bord analytique avec métriques détaillées par projet et par période.',
    color: '#34A853',
  },
];

const INTEGRATIONS = [
  { name: 'JavaScript',  color: '#F7DF1E', bg: '#FEFCE8' },
  { name: 'TypeScript',  color: '#3178C6', bg: '#EFF6FF' },
  { name: 'React',       color: '#61DAFB', bg: '#F0FDFE' },
  { name: 'Vue.js',      color: '#42B883', bg: '#F0FDF4' },
  { name: 'Flutter',     color: '#1A73E8', bg: '#EAF2FD' },
  { name: 'Laravel',     color: '#FF2D20', bg: '#FFF1F0' },
  { name: 'Django',      color: '#092E20', bg: '#F0FDF4' },
  { name: 'Node.js',     color: '#339933', bg: '#F0FDF4' },
];

const STEPS = [
  { num: '01', title: 'Créez votre compte', desc: 'Connectez-vous avec Google, GitHub ou WhatsApp. Votre compte développeur est créé automatiquement.' },
  { num: '02', title: 'Créez un projet',    desc: 'Générez une paire de clés API (publishable + secret) en un clic.' },
  { num: '03', title: 'Intégrez le SDK',    desc: 'Installez `palabre-sdk` et initialisez avec votre clé en une ligne.' },
  { num: '04', title: 'Déployez',           desc: 'Vos utilisateurs bénéficient de la messagerie, des appels et de la vidéo de Palabre.' },
];

// ─── Composants de section ────────────────────────────────────────────────────

function FeatureCard({ icon, title, desc, color, delay }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className="lp-reveal"
      style={{ '--lp-delay': `${delay}ms` }}
    >
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: 8,
        padding: '24px',
        height: '100%',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.boxShadow = `0 4px 16px ${color}22`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#E0E0E0';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{
          width: 44, height: 44,
          borderRadius: 8,
          background: `${color}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, marginBottom: 14,
        }}>
          {icon}
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 8px' }}>
          {title}
        </h3>
        <p style={{ fontSize: 14, color: '#5F6368', margin: 0, lineHeight: 1.6 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc, delay }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="lp-reveal" style={{ '--lp-delay': `${delay}ms` }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#1A73E8', color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {num}
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>
            {title}
          </h3>
          <p style={{ fontSize: 14, color: '#5F6368', margin: 0, lineHeight: 1.6 }}>
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── LandingPage ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const heroRef    = useRef(null);
  const featRef    = useReveal();
  const stepsRef   = useReveal();
  const intRef     = useReveal();
  const ctaRef     = useReveal();

  // Animation de l'hero au montage
  useEffect(() => {
    if (heroRef.current) {
      heroRef.current.classList.add('lp-revealed');
    }
  }, []);

  return (
    <>
      {/* ── CSS global animations ── */}
      <style>{`
        .lp-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.55s ease var(--lp-delay, 0ms),
                      transform 0.55s ease var(--lp-delay, 0ms);
        }
        .lp-reveal.lp-revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-hero-reveal {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s cubic-bezier(0.4,0,0.2,1) var(--lp-delay, 0ms),
                      transform 0.6s cubic-bezier(0.4,0,0.2,1) var(--lp-delay, 0ms);
        }
        .lp-hero-reveal.lp-revealed { opacity: 1; transform: translateY(0); }
        .lp-nav-link:hover { color: #1A73E8 !important; }
        .lp-btn-primary:hover:not(:disabled) {
          background: #1557b0 !important;
          box-shadow: 0 4px 16px rgba(26,115,232,.35) !important;
          transform: translateY(-1px);
        }
        .lp-btn-secondary:hover {
          background: #F8F9FA !important;
          border-color: #1A73E8 !important;
          color: #1A73E8 !important;
        }
        .lp-code-anim {
          animation: lpCodeFade 1s ease 0.8s both;
        }
        @keyframes lpCodeFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lpPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .lp-stat-val {
          animation: lpCountIn 0.6s ease both;
        }
        @keyframes lpCountIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div style={{ fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif", background: '#F8F9FA', minHeight: '100vh' }}>

        {/* ── NAVIGATION ── */}
        <header style={{
          position:  'sticky', top: 0, zIndex: 80,
          display:   'flex', alignItems: 'center', justifyContent: 'space-between',
          padding:   '0 40px', height: 64,
          background: '#FFFFFF',
          borderBottom: '1px solid #E0E0E0',
          boxShadow: '0 1px 3px rgba(32,33,36,.06)',
        }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="Palabre" style={{ width: 30, height: 30 }} />
            <span style={{ fontWeight: 700, fontSize: 18, color: '#202124', letterSpacing: '0.2px' }}>
              Palabre
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
              color: '#1A73E8', background: '#EAF2FD', padding: '1px 6px', borderRadius: 3,
            }}>
              Developers
            </span>
          </Link>

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[
              { label: 'Fonctionnalités', href: '#features'  },
              { label: 'Intégrations',    href: '#integrations' },
              { label: 'Documentation',   href: '/docs' },
            ].map(({ label, href }) => (
              href.startsWith('#') ? (
                <a key={label} href={href}
                  className="lp-nav-link"
                  style={{
                    padding: '8px 14px', fontSize: 14, fontWeight: 500,
                    color: '#5F6368', textDecoration: 'none',
                    borderRadius: 6, transition: 'color 150ms ease',
                  }}
                >
                  {label}
                </a>
              ) : (
                <Link key={label} to={href}
                  className="lp-nav-link"
                  style={{
                    padding: '8px 14px', fontSize: 14, fontWeight: 500,
                    color: '#5F6368', textDecoration: 'none',
                    borderRadius: 6, transition: 'color 150ms ease',
                  }}
                >
                  {label}
                </Link>
              )
            ))}

            <div style={{ width: 1, height: 20, background: '#E0E0E0', margin: '0 6px' }} />

            <Link to="/login"
              className="lp-btn-secondary"
              style={{
                padding: '8px 16px',
                fontSize: 14, fontWeight: 600,
                color: '#202124', textDecoration: 'none',
                border: '1px solid #E0E0E0', borderRadius: 8,
                background: '#FFFFFF',
                transition: 'all 150ms ease',
              }}
            >
              Se connecter
            </Link>
            <Link to="/signup"
              className="lp-btn-primary"
              style={{
                padding: '8px 18px',
                fontSize: 14, fontWeight: 600,
                color: '#FFFFFF', textDecoration: 'none',
                background: '#1A73E8', borderRadius: 8, border: 'none',
                transition: 'all 150ms ease',
              }}
            >
              Commencer — c'est gratuit
            </Link>
          </nav>
        </header>

        {/* ── HÉRO ── */}
        <section style={{
          maxWidth: 1120, margin: '0 auto', padding: '80px 40px 64px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center',
        }}>
          {/* Texte */}
          <div ref={heroRef} className="lp-hero-reveal" style={{ '--lp-delay': '0ms' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#EAF2FD', borderRadius: 20,
              padding: '4px 14px', marginBottom: 20,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#1A73E8',
                animation: 'lpPulse 2s ease infinite',
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1A73E8' }}>
                API CPaaS — Communication Platform as a Service
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 800, color: '#202124', lineHeight: 1.15,
              margin: '0 0 20px',
              letterSpacing: '-0.02em',
            }}>
              Intégrez la communication Palabre dans vos applications
            </h1>
            <p style={{
              fontSize: 17, color: '#5F6368', lineHeight: 1.7,
              margin: '0 0 32px', maxWidth: 500,
            }}>
              Messagerie E2E, appels WebRTC, vidéoconférence et notifications push —
              en quelques lignes de code, avec vos propres clés API.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/signup" className="lp-btn-primary" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', fontSize: 15, fontWeight: 700,
                color: '#FFFFFF', textDecoration: 'none',
                background: '#1A73E8', borderRadius: 10,
                transition: 'all 200ms ease',
              }}>
                Créer mon compte développeur
                <Icons.ArrowR />
              </Link>
              <Link to="/docs" className="lp-btn-secondary" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 20px', fontSize: 15, fontWeight: 600,
                color: '#202124', textDecoration: 'none',
                background: '#FFFFFF', border: '1px solid #E0E0E0',
                borderRadius: 10, transition: 'all 200ms ease',
              }}>
                <Icons.Code />
                Voir la documentation
              </Link>
            </div>

            {/* Stats */}
            <div style={{
              display: 'flex', gap: 32, marginTop: 40,
              paddingTop: 32, borderTop: '1px solid #E0E0E0',
            }}>
              {[
                { val: '5 min',  label: 'pour la première intégration' },
                { val: '4',      label: 'SDK disponibles' },
                { val: '99.9%',  label: 'disponibilité SLA' },
              ].map(s => (
                <div key={s.label}>
                  <p className="lp-stat-val" style={{ fontSize: 22, fontWeight: 800, color: '#1A73E8', margin: '0 0 2px' }}>
                    {s.val}
                  </p>
                  <p style={{ fontSize: 12, color: '#5F6368', margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Code démo */}
          <div className="lp-code-anim" style={{
            background: '#1e2433', borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(26,115,232,.20), 0 4px 16px rgba(32,33,36,.12)',
          }}>
            {/* Barre de titre */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 16px', background: '#161b27',
              borderBottom: '1px solid rgba(255,255,255,.08)',
            }}>
              {['#EA4335','#FBBC05','#34A853'].map(c => (
                <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ marginLeft: 8, fontSize: 12, color: '#8892a4', fontFamily: 'monospace' }}>
                app.js
              </span>
            </div>
            {/* Code */}
            <pre style={{
              margin: 0, padding: '20px 24px',
              fontSize: 13, lineHeight: 1.8,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color: '#e2e8f0', overflowX: 'auto',
            }}>
{`\u001b[0mimport PalabreSDK \u001b[36mfrom\u001b[0m \u001b[32m'palabre-sdk'\u001b[0m;

\u001b[36mconst\u001b[0m palabre = \u001b[36mawait\u001b[0m PalabreSDK\u001b[0m
  .init(\u001b[32m'pk_live_…'\u001b[0m);

\u001b[90m// Envoyer un message\u001b[0m
\u001b[36mawait\u001b[0m palabre.chat
  .send(\u001b[32m'user_456'\u001b[0m, \u001b[32m'Bonjour !'\u001b[0m);

\u001b[90m// Écouter les événements\u001b[0m
palabre.on(\u001b[32m'message'\u001b[0m, msg \u001b[36m=>\u001b[0m {
  console.log(\u001b[32m'Reçu :'\u001b[0m, msg);
});

\u001b[90m// Lancer un appel\u001b[0m
\u001b[36mconst\u001b[0m call = \u001b[36mawait\u001b[0m palabre.call
  .start(\u001b[32m'user_456'\u001b[0m);`
              .replace(/\u001b\[\d+m/g, '')}
            </pre>
            {/* Barre de bas */}
            <div style={{
              padding: '10px 16px', background: '#161b27',
              borderTop: '1px solid rgba(255,255,255,.08)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34A853' }} />
              <span style={{ fontSize: 11, color: '#8892a4' }}>npm install palabre-sdk</span>
            </div>
          </div>
        </section>

        {/* ── FONCTIONNALITÉS ── */}
        <section id="features" style={{ background: '#FFFFFF', padding: '64px 0', borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
            <div ref={featRef} className="lp-reveal" style={{ '--lp-delay': '0ms', textAlign: 'center', marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#1A73E8', margin: '0 0 10px' }}>
                Fonctionnalités
              </p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#202124', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                Tout ce dont vous avez besoin
              </h2>
              <p style={{ fontSize: 16, color: '#5F6368', margin: '0 auto', maxWidth: 500, lineHeight: 1.6 }}>
                Une seule intégration pour ajouter messagerie, appels, vidéo et push à votre application.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
            }}>
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} {...f} delay={i * 80} />
              ))}
            </div>
          </div>
        </section>

        {/* ── COMMENT ÇA MARCHE ── */}
        <section style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 40px' }}>
          <div ref={stepsRef} className="lp-reveal" style={{ '--lp-delay': '0ms', textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#1A73E8', margin: '0 0 10px' }}>
              Comment ça marche
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#202124', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
              Opérationnel en 5 minutes
            </h2>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 32,
          }}>
            {STEPS.map((s, i) => (
              <StepCard key={s.num} {...s} delay={i * 100} />
            ))}
          </div>
        </section>

        {/* ── INTÉGRATIONS ── */}
        <section id="integrations" style={{ background: '#FFFFFF', padding: '64px 0', borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 40px' }}>
            <div ref={intRef} className="lp-reveal" style={{ '--lp-delay': '0ms', textAlign: 'center', marginBottom: 40 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#1A73E8', margin: '0 0 10px' }}>
                Intégrations
              </p>
              <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 32px)', fontWeight: 800, color: '#202124', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                SDK et bibliothèques disponibles
              </h2>
              <p style={{ fontSize: 15, color: '#5F6368', margin: '0 auto', maxWidth: 460, lineHeight: 1.6 }}>
                Un SDK natif pour chaque stack. Même API, mêmes fonctionnalités.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {INTEGRATIONS.map(({ name, color, bg }, i) => (
                <div
                  key={name}
                  className="lp-reveal"
                  style={{ '--lp-delay': `${i * 50}ms` }}
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 18px',
                    background: bg,
                    border: `1px solid ${color}30`,
                    borderRadius: 999,
                    fontSize: 14, fontWeight: 600, color,
                    transition: 'transform 200ms ease, box-shadow 200ms ease',
                    cursor: 'default',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${color}25`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 40px' }}>
          <div ref={ctaRef} className="lp-reveal" style={{ '--lp-delay': '0ms' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1A73E8 0%, #1557b0 100%)',
              borderRadius: 16, padding: '56px 48px', textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Cercles décoratifs */}
              <div style={{
                position: 'absolute', top: -60, right: -60,
                width: 240, height: 240, borderRadius: '50%',
                background: 'rgba(255,255,255,.06)', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: -40, left: -40,
                width: 160, height: 160, borderRadius: '50%',
                background: 'rgba(255,255,255,.04)', pointerEvents: 'none',
              }} />

              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,.7)', margin: '0 0 14px' }}>
                Prêt à intégrer ?
              </p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800, color: '#FFFFFF', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
                Créez votre compte développeur
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,.8)', margin: '0 auto 32px', maxWidth: 480, lineHeight: 1.6 }}>
                Gratuit, sans carte bancaire. Votre première intégration
                est opérationnelle en moins de 5 minutes.
              </p>

              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/signup" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 28px', fontSize: 15, fontWeight: 700,
                  color: '#1A73E8', textDecoration: 'none',
                  background: '#FFFFFF', borderRadius: 10,
                  transition: 'all 200ms ease',
                  boxShadow: '0 4px 16px rgba(0,0,0,.16)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.20)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.16)'; }}
                >
                  Commencer gratuitement
                  <Icons.ArrowR />
                </Link>
                <Link to="/login" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 24px', fontSize: 15, fontWeight: 600,
                  color: '#FFFFFF', textDecoration: 'none',
                  background: 'rgba(255,255,255,.15)',
                  border: '1px solid rgba(255,255,255,.30)',
                  borderRadius: 10, transition: 'all 200ms ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.15)'; }}
                >
                  J'ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          background: '#FFFFFF', borderTop: '1px solid #E0E0E0',
          padding: '32px 40px',
        }}>
          <div style={{
            maxWidth: 1120, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.png" alt="Palabre" style={{ width: 24, height: 24 }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: '#202124' }}>Palabre Developers</span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Documentation',  to: '/docs'   },
                { label: 'Se connecter',   to: '/login'  },
                { label: 'S\'inscrire',    to: '/signup' },
              ].map(({ label, to }) => (
                <Link key={label} to={to} style={{ fontSize: 13, color: '#5F6368', textDecoration: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#1A73E8'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#5F6368'; }}
                >
                  {label}
                </Link>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#9aa0a6', margin: 0 }}>
              © {new Date().getFullYear()} Palabre. Tous droits réservés.
            </p>
          </div>
        </footer>

      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 860px) {
          section[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          header { padding: 0 20px !important; }
          header nav a:not(:last-child):not(:nth-last-child(2)) { display: none; }
        }
        @media (max-width: 600px) {
          header nav a { padding: 6px 10px !important; font-size: 12px !important; }
          section { padding-left: 20px !important; padding-right: 20px !important; }
          footer  { padding: 24px 20px !important; }
        }
      `}</style>
    </>
  );
}
