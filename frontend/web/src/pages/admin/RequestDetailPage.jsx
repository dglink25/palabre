import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
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
  'step1_organization.name': "Nom de l'organisation",
  'step1_organization.headquarters': 'Siège',
  'step1_organization.country': 'Pays',
  'step1_organization.city': 'Ville',
  'step1_organization.address': 'Adresse complète',
  'step1_organization.sector': "Secteur d'activité",
  'step1_organization.ifuNumber': 'Numéro IFU',
  'step2_leader.fullName': 'Nom complet du dirigeant',
  'step2_leader.gender': 'Sexe',
  'step2_leader.email': 'E-mail du dirigeant',
  'step2_leader.phone': 'Téléphone du dirigeant',
  'step3_documents.rccm': 'RCCM',
  'step3_documents.ifuAttestation': 'Attestation IFU',
  'step3_documents.leaderId': "Pièce d'identité du dirigeant",
  'step3_documents.logo': "Logo de l'organisation",
};

const ORG_LABELS    = { name: "Nom de l'organisation", headquarters: 'Siège', country: 'Pays', city: 'Ville', address: 'Adresse', sector: "Secteur d'activité", ifuNumber: 'IFU', countryCode: 'Code pays' };
const LEADER_LABELS = { fullName: 'Nom complet', gender: 'Sexe', email: 'E-mail', phone: 'Téléphone' };
const DOC_LABELS    = { rccm: 'RCCM', ifuAttestation: 'Attestation IFU', leaderId: "Pièce d'identité", logo: 'Logo' };

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL   = { draft: 'Brouillon', submitted: 'Soumise', rejected: 'Rejetée', approved: 'Approuvée' };

const GENDER = { male: 'Masculin', female: 'Féminin' };

