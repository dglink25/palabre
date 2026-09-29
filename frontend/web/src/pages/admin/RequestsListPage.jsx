import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL   = { draft: 'Brouillon', submitted: 'Soumise', rejected: 'Rejetee', approved: 'Approuvee' };

const PAGE_SIZE = 15;

export default function RequestsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtre par statut depuis l'URL (?status=submitted)
  // Par défaut : "submitted" — les brouillons sont exclus intentionnellement
  // (ils se créent automatiquement dès que quelqu'un ouvre le formulaire,
  //  même sans le compléter : les afficher par défaut polluerait la liste)
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

  // Quand le filtre change, revenir à la page 1
  function handleStatusChange(val) {
    setStatus(val);
    setPage(1);
    setSearchParams(val ? { status: val } : {});
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Dossiers d'inscription</h1>
        <span className="text-secondary" style={{ fontSize: 14 }}>{total} dossier{total > 1 ? 's' : ''}</span>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { val: 'submitted', label: 'A instruire' },
          { val: 'rejected',  label: 'En correction' },
          { val: 'approved',  label: 'Approuvees' },
          { val: '',          label: 'Tous (hors brouillons)' },
          { val: 'draft',     label: 'Brouillons' },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => handleStatusChange(val)}
            className={`btn btn-sm${status === val ? '' : ' btn-secondary'}`}
            style={{ fontSize: 13 }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Dirigeant</th>
                  <th>Statut</th>
                  <th>Soumise le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>
                      {r.step1_organization?.name || (
                        <span className="text-secondary" style={{ fontStyle: 'italic' }}>Sans nom</span>
                      )}
                    </td>
                    <td>{r.step2_leader?.fullName || '-'}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[r.status]}>
                        {STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="text-secondary" style={{ fontSize: 13 }}>
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleString('fr-FR')
                        : r.status === 'draft'
                          ? <span style={{ fontStyle: 'italic' }}>Non soumis</span>
                          : '-'
                      }
                    </td>
                    <td>
                      <Link to={`/admin/onboarding/${r.id}`} style={{ fontSize: 14 }}>
                        {r.status === 'submitted' ? 'Instruire' : 'Voir'}
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)' }}>
                      Aucun dossier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span className="text-secondary" style={{ fontSize: 14 }}>
                Page {page} sur {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Precedent
                </button>
                {/* Pages numeros */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      className={`btn btn-sm${page === p ? '' : ' btn-secondary'}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="btn btn-sm btn-secondary"
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
