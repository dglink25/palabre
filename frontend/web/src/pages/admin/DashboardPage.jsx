import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Spinner, Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Charte Palabre : #1A73E8 bleu · #34A853 vert · #FBBC05 ambre · #EA4335 rouge
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  blue:   '#1A73E8',
  green:  '#34A853',
  amber:  '#FBBC05',
  red:    '#EA4335',
  text:   '#202124',
  sub:    '#5F6368',
  border: '#E0E0E0',
  bg:     '#F8F9FA',
};

const STATUS_VARIANT = { submitted: 'primary', rejected: 'warning', approved: 'success', draft: 'neutral' };
const STATUS_LABEL   = { submitted: 'A instruire', rejected: 'En correction', approved: 'Approuvee', draft: 'Brouillon' };

function Ico({ d, size = 18, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICO = {
  file:    ['M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z'],
  check:   ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  warn:    ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  total:   ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  chevron: ['M9 18l6-6-6-6'],
  arrow:   ['M5 12h14', 'M12 5l7 7-7 7'],
  bell:    ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
};

// ── Carte statistique animée ──────────────────────────────────────────────────
function StatCard({ label, value, icon, color, to, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  const inner = (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'box-shadow 0.2s, transform 0.2s',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transitionProperty: 'opacity, transform, box-shadow',
      transitionDuration: '0.35s',
      transitionDelay: visible ? '0s' : `${delay}ms`,
      cursor: to ? 'pointer' : 'default',
    }}
    onMouseEnter={e => { if (to) { e.currentTarget.style.boxShadow = `0 4px 16px ${color}22`; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 10, flexShrink: 0,
        background: `${color}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico d={icon} size={22} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.5px' }}>
          {value ?? <span style={{ opacity: 0.25, fontSize: 22 }}>-</span>}
        </div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
      {to && <div style={{ color: C.sub }}><Ico d={ICO.chevron} size={15} /></div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner;
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
  const name     = user?.fullName?.split(' ')[0] || 'Administrateur';
  const dateStr  = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    (async () => {
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

      {/* ── En-tête ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 32, paddingBottom: 22,
        borderBottom: `1px solid ${C.border}`,
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: C.green,
              boxShadow: `0 0 0 3px ${C.green}30`,
            }} />
            <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>Super-Administrateur</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
            {greeting}, {name}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: C.sub }}>
            {stats?.submitted > 0
              ? `${stats.submitted} dossier${stats.submitted > 1 ? 's' : ''} en attente d'instruction`
              : 'Tout est a jour - aucun dossier en attente'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: C.sub, textTransform: 'capitalize' }}>{dateStr}</div>
          {stats?.submitted > 0 && (
            <Link to="/admin/onboarding?status=submitted" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 8, padding: '7px 14px',
              background: C.blue, color: '#fff',
              borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Ico d={ICO.bell} size={14} color="#fff" />
              Instruire les dossiers
            </Link>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center' }}><Spinner /></div>
      ) : (
        <>
          {/* ── Cartes statistiques ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
            <StatCard label="A instruire"   value={stats?.submitted} icon={ICO.file}  color={C.blue}  to="/admin/onboarding?status=submitted" delay={0}   />
            <StatCard label="Approuvees"    value={stats?.approved}  icon={ICO.check} color={C.green} to="/admin/onboarding?status=approved"  delay={60}  />
            <StatCard label="En correction" value={stats?.rejected}  icon={ICO.warn}  color={C.amber} to="/admin/onboarding?status=rejected"  delay={120} />
            <StatCard label="Total"         value={stats?.total}     icon={ICO.total} color={C.sub}   to="/admin/onboarding"                  delay={180} />
          </div>

          {/* ── Barre d'alerte ── */}
          {stats?.submitted > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', marginBottom: 28,
              background: `${C.blue}08`, border: `1px solid ${C.blue}30`,
              borderRadius: 8,
              animation: 'fadeIn 0.4s ease',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${C.blue}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Ico d={ICO.file} size={18} color={C.blue} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {stats.submitted} dossier{stats.submitted > 1 ? 's' : ''} en attente d'instruction
                </div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 1 }}>
                  Ces dossiers ont ete soumis et attendent votre validation.
                </div>
              </div>
              <Link to="/admin/onboarding?status=submitted" style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 13, fontWeight: 700, color: C.blue,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                Instruire <Ico d={ICO.arrow} size={13} color={C.blue} />
              </Link>
            </div>
          )}

          {/* ── Tableau dossiers recents ── */}
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Dossiers recents</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>Dernieres demandes soumises</div>
              </div>
              <Link to="/admin/onboarding" style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: 600, color: C.blue, textDecoration: 'none',
              }}>
                Voir tout <Ico d={ICO.chevron} size={14} color={C.blue} />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div style={{ padding: '52px 24px', textAlign: 'center', color: C.sub }}>
                <Ico d={ICO.total} size={44} color={C.border} stroke={1.2} />
                <p style={{ marginTop: 12, fontSize: 14 }}>Aucun dossier pour le moment.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {['Organisation', 'Dirigeant', 'Statut', 'Date', ''].map((h, i) => (
                        <th key={i} style={{
                          padding: '10px 16px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: C.sub,
                          textTransform: 'uppercase', letterSpacing: '0.6px',
                          borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, idx) => (
                      <tr key={r.id}
                        style={{ borderBottom: idx < recent.length - 1 ? `1px solid ${C.bg}` : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                              background: `${C.blue}14`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: C.blue,
                            }}>
                              {(r.step1_organization?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: C.text }}>
                              {r.step1_organization?.name || <span style={{ color: C.sub, fontStyle: 'italic', fontWeight: 400 }}>Sans nom</span>}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', color: C.sub }}>
                          {r.step2_leader?.fullName || '-'}
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status] || r.status}</Badge>
                        </td>
                        <td style={{ padding: '13px 16px', color: C.sub, whiteSpace: 'nowrap', fontSize: 13 }}>
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          <Link to={`/admin/onboarding/${r.id}`} style={{
                            padding: '5px 12px', fontSize: 13, fontWeight: 600,
                            color: C.blue, border: `1px solid ${C.blue}35`,
                            borderRadius: 5, textDecoration: 'none',
                            transition: 'background 0.12s, border-color 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${C.blue}10`; e.currentTarget.style.borderColor = C.blue; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = `${C.blue}35`; }}
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
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @media(max-width:900px){ .sadmin-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media(max-width:520px){ .sadmin-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
