import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Spinner, Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

const STATUS_VARIANT = { submitted: 'primary', rejected: 'warning', approved: 'success', draft: 'neutral' };
const STATUS_LABEL   = { submitted: 'A instruire', rejected: 'En correction', approved: 'Approuvee', draft: 'Brouillon' };

// ── Icône SVG simple ──────────────────────────────────────────────────────────
function Ico({ d, size = 18, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICONS = {
  submitted: ['M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z'],
  approved:  ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  rejected:  ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  total:     ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  chevron:   ['M9 18l6-6-6-6'],
  alert:     ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  arrow:     ['M5 12h14', 'M12 5l7 7-7 7'],
};

// ── Carte statistique ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accentColor, to }) {
  const card = (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '20px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      transition: 'box-shadow 0.15s',
      cursor: to ? 'pointer' : 'default',
    }}
    onMouseEnter={e => { if (to) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Icône */}
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: `${accentColor}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico d={icon} size={20} color={accentColor} stroke={1.8} />
      </div>

      {/* Valeur + label */}
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
          {value ?? <span style={{ opacity: 0.3, fontSize: 20 }}>—</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2, fontWeight: 500 }}>
          {label}
        </div>
      </div>

      {/* Indicateur couleur à droite */}
      {to && (
        <div style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--color-text-secondary)' }}>
          <Ico d={ICONS.chevron} size={16} />
        </div>
      )}
    </div>
  );

  return to
    ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>
    : card;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const now       = new Date();
  const hour      = now.getHours();
  const greeting  = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
  const firstName = user?.fullName?.split(' ')[0] || 'Administrateur';
  const dateStr   = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, r, a, all] = await Promise.all([
          api.get('/onboarding/admin/requests?status=submitted&pageSize=1'),
          api.get('/onboarding/admin/requests?status=rejected&pageSize=1'),
          api.get('/onboarding/admin/requests?status=approved&pageSize=1'),
          api.get('/onboarding/admin/requests?pageSize=6'),
        ]);
        setStats({ submitted: s.total, rejected: r.total, approved: a.total, total: all.total });
        setRecent(all.items || []);
      } catch (e) { setError(friendlyMessage(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto' }}>

      {/* ── En-tete page ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 28, paddingBottom: 20,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            {stats?.submitted > 0
              ? `${stats.submitted} dossier${stats.submitted > 1 ? 's' : ''} en attente d'instruction`
              : 'Tout est a jour — aucun dossier en attente'}
          </p>
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {dateStr}
        </span>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}><Spinner /></div>
      ) : (
        <>
          {/* ── Alerte dossiers en attente ────────────────────────────────── */}
          {stats?.submitted > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              background: 'rgba(26,115,232,0.05)',
              border: '1px solid rgba(26,115,232,0.2)',
              borderRadius: 8,
              marginBottom: 24,
            }}>
              <Ico d={ICONS.alert} size={18} color="var(--color-primary-blue)" />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text-primary)' }}>
                <strong>{stats.submitted}</strong> dossier{stats.submitted > 1 ? 's' : ''} en attente d'instruction
              </span>
              <Link to="/admin/onboarding?status=submitted"
                style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--color-primary-blue)',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                }}>
                Instruire <Ico d={ICONS.arrow} size={13} color="var(--color-primary-blue)" />
              </Link>
            </div>
          )}

          {/* ── Cartes statistiques ───────────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            marginBottom: 28,
          }}>
            <StatCard
              label="A instruire"
              value={stats?.submitted}
              icon={ICONS.submitted}
              accentColor="var(--color-primary-blue)"
              to="/admin/onboarding?status=submitted"
            />
            <StatCard
              label="Approuvees"
              value={stats?.approved}
              icon={ICONS.approved}
              accentColor="var(--color-success-green)"
              to="/admin/onboarding?status=approved"
            />
            <StatCard
              label="En correction"
              value={stats?.rejected}
              icon={ICONS.rejected}
              accentColor="var(--color-warning-amber)"
              to="/admin/onboarding?status=rejected"
            />
            <StatCard
              label="Total dossiers"
              value={stats?.total}
              icon={ICONS.total}
              accentColor="var(--color-text-secondary)"
              to="/admin/onboarding"
            />
          </div>

          {/* ── Tableau dossiers recents ──────────────────────────────────── */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {/* Header tableau */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Dossiers recents
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Dernieres demandes soumises sur la plateforme
                </p>
              </div>
              <Link to="/admin/onboarding"
                style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--color-primary-blue)',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                Voir tout <Ico d={ICONS.chevron} size={14} color="var(--color-primary-blue)" />
              </Link>
            </div>

            {/* Contenu */}
            {recent.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '52px 24px', textAlign: 'center',
              }}>
                <Ico d={ICONS.total} size={40} color="var(--color-border)" stroke={1.2} />
                <p style={{ margin: '12px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  Aucun dossier pour le moment.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-offwhite)' }}>
                      {['Organisation', 'Dirigeant', 'Statut', 'Date', ''].map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 16px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase', letterSpacing: '0.6px',
                          borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, idx) => (
                      <tr key={r.id}
                        style={{ borderBottom: idx < recent.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        {/* Organisation */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                              background: 'rgba(26,115,232,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: 'var(--color-primary-blue)',
                            }}>
                              {(r.step1_organization?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>
                              {r.step1_organization?.name || <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontWeight: 400 }}>Sans nom</span>}
                            </span>
                          </div>
                        </td>

                        {/* Dirigeant */}
                        <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)' }}>
                          {r.step2_leader?.fullName || <span style={{ color: 'var(--color-border)' }}>—</span>}
                        </td>

                        {/* Statut */}
                        <td style={{ padding: '13px 16px' }}>
                          <Badge variant={STATUS_VARIANT[r.status]}>
                            {STATUS_LABEL[r.status] || r.status}
                          </Badge>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : <span style={{ color: 'var(--color-border)' }}>—</span>}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          <Link to={`/admin/onboarding/${r.id}`}
                            style={{
                              display: 'inline-block',
                              padding: '5px 12px',
                              fontSize: 13, fontWeight: 600,
                              color: 'var(--color-primary-blue)',
                              border: '1px solid rgba(26,115,232,0.3)',
                              borderRadius: 4,
                              textDecoration: 'none',
                              transition: 'background 0.12s, border-color 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.07)'; e.currentTarget.style.borderColor = 'var(--color-primary-blue)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = 'rgba(26,115,232,0.3)'; }}
                          >
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

          {/* ── Responsive grille stats ───────────────────────────────────── */}
          <style>{`
            @media (max-width: 900px) {
              .dash-grid-stats { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (max-width: 520px) {
              .dash-grid-stats { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
