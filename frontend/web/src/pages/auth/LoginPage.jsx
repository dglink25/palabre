import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { federatedProviders } from '../../lib/firebase';
import { loginWithDiscoverablePasskey, isPasskeySupported } from '../../lib/webauthn';
import { getDeviceInfo } from '../../lib/device';
import { useAuth } from '../../context/AuthContext';
import { friendlyMessage } from '../../lib/errorMessages';
import { Alert } from '../../components/ui';
import PhoneInput from '../../components/PhoneInput';
import Recaptcha, { isRecaptchaConfigured } from '../../components/Recaptcha';
import AuthLayout from '../../components/AuthLayout';
import SocialButtons from '../../components/SocialButtons';

const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  apple: 'Apple',
  tiktok: 'TikTok',
};

export default function LoginPage() {
  const { applySession } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [tab, setTab] = useState('phone'); // 'phone' | 'federated'
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // --- Téléphone ---
  const [phoneValue, setPhoneValue] = useState({ e164: '', countryCode: 'BJ' });
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  // --- Parcours renforcé super-admin (Google : 3 étapes, téléphone : 2 étapes) ---
  const [superAdminStep, setSuperAdminStep] = useState(null);
  const [stepToken, setStepToken] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [saCode, setSaCode] = useState('');
  const [saPhoneValue, setSaPhoneValue] = useState({ e164: '', countryCode: 'BJ' });

  function finishLogin(session) {
    applySession(session);
    navigate(session.requiresTwoFactor ? '/two-factor' : '/profile');
  }

  function handleStepUpChallenge(result) {
    setStepToken(result.stepToken);
    if (result.phoneHintLastTwoDigits) setPhoneHint(result.phoneHintLastTwoDigits);
    setSuperAdminStep(result.step);
    setSaCode('');
    setInfo('Un code de vérification vous a été envoyé (valable 3 minutes).');
  }

  async function requestOtp(e) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    if (isRecaptchaConfigured() && !captchaToken) {
      setError('Merci de confirmer que vous n\'êtes pas un robot.');
      setBusy(false);
      return;
    }
    try {
      await api.post('/auth/phone/otp', { phone: phoneValue.e164, country: phoneValue.countryCode, purpose: mode === 'register' ? 'register' : 'login', captchaToken }, { auth: false });
      setOtpSent(true);
      setInfo('Code envoyé par WhatsApp.');
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function submitPhoneCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const path = mode === 'register' ? '/auth/phone/register' : '/auth/phone/login';
      const result = await api.post(path, { phone: phoneValue.e164, country: phoneValue.countryCode, code, ...getDeviceInfo() }, { auth: false });
      if (result.requiresSuperAdminVerification) {
        handleStepUpChallenge(result);
      } else {
        finishLogin(result);
      }
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function handleFederated(providerKey) {
    setError(''); setBusy(true);
    try {
      const { idToken } = await federatedProviders[providerKey]();
      const path = mode === 'register' ? '/auth/federated/register' : '/auth/federated/login';
      const result = await api.post(path, { idToken, ...getDeviceInfo() }, { auth: false });
      if (result.requiresSuperAdminVerification) {
        handleStepUpChallenge(result);
      } else {
        finishLogin(result);
      }
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function handlePasskeyLogin() {
    setError(''); setBusy(true);
    try {
      const session = await loginWithDiscoverablePasskey(getDeviceInfo());
      finishLogin(session);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  // --- Étapes super-admin ---
  async function submitSaEmailCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const result = await api.post('/auth/super-admin/step/email-code', { stepToken, code: saCode }, { auth: false });
      handleStepUpChallenge(result);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function submitSaPhoneConfirm(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const result = await api.post('/auth/super-admin/step/phone-confirm', { stepToken, country: saPhoneValue.countryCode, phone: saPhoneValue.e164 }, { auth: false });
      handleStepUpChallenge(result);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function submitSaPhoneOtp(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const session = await api.post('/auth/super-admin/step/phone-otp', { stepToken, code: saCode }, { auth: false });
      finishLogin(session);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  async function submitSaPhoneLoginEmail(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const session = await api.post('/auth/super-admin/step/phone-login-email', { stepToken, code: saCode }, { auth: false });
      finishLogin(session);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  if (superAdminStep) {
    const stepMeta = {
      email_code: { title: 'Étape 1 sur 3 — code reçu par e-mail', submit: submitSaEmailCode },
      phone_confirmation: { title: `Étape 2 sur 3 — confirmez le numéro se terminant par ${phoneHint}`, submit: submitSaPhoneConfirm },
      phone_otp: { title: 'Étape 3 sur 3 — code reçu par WhatsApp', submit: submitSaPhoneOtp },
      phone_login_email: { title: 'Étape 2 sur 2 — code reçu par e-mail', submit: submitSaPhoneLoginEmail },
    }[superAdminStep];

    return (
      <AuthLayout>
        <h1>Connexion super-administrateur</h1>
        <p className="text-secondary">{stepMeta.title}</p>
        <Alert variant="danger">{error}</Alert>
        <Alert variant="primary">{info}</Alert>

        {superAdminStep === 'phone_confirmation' ? (
          <form onSubmit={stepMeta.submit}>
            <div className="field">
              <label>Numéro de téléphone complet</label>
              <PhoneInput defaultCountryCode="BJ" onChange={setSaPhoneValue} autoFocus />
            </div>
            <button className="btn btn-block" disabled={busy}>Confirmer le numéro</button>
          </form>
        ) : (
          <form onSubmit={stepMeta.submit}>
            <div className="field">
              <label>Code de vérification</label>
              <input value={saCode} onChange={(e) => setSaCode(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-block" disabled={busy}>Valider</button>
          </form>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Palabre</h1>

      <div className="segmented">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Se connecter</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Créer un compte</button>
      </div>

      <div className="segmented">
        <button className={tab === 'phone' ? 'active' : ''} onClick={() => setTab('phone')}>Téléphone</button>
        <button className={tab === 'federated' ? 'active' : ''} onClick={() => setTab('federated')}>Compte social</button>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="primary">{info}</Alert>

      {tab === 'phone' && !otpSent && (
        <form onSubmit={requestOtp}>
          <div className="field">
            <label>Numéro de téléphone</label>
            <PhoneInput defaultCountryCode="BJ" onChange={setPhoneValue} />
            <div className="hint">Un code vous sera envoyé par WhatsApp.</div>
          </div>
          <Recaptcha onVerify={setCaptchaToken} />
          <button className="btn btn-block" disabled={busy}>Recevoir le code</button>
        </form>
      )}

      {tab === 'phone' && otpSent && (
        <form onSubmit={submitPhoneCode}>
          <div className="field">
            <label>Code reçu par WhatsApp</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </div>
          <button className="btn btn-block" disabled={busy}>{mode === 'register' ? 'Créer le compte' : 'Se connecter'}</button>
          <div className="spacer" />
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setOtpSent(false)}>Changer de numéro</button>
        </form>
      )}

      {tab === 'federated' && (
        <SocialButtons disabled={busy} onSelect={handleFederated} />
      )}

      {mode === 'login' && isPasskeySupported() && (
        <>
          <div className="divider"><span>ou</span></div>
          <button className="btn btn-success btn-block" disabled={busy} onClick={handlePasskeyLogin}>
            Se connecter avec un passkey
          </button>
        </>
      )}

      <div className="spacer" />
      <p className="text-secondary">
        Vous représentez une organisation ? <Link to="/onboarding/new">Demandez son inscription</Link>.
      </p>
      <p className="text-secondary">
        Vous venez d'être approuvé ? <Link to="/activate">Activez votre compte administrateur</Link>.
      </p>
      <p className="text-secondary">
        Mode de connexion oublié ? <Link to="/recovery">Récupérer l'accès à mon compte</Link>.
      </p>
    </AuthLayout>
  );
}
