import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// ── Mapping labels ────────────────────────────────────────────────────────────

const FLAGGABLE_FIELDS = [
  'step1_organization.name', 'step1_organization.headquarters', 'step1_organization.country',
  'step1_organization.city', 'step1_organization.address', 'step1_organization.sector',
  'step2_leader.fullName', 'step2_leader.gender', 'step2_leader.email', 'step2_leader.phone',
  'step3_documents.rccm', 'step3_documents.ifuAttestation', 'step3_documents.leaderId', 'step3_documents.logo',
];

const FIELD_LABELS = {
  'step1_organization.name': "Nom de l'organisation",
  'step1_organization.headquarters': 'Siege',
  'step1_organization.country': 'Pays',
  'step1_organization.city': 'Ville',
  'step1_organization.address': 'Adresse complete',
  'step1_organization.sector': "Secteur d'activite",
  'step1_organization.ifuNumber': 'Numero IFU',
  'step2_leader.fullName': 'Nom complet du dirigeant',
  'step2_leader.gender': 'Sexe',
  'step2_leader.email': 'E-mail du dirigeant',
  'step2_leader.phone': 'Telephone du dirigeant',
  'step3_documents.rccm': 'RCCM',
  'step3_documents.ifuAttestation': 'Attestation IFU',
  'step3_documents.leaderId': "Piece d'identite du dirigeant",
  'step3_documents.logo': "Logo de l'organisation",
};

const ORG_LABELS    = { name: "Nom de l'organisation", headquarters: 'Siege', country: 'Pays', city: 'Ville', address: 'Adresse', sector: "Secteur d'activite", ifuNumber: 'IFU', countryCode: 'Code pays' };
const LEADER_LABELS = { fullName: 'Nom complet', gender: 'Sexe', email: 'E-mail', phone: 'Telephone' };
const DOC_LABELS    = { rccm: 'RCCM', ifuAttestation: 'Attestation IFU', leaderId: "Piece d'identite", logo: 'Logo' };

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL   = { draft: 'Brouillon', submitted: 'Soumise', rejected: 'Rejetee', approved: 'Approuvee' };

const GENDER = { male: 'Masculin', female: 'Feminin' };

// ── Composant QR code canvas ──────────────────────────────────────────────────

