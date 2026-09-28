import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import AuthLayout from '../../components/AuthLayout';
import CountrySelect from '../../components/CountrySelect';
import PhoneInput from '../../components/PhoneInput';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL = { draft: 'Brouillon', submitted: 'Soumise - en instruction', rejected: 'A corriger', approved: 'Approuvee' };

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

const GENDER_LABEL = { male: 'Masculin', female: 'Feminin' };

// Retourne la valeur actuelle d'un champ a partir de request
function getCurrentValue(request, fullPath) {
  const [col, field] = fullPath.split('.');
  const step = request[col] || {};
  return step[field];
}

// Rendu d'une ligne en lecture seule
function ReadOnlyRow({ label, value }) {
  const display = value === undefined || value === null || value === ''
    ? <span style={{ color: '#aaa', fontStyle: 'italic' }}>Non renseigne</span>
    : <span>{String(value)}</span>;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--color-border)', gap: 16 }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0, minWidth: 180 }}>{label}</span>
      {display}
    </div>
  );
}

// Rendu d'un champ document en lecture seule
function ReadOnlyDoc({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border)', gap: 16 }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0, minWidth: 180 }}>{label}</span>
      {value
        ? <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Voir le fichier</a>
        : <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: 13 }}>Non fourni</span>}
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
      // Pre-remplir les corrections avec les valeurs existantes des champs flagges
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
      setNotice('Document mis a jour.');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function submitCorrection() {
    setError(''); setNotice('');
    try {
      await api.patch(`/onboarding/requests/${requestId}/correct`, corrections, { auth: false, headers: { 'X-Draft-Token': draftToken } });
      setNotice('Corrections envoyees, demande re-soumise.');
      setCorrections({});
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  if (!requestId || !draftToken) {
    return (
      <AuthLayout>
        <h1>Suivi de demande</h1>
        <Alert variant="warning">
          Lien invalide, ou le jeton d'acces n'est pas enregistre sur cet appareil. Utilisez le lien recu
          par e-mail ou WhatsApp lors de la soumission de votre demande.
        </Alert>
        <div className="spacer" />
        <p className="text-secondary">Pas encore de demande ? <Link to="/onboarding/new">En creer une</Link>.</p>
        <p className="text-secondary">Deja un compte ? <Link to="/login">Se connecter</Link>.</p>
      </AuthLayout>
    );
  }
  if (loading) return <AuthLayout><Spinner /></AuthLayout>;
  if (!request) return <AuthLayout><Alert variant="danger">{error}</Alert></AuthLayout>;

  const flaggedSet = new Set(request.flagged_fields || []);
  const org = request.step1_organization || {};
  const leader = request.step2_leader || {};
  const docs = request.step3_documents || {};

  // Rendu d'un champ editable (flagge) dans le formulaire de correction
  function EditableField({ fullPath }) {
    const [, field] = fullPath.split('.');
    const label = FIELD_LABELS[fullPath] || fullPath;
    const currentVal = getCurrentValue(request, fullPath);
    const isDoc = fullPath.startsWith('step3_documents.');

    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-alert-red)', flexShrink: 0, display: 'inline-block' }} />
          <label style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--color-alert-red)' }}>{label}</label>
        </div>
        {currentVal && !isDoc && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6, padding: '6px 10px', background: '#fff3f3', border: '1px solid #fecdca', borderRadius: 0 }}>
            Valeur actuelle : <strong style={{ color: 'var(--color-alert-red)' }}>
              {field === 'gender' ? (GENDER_LABEL[currentVal] || currentVal) : String(currentVal)}
            </strong>
          </div>
        )}
        {currentVal && isDoc && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6, padding: '6px 10px', background: '#fff3f3', border: '1px solid #fecdca' }}>
            Fichier actuel : <a href={currentVal} target="_blank" rel="noreferrer" style={{ color: 'var(--color-alert-red)' }}>Voir le fichier existant</a>
          </div>
        )}
        {isDoc ? (
          <input
            type="file"
            style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--color-alert-red)', background: '#fff', fontSize: 14, cursor: 'pointer' }}
            onChange={(e) => e.target.files[0] && uploadCorrectionDoc(fullPath, e.target.files[0])}
          />
        ) : field === 'gender' ? (
          <select
            value={getCorrectionValue(fullPath)}
            onChange={(e) => setFieldCorrection(fullPath, e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--color-alert-red)', fontSize: 14, background: '#fff', color: 'var(--color-text-primary)' }}
          >
            <option value="">- Choisir -</option>
            <option value="male">Masculin</option>
            <option value="female">Feminin</option>
          </select>
        ) : field === 'country' ? (
          <div style={{ border: '2px solid var(--color-alert-red)' }}>
            <CountrySelect
              value={getCorrectionValue(fullPath)}
              onChange={(c) => {
                setFieldCorrection(fullPath, c.name);
              }}
            />
          </div>
        ) : field === 'phone' ? (
          <div style={{ border: '2px solid var(--color-alert-red)' }}>
            <PhoneInput
              defaultCountryCode={org.countryCode || 'BJ'}
              defaultValue={getCorrectionValue(fullPath)}
              onChange={(v) => setFieldCorrection(fullPath, v.e164)}
            />
          </div>
        ) : (
          <input
            type={field === 'email' ? 'email' : 'text'}
            value={getCorrectionValue(fullPath)}
            onChange={(e) => setFieldCorrection(fullPath, e.target.value)}
            placeholder={label}
            style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--color-alert-red)', fontSize: 14, background: '#fff', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
          />
        )}
      </div>
    );
  }

  return (
    <AuthLayout cardWidth={600}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/" className="text-secondary">Accueil</Link>
        <Link to="/login" className="text-secondary">Se connecter</Link>
      </div>
      <h1>Suivi de votre demande</h1>
      <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      <div className="spacer" />
      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {/* ================================================================
          STATUT : A CORRIGER
      ================================================================ */}
      {request.status === 'rejected' && (
        <div>
          {/* Motif */}
          <Alert variant="warning">
            <strong>Motif du rejet :</strong> {request.rejection_reason}
          </Alert>

          {/* Section Organisation */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Organisation</h3>
            {flaggedSet.has('step1_organization.name')
              ? <EditableField fullPath="step1_organization.name" />
              : <ReadOnlyRow label="Nom de l'organisation" value={org.name} />}
            {flaggedSet.has('step1_organization.headquarters')
              ? <EditableField fullPath="step1_organization.headquarters" />
              : <ReadOnlyRow label="Siege" value={org.headquarters} />}
            {flaggedSet.has('step1_organization.country')
              ? <EditableField fullPath="step1_organization.country" />
              : <ReadOnlyRow label="Pays" value={org.country} />}
            {flaggedSet.has('step1_organization.city')
              ? <EditableField fullPath="step1_organization.city" />
              : <ReadOnlyRow label="Ville" value={org.city} />}
            {flaggedSet.has('step1_organization.address')
              ? <EditableField fullPath="step1_organization.address" />
              : <ReadOnlyRow label="Adresse complete" value={org.address} />}
            {flaggedSet.has('step1_organization.sector')
              ? <EditableField fullPath="step1_organization.sector" />
              : <ReadOnlyRow label="Secteur d'activite" value={org.sector} />}
            {flaggedSet.has('step1_organization.ifuNumber')
              ? <EditableField fullPath="step1_organization.ifuNumber" />
              : <ReadOnlyRow label="Numero IFU" value={org.ifuNumber || '-'} />}
          </div>

          {/* Section Dirigeant */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Dirigeant</h3>
            {flaggedSet.has('step2_leader.fullName')
              ? <EditableField fullPath="step2_leader.fullName" />
              : <ReadOnlyRow label="Nom complet" value={leader.fullName} />}
            {flaggedSet.has('step2_leader.gender')
              ? <EditableField fullPath="step2_leader.gender" />
              : <ReadOnlyRow label="Sexe" value={GENDER_LABEL[leader.gender]} />}
            {flaggedSet.has('step2_leader.email')
              ? <EditableField fullPath="step2_leader.email" />
              : <ReadOnlyRow label="E-mail" value={leader.email} />}
            {flaggedSet.has('step2_leader.phone')
              ? <EditableField fullPath="step2_leader.phone" />
              : <ReadOnlyRow label="Telephone" value={leader.phone} />}
          </div>

          {/* Section Documents */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Documents</h3>
            {flaggedSet.has('step3_documents.rccm')
              ? <EditableField fullPath="step3_documents.rccm" />
              : <ReadOnlyDoc label="RCCM (facultatif)" value={docs.rccm} />}
            {flaggedSet.has('step3_documents.ifuAttestation')
              ? <EditableField fullPath="step3_documents.ifuAttestation" />
              : <ReadOnlyDoc label="Attestation IFU" value={docs.ifuAttestation} />}
            {flaggedSet.has('step3_documents.leaderId')
              ? <EditableField fullPath="step3_documents.leaderId" />
              : <ReadOnlyDoc label="Piece d'identite du dirigeant" value={docs.leaderId} />}
            {flaggedSet.has('step3_documents.logo')
              ? <EditableField fullPath="step3_documents.logo" />
              : <ReadOnlyDoc label="Logo de l'organisation" value={docs.logo} />}
          </div>

          <button className="btn btn-block btn-success" onClick={submitCorrection}>
            Soumettre les corrections
          </button>
        </div>
      )}

      {/* ================================================================
          STATUT : APPROUVEE
      ================================================================ */}
      {request.status === 'approved' && (
        <Alert variant="success">
          Votre organisation a ete approuvee. L'administrateur designe a recu son code d'activation par e-mail et WhatsApp.
          <div className="spacer" />
          <Link to="/activate">Activer le compte administrateur</Link>
        </Alert>
      )}

      {/* ================================================================
          STATUT : EN INSTRUCTION
      ================================================================ */}
      {request.status === 'submitted' && (
        <p className="text-secondary">Votre demande est en cours d'instruction par le super-administrateur.</p>
      )}
    </AuthLayout>
  );
}
