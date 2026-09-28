import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL = { draft: 'Brouillon', submitted: 'Soumise', rejected: 'Rejetée', approved: 'Approuvée' };

export default function RequestsListPage() {
  const [status, setStatus] = useState('submitted');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/onboarding/admin/requests${status ? `?status=${status}` : ''}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div>
      <h1>Demandes d'inscription d'organisation</h1>
      <div className="field" style={{ maxWidth: 260 }}>
        <label>Filtrer par statut</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous</option>
          <option value="submitted">Soumises</option>
          <option value="rejected">Rejetées</option>
          <option value="approved">Approuvées</option>
          <option value="draft">Brouillons</option>
        </select>
      </div>
      <Alert variant="danger">{error}</Alert>
      {loading ? <Spinner /> : (
        <table>
          <thead><tr><th>Organisation</th><th>Dirigeant</th><th>Statut</th><th>Soumise le</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.step1_organization?.name || '—'}</td>
                <td>{r.step2_leader?.fullName || '—'}</td>
                <td><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                <td className="text-secondary">{r.submitted_at ? new Date(r.submitted_at).toLocaleString('fr-FR') : '—'}</td>
                <td><Link to={`/admin/onboarding/${r.id}`}>Instruire</Link></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="5" className="text-secondary">Aucune demande.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