function QrCanvas({ data }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: 280, margin: 2,
        color: { dark: '#202124', light: '#FFFFFF' },
      });
    }
  }, [data]);
  return <canvas ref={canvasRef} style={{ display: 'block', border: '1px solid var(--color-border)' }} />;
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const { id } = useParams();
  const [request,  setRequest]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');
  const [reason,   setReason]   = useState('');
  const [flagged,  setFlagged]  = useState([]);
  const [approval, setApproval] = useState(null);
  const [qrData,   setQrData]   = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      setRequest(await api.get(`/onboarding/admin/requests/${id}`));
    } catch (e) { setError(friendlyMessage(e)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  // Quand l'approbation est reçue, encoder le qrPayload en JSON pour le QR
  useEffect(() => {
    if (approval?.qrPayload) {
      setQrData(JSON.stringify(approval.qrPayload));
    }
  }, [approval]);

  function toggleFlag(field) {
    setFlagged((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
  }

  async function reject() {
    if (!reason.trim()) return;
    setError(''); setNotice('');
    try {
      await api.post(`/onboarding/admin/requests/${id}/reject`, { reason, flaggedFields: flagged });
      setNotice('Demande rejetee. Le demandeur a ete notifie par e-mail et WhatsApp.');
      setReason(''); setFlagged([]);
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function approve() {
    setError(''); setNotice('');
    try {
      const result = await api.post(`/onboarding/admin/requests/${id}/approve`, undefined);
      setApproval(result);
      setNotice('Organisation approuvee. Le code QR est disponible ci-dessous (etape 8).');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  function downloadQr() {
    const canvas = document.querySelector('#qr-canvas-el');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `palabre-qr-${id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (loading) return <Spinner />;
  if (!request && error) return <Alert variant="danger">{error}</Alert>;
  if (!request) return null;

  return (
    <div>
      <p><Link to="/admin/onboarding">&larr; Retour a la liste</Link></p>

      {/* En-tete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>{request.step1_organization?.name || 'Demande'}</h1>
        <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      </div>
      <p className="text-secondary" style={{ margin: '0 0 16px 0' }}>
        Soumise le {request.submitted_at ? new Date(request.submitted_at).toLocaleString('fr-FR') : 'N/A'}
        {request.reviewed_at && ` · Instruite le ${new Date(request.reviewed_at).toLocaleString('fr-FR')}`}
      </p>

      {error  && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* Motif de rejet affiché si applicable */}
      {request.status === 'rejected' && request.rejection_reason && (
        <Alert variant="warning">
          <strong>Motif du rejet :</strong> {request.rejection_reason}
        </Alert>
      )}

      {/* ── Etape 8 : QR code affiché après approbation ── */}
      {approval && (
        <div className="card" style={{ borderTop: '4px solid var(--color-success-green)' }}>
          <h2>Etape 8 : Code QR de provisioning</h2>
          <p className="text-secondary">
            Ce QR code ne sera plus jamais affiche apres avoir quitte cette page.
            Il contient le jeton de controle, la cle VPN WireGuard et l'URL de heartbeat.
            Transmettez-le a l'administrateur de l'organisation.
          </p>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                QR code (scannez avec l'app Palabre mobile)
              </p>
              {qrData && <QrCanvas data={qrData} id="qr-canvas-el" />}
              <button
                className="btn btn-secondary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={downloadQr}
              >
                Telecharger l'image PNG
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>Informations transmises</p>
              <p><strong>Organisation ID :</strong> {approval.organization.id}</p>
              <p><strong>Administrateur :</strong> {approval.adminUser.fullName}</p>
              <p><strong>E-mail :</strong> {approval.adminUser.email}</p>
              <p><strong>Telephone :</strong> {approval.adminUser.phone}</p>
              <div className="field" style={{ marginTop: 16 }}>
                <label>Payload JSON (reference, ne pas partager)</label>
                <textarea
                  rows={8}
                  readOnly
                  value={JSON.stringify(approval.qrPayload, null, 2)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dossier : Organisation ── */}
      <div className="card">
        <h2>Organisation</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(request.step1_organization || {}).map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', width: 200, fontSize: 14 }}>
                  {ORG_LABELS[k] || k}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 14 }}>
                  {k === 'gender' ? (GENDER[v] || v) : String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Dossier : Dirigeant ── */}
      <div className="card">
        <h2>Dirigeant</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(request.step2_leader || {}).map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', width: 200, fontSize: 14 }}>
                  {LEADER_LABELS[k] || k}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 14 }}>
                  {k === 'gender' ? (GENDER[v] || v) : String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Dossier : Documents ── */}
      <div className="card">
        <h2>Documents</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(request.step3_documents || {}).map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', width: 200, fontSize: 14 }}>
                  {DOC_LABELS[k] || k}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 14 }}>
                  <a href={v} target="_blank" rel="noreferrer">Voir le fichier</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Panel de decision (etapes 1-4) ── */}
      {request.status === 'submitted' && (
        <div className="card">
          <h2>Decision</h2>

          {/* Approuver — etapes 4-8 */}
          <button
            className="btn btn-success"
            onClick={approve}
            style={{ marginBottom: 24 }}
          >
            Approuver la demande (etapes 4-8)
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 24px 0' }} />

          {/* Rejeter — etape 2 */}
          <h3 style={{ marginBottom: 12 }}>Ou rejeter avec motif (etape 2)</h3>
          <div className="field">
            <label>Motif obligatoire (transmis au demandeur par e-mail)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Decrivez precisement les elements a corriger..."
            />
          </div>

          <p style={{ fontSize: 14, fontWeight: 'bold', margin: '4px 0 10px 0' }}>
            Champs a corriger (etape 3 : le demandeur ne pourra modifier que ces champs)
          </p>

          {[
            { group: 'Organisation', fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step1_')) },
            { group: 'Dirigeant',    fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step2_')) },
            { group: 'Documents',    fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step3_')) },
          ].map(({ group, fields }) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', margin: '0 0 6px 0' }}>
                {group}
              </p>
              <div style={{ border: '1px solid var(--color-border)', padding: '4px 12px' }}>
                {fields.map((f, idx) => (
                  <div
                    key={f}
                    onClick={() => toggleFlag(f)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                      borderBottom: idx < fields.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer', userSelect: 'none',
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
              {flagged.length} champ{flagged.length > 1 ? 's' : ''} selectionne{flagged.length > 1 ? 's' : ''}
            </p>
          )}

          <button
            className="btn btn-danger"
            onClick={reject}
            disabled={!reason.trim()}
          >
            Rejeter la demande
          </button>
        </div>
      )}

      {/* ── Historique pour demandes deja traitees ── */}
      {request.status === 'approved' && !approval && (
        <div className="card">
          <h2>Organisation approuvee</h2>
          <p className="text-secondary">
            Cette demande a ete approuvee le {new Date(request.reviewed_at).toLocaleString('fr-FR')}.
            Le code QR a deja ete transmis a l'administrateur. Il n'est plus accessible ici.
          </p>
          {request.organization_id && (
            <p><strong>ID organisation :</strong> {request.organization_id}</p>
          )}
        </div>
      )}
    </div>
  );
}
