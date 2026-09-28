import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      setSessions(await api.get('/sessions'));
    } catch (e) { setError(friendlyMessage(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function revoke(id) {
    setError(''); setNotice('');
    try {
      await api.delete(`/sessions/${id}`);
      setNotice('Session déconnectée.');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function revokeOthers() {
    setError(''); setNotice('');
    try {
      await api.delete('/sessions/others');
      setNotice('Tous les autres appareils ont été déconnectés.');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  return (
    <div>
      <h1>Sessions & appareils</h1>
      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>
      {loading ? <Spinner /> : (
        <div className="card">
          <table>
            <thead><tr><th>Appareil</th><th>Statut</th><th>Dernière activité</th><th /></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.platform || 'Appareil'} {s.model ? `— ${s.model}` : ''}
                    {s.isCurrent && <span> <Badge variant="primary">Cet appareil</Badge></span>}
                  </td>
                  <td>
                    {s.isOnline ? <Badge variant="success">En ligne</Badge> : <Badge variant="neutral">Hors ligne</Badge>}
                  </td>
                  <td className="text-secondary">{new Date(s.last_active_at).toLocaleString('fr-FR')}</td>
                  <td>
                    {!s.isCurrent && <button className="btn btn-danger" onClick={() => revoke(s.id)}>Déconnecter</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="spacer" />
          <button className="btn btn-secondary" onClick={revokeOthers}>Déconnecter tous les autres appareils</button>
        </div>
      )}
    </div>
  );
}
