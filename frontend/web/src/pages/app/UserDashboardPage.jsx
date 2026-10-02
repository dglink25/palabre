import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/apiClient';

/* Tokens CSS - référencés via les variables :root de theme.css.
   Plus aucune couleur hexadécimale en dur dans ce composant. */
const C = {
  blue:   'var(--color-primary-blue)',
  green:  'var(--color-success-green)',
  amber:  'var(--color-warning-amber)',
  red:    'var(--color-alert-red)',
  purple: 'var(--color-primary-blue)', /* violet interdit par la charte → bleu primaire */
  text:   'var(--color-text-primary)',
  sub:    'var(--color-text-secondary)',
  border: 'var(--color-border)',
  bg:     'var(--color-offwhite)',
};

function Ico({ d, size = 20, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ACTIONS = [
  {
    to:    '/app/conversations',
    label: 'Messages',
    desc:  'Conversations chiffrees',
    color: C.blue,
    icon:  ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    badge: null,
  },
  {
    to:    '/app/calls',
    label: 'Appels',
    desc:  'Audio et video',
    color: C.green,
    icon:  ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  },
  {
    to:    '/app/contacts',
    label: 'Contacts',
    desc:  'Membres de l\'org',
    color: C.purple,
    icon:  ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  },
];

function ActionCard({ action, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <Link to={action.to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff',
        border: `1px solid ${hovered ? action.color + '60' : C.border}`,
        borderRadius: 12,
        padding: '20px 18px',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
        boxShadow: hovered ? `0 6px 20px ${action.color}18` : 'none',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        opacity: visible ? 1 : 0,
        transitionProperty: 'opacity, transform, box-shadow, border-color',
        transitionDuration: '0.35s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: `${action.color}${hovered ? '22' : '14'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}>
          <Ico d={action.icon} size={22} color={action.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{action.label}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{action.desc}</div>
        </div>
        <Ico d={['M9 18l6-6-6-6']} size={16} color={hovered ? action.color : C.sub} />
      </div>
    </Link>
  );
}

export default function UserDashboardPage() {
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
  const firstName = user?.fullName?.split(' ')[0] || 'vous';

  useEffect(() => {
    if (user?.orgId) {
      api.get('/org/me').then(d => setOrgName(d?.name || '')).catch(() => {});
    }
  }, [user?.orgId]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 32, paddingBottom: 22, borderBottom: `1px solid ${C.border}`,
        flexWrap: 'wrap', gap: 12,
        animation: 'fadein 0.4s ease',
      }}>
        <div>
          {orgName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 0 3px ${C.green}25` }} />
              <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{orgName}</span>
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: C.sub }}>
            Vos communications sont chiffrees de bout en bout avec le protocole Signal.
          </p>
        </div>
        <Link to="/app/conversations/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 16px',
          background: C.blue, color: '#fff',
          borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
          Nouvelle conversation
        </Link>
      </div>

      {/* ── Etiquette section ── */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 14 }}>
        Communications
      </div>

      {/* ── Cartes d'accès ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {ACTIONS.map((a, i) => <ActionCard key={a.to} action={a} delay={i * 60} />)}
      </div>

      {/* ── Bannière chiffrement ── */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'flex-start',
        background: `${C.green}08`, border: `1px solid ${C.green}25`,
        borderRadius: 10, padding: '16px 20px',
        animation: 'fadein 0.6s ease 0.3s both',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: `${C.green}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']} size={18} color={C.green} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 3 }}>
            Chiffrement de bout en bout actif
          </div>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
            Messages et appels proteges avec le protocole Signal (Double Ratchet + X3DH).
            Les cles privees ne quittent jamais votre appareil.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadein { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @media(max-width:520px) { .usr-dash-btn { display:none !important; } }
      `}</style>
    </div>
  );
}
