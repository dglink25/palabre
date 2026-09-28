import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Spinner, Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL   = { draft: 'Brouillon', submitted: 'Soumise', rejected: 'Rejetee', approved: 'Approuvee' };

function StatCard({ label, value, color, to }) {
  const content = (
    <div style={{
      background: 'var(--color-white)',
      border: '1px solid var(--color-border)',
      borderTop: `4px solid ${color}`,
      padding: '20px 24px',
      flex: 1,
      minWidth: 160,
    }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </p>
      <p style={{ fontSize: 32, fontWeight: 800, margin: 0, color }}>
        {value ?? '—'}
      </p>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'contents' }}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [stats, setStats]     = useState(null);
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Charger les stats en parallèle
        const [submitted, rejected, approved, all] = await Promise.all([
          api.get('/onboarding/admin/requests?status=submitted&pageSize=1'),
          api.get('/onboarding/admin/requests?status=rejected&pageSize=1'),
          api.get('/onboarding/admin/requests?status=approved&pageSize=1'),
          api.get('/onboarding/admin/requests?pageSize=5'),
        ]);
        setStats({
          submitted: submitted.total,
          rejected:  rejected.total,
          approved:  approved.total,
          total:     all.total,
        });
        setRecent(all.items);
      } catch (e) {
        setError(friendlyMessage(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1>Tableau de bord</h1>
      <p className="text-secondary">Vue d'ensemble de la plateforme Palabre.</p>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Cartes statistiques */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard
          label="A instruire"
          value={stats?.submitted}
          color="var(--color-primary-blue)"
          to="/admin/onboarding?status=submitted"
        />
        <StatCard
          label="Approuvees"
          value={stats?.approved}
          color="var(--color-success-green)"
          to="/admin/onboarding?status=approved"
        />
        <StatCard
          label="En correction"
          value={stats?.rejected}
          color="var(--color-warning-amber)"
          to="/admin/onboarding?status=rejected"
        />
        <StatCard
          label="Total dossiers"
          value={stats?.total}
          color="var(--color-text-secondary)"
          to="/admin/onboarding"
        />
      </div>

      {/* Demandes récentes */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Dossiers recents</h2>
          <Link to="/admin/onboarding" style={{ fontSize: 14 }}>Voir tout</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-secondary">Aucun dossier pour le moment.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Dirigeant</th>
                <th>Statut</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.step1_organization?.name || '-'}</td>
                  <td>{r.step2_leader?.fullName || '-'}</td>
                  <td><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td className="text-secondary" style={{ fontSize: 13 }}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td>
                    <Link to={`/admin/onboarding/${r.id}`} style={{ fontSize: 14 }}>
                      Instruire
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Actions rapides */}
      <div className="card">
        <h2>Actions rapides</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/admin/onboarding?status=submitted" className="btn btn-sm">
            Instruire les dossiers en attente
          </Link>
          <Link to="/admin/onboarding" className="btn btn-sm btn-secondary">
            Tous les dossiers
          </Link>
        </div>
      </div>
    </div>
  );
}
