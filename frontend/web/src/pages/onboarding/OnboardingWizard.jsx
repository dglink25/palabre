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

// Labels lisibles pour les champs obligatoires (utilisés dans les messages d'erreur)
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

function RecapRow({ label, value, missing }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--color-border)', gap: 12 }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 13, flexShrink: 0, minWidth: 160 }}>{label}</span>
      {missing
        ? <span style={{ color: 'var(--color-alert-red)', fontSize: 13, fontWeight: 'bold' }}>- manquant</span>
        : <span style={{ fontSize: 13, textAlign: 'right' }}>{value}</span>
      }
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
    // Validation côté client avant de sauvegarder l'étape 2 (dirigeant)
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

  if (loading) return <AuthLayout><Spinner /></AuthLayout>;

  const docs = (request && request.step3_documents) || {};

  return (
    <AuthLayout cardWidth={560}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/login" className="text-secondary">J'ai déjà une organisation - Se connecter</Link>
        <Link to="/onboarding/status" className="text-secondary">Suivre une demande déjà commencée</Link>
      </div>
      <h1>Demande d'inscription d'organisation</h1>
      <p className="text-secondary">
        Votre saisie est enregistrée automatiquement à chaque étape. Une fois la demande soumise, consultez votre e-mail et votre WhatsApp.
      </p>
      <div className="steps-indicator">
        {STEP_LABELS.map((_, i) => <span key={i} className={i <= stepIndex ? 'done' : ''} />)}
      </div>
      <p className="text-secondary">Étape {stepIndex + 1} sur 4 - {STEP_LABELS[stepIndex]}</p>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {stepIndex === 0 && (
        <div>
          <div className="field">
            <label>Nom de l'organisation</label>
            <input value={step1.name} onChange={(e) => setStep1({ ...step1, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Siège</label>
            <input value={step1.headquarters} onChange={(e) => setStep1({ ...step1, headquarters: e.target.value })} />
          </div>

          <div className="field">
            <label>Pays</label>
            <CountrySelect
              value={step1.countryCode}
              onChange={(c) => setStep1({ ...step1, countryCode: c.code, country: c.name })}
            />
          </div>

          <div className="field">
            <label>Ville</label>
            <input value={step1.city} onChange={(e) => setStep1({ ...step1, city: e.target.value })} />
          </div>
          <div className="field">
            <label>Adresse complète</label>
            <input value={step1.address} onChange={(e) => setStep1({ ...step1, address: e.target.value })} />
          </div>
          <div className="field">
            <label>Secteur d'activité</label>
            <input value={step1.sector} onChange={(e) => setStep1({ ...step1, sector: e.target.value })} />
          </div>
          <div className="field">
            <label>Numéro IFU</label>
            <input value={step1.ifuNumber} onChange={(e) => setStep1({ ...step1, ifuNumber: e.target.value })} />
          </div>
        </div>
      )}

      {stepIndex === 1 && (
        <div>
          <div className="field">
            <label>Nom complet du dirigeant</label>
            <input value={step2.fullName} onChange={(e) => setStep2({ ...step2, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label>Sexe</label>
            <select value={step2.gender} onChange={(e) => setStep2({ ...step2, gender: e.target.value })}>
              <option value="">-</option>
              <option value="male">Masculin</option>
              <option value="female">Féminin</option>
            </select>
          </div>
          <div className="field">
            <label>E-mail</label>
            <input value={step2.email} onChange={(e) => setStep2({ ...step2, email: e.target.value })} />
          </div>

          <div className="field">
            <label>Téléphone</label>
            <PhoneInput
              defaultCountryCode={step1.countryCode || 'BJ'}
              defaultValue={step2.phone}
              onChange={(v) => setStep2({ ...step2, phone: v.e164 })}
            />
            <div className="hint">
              Sélectionnez votre pays puis saisissez votre numéro local (sans indicatif).
            </div>
          </div>
        </div>
      )}

      {stepIndex === 2 && (
        <div>
          {[
            ['rccm', 'RCCM (facultatif)'],
            ['ifuAttestation', 'Attestation IFU'],
            ['leaderId', "Pièce d'identité du dirigeant"],
            ['logo', "Logo de l'organisation"],
          ].map(([type, label]) => (
            <div className="field" key={type}>
              <label>{label}</label>
              {docs[type] ? <div className="text-secondary">Déjà envoyé.</div> : null}
              <input
                type="file"
                onChange={(e) => e.target.files[0] && uploadDocument(type, e.target.files[0])}
              />
            </div>
          ))}
        </div>
      )}

      {stepIndex === 3 && (
        <div>
          {/* ── Récapitulatif Organisation ── */}
          <h3 style={{ marginBottom: 4 }}>Organisation</h3>
          <div style={{ marginBottom: 20 }}>
            <RecapRow label="Nom" value={step1.name} missing={!step1.name} />
            <RecapRow label="Siège" value={step1.headquarters} missing={!step1.headquarters} />
            <RecapRow label="Pays" value={step1.country} missing={!step1.country} />
            <RecapRow label="Ville" value={step1.city} missing={!step1.city} />
            <RecapRow label="Adresse" value={step1.address} missing={!step1.address} />
            <RecapRow label="Secteur d'activité" value={step1.sector} missing={!step1.sector} />
            <RecapRow label="Numéro IFU" value={step1.ifuNumber || '-'} />
          </div>

          {/* ── Récapitulatif Dirigeant ── */}
          <h3 style={{ marginBottom: 4 }}>Dirigeant</h3>
          <div style={{ marginBottom: 20 }}>
            <RecapRow label="Nom complet" value={step2.fullName} missing={!step2.fullName} />
            <RecapRow label="Sexe" value={GENDER_LABEL[step2.gender]} missing={!step2.gender} />
            <RecapRow label="E-mail" value={step2.email} missing={!step2.email} />
            <RecapRow label="Téléphone" value={step2.phone} missing={!step2.phone} />
          </div>

          {/* ── Récapitulatif Documents ── */}
          <h3 style={{ marginBottom: 4 }}>Documents</h3>
          <div style={{ marginBottom: 24 }}>
            <RecapRow label="RCCM" value={docs.rccm ? 'Envoyé ✓' : 'Non fourni (facultatif)'} />
            <RecapRow label="Attestation IFU" value={docs.ifuAttestation ? 'Envoyé ✓' : undefined} missing={!docs.ifuAttestation} />
            <RecapRow label="Pièce d'identité dirigeant" value={docs.leaderId ? 'Envoyé ✓' : undefined} missing={!docs.leaderId} />
            <RecapRow label="Logo de l'organisation" value={docs.logo ? 'Envoyé ✓' : undefined} missing={!docs.logo} />
          </div>

          {/* ── Certification ── */}
          <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 16, marginBottom: 8 }}>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={step4.infoCertified}
                onChange={(e) => setStep4({ ...step4, infoCertified: e.target.checked })}
              />
              <span>Je certifie l'exactitude des informations fournies</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={step4.termsAccepted}
                onChange={(e) => setStep4({ ...step4, termsAccepted: e.target.checked })}
              />
              <span>J'accepte les <Link to="/terms" target="_blank">conditions d'utilisation</Link></span>
            </label>
          </div>

          <Recaptcha onVerify={setCaptchaToken} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {stepIndex > 0 && (
          <button className="btn btn-secondary" onClick={() => setStepIndex(stepIndex - 1)}>
            Précédent
          </button>
        )}
        {stepIndex < 3 && <button className="btn" onClick={next}>Suivant</button>}
        {stepIndex === 3 && (
          <button className="btn btn-success" onClick={submit}>Soumettre la demande</button>
        )}
      </div>
    </AuthLayout>
  );
}