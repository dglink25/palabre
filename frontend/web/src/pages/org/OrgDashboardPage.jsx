import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const CardIcon = ({ path, color }) => (
  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
    </svg>
  </div>
);

export default function OrgDashboardPage() {
  const { user } = useAuth();

  const cards = [
    {
      label: 'Tunnel VPN',
      desc: 'Configurer la connexion au serveur central',
      color: 'var(--color-primary-blue)',
      to: '/org/vpn',
      icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
    },
    {
      label: 'Invitations membres',
      desc: 'Generer un code pour inviter vos collaborateurs',
      color: 'var(--color-success-green)',
      to: '/org/invite',
      icon: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
    },
    {
      label: 'Lier mon organisation',
      desc: 'Connecter ce compte a votre tenant via QR code',
      color: 'var(--color-warning-amber)',
      to: '/org/link',
      icon: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    },
  ];

  return (
    <div>
      {/* Bannière */}
      <div style={{
        background: 'linear-gradient(135deg, #1557b0 0%, #1A73E8 100%)',
        borderRadius: 12, padding: '24px 28px', marginBottom: 24,
        color: '#fff',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Tableau de bord Organisation
        </div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          Gerez votre organisation, votre tunnel VPN et vos membres.
        </div>
      </div>

      {/* Cartes d'actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {cards.map((c) => (
          <Link key={c.to} to={c.to} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: 20,
              borderTop: `3px solid ${c.color}`,
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <CardIcon path={c.icon} color={c.color} />
              <div style={{ marginTop: 14, fontWeight: 700, fontSize: 15 }}>{c.label}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Informations */}
      <div className="card">
        <h2>Informations</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)', width: 180 }}>Identifiant organisation</td>
              <td style={{ padding: '10px 0', fontFamily: 'monospace', fontSize: 13 }}>{user?.orgId || 'Non lie'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>Compte</td>
              <td style={{ padding: '10px 0', fontSize: 14 }}>{user?.fullName || user?.email || user?.phone}</td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>Role</td>
              <td style={{ padding: '10px 0', fontSize: 14 }}>Administrateur d'organisation</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
