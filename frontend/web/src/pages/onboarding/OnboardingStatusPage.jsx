import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import AuthLayout from '../../components/AuthLayout';
import CountrySelect from '../../components/CountrySelect';
import PhoneInput from '../../components/PhoneInput';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL = { draft: 'Brouillon', submitted: 'Soumise — en instruction', rejected: 'À corriger', approved: 'Approuvée' };

const STATUS_COLORS = {
  draft:     { bg: '#F8F9FA', border: '#E0E0E0', dot: '#5F6368' },
  submitted: { bg: 'rgba(26,115,232,0.06)', border: 'rgba(26,115,232,0.25)', dot: '#1A73E8' },
  rejected:  { bg: 'rgba(251,188,5,0.08)', border: 'rgba(251,188,5,0.35)', dot: '#FBBC05' },
  approved:  { bg: 'rgba(52,168,83,0.06)', border: 'rgba(52,168,83,0.25)', dot: '#34A853' },
};

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

const GENDER_LABEL = { male: 'Masculin', female: 'Féminin' };

function getCurrentValue(request, fullPath) {
  const [col, field] = fullPath.split('.');
  const step = request[col] || {};
  return step[field];
}

// ── EditableField défini HORS du composant pour éviter les remontages ─────────
function EditableField({ fullPath, request, corrections, onFieldChange, onDocUpload, orgCountryCode }) {
  const [, field] = fullPath.split('.');
  const label = FIELD_LABELS[fullPath] || fullPath;
  const currentVal = getCurrentValue(request, fullPath);
  const isDoc = fullPath.startsWith('step3_documents.');

  const stepKeyMap = { step1_organization: 'step1', step2_leader: 'step2', step3_documents: 'step3', step4_certification: 'step4' };
  const getValue = () => {
    const [col, f] = fullPath.split('.');
    const sk = stepKeyMap[col];
    return (corrections[sk] || {})[f] || '';
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EA4335', flexShrink: 0, display: 'inline-block' }} />
        <label style={{ fontWeight: 600, fontSize: 13, color: '#EA4335', margin: 0 }}>{label}</label>
      </div>
      {currentVal && !isDoc && (
        <div style={{ fontSize: 12, color: '#5F6368', marginBottom: 6, padding: '6px 10px', background: '#fff5f5', border: '1px solid #fcd3d0', borderRadius: 6 }}>
          Valeur actuelle : <strong style={{ color: '#EA4335' }}>
            {field === 'gender' ? (GENDER_LABEL[currentVal] || currentVal) : String(currentVal)}
          </strong>
        </div>
      )}
      {currentVal && isDoc && (
        <div style={{ fontSize: 12, color: '#5F6368', marginBottom: 6, padding: '6px 10px', background: '#fff5f5', border: '1px solid #fcd3d0', borderRadius: 6 }}>
          Fichier actuel :{' '}
          <a href={currentVal} target="_blank" rel="noreferrer" style={{ color: '#EA4335' }}>Voir le fichier existant</a>
        </div>
      )}
      {isDoc ? (
        <input type="file"
          style={{ width: '100%', padding: '10px 12px', border: '2px solid #EA4335', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}
          onChange={(e) => e.target.files[0] && onDocUpload(fullPath, e.target.files[0])}
        />
      ) : field === 'gender' ? (
        <select value={getValue()} onChange={(e) => onFieldChange(fullPath, e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '2px solid #EA4335', borderRadius: 8, fontSize: 14, background: '#fff', color: '#202124' }}>
          <option value="">— Choisir —</option>
          <option value="male">Masculin</option>
          <option value="female">Féminin</option>
        </select>
      ) : field === 'country' ? (
        <div style={{ border: '2px solid #EA4335', borderRadius: 8, overflow: 'hidden' }}>
          <CountrySelect value={getValue()} onChange={(c) => onFieldChange(fullPath, c.name)} />
        </div>
      ) : field === 'phone' ? (
        <div style={{ border: '2px solid #EA4335', borderRadius: 8, overflow: 'hidden' }}>
          <PhoneInput defaultCountryCode={orgCountryCode || 'BJ'} defaultValue={getValue()} onChange={(v) => onFieldChange(fullPath, v.e164)} />
        </div>
      ) : (
        <input type={field === 'email' ? 'email' : 'text'}
          value={getValue()} onChange={(e) => onFieldChange(fullPath, e.target.value)}
          placeholder={label}
          style={{ width: '100%', padding: '10px 12px', border: '2px solid #EA4335', borderRadius: 8, fontSize: 14, background: '#fff', color: '#202124', boxSizing: 'border-box' }}
        />
      )}
    </div>
  );
}

function ReadOnlyRow({ label, value }) {
  const display = value === undefined || value === null || value === ''
    ? <span style={{ color: '#bbb', fontStyle: 'italic', fontSize: 13 }}>Non renseigné</span>
    : <span style={{ fontSize: 14, color: '#202124' }}>{String(value)}</span>;
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '9px 0',
      borderBottom: '1px solid #E0E0E0',
      gap: 16,
    }}>
      <span style={{ fontSize: 13, color: '#5F6368', flexShrink: 0, minWidth: 180 }}>{label}</span>
      {display}
    </div>
  );
}

