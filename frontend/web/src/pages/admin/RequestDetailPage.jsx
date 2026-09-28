import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const FLAGGABLE_FIELDS = [
  'step1_organization.name', 'step1_organization.headquarters', 'step1_organization.country',
  'step1_organization.city', 'step1_organization.address', 'step1_organization.sector',
  'step2_leader.fullName', 'step2_leader.gender', 'step2_leader.email', 'step2_leader.phone',
  'step3_documents.rccm', 'step3_documents.ifuAttestation', 'step3_documents.leaderId', 'step3_documents.logo',
];

export default function RequestDetailPage() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [reason, setReason] = useState('');
  const [flagged, setFlagged] = useState([]);
  const [approval, setApproval] = useState(null); // { organization, adminUser, qrPayload } - affiché une seule fois

  async function load() {
    setLoading(true);
    try {
      setRequest(await api.get(`/onboarding/admin/requests/${id}`));
    } catch (e) { setError(friendlyMessage(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  function toggleFlag(field) {
    setFlagged((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
  }

  async function reject() {
    setError(''); setNotice('');
    try {
      await api.post(`/onboarding/admin/requests/${id}/reject`, { reason, flaggedFields: flagged });
      setNotice('Demande rejetée, le demandeur a été notifié par e-mail et WhatsApp.');
      setReason(''); setFlagged([]);
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function approve() {
    setError(''); setNotice('');
    try {
      const result = await api.post(`/onboarding/admin/requests/${id}/approve`, undefined);
      setApproval(result);
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  if (loading) return <Spinner />;
  if (!request) return <Alert variant="danger">{error}</Alert>;

  return (
    <div>
      <p><Link to="/admin/onboarding">&larr; Retour à la liste</Link></p>
      <h1>{request.step1_organization?.name || 'Demande'}</h1>
      <Badge variant="primary">{request.status}</Badge>
      <div className="spacer" />
      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {approval && (
        <div className="card">
          <h2>Organisation approuvée</h2>
          <p className="text-secondary">
            Les informations ci-dessous ne seront plus jamais affichées après avoir quitté cette page - le code
            d'activation a déjà été envoyé à l'administrateur par e-mail et WhatsApp.
          </p>
          <p><strong>Identifiant de l'organisation :</strong> {approval.organization.id}</p>
          <p><strong>Administrateur :</strong> {approval.adminUser.fullName} ({approval.adminUser.email}, {approval.adminUser.phone})</p>
          <div className="field">
            <label>Payload de démarrage (à encoder en QR pour l'administrateur)</label>
            <textarea rows={6} readOnly value={JSON.stringify(approval.qrPayload, null, 2)} />
          </div>
        </div>
      )}

      <div className="card">
        <h2>Organisation</h2>
        {Object.entries(request.step1_organization || {}).map(([k, v]) => <p key={k}><strong>{k} :</strong> {String(v)}</p>)}
      </div>
      <div className="card">
        <h2>Dirigeant</h2>
        {Object.entries(request.step2_leader || {}).map(([k, v]) => <p key={k}><strong>{k} :</strong> {String(v)}</p>)}
      </div>
      <div className="card">
        <h2>Documents</h2>
        {Object.entries(request.step3_documents || {}).map(([k, v]) => (
          <p key={k}><strong>{k} :</strong> <a href={v} target="_blank" rel="noreferrer">Voir le fichier</a></p>
        ))}
      </div>

      {request.status === 'submitted' && (
        <div className="card">
          <h2>Décision</h2>
          <button className="btn btn-success" onClick={approve} style={{ marginBottom: 20 }}>Approuver la demande</button>

          <h3>Ou rejeter avec motif</h3>
          <div className="field">
            <label>Motif (obligatoire, envoyé au demandeur)</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="field">
            <label>Champs à corriger</label>
            {FLAGGABLE_FIELDS.map((f) => (
              <label key={f} style={{ display: 'block', fontWeight: 'normal', marginBottom: 4 }}>
                <input type="checkbox" checked={flagged.includes(f)} onChange={() => toggleFlag(f)} /> {f}
              </label>
            ))}
          </div>
          <button className="btn btn-danger" onClick={reject}>Rejeter la demande</button>
        </div>
      )}
    </div>
  );
}
