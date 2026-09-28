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

const FIELD_LABELS = {
  'step1_organization.name': 'Nom de l\'organisation',
  'step1_organization.headquarters': 'Siège',
  'step1_organization.country': 'Pays',
  'step1_organization.city': 'Ville',
  'step1_organization.address': 'Adresse complète',
  'step1_organization.sector': 'Secteur d\'activité',
  'step1_organization.ifuNumber': 'Numéro IFU',
  'step2_leader.fullName': 'Nom complet du dirigeant',
  'step2_leader.gender': 'Sexe',
  'step2_leader.email': 'E-mail du dirigeant',
  'step2_leader.phone': 'Téléphone du dirigeant',
  'step3_documents.rccm': 'RCCM',
  'step3_documents.ifuAttestation': 'Attestation IFU',
  'step3_documents.leaderId': 'Pièce d\'identité du dirigeant',
  'step3_documents.logo': 'Logo de l\'organisation',
};

const ORG_FIELD_LABELS = {
  name: 'Nom de l\'organisation',
  headquarters: 'Siège',
  country: 'Pays',
  city: 'Ville',
  address: 'Adresse complète',
  sector: 'Secteur d\'activité',
  ifuNumber: 'Numéro IFU',
  countryCode: 'Code pays',
};

const LEADER_FIELD_LABELS = {
  fullName: 'Nom complet du dirigeant',
  gender: 'Sexe',
  email: 'E-mail',
  phone: 'Téléphone',
};

const DOC_FIELD_LABELS = {
  rccm: 'RCCM',
  ifuAttestation: 'Attestation IFU',
  leaderId: 'Pièce d\'identité du dirigeant',
  logo: 'Logo de l\'organisation',
};

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
        {Object.entries(request.step1_organization || {}).map(([k, v]) => <p key={k}><strong>{ORG_FIELD_LABELS[k] || k} :</strong> {String(v)}</p>)}
      </div>
      <div className="card">
        <h2>Dirigeant</h2>
        {Object.entries(request.step2_leader || {}).map(([k, v]) => <p key={k}><strong>{LEADER_FIELD_LABELS[k] || k} :</strong> {String(v)}</p>)}
      </div>
      <div className="card">
        <h2>Documents</h2>
        {Object.entries(request.step3_documents || {}).map(([k, v]) => (
          <p key={k}><strong>{DOC_FIELD_LABELS[k] || k} :</strong> <a href={v} target="_blank" rel="noreferrer">Voir le fichier</a></p>
        ))}
      </div>

      {request.status === 'submitted' && (
        <div className="card">
          <h2>Décision</h2>
          <button className="btn btn-success" onClick={approve} style={{ marginBottom: 24 }}>Approuver la demande</button>

          <h3 style={{ marginBottom: 12 }}>Ou rejeter avec motif</h3>
          <div className="field">
            <label>Motif (obligatoire, envoyé au demandeur)</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <p style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10, marginTop: 4 }}>Champs à corriger</p>

          {[
            {
              group: 'Organisation',
              fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step1_')),
            },
            {
              group: 'Dirigeant',
              fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step2_')),
            },
            {
              group: 'Documents',
              fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step3_')),
            },
          ].map(({ group, fields }) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', margin: '0 0 6px 0' }}>{group}</p>
              <div style={{ border: '1px solid var(--color-border)', padding: '4px 12px' }}>
                {fields.map((f) => (
                  <div
                    key={f}
                    onClick={() => toggleFlag(f)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 0',
                      borderBottom: fields.indexOf(f) < fields.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={flagged.includes(f)}
                      onChange={() => toggleFlag(f)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 16, height: 16, margin: 0, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--color-alert-red)' }}
                    />
                    <span style={{ fontSize: 14, color: flagged.includes(f) ? 'var(--color-alert-red)' : 'var(--color-text-primary)' }}>
                      {FIELD_LABELS[f] || f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {flagged.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-alert-red)', marginBottom: 16 }}>
              {flagged.length} champ{flagged.length > 1 ? 's' : ''} sélectionné{flagged.length > 1 ? 's' : ''}
            </p>
          )}

          <button className="btn btn-danger" onClick={reject} disabled={!reason.trim()}>Rejeter la demande</button>
        </div>
      )}
    </div>
  );
}
