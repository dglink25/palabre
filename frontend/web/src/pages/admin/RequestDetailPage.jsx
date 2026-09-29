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

// ── Composant régénération QR (demande déjà approuvée) ───────────────────────

function RegenQrSection({ orgId, requestId }) {
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState('');
  const [newQrData, setNewQrData] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (newQrData && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, newQrData, { width: 240, margin: 2 });
    }
  }, [newQrData]);

  async function regenerate() {
    setError(''); setBusy(true);
    try {
      const result = await api.post(`/org/tenants/${orgId}/regenerate-qr`);
      setNewQrData(JSON.stringify(result.qrPayload));
      setConfirmed(false);
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setBusy(false); }
  }

  function downloadQr() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `palabre-qr-regen-${orgId}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Code QR perdu ?</h3>
      <p className="text-secondary" style={{ fontSize: 14, marginBottom: 12 }}>
        Si l'administrateur a perdu le QR avant de configurer le tunnel, vous pouvez en
        regenerer un nouveau. L'ancien token sera revoque.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {!newQrData && (
        <>
          {!confirmed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setConfirmed(true)}
              >
                Regenerer un nouveau QR code
              </button>
            </div>
          ) : (
            <div>
              <Alert variant="warning">
                Cette action revoque l'ancien token VPN. Si le tunnel etait configure, il devra etre reconfigure.
              </Alert>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-danger" onClick={regenerate} disabled={busy}>
                  {busy ? <Spinner /> : 'Confirmer la regeneration'}
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmed(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {newQrData && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
          <div>
            <canvas ref={canvasRef} style={{ display: 'block', border: '1px solid var(--color-border)' }} />
            <button className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={downloadQr}>
              Telecharger le nouveau QR
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <Alert variant="success">
              Nouveau QR code genere. Transmettez-le a l'administrateur maintenant.
              Il ne sera plus accessible apres avoir quitte cette page.
            </Alert>
            <Alert variant="warning">
              L'ancien token VPN est revoque. Si le tunnel etait actif, l'agent tenant devra etre reconfigure.
            </Alert>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant QR code canvas ──────────────────────────────────────────────────

function QrCanvas({ data, canvasRef }) {
  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: 280, margin: 2,
        color: { dark: '#202124', light: '#FFFFFF' },
      });
    }
  }, [data, canvasRef]);
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
  const qrCanvasRef = useRef(null);

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
    if (!qrCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `palabre-qr-${id}.png`;
    link.href = qrCanvasRef.current.toDataURL('image/png');
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
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
            </svg>
            <h2 style={{ margin: 0 }}>Code QR de provisioning</h2>
          </div>
          <p className="text-secondary">
            Ce QR code ne sera plus jamais affiche apres avoir quitte cette page.
            Transmettez-le a l'administrateur de l'organisation maintenant.
          </p>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
            <div>
              {qrData && <QrCanvas data={qrData} canvasRef={qrCanvasRef} />}
              <button
                className="btn btn-secondary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={downloadQr}
              >
                Telecharger l'image PNG
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <p><strong>Organisation ID :</strong> {approval.organization.id}</p>
              <p><strong>Administrateur :</strong> {approval.adminUser.fullName}</p>
              <p><strong>E-mail :</strong> {approval.adminUser.email}</p>
              <p><strong>Telephone :</strong> {approval.adminUser.phone}</p>
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

          <button className="btn btn-success" onClick={approve} style={{ marginBottom: 24 }}>
            Approuver la demande
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 24px 0' }} />

          <h3 style={{ marginBottom: 12 }}>Rejeter avec motif</h3>
          <div className="field">
            <label>Motif obligatoire (transmis au demandeur par e-mail)</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Decrivez precisement les elements a corriger..." />
          </div>

          <p style={{ fontSize: 14, fontWeight: 'bold', margin: '4px 0 10px 0' }}>
            Champs a corriger (le demandeur ne pourra modifier que ces champs)
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
            Le code QR a deja ete transmis a l'administrateur.
          </p>
          {request.organization_id && (
            <>
              <p><strong>ID organisation :</strong> {request.organization_id}</p>
              <RegenQrSection orgId={request.organization_id} requestId={id} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
