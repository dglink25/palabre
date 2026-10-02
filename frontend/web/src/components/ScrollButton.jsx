import { useEffect, useState } from 'react';

/**
 * Bouton flottant de défilement bidirectionnel.
 * Couleur : bleu primaire (var(--color-primary-blue)) — charte Palabre.
 * Positionné à droite, décalé pour ne pas chevaucher le SupportWidget.
 */
export default function ScrollButton() {
  const [visible,  setVisible]  = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [pressed,  setPressed]  = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrollY   = window.scrollY || window.pageYOffset;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(maxScroll > 120);
      setAtBottom(maxScroll > 0 && scrollY >= maxScroll - 60);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function handleClick() {
    if (atBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  }

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes sbIn {
          from { opacity:0; transform:scale(0.7) translateY(10px); }
          to   { opacity:1; transform:scale(1)   translateY(0);    }
        }
        @keyframes sbPulse {
          0%,100% { box-shadow: 0 4px 18px rgba(26,115,232,0.50); }
          50%      { box-shadow: 0 6px 28px rgba(26,115,232,0.75); }
        }
        .scroll-btn:focus-visible {
          outline: 3px solid var(--color-primary-blue);
          outline-offset: 2px;
        }
        @media (max-width: 640px) {
          .scroll-btn { display: none !important; }
        }
      `}</style>

      <button
        className="scroll-btn"
        onClick={handleClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        title={atBottom ? 'Retour en haut' : 'Aller en bas'}
        aria-label={atBottom ? 'Retour en haut' : 'Aller en bas'}
        style={{
          position:       'fixed',
          bottom:         28,
          right:          28,
          zIndex:         8888,
          width:          48,
          height:         48,
          borderRadius:   '50%',
          border:         'none',
          background:     'var(--color-primary-blue)',
          color:          'var(--color-white)',
          cursor:         'pointer',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            2,
          padding:        0,
          animation:      'sbIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both, sbPulse 2.8s ease-in-out 1s infinite',
          transform:      pressed ? 'scale(0.92)' : 'scale(1)',
          transition:     'transform 0.12s',
          userSelect:     'none',
        }}
      >
        {/* Flèche haut */}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <polyline points="1,8 7,2 13,8"/>
        </svg>

        {/* Séparateur central */}
        <div style={{ width: 18, height: 1.5, background: 'rgba(255,255,255,0.45)', borderRadius: 1 }} aria-hidden="true" />

        {/* Flèche bas */}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <polyline points="1,2 7,8 13,2"/>
        </svg>
      </button>
    </>
  );
}
