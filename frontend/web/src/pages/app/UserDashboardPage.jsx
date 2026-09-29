import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function UserDashboardPage() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
  const firstName = user?.fullName?.split(' ')[0] || 'vous';

  const actions = [
    {
      to: '/app/conversations',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      label: 'Messages',
      sub: 'Conversations et groupes',
      color: 'var(--color-primary-blue)',
    },
    {
      to: '/app/calls',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      ),
      label: 'Appels',
      sub: 'Audio et video',
      color: 'var(--color-success-green)',
    },
    {
      to: '/app/contacts',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      label: 'Contacts',
      sub: 'Membres de l\'organisation',
      color: 'var(--color-warning-amber)',
    },
  ];

  return (
    <div>
      {/* Bannière */}
      <div style={{
        background: 'linear-gradient(135deg, #1557b0 0%, var(--color-primary-blue) 100%)',
        borderRadius: 12, padding: '24px 28px', marginBottom: 28,
      }}>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          {greeting}, {firstName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
          Bienvenue sur Palabre. Vos communications sont chiffrees de bout en bout.
        </div>
      </div>

      {/* Cartes d'accès rapide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {actions.map((a) => (
          <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '24px 20px',
              borderTop: `3px solid ${a.color}`,
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ color: a.color, marginBottom: 14 }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{a.label}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{a.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Infos chiffrement */}
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-blue)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Chiffrement de bout en bout actif</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Tous vos messages et appels sont chiffres avec le protocole Signal.
            Les cles privees ne quittent jamais votre navigateur. Palabre ne peut pas lire vos communications.
          </div>
        </div>
      </div>
    </div>
  );
}
