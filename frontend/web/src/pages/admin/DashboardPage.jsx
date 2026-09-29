import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Spinner, Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

const STATUS_VARIANT = { submitted: 'primary', rejected: 'warning', approved: 'success', draft: 'neutral' };
const STATUS_LABEL   = { submitted: 'A instruire', rejected: 'En correction', approved: 'Approuvee', draft: 'Brouillon' };

// ── Icônes SVG pour les cartes ────────────────────────────────────────────────
const CardIcon = ({ path, color }) => (
  <div style={{
    width: 44, height: 44, borderRadius: 10,
    background: `${color}18`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
    </svg>
  </div>
);

const STAT_ICONS = {
  submitted: ['M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z'],
  approved:  ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  rejected:  ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  total:     ['M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
};

function StatCard({ label, value, color, icon, to, trend }) {
  const inner = (
    <div className="dash-stat-card" style={{ '--accent': color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <CardIcon path={icon} color={color} />
        {trend !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 600, color: trend >= 0 ? 'var(--color-success-green)' : 'var(--color-alert-red)' }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1, marginBottom: 4 }}>
        {value ?? <span style={{ fontSize: 20, opacity: 0.4 }}>...</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
  );
  return to
    ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
    : inner;
}

// ── Tableau de bord ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
  const firstName = user?.fullName?.split(' ')[0] || 'Administrateur';
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [s, r, a, all] = await Promise.all([
          api.get('/onboarding/admin/requests?status=submitted&pageSize=1'),
          api.get('/onboarding/admin/requests?status=rejected&pageSize=1'),
          api.get('/onboarding/admin/requests?status=approved&pageSize=1'),
          api.get('/onboarding/admin/requests?pageSize=6'),
        ]);
        setStats({ submitted: s.total, rejected: r.total, approved: a.total, total: all.total });
        setRecent(all.items);
      } catch (e) { setError(friendlyMessage(e)); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div>
      {/* ── Bannière de bienvenue ── */}
      <div className="dash-banner">
        <div>
          <div className="dash-banner-greeting">{greeting}, {firstName}</div>
          <div className="dash-banner-sub">
            {stats?.submitted > 0
              ? `${stats.submitted} dossier${stats.submitted > 1 ? 's' : ''} en attente d'instruction.`
              : 'Tout est a jour. Aucun dossier en attente.'}
          </div>
        </div>
        <div className="dash-banner-date">{dateStr}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}><Spinner /></div>
      ) : (
        <>
          {/* ── Cartes de stats ── */}
          <div className="dash-stats-grid">
            <StatCard
              label="A instruire"
              value={stats?.submitted}
              color="var(--color-primary-blue)"
              icon={STAT_ICONS.submitted}
              to="/admin/onboarding?status=submitted"
            />
            <StatCard
              label="Approuvees"
              value={stats?.approved}
              color="var(--color-success-green)"
              icon={STAT_ICONS.approved}
              to="/admin/onboarding?status=approved"
            />
            <StatCard
              label="En correction"
              value={stats?.rejected}
              color="var(--color-warning-amber)"
              icon={STAT_ICONS.rejected}
              to="/admin/onboarding?status=rejected"
            />
            <StatCard
              label="Total dossiers"
              value={stats?.total}
              color="var(--color-text-secondary)"
              icon={STAT_ICONS.total}
              to="/admin/onboarding"
            />
          </div>

          {/* ── Dossiers récents ── */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h2 className="dash-card-title">Dossiers recents</h2>
                <p className="dash-card-sub">Dernieres demandes soumises sur la plateforme</p>
              </div>
              <Link to="/admin/onboarding" className="dash-link-all">
                Voir tout
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="dash-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--color-border)', marginBottom: 12 }}>
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
                </svg>
                <p>Aucun dossier pour le moment.</p>
              </div>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Organisation</th>
                      <th>Dirigeant</th>
                      <th>Statut</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id} className="dash-table-row">
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="dash-org-avatar">
                              {(r.step1_organization?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                              {r.step1_organization?.name || <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sans nom</span>}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                          {r.step2_leader?.fullName || '-'}
                        </td>
                        <td>
                          <Badge variant={STATUS_VARIANT[r.status]}>
                            {STATUS_LABEL[r.status] || r.status}
                          </Badge>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td>
                          <Link to={`/admin/onboarding/${r.id}`} className="dash-action-btn">
                            {r.status === 'submitted' ? 'Instruire' : 'Voir'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Actions rapides ── */}
          {stats?.submitted > 0 && (
            <div className="dash-quick">
              <div className="dash-quick-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-blue)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {stats.submitted} dossier{stats.submitted > 1 ? 's' : ''} en attente d'instruction
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Ces dossiers ont ete soumis et attendent votre validation.
                </div>
              </div>
              <Link to="/admin/onboarding?status=submitted" className="btn btn-sm">
                Instruire maintenant
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
