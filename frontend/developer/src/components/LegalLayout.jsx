import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DeveloperFooter from './DeveloperFooter.jsx';

const PALABRE_URL = import.meta.env.VITE_PALABRE_BASE_URL || 'http://localhost:3000';

// ─── Icônes ───────────────────────────────────────────────────────────────────

function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Table des matières ───────────────────────────────────────────────────────

function LegalToc({ sections }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    function onScroll() {
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 120) {
          setActive(sections[i].id);
          break;
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  }

  return (
    <aside aria-label="Table des matières" style={{
      width: 220, flexShrink: 0,
      position: 'sticky', top: 80,
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      paddingRight: 20,
      borderRight: '1px solid #E0E0E0',
      marginRight: 40,
      display: 'none', /* géré par .legal-toc CSS */
    }} className="legal-toc">
      <p style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.7px', color: '#9aa0a6', margin: '0 0 12px',
      }}>
        Sur cette page
      </p>
      <nav>
        {sections.map(s => {
          const isA = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 10px',
                background: isA ? '#EAF2FD' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${isA ? '#1A73E8' : 'transparent'}`,
                borderRadius: '0 6px 6px 0',
                marginBottom: 2,
                fontSize: 13,
                fontWeight: isA ? 600 : 400,
                color: isA ? '#1A73E8' : '#5F6368',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 150ms ease',
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: isA ? '#1A73E8' : '#F1F3F4',
                color: isA ? '#FFFFFF' : '#9aa0a6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}>
                {s.n}
              </span>
              {s.title}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ─── LegalLayout ─────────────────────────────────────────────────────────────

export default function LegalLayout({ title, subtitle, badges = [], sections, children }) {
  return (
    <>
      <style>{`
        /* Layout légal responsive */
        .legal-toc { display: none; }
        @media (min-width: 900px) {
          .legal-toc { display: block !important; }
        }

        /* Styles du corps légal */
        .legal-body h2 {
          font-size: 18px;
          font-weight: 700;
          color: #202124;
          margin: 32px 0 12px;
          padding-top: 8px;
          border-top: 1px solid #E0E0E0;
        }
        .legal-body h2:first-of-type { border-top: none; margin-top: 0; }
        .legal-body h3 {
          font-size: 15px;
          font-weight: 600;
          color: #202124;
          margin: 20px 0 8px;
        }
        .legal-body p {
          font-size: 14px;
          color: #5F6368;
          line-height: 1.7;
          margin: 0 0 12px;
        }
        .legal-body ul, .legal-body ol {
          margin: 0 0 14px 20px;
          padding: 0;
        }
        .legal-body li {
          font-size: 14px;
          color: #5F6368;
          line-height: 1.7;
          margin-bottom: 4px;
        }
        .legal-body a {
          color: #1A73E8;
          text-decoration: none;
          font-weight: 500;
        }
        .legal-body a:hover { text-decoration: underline; }
        .legal-body strong { color: #202124; font-weight: 600; }
        .legal-body code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          background: #F1F3F4;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #E0E0E0;
          color: #202124;
        }

        /* Table légale */
        .legal-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 16px;
          display: block;
          overflow-x: auto;
        }
        .legal-body table th {
          background: #F8F9FA;
          padding: 10px 14px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: #5F6368;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #E0E0E0;
          white-space: nowrap;
        }
        .legal-body table td {
          padding: 10px 14px;
          font-size: 13px;
          color: #5F6368;
          border-bottom: 1px solid #E0E0E0;
        }
        .legal-body table tr:last-child td { border-bottom: none; }
        .legal-body table tr:hover td { background: rgba(26,115,232,.02); }

        /* Callout */
        .legal-callout {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(26,115,232,.06);
          border: 1px solid rgba(26,115,232,.20);
          border-left: 3px solid #1A73E8;
          border-radius: 8px;
          margin: 0 0 16px;
        }
        .legal-callout-icon { color: #1A73E8; flex-shrink: 0; margin-top: 2px; }
        .legal-callout p { margin: 0; color: #202124; font-size: 13px; line-height: 1.6; }

        /* Carte contact */
        .legal-contact-card {
          background: #FFFFFF;
          border: 1px solid #E0E0E0;
          border-radius: 8px;
          padding: 20px 24px;
          margin: 0 0 16px;
        }
        .legal-contact-card h3 {
          font-size: 14px; font-weight: 700; color: #202124; margin: 0 0 10px;
        }
        .legal-contact-card p {
          font-size: 13px; color: #5F6368; line-height: 1.6; margin: 0;
        }

        /* Liens pied de page légal */
        .legal-footer-links {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 24px;
          margin-top: 24px;
          border-top: 1px solid #E0E0E0;
        }
        .legal-footer-links a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #1A73E8;
          text-decoration: none;
        }
        .legal-footer-links a:hover { text-decoration: underline; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8F9FA' }}>

        {/* ── Topbar ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 40px)', height: 60,
          background: '#FFFFFF', borderBottom: '1px solid #E0E0E0',
          boxShadow: '0 1px 3px rgba(32,33,36,.06)',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo.png" alt="Palabre" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#202124', letterSpacing: '0.2px' }}>Palabre</span>
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
              color: '#1A73E8', background: '#EAF2FD', padding: '1px 5px', borderRadius: 3,
            }}>Dev</span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/" style={{ fontSize: 13, color: '#5F6368', textDecoration: 'none', padding: '6px 12px', borderRadius: 6, fontFamily: 'inherit' }}>
              Accueil
            </Link>
            <Link to="/login" style={{
              fontSize: 13, fontWeight: 600, color: '#FFFFFF',
              background: '#1A73E8', borderRadius: 8, padding: '7px 14px', textDecoration: 'none',
            }}>
              Se connecter
            </Link>
          </nav>
        </header>

        {/* ── Héro bleu ── */}
        <div style={{
          background: '#1A73E8', color: '#FFFFFF',
          padding: 'clamp(32px, 5vw, 56px) clamp(20px, 5vw, 40px)',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Breadcrumb */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'rgba(255,255,255,.7)', marginBottom: 16,
              flexWrap: 'wrap',
            }}>
              <Link to="/" style={{ color: 'rgba(255,255,255,.8)', textDecoration: 'none' }}>Accueil</Link>
              <IconChevronRight />
              <span style={{ color: '#FFFFFF' }}>{title}</span>
            </div>

            <h1 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              {title}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 560 }}>
              {subtitle}
            </p>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {badges.map(b => (
                <span key={b} style={{
                  fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,255,255,.18)',
                  color: '#FFFFFF',
                  padding: '3px 10px', borderRadius: 20,
                  letterSpacing: '0.3px',
                }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Corps - 2 colonnes ── */}
        <div style={{ flex: 1, maxWidth: 960, margin: '0 auto', width: '100%', padding: '40px clamp(16px, 4vw, 32px) 60px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <LegalToc sections={sections} />
            <article className="legal-body" style={{ flex: 1, minWidth: 0 }}>
              {children}
            </article>
          </div>
        </div>

        {/* ── Footer ── */}
        <DeveloperFooter />
      </div>
    </>
  );
}