function ReadOnlyDoc({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 0',
      borderBottom: '1px solid #E0E0E0',
      gap: 16,
    }}>
      <span style={{ fontSize: 13, color: '#5F6368', flexShrink: 0, minWidth: 180 }}>{label}</span>
      {value
        ? (
          <a href={value} target="_blank" rel="noreferrer" style={{
            fontSize: 13,
            color: '#1A73E8',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Voir le fichier
          </a>
        )
        : <span style={{ color: '#bbb', fontStyle: 'italic', fontSize: 13 }}>Non fourni</span>}
    </div>
  );
}

export default function OnboardingStatusPage() {
  const [params] = useSearchParams();
  const requestId = params.get('id');

  const urlToken = params.get('token');
  if (requestId && urlToken) {
    localStorage.setItem('palabre_onboarding_draft_' + requestId, urlToken);
  }
  const draftToken = requestId ? (urlToken || localStorage.getItem('palabre_onboarding_draft_' + requestId)) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [request, setRequest] = useState(null);
  const [corrections, setCorrections] = useState({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/onboarding/requests/${requestId}`, { auth: false, headers: { 'X-Draft-Token': draftToken } });
      setRequest(data);
      if (data.flagged_fields && data.flagged_fields.length > 0) {
        const init = {};
        data.flagged_fields.forEach((path) => {
          const [col, field] = path.split('.');
          const stepKey = { step1_organization: 'step1', step2_leader: 'step2', step3_documents: 'step3', step4_certification: 'step4' }[col];
          if (stepKey) {
            if (!init[stepKey]) init[stepKey] = {};
            const existing = (data[col] || {})[field];
            if (existing !== undefined) init[stepKey][field] = existing;
          }
        });
        setCorrections(init);
      }
    } catch (e) { setError(friendlyMessage(e)); } finally { setLoading(false); }
  }

  useEffect(() => { if (requestId && draftToken) load(); }, [requestId, draftToken]);

  function setFieldCorrection(fullPath, value) {
    const [col, field] = fullPath.split('.');
    const stepKey = { step1_organization: 'step1', step2_leader: 'step2', step3_documents: 'step3', step4_certification: 'step4' }[col];
    setCorrections((prev) => ({ ...prev, [stepKey]: { ...(prev[stepKey] || {}), [field]: value } }));
  }

  function getCorrectionValue(fullPath) {
    const [col, field] = fullPath.split('.');
    const stepKey = { step1_organization: 'step1', step2_leader: 'step2', step3_documents: 'step3', step4_certification: 'step4' }[col];
    return (corrections[stepKey] || {})[field] || '';
  }

  async function uploadCorrectionDoc(fullPath, file) {
    setError('');
    const [, docType] = fullPath.split('.');
    const form = new FormData();
    form.append('type', docType);
    form.append('file', file);
    try {
      await api.upload(`/onboarding/requests/${requestId}/documents`, form, { auth: false, headers: { 'X-Draft-Token': draftToken } });
      setNotice('Document mis à jour.');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function submitCorrection() {
    setError(''); setNotice('');
    try {
      await api.patch(`/onboarding/requests/${requestId}/correct`, corrections, { auth: false, headers: { 'X-Draft-Token': draftToken } });
      setNotice('Corrections envoyées, demande re-soumise.');
      setCorrections({});
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  if (!requestId || !draftToken) {
    return (
      <AuthLayout>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0' }}>Suivi de demande</h1>
        </div>
        <Alert variant="warning">
          Lien invalide, ou le jeton d'accès n'est pas enregistré sur cet appareil. Utilisez le lien reçu
          par e-mail ou WhatsApp lors de la soumission de votre demande.
        </Alert>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
          <Link to="/onboarding/new" style={{ color: '#1A73E8', fontSize: 14 }}>Créer une demande</Link>
          <Link to="/login" style={{ color: '#5F6368', fontSize: 14 }}>Se connecter</Link>
        </div>
      </AuthLayout>
    );
  }

  if (loading) return <AuthLayout><div style={{ textAlign: 'center', padding: 32 }}><Spinner /></div></AuthLayout>;
  if (!request) return <AuthLayout><Alert variant="danger">{error}</Alert></AuthLayout>;

  const flaggedSet = new Set(request.flagged_fields || []);
  const org = request.step1_organization || {};
  const leader = request.step2_leader || {};
  const docs = request.step3_documents || {};
  const statusColors = STATUS_COLORS[request.status] || STATUS_COLORS.draft;

  // Props partagées pour EditableField
  const efProps = { request, corrections, onFieldChange: setFieldCorrection, onDocUpload: uploadCorrectionDoc, orgCountryCode: org.countryCode };

  return (
    <AuthLayout cardWidth={600}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/" style={{ fontSize: 13, color: '#5F6368', textDecoration: 'none' }}>Accueil</Link>
        <span style={{ color: '#E0E0E0' }}>/</span>
        <Link to="/login" style={{ fontSize: 13, color: '#5F6368', textDecoration: 'none' }}>Se connecter</Link>
      </div>

      {/* Header with status */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px 0', color: '#202124' }}>
          Suivi de votre demande
        </h1>

        {/* Status banner */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: statusColors.bg,
          border: `1px solid ${statusColors.border}`,
          borderRadius: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>
            {STATUS_LABEL[request.status] || request.status}
          </span>
        </div>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {/* STATUT : À CORRIGER */}
      {request.status === 'rejected' && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          <Alert variant="warning">
            <strong>Motif du rejet :</strong> {request.rejection_reason}
          </Alert>

          <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
              Organisation
            </h3>
            {flaggedSet.has('step1_organization.name') ? <EditableField fullPath="step1_organization.name" {...efProps} /> : <ReadOnlyRow label="Nom" value={org.name} />}
            {flaggedSet.has('step1_organization.headquarters') ? <EditableField fullPath="step1_organization.headquarters" {...efProps} /> : <ReadOnlyRow label="Siège" value={org.headquarters} />}
            {flaggedSet.has('step1_organization.country') ? <EditableField fullPath="step1_organization.country" {...efProps} /> : <ReadOnlyRow label="Pays" value={org.country} />}
            {flaggedSet.has('step1_organization.city') ? <EditableField fullPath="step1_organization.city" {...efProps} /> : <ReadOnlyRow label="Ville" value={org.city} />}
            {flaggedSet.has('step1_organization.address') ? <EditableField fullPath="step1_organization.address" {...efProps} /> : <ReadOnlyRow label="Adresse complète" value={org.address} />}
            {flaggedSet.has('step1_organization.sector') ? <EditableField fullPath="step1_organization.sector" {...efProps} /> : <ReadOnlyRow label="Secteur d'activité" value={org.sector} />}
            {flaggedSet.has('step1_organization.ifuNumber') ? <EditableField fullPath="step1_organization.ifuNumber" {...efProps} /> : <ReadOnlyRow label="Numéro IFU" value={org.ifuNumber || '—'} />}
          </div>

          <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Dirigeant
            </h3>
            {flaggedSet.has('step2_leader.fullName') ? <EditableField fullPath="step2_leader.fullName" {...efProps} /> : <ReadOnlyRow label="Nom complet" value={leader.fullName} />}
            {flaggedSet.has('step2_leader.gender') ? <EditableField fullPath="step2_leader.gender" {...efProps} /> : <ReadOnlyRow label="Sexe" value={GENDER_LABEL[leader.gender]} />}
            {flaggedSet.has('step2_leader.email') ? <EditableField fullPath="step2_leader.email" {...efProps} /> : <ReadOnlyRow label="E-mail" value={leader.email} />}
            {flaggedSet.has('step2_leader.phone') ? <EditableField fullPath="step2_leader.phone" {...efProps} /> : <ReadOnlyRow label="Téléphone" value={leader.phone} />}
          </div>

          <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Documents
            </h3>
            {flaggedSet.has('step3_documents.rccm') ? <EditableField fullPath="step3_documents.rccm" {...efProps} /> : <ReadOnlyDoc label="RCCM (facultatif)" value={docs.rccm} />}
            {flaggedSet.has('step3_documents.ifuAttestation') ? <EditableField fullPath="step3_documents.ifuAttestation" {...efProps} /> : <ReadOnlyDoc label="Attestation IFU" value={docs.ifuAttestation} />}
            {flaggedSet.has('step3_documents.leaderId') ? <EditableField fullPath="step3_documents.leaderId" {...efProps} /> : <ReadOnlyDoc label="Pièce d'identité du dirigeant" value={docs.leaderId} />}
            {flaggedSet.has('step3_documents.logo') ? <EditableField fullPath="step3_documents.logo" {...efProps} /> : <ReadOnlyDoc label="Logo de l'organisation" value={docs.logo} />}
          </div>

          <button className="btn btn-success btn-block" onClick={submitCorrection} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
            Soumettre les corrections
          </button>
        </div>
      )}

      {/* STATUT : APPROUVÉE */}
      {request.status === 'approved' && (
        <div style={{
          padding: '20px 24px',
          background: 'rgba(52,168,83,0.06)',
          border: '1px solid rgba(52,168,83,0.25)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <strong style={{ fontSize: 16, color: '#202124' }}>Organisation approuvée</strong>
          </div>
          <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 16px 0', lineHeight: 1.6 }}>
            L'administrateur désigné a reçu son code d'activation par e-mail et WhatsApp.
          </p>
          <Link to="/activate" className="btn btn-success" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Activer le compte administrateur
          </Link>
        </div>
      )}

      {/* STATUT : EN INSTRUCTION */}
      {request.status === 'submitted' && (
        <div style={{
          padding: '20px 24px',
          background: 'rgba(26,115,232,0.05)',
          border: '1px solid rgba(26,115,232,0.2)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <strong style={{ fontSize: 15, color: '#202124' }}>Demande en cours d'instruction</strong>
          </div>
          <p style={{ fontSize: 14, color: '#5F6368', margin: 0, lineHeight: 1.6 }}>
            Votre demande est examinée par le super-administrateur. Vous serez notifié par e-mail et WhatsApp.
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
