import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Ico({ d, size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ACTIONS = [
  {
    to:    '/app/conversations',
    label: 'Messages',
    sub:   'Conversations et groupes',
    color: 'var(--color-primary-blue)',
    icon:  ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  },
  {
    to:    '/app/calls',
    label: 'Appels',
    sub:   'Audio et video',
    color: 'var(--color-success-green)',
    icon:  ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  },
  {
    to:    '/app/contacts',
    label: 'Contacts',
    sub:   'Membres de l\'organisation',
    color: '#7B61FF',
    icon:  ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  },
];

export default function UserDashboardPage() {
  const { user } = useAuth();
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
  const firstName = user?.fullName?.split(' ')[0] || 'vous';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── En-tête sobre ── */}
      <div style={{
        paddingBottom: 20, marginBottom: 28,
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Vos communications sont chiffrees de bout en bout.
          </p>
        </div>
        <Link to="/app/conversations/new" className="btn btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nouvelle conversation
        </Link>
      </div>

      {/* ── Acces rapide ── */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: '0 0 14px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Acces rapide
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '18px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Icone dans carré teinté */}
                <div style={{
                  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                  background: `${a.color}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico d={a.icon} size={20} color={a.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{a.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 1 }}>{a.sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Chiffrement info ── */}
      <div style={{
        marginTop: 24,
        display: 'flex', gap: 14, alignItems: 'flex-start',
        background: '#fff', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '16px 18px',
      }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <Ico d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']} size={20} color="var(--color-success-green)" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Chiffrement de bout en bout actif</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            Messages et appels chiffres avec le protocole Signal.
            Les cles privees ne quittent jamais votre navigateur.
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 640px) {
          .usr-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
