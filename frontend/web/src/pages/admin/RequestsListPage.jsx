import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL   = { draft: 'Brouillon', submitted: 'Soumise', rejected: 'Rejetée', approved: 'Approuvée' };

const FILTER_TABS = [
  { val: 'submitted', label: 'À instruire', color: '#1A73E8' },
  { val: 'rejected',  label: 'En correction', color: '#FBBC05' },
  { val: 'approved',  label: 'Approuvées', color: '#34A853' },
  { val: '',          label: 'Toutes', color: '#5F6368' },
  { val: 'draft',     label: 'Brouillons', color: '#5F6368' },
];

const PAGE_SIZE = 15;

// Chevron Right icon
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default function RequestsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? 'submitted';

  const [status,  setStatus]  = useState(statusParam);
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const load = useCallback(() => {
    setLoading(true); setError('');
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    qs.set('page', page);
    qs.set('pageSize', PAGE_SIZE);
    api.get(`/onboarding/admin/requests?${qs}`)
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch((e) => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  function handleStatusChange(val) {
    setStatus(val);
    setPage(1);
    setSearchParams(val ? { status: val } : {});
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 800, color: '#202124' }}>
            Dossiers d'inscription
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
            {total} dossier{total !== 1 ? 's' : ''}
            {status === 'submitted' ? ' en attente d\'instruction' : ''}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Actualiser
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(({ val, label, color }) => {
          const isActive = status === val;
          return (
            <button
              key={val}
              onClick={() => handleStatusChange(val)}
              style={{
                height: 36,
                padding: '0 14px',
                border: isActive ? `2px solid ${color}` : '1px solid #E0E0E0',
                borderRadius: 20,
                background: isActive ? `${color}15` : '#fff',
                color: isActive ? color : '#5F6368',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : (
        <>
          {/* Table card */}
          <div style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: '#F8F9FA' }}>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid #E0E0E0' }}>
                    Organisation
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid #E0E0E0' }}>
                    Dirigeant
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid #E0E0E0' }}>
                    Statut
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid #E0E0E0' }}>
                    Soumise le
                  </th>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid #E0E0E0', width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: idx < items.length - 1 ? '1px solid #E0E0E0' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,115,232,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 16px', fontSize: 15 }}>
                      <span style={{ fontWeight: 600, color: '#202124' }}>
                        {r.step1_organization?.name || (
                          <span style={{ color: '#9aa', fontStyle: 'italic', fontWeight: 400 }}>Sans nom</span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 15, color: '#5F6368' }}>
                      {r.step2_leader?.fullName || '-'}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <Badge variant={STATUS_VARIANT[r.status]}>
                        {STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#5F6368' }}>
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : r.status === 'draft'
                          ? <span style={{ fontStyle: 'italic' }}>Non soumis</span>
                          : '-'
                      }
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <Link
                        to={`/admin/onboarding/${r.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1A73E8',
                          textDecoration: 'none',
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid rgba(26,115,232,0.2)',
                          background: 'rgba(26,115,232,0.05)',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.05)'; }}
                      >
                        {r.status === 'submitted' ? 'Instruire' : 'Voir'}
                        <ChevronRight />
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ color: '#5F6368', fontSize: 15 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.35, display: 'block', margin: '0 auto 12px' }}>
                          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                        </svg>
                        Aucun dossier trouvé.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 13, color: '#5F6368' }}>
                Page {page} sur {totalPages} - {total} résultat{total !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Précédent
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      className={`btn btn-sm${page === p ? '' : ' btn-secondary'}`}
                      onClick={() => setPage(p)}
                      style={{ minWidth: 36 }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
