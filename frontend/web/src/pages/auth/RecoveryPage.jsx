import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { getDeviceInfo } from '../../lib/device';
import { useAuth } from '../../context/AuthContext';
import { friendlyMessage } from '../../lib/errorMessages';
import { Alert } from '../../components/ui';
import PhoneInput from '../../components/PhoneInput';
import Recaptcha, { isRecaptchaConfigured } from '../../components/Recaptcha';
import AuthLayout from '../../components/AuthLayout';

export default function RecoveryPage() {
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState('phone'); // 'phone' | 'questions'
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // --- Téléphone ---
  const [phoneValue, setPhoneValue] = useState({ e164: '', countryCode: 'BJ' });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  // --- Questions de sécurité ---
  const [identifier, setIdentifier] = useState('');
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});

  function finish(session) {
    applySession(session);
    navigate('/profile');
  }

  async function startPhone(e) {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    if (isRecaptchaConfigured() && !captchaToken) {
      setError('Merci de confirmer que vous n\'êtes pas un robot.');
      setBusy(false);
      return;
    }
    try {
      await api.post('/security/recovery/start', { phone: phoneValue.e164, country: phoneValue.countryCode, captchaToken }, { auth: false });
      setSent(true);
      setNotice('Si ce numéro est associé à un compte, un code vous a été envoyé par WhatsApp.');
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function confirmPhone(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const session = await api.post('/security/recovery/confirm', { phone: phoneValue.e164, country: phoneValue.countryCode, code, ...getDeviceInfo() }, { auth: false });
      finish(session);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function loadQuestions(e) {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      const qs = await api.post('/security/recovery/questions/list', { identifier }, { auth: false });
      if (qs.length < 2) {
        setError("Aucune question de sécurité suffisante n'est configurée pour ce compte. Essayez la récupération par téléphone.");
        setQuestions(null);
      } else {
        setQuestions(qs);
      }
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function submitAnswers(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
      const session = await api.post('/security/recovery/questions/verify', {
        identifier, answers: payload, ...getDeviceInfo(),
      }, { auth: false });
      finish(session);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  return (
    <AuthLayout>
      <h1>Récupérer l'accès à votre compte</h1>

      <div className="segmented">
        <button className={method === 'phone' ? 'active' : ''} onClick={() => { setMethod('phone'); setError(''); setNotice(''); }}>Par téléphone</button>
        <button className={method === 'questions' ? 'active' : ''} onClick={() => { setMethod('questions'); setError(''); setNotice(''); }}>Par questions de sécurité</button>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="primary">{notice}</Alert>

      {method === 'phone' && !sent && (
        <form onSubmit={startPhone}>
          <div className="field"><label>Numéro de téléphone enregistré</label><PhoneInput defaultCountryCode="BJ" onChange={setPhoneValue} /></div>
          <Recaptcha onVerify={setCaptchaToken} />
          <button className="btn btn-block" disabled={busy}>Recevoir un code</button>
        </form>
      )}
      {method === 'phone' && sent && (
        <form onSubmit={confirmPhone}>
          <div className="field"><label>Code reçu par WhatsApp</label><input value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
          <button className="btn btn-block" disabled={busy}>Récupérer l'accès</button>
        </form>
      )}

      {method === 'questions' && !questions && (
        <form onSubmit={loadQuestions}>
          <div className="field">
            <label>Numéro de téléphone ou e-mail du compte</label>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </div>
          <button className="btn btn-block" disabled={busy}>Continuer</button>
        </form>
      )}
      {method === 'questions' && questions && (
        <form onSubmit={submitAnswers}>
          {questions.map((q) => (
            <div className="field" key={q.id}>
              <label>{q.label_fr}</label>
              <input value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
            </div>
          ))}
          <button className="btn btn-block" disabled={busy}>Récupérer l'accès</button>
        </form>
      )}

      <div className="spacer" />
      <p className="text-secondary">
        Vous vous souvenez de votre mode de connexion ? <Link to="/login">Retour à la connexion</Link>.
      </p>
    </AuthLayout>
  );
}