// Section heading component
function SectionHeading({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #F8F9FA' }}>
      <span style={{ color: '#1A73E8' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#202124' }}>{children}</h2>
    </div>
  );
}

// Info row in table
function InfoRow({ label, value, isLink }) {
  return (
    <tr style={{ transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#F8F9FA'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '11px 16px', color: '#5F6368', width: 200, fontSize: 14, borderBottom: '1px solid #E0E0E0' }}>
        {label}
      </td>
      <td style={{ padding: '11px 16px', fontSize: 14, color: '#202124', borderBottom: '1px solid #E0E0E0' }}>
        {isLink && value
          ? <a href={value} target="_blank" rel="noreferrer" style={{ color: '#1A73E8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Voir le fichier
            </a>
          : String(value ?? '—')
        }
      </td>
    </tr>
  );
}

// ── Send guide button ───────────────────────────────────────────────────────

function SendGuideButton({ request }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const email = request?.step2_leader?.email;
  const phone = request?.step2_leader?.phone;
  const orgName = request?.step1_organization?.name || 'l\'organisation';

  async function send() {
    setBusy(true); setError(''); setSent(false);
    try {
      await api.post(`/onboarding/admin/requests/${request.id}/send-guide`);
      setSent(true);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: 'rgba(26,115,232,0.04)', border: '1px solid rgba(26,115,232,0.18)', borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#202124' }}>Guide d'installation</div>
      <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#5F6368', lineHeight: 1.6 }}>
        Envoyez le guide d'installation à l'administrateur de {orgName}.
        {email && <span> E-mail : <strong>{email}</strong></span>}
        {phone && <span> · WhatsApp : <strong>{phone}</strong></span>}
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      {sent && <Alert variant="success">Guide envoyé avec succès par e-mail{phone ? ' et WhatsApp' : ''}.</Alert>}
      <button
        className="btn btn-sm"
        onClick={send}
        disabled={busy || sent}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
        </svg>
        {sent ? 'Guide envoyé' : busy ? 'Envoi...' : 'Envoyer le guide d\'installation'}
      </button>
    </div>
  );
}

// ── QR regen section ─────────────────────────────────────────────────────────

function RegenQrSection({ orgId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newQrData, setNewQrData] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (newQrData && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, newQrData, { width: 220, margin: 2 });
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
    <div style={{ marginTop: 20, borderTop: '1px solid #E0E0E0', paddingTop: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#202124' }}>Code QR perdu ?</h3>
      <p style={{ fontSize: 13, color: '#5F6368', marginBottom: 12, lineHeight: 1.6 }}>
        Si l'administrateur a perdu le QR avant de configurer le tunnel, vous pouvez en régénérer un nouveau. L'ancien token sera révoqué.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {!newQrData && (
        <>
          {!confirmed ? (
            <button className="btn btn-sm btn-secondary" onClick={() => setConfirmed(true)}>
              Régénérer un nouveau QR code
            </button>
          ) : (
            <div>
              <Alert variant="warning">
                Cette action révoque l'ancien token VPN. Si le tunnel était configuré, il devra être reconfiguré.
              </Alert>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-danger btn-sm" onClick={regenerate} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {busy ? <Spinner /> : 'Confirmer la régénération'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmed(false)}>Annuler</button>
              </div>
            </div>
          )}
        </>
      )}

      {newQrData && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
          <div>
            <canvas ref={canvasRef} style={{ display: 'block', border: '1px solid #E0E0E0', borderRadius: 8 }} />
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={downloadQr}>
              Télécharger le nouveau QR
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <Alert variant="success">Nouveau QR code généré. Transmettez-le à l'administrateur maintenant.</Alert>
            <Alert variant="warning">L'ancien token VPN est révoqué. Si le tunnel était actif, l'agent tenant devra être reconfiguré.</Alert>
          </div>
        </div>
      )}
    </div>
  );
}

// ── QR canvas ─────────────────────────────────────────────────────────────────

function QrCanvas({ data, canvasRef }) {
  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, { width: 260, margin: 2, color: { dark: '#202124', light: '#FFFFFF' } });
    }
  }, [data, canvasRef]);
  return <canvas ref={canvasRef} style={{ display: 'block', border: '1px solid #E0E0E0', borderRadius: 8 }} />;
}

// ── Main page ────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (approval?.qrPayload) setQrData(JSON.stringify(approval.qrPayload));
  }, [approval]);

  function toggleFlag(field) {
    setFlagged((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
  }

  async function reject() {
    if (!reason.trim()) return;
    setError(''); setNotice('');
    try {
      await api.post(`/onboarding/admin/requests/${id}/reject`, { reason, flaggedFields: flagged });
      setNotice('Demande rejetée. Le demandeur a été notifié par e-mail et WhatsApp.');
      setReason(''); setFlagged([]);
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function approve() {
    setError(''); setNotice('');
    try {
      const result = await api.post(`/onboarding/admin/requests/${id}/approve`, undefined);
      setApproval(result);
      setNotice('Organisation approuvée. Le code QR est disponible ci-dessous.');
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>;
  if (!request && error) return <Alert variant="danger">{error}</Alert>;
  if (!request) return null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          to="/admin/onboarding"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#5F6368', textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour à la liste
        </Link>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#202124' }}>
              {request.step1_organization?.name || 'Demande sans nom'}
            </h1>
            <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5F6368' }}>
            Soumise le {request.submitted_at ? new Date(request.submitted_at).toLocaleString('fr-FR') : 'N/A'}
            {request.reviewed_at && ` · Instruite le ${new Date(request.reviewed_at).toLocaleString('fr-FR')}`}
          </p>
        </div>
      </div>

      {error  && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {request.status === 'rejected' && request.rejection_reason && (
        <Alert variant="warning">
          <strong>Motif du rejet :</strong> {request.rejection_reason}
        </Alert>
      )}

      {/* QR code after approval */}
      {approval && (
        <div className="card" style={{ borderLeft: '4px solid #34A853', padding: '20px 24px' }}>
          <SectionHeading
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          >
            Code QR de provisioning
          </SectionHeading>
          <p style={{ fontSize: 14, color: '#5F6368', marginBottom: 20, lineHeight: 1.6 }}>
            Ce QR code ne sera plus jamais affiché après avoir quitté cette page. Transmettez-le à l'administrateur maintenant.
          </p>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              {qrData && <QrCanvas data={qrData} canvasRef={qrCanvasRef} />}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={downloadQr}>
                Télécharger PNG
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Organisation ID', approval.organization.id],
                  ['Administrateur', approval.adminUser.fullName],
                  ['E-mail', approval.adminUser.email],
                  ['Téléphone', approval.adminUser.phone],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                    <span style={{ color: '#5F6368', minWidth: 120 }}>{label} :</span>
                    <strong style={{ color: '#202124', wordBreak: 'break-all' }}>{val}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organisation */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <SectionHeading
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>}
        >
          Organisation
        </SectionHeading>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(request.step1_organization || {}).map(([k, v]) => (
              <InfoRow key={k} label={ORG_LABELS[k] || k} value={k === 'gender' ? (GENDER[v] || v) : v} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Dirigeant */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <SectionHeading
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        >
          Dirigeant
        </SectionHeading>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(request.step2_leader || {}).map(([k, v]) => (
              <InfoRow key={k} label={LEADER_LABELS[k] || k} value={k === 'gender' ? (GENDER[v] || v) : v} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <SectionHeading
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        >
          Documents
        </SectionHeading>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(request.step3_documents || {}).map(([k, v]) => (
              <InfoRow key={k} label={DOC_LABELS[k] || k} value={v} isLink />
            ))}
          </tbody>
        </table>
      </div>

      {/* Decision panel */}
      {request.status === 'submitted' && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <SectionHeading
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          >
            Décision
          </SectionHeading>

          {/* Approve */}
          <div style={{ marginBottom: 24, padding: '16px', background: 'rgba(52,168,83,0.05)', border: '1px solid rgba(52,168,83,0.2)', borderRadius: 8 }}>
            <p style={{ fontSize: 14, color: '#5F6368', marginBottom: 12, margin: '0 0 12px 0', lineHeight: 1.5 }}>
              Approuver génère le code QR de provisioning pour cette organisation.
            </p>
            <button
              className="btn btn-success"
              onClick={approve}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Approuver la demande
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #E0E0E0', margin: '0 0 20px 0' }} />

          {/* Reject */}
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px 0', color: '#202124' }}>Rejeter avec motif</h3>
          <div className="field">
            <label>Motif obligatoire (transmis au demandeur par e-mail)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrivez précisément les éléments à corriger..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <p style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 10px 0', color: '#202124' }}>
            Champs à corriger (le demandeur ne pourra modifier que ces champs)
          </p>

          {[
            { group: 'Organisation', fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step1_')) },
            { group: 'Dirigeant',    fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step2_')) },
            { group: 'Documents',    fields: FLAGGABLE_FIELDS.filter((f) => f.startsWith('step3_')) },
          ].map(({ group, fields }) => (
            <div key={group} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#5F6368', margin: '0 0 6px 0', fontWeight: 700 }}>
                {group}
              </p>
              <div style={{ border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
                {fields.map((f, idx) => (
                  <div
                    key={f}
                    onClick={() => toggleFlag(f)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: idx < fields.length - 1 ? '1px solid #E0E0E0' : 'none',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: flagged.includes(f) ? 'rgba(234,67,53,0.04)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={flagged.includes(f)}
                      onChange={() => toggleFlag(f)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 16, height: 16, margin: 0, flexShrink: 0, cursor: 'pointer', accentColor: '#EA4335' }}
                    />
                    <span style={{ fontSize: 14, color: flagged.includes(f) ? '#EA4335' : '#202124', fontWeight: flagged.includes(f) ? 600 : 400 }}>
                      {FIELD_LABELS[f] || f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {flagged.length > 0 && (
            <p style={{ fontSize: 13, color: '#EA4335', marginBottom: 16, fontWeight: 600 }}>
              {flagged.length} champ{flagged.length > 1 ? 's' : ''} sélectionné{flagged.length > 1 ? 's' : ''}
            </p>
          )}

          <button
            className="btn btn-danger"
            onClick={reject}
            disabled={!reason.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Rejeter la demande
          </button>
        </div>
      )}

      {/* Approved — history */}
      {request.status === 'approved' && !approval && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <SectionHeading
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          >
            Organisation approuvée
          </SectionHeading>
          <p style={{ fontSize: 14, color: '#5F6368', lineHeight: 1.6, marginBottom: 16 }}>
            Cette demande a été approuvée le {new Date(request.reviewed_at).toLocaleString('fr-FR')}.
            Le code QR a déjà été transmis à l'administrateur lors de l'approbation.
          </p>
          {request.organization_id && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '10px 14px', background: '#F8F9FA', borderRadius: 6, fontSize: 14 }}>
                <span style={{ color: '#5F6368' }}>ID organisation :</span>
                <code style={{ background: '#fff', border: '1px solid #E0E0E0', padding: '2px 8px', borderRadius: 4, fontSize: 13, color: '#202124' }}>
                  {request.organization_id}
                </code>
              </div>
              <SendGuideButton request={request} />
              <RegenQrSection orgId={request.organization_id} requestId={id} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
