import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function OrgDashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Organisation</h1>
      <p className="text-secondary">
        Tableau de bord de votre organisation.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Statut VPN', value: 'Inconnu', color: 'var(--color-text-secondary)', to: '/org/vpn' },
          { label: 'Application mobile', value: 'Non generee', color: 'var(--color-warning-amber)', to: '/org/apk' },
        ].map((s) => (
          <Link key={s.label} to={s.to} style={{ textDecoration: 'none', flex: 1, minWidth: 160 }}>
            <div style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-border)',
              borderTop: `4px solid ${s.color}`,
              padding: '20px 24px',
            }}>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {s.label}
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: s.color }}>{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2>Actions disponibles</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/org/vpn" className="btn btn-sm btn-secondary">Configurer le tunnel VPN</Link>
          <Link to="/org/apk" className="btn btn-sm btn-secondary">Generer l'APK</Link>
        </div>
      </div>
    </div>
  );
}
