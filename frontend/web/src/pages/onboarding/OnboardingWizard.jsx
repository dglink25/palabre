import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import PhoneInput from '../../components/PhoneInput';
import CountrySelect from '../../components/CountrySelect';
import Recaptcha, { isRecaptchaConfigured } from '../../components/Recaptcha';
import { friendlyMessage } from '../../lib/errorMessages';
import { validateE164 } from '../../lib/phoneValidation';
import AuthLayout from '../../components/AuthLayout';

const DRAFT_TOKEN_PREFIX = 'palabre_onboarding_draft_';

function saveDraftToken(id, token) {
  localStorage.setItem(DRAFT_TOKEN_PREFIX + id, token);
}
function loadDraftToken(id) {
  return localStorage.getItem(DRAFT_TOKEN_PREFIX + id);
}

const STEP_LABELS = ['Organisation', 'Dirigeant', 'Documents', 'Récapitulatif'];

const MISSING_FIELD_LABELS = {
  'step1_organization.name': 'Nom de l\'organisation',
  'step1_organization.headquarters': 'Siège',
  'step1_organization.country': 'Pays',
  'step1_organization.city': 'Ville',
  'step1_organization.address': 'Adresse complète',
  'step1_organization.sector': 'Secteur d\'activité',
  'step2_leader.fullName': 'Nom complet du dirigeant',
  'step2_leader.gender': 'Sexe',
  'step2_leader.email': 'E-mail du dirigeant',
  'step2_leader.phone': 'Téléphone du dirigeant',
  'step3_documents.ifuAttestation': 'Attestation IFU',
  'step3_documents.leaderId': 'Pièce d\'identité du dirigeant',
  'step3_documents.logo': 'Logo de l\'organisation',
  'step4_certification.infoCertified': 'Certification des informations',
  'step4_certification.termsAccepted': 'Acceptation des conditions',
};

const GENDER_LABEL = { male: 'Masculin', female: 'Féminin' };

// Check icon SVG
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Alert icon SVG
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

function RecapRow({ label, value, missing }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: '1px solid #E0E0E0',
      gap: 12,
    }}>
      <span style={{ color: '#5F6368', fontSize: 14, flexShrink: 0, minWidth: 160 }}>{label}</span>
      {missing ? (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: '#EA4335',
          fontSize: 13,
          fontWeight: 600,
        }}>
          <AlertIcon /> Manquant
        </span>
      ) : (
        <span style={{ fontSize: 14, textAlign: 'right', color: '#202124' }}>{value}</span>
      )}
    </div>
  );
}

export default function OnboardingWizard() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = params.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [request, setRequest] = useState(null);

  const [step1, setStep1] = useState({
    name: '', headquarters: '', country: '', countryCode: 'BJ',
    city: '', address: '', sector: '', ifuNumber: '',
  });
  const [step2, setStep2] = useState({ fullName: '', gender: '', email: '', phone: '' });
  const [step4, setStep4] = useState({ infoCertified: false, termsAccepted: false });
  const [captchaToken, setCaptchaToken] = useState('');

  useEffect(() => {
    async function init() {
      try {
        if (requestId) {
          const token = loadDraftToken(requestId);
          if (!token) {
            setError('Jeton de brouillon introuvable sur cet appareil pour cette demande.');
            setLoading(false);
            return;
          }
          setDraftToken(token);
          const data = await api.get(`/onboarding/requests/${requestId}`, {
            auth: false,
            headers: { 'X-Draft-Token': token },
          });
          hydrate(data);
        } else {
          const created = await api.post('/onboarding/requests', undefined, { auth: false });
          saveDraftToken(created.id, created.draftToken);
          setDraftToken(created.draftToken);
          setParams({ id: created.id }, { replace: true });
        }
      } catch (e) {
        setError(friendlyMessage(e));
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  function hydrate(data) {
    setRequest(data);
    setStep1((s) => ({ ...s, ...data.step1_organization }));
    setStep2((s) => ({ ...s, ...data.step2_leader }));
    setStep4((s) => ({ ...s, ...data.step4_certification }));
  }

  const headers = { 'X-Draft-Token': draftToken };

  async function saveStep(stepKey, data) {
    setError(''); setNotice('');
    try {
      const updated = await api.patch(
        `/onboarding/requests/${requestId}/steps/${stepKey}`,
        data,
        { auth: false, headers }
      );
      setRequest(updated);
      return true;
    } catch (e) {
      setError(friendlyMessage(e));
      return false;
    }
  }

  async function next() {
    if (stepIndex === 1) {
      const { valid, reason } = validateE164(step2.phone, step1.countryCode);
      if (!valid) {
        setError(reason || 'Numéro de téléphone invalide.');
        return;
      }
    }
    if (stepIndex === 0 && (await saveStep('step1', step1))) setStepIndex(1);
    else if (stepIndex === 1 && (await saveStep('step2', step2))) setStepIndex(2);
    else if (stepIndex === 2) setStepIndex(3);
  }

  async function uploadDocument(type, file) {
    setError(''); setNotice('');
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    try {
      const updated = await api.upload(
        `/onboarding/requests/${requestId}/documents`,
        form,
        { auth: false, headers }
      );
      setRequest(updated);
      setNotice('Document envoyé.');
    } catch (e) {
      setError(friendlyMessage(e));
    }
  }

  async function submit() {
    setError(''); setNotice('');
    if (isRecaptchaConfigured() && !captchaToken) {
      setError("Merci de confirmer que vous n'êtes pas un robot.");
      return;
    }
    const saved = await saveStep('step4', step4);
    if (!saved) return;
    try {
      await api.post(
        `/onboarding/requests/${requestId}/submit`,
        { captchaToken },
        { auth: false, headers }
      );
      navigate(`/onboarding/status?id=${requestId}&token=${draftToken}`);
    } catch (e) {
      if (e.missingFields && e.missingFields.length > 0) {
        const labels = e.missingFields.map((f) => MISSING_FIELD_LABELS[f] || f);
        setError(`Demande incomplète. Champs manquants :\n• ${labels.join('\n• ')}`);
      } else {
        setError(friendlyMessage(e));
      }
    }
  }

  if (loading) return <AuthLayout><div style={{ textAlign: 'center', padding: 32 }}><Spinner /></div></AuthLayout>;

  const docs = (request && request.step3_documents) || {};

  return (
    <AuthLayout cardWidth={560}>
      {/* Top links */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link to="/login" style={{ fontSize: 13, color: '#5F6368', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          J'ai déjà une organisation
        </Link>
        <Link to="/onboarding/status" style={{ fontSize: 13, color: '#5F6368', textDecoration: 'none' }}>
          Suivre une demande
        </Link>
      </div>

      {/* Heading */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#202124', margin: '0 0 6px 0' }}>
          Demande d'inscription d'organisation
        </h1>
        <p style={{ color: '#5F6368', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Votre saisie est enregistrée automatiquement à chaque étape. Une fois soumise, consultez votre e-mail et WhatsApp.
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {STEP_LABELS.map((label, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: i <= stepIndex ? '#1A73E8' : '#E0E0E0',
                transition: 'background 0.25s',
              }} />
              <span style={{
                fontSize: 11,
                fontWeight: i === stepIndex ? 700 : 400,
                color: i === stepIndex ? '#1A73E8' : i < stepIndex ? '#34A853' : '#5F6368',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                {i < stepIndex && <CheckIcon />}
                {label}
              </span>
            </div>
          ))}
        </div>
        <p style={{ color: '#5F6368', fontSize: 13, margin: 0 }}>
          Étape {stepIndex + 1} sur 4
        </p>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {/* Step 1: Organisation */}
      {stepIndex === 0 && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Nom de l'organisation <span style={{ color: '#EA4335' }}>*</span></label>
              <input value={step1.name} onChange={(e) => setStep1({ ...step1, name: e.target.value })} placeholder="Ex. ACME Corp" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Siège <span style={{ color: '#EA4335' }}>*</span></label>
              <input value={step1.headquarters} onChange={(e) => setStep1({ ...step1, headquarters: e.target.value })} placeholder="Ville ou pays du siège" />
            </div>
            <div className="field">
              <label>Pays <span style={{ color: '#EA4335' }}>*</span></label>
              <CountrySelect
                value={step1.countryCode}
                onChange={(c) => setStep1({ ...step1, countryCode: c.code, country: c.name })}
              />
            </div>
            <div className="field">
              <label>Ville <span style={{ color: '#EA4335' }}>*</span></label>
              <input value={step1.city} onChange={(e) => setStep1({ ...step1, city: e.target.value })} placeholder="Ville" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Adresse complète <span style={{ color: '#EA4335' }}>*</span></label>
              <input value={step1.address} onChange={(e) => setStep1({ ...step1, address: e.target.value })} placeholder="Adresse physique" />
            </div>
            <div className="field">
              <label>Secteur d'activité <span style={{ color: '#EA4335' }}>*</span></label>
              <input value={step1.sector} onChange={(e) => setStep1({ ...step1, sector: e.target.value })} placeholder="Ex. Finance, Santé..." />
            </div>
            <div className="field">
              <label>Numéro IFU</label>
              <input value={step1.ifuNumber} onChange={(e) => setStep1({ ...step1, ifuNumber: e.target.value })} placeholder="Optionnel" />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Dirigeant */}
      {stepIndex === 1 && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          <div className="field">
            <label>Nom complet du dirigeant <span style={{ color: '#EA4335' }}>*</span></label>
            <input value={step2.fullName} onChange={(e) => setStep2({ ...step2, fullName: e.target.value })} placeholder="Prénom et nom" />
          </div>
          <div className="field">
            <label>Sexe <span style={{ color: '#EA4335' }}>*</span></label>
            <select value={step2.gender} onChange={(e) => setStep2({ ...step2, gender: e.target.value })}>
              <option value="">— Choisir —</option>
              <option value="male">Masculin</option>
              <option value="female">Féminin</option>
            </select>
          </div>
          <div className="field">
            <label>E-mail <span style={{ color: '#EA4335' }}>*</span></label>
            <input type="email" value={step2.email} onChange={(e) => setStep2({ ...step2, email: e.target.value })} placeholder="adresse@exemple.com" />
          </div>
          <div className="field">
            <label>Téléphone <span style={{ color: '#EA4335' }}>*</span></label>
            <PhoneInput
              defaultCountryCode={step1.countryCode || 'BJ'}
              defaultValue={step2.phone}
              onChange={(v) => setStep2({ ...step2, phone: v.e164 })}
            />
            <div className="hint">Sélectionnez votre pays puis saisissez votre numéro local (sans indicatif).</div>
          </div>
        </div>
      )}

      {/* Step 3: Documents */}
      {stepIndex === 2 && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          <p style={{ fontSize: 14, color: '#5F6368', marginBottom: 16, lineHeight: 1.6 }}>
            Téléversez les documents requis. Les fichiers PDF, JPG et PNG sont acceptés (max. 10 Mo).
          </p>
          {[
            ['rccm', 'RCCM', false],
            ['ifuAttestation', 'Attestation IFU', true],
            ['leaderId', "Pièce d'identité du dirigeant", true],
            ['logo', "Logo de l'organisation", true],
          ].map(([type, label, required]) => (
            <div key={type} style={{
              padding: '14px 16px',
              border: '1px solid #E0E0E0',
              borderRadius: 8,
              marginBottom: 12,
              background: docs[type] ? 'rgba(52,168,83,0.04)' : '#fff',
              borderColor: docs[type] ? 'rgba(52,168,83,0.3)' : '#E0E0E0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 14, color: '#202124', margin: 0 }}>
                  {label}
                  {required && <span style={{ color: '#EA4335', marginLeft: 2 }}>*</span>}
                </label>
                {docs[type] && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#34A853',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>
                    <CheckIcon /> Envoyé
                  </span>
                )}
              </div>
              <input
                type="file"
                style={{ width: '100%', fontSize: 14, cursor: 'pointer', color: '#5F6368' }}
                onChange={(e) => e.target.files[0] && uploadDocument(type, e.target.files[0])}
              />
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Summary */}
      {stepIndex === 3 && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          {/* Organisation */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Organisation
            </h3>
            <RecapRow label="Nom" value={step1.name} missing={!step1.name} />
            <RecapRow label="Siège" value={step1.headquarters} missing={!step1.headquarters} />
            <RecapRow label="Pays" value={step1.country} missing={!step1.country} />
            <RecapRow label="Ville" value={step1.city} missing={!step1.city} />
            <RecapRow label="Adresse" value={step1.address} missing={!step1.address} />
            <RecapRow label="Secteur" value={step1.sector} missing={!step1.sector} />
            <RecapRow label="Numéro IFU" value={step1.ifuNumber || '—'} />
          </div>

          {/* Dirigeant */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Dirigeant
            </h3>
            <RecapRow label="Nom complet" value={step2.fullName} missing={!step2.fullName} />
            <RecapRow label="Sexe" value={GENDER_LABEL[step2.gender]} missing={!step2.gender} />
            <RecapRow label="E-mail" value={step2.email} missing={!step2.email} />
            <RecapRow label="Téléphone" value={step2.phone} missing={!step2.phone} />
          </div>

          {/* Documents */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Documents
            </h3>
            <RecapRow label="RCCM" value={docs.rccm ? 'Envoyé' : 'Non fourni (facultatif)'} />
            <RecapRow label="Attestation IFU" value={docs.ifuAttestation ? 'Envoyé' : undefined} missing={!docs.ifuAttestation} />
            <RecapRow label="Pièce d'identité" value={docs.leaderId ? 'Envoyé' : undefined} missing={!docs.leaderId} />
            <RecapRow label="Logo" value={docs.logo ? 'Envoyé' : undefined} missing={!docs.logo} />
          </div>

          {/* Certification */}
          <div style={{ borderTop: '2px solid #E0E0E0', paddingTop: 16, marginBottom: 8 }}>
            <label className="checkbox-field" style={{ padding: '10px 0', borderRadius: 6 }}>
              <input
                type="checkbox"
                checked={step4.infoCertified}
                onChange={(e) => setStep4({ ...step4, infoCertified: e.target.checked })}
              />
              <span style={{ fontSize: 14 }}>Je certifie l'exactitude des informations fournies</span>
            </label>
            <label className="checkbox-field" style={{ padding: '10px 0', borderRadius: 6 }}>
              <input
                type="checkbox"
                checked={step4.termsAccepted}
                onChange={(e) => setStep4({ ...step4, termsAccepted: e.target.checked })}
              />
              <span style={{ fontSize: 14 }}>
                J'accepte les{' '}
                <Link to="/terms" target="_blank" style={{ color: '#1A73E8' }}>conditions d'utilisation</Link>
              </span>
            </label>
          </div>

          <Recaptcha onVerify={setCaptchaToken} />
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {stepIndex > 0 && (
          <button
            className="btn btn-secondary"
            onClick={() => setStepIndex(stepIndex - 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Précédent
          </button>
        )}
        {stepIndex < 3 && (
          <button
            className="btn"
            onClick={next}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            Suivant
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        )}
        {stepIndex === 3 && (
          <button
            className="btn btn-success"
            onClick={submit}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
            Soumettre la demande
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
