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

export default function LoginPage() {
  const { applySession } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [tab, setTab] = useState('phone'); // 'phone' | 'federated'
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const [phoneValue, setPhoneValue] = useState({ e164: '', countryCode: 'BJ' });
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  const [superAdminStep, setSuperAdminStep] = useState(null);
  const [stepToken, setStepToken] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [saCode, setSaCode] = useState('');
  const [saPhoneValue, setSaPhoneValue] = useState({ e164: '', countryCode: 'BJ' });

  function finishLogin(session) {
    applySession(session);
    if (session.requiresTwoFactor) {
      navigate('/two-factor');
    } else if (session.user?.isSuperAdmin) {
      navigate('/admin');
    } else if (session.user?.orgId) {
      const role = session.user?.role;
      if (role === 'org_admin' || role === null) {
        navigate('/org/dashboard');
      } else {
        navigate('/app');
      }
    } else {
      navigate('/org/join');
    }
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
      email_code: { title: 'Étape 1 sur 3 - code reçu par e-mail', submit: submitSaEmailCode },
      phone_confirmation: { title: `Étape 2 sur 3 - confirmez le numéro se terminant par ${phoneHint}`, submit: submitSaPhoneConfirm },
      phone_otp: { title: 'Étape 3 sur 3 - code reçu par WhatsApp', submit: submitSaPhoneOtp },
      phone_login_email: { title: 'Étape 2 sur 2 - code reçu par e-mail', submit: submitSaPhoneLoginEmail },
    }[superAdminStep];

    return (
      <AuthLayout>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {/* Shield icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#202124' }}>
            Connexion super-administrateur
          </h1>
        </div>

        <div style={{
          background: 'rgba(26,115,232,0.06)',
          border: '1px solid rgba(26,115,232,0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 14,
          color: '#5F6368',
        }}>
          {stepMeta.title}
        </div>

        <Alert variant="danger">{error}</Alert>
        <Alert variant="primary">{info}</Alert>

        {superAdminStep === 'phone_confirmation' ? (
          <form onSubmit={stepMeta.submit}>
            <div className="field">
              <label>Numéro de téléphone complet</label>
              <PhoneInput defaultCountryCode="BJ" onChange={setSaPhoneValue} autoFocus />
            </div>
            <button className="btn btn-block" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? 'Confirmation...' : 'Confirmer le numéro'}
            </button>
          </form>
        ) : (
          <form onSubmit={stepMeta.submit}>
            <div className="field">
              <label>Code de vérification</label>
              <input
                value={saCode}
                onChange={(e) => setSaCode(e.target.value)}
                autoFocus
                placeholder="Saisir le code reçu"
                style={{ letterSpacing: 4, fontSize: 20, textAlign: 'center' }}
              />
            </div>
            <button className="btn btn-block" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? 'Validation...' : 'Valider'}
            </button>
          </form>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {/* Page title */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#202124', margin: '0 0 6px 0' }}>Palabre</h1>
        <p style={{ color: '#5F6368', fontSize: 15, margin: 0 }}>
          Connexion sécurisée à votre espace
        </p>
      </div>

      {/* Mode switcher */}
      <div className="segmented" style={{ marginBottom: 20 }}>
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
          Se connecter
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
          Créer un compte
        </button>
      </div>

      {/* Method switcher */}
      <div className="segmented" style={{ marginBottom: 24 }}>
        <button className={tab === 'phone' ? 'active' : ''} onClick={() => setTab('phone')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.22 2.22 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
          Téléphone
        </button>
        <button className={tab === 'federated' ? 'active' : ''} onClick={() => setTab('federated')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Compte social
        </button>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="primary">{info}</Alert>

      {tab === 'phone' && !otpSent && (
        <form onSubmit={requestOtp}>
          <div className="field">
            <label>Numéro de téléphone</label>
            <PhoneInput defaultCountryCode="BJ" onChange={setPhoneValue} />
            <div className="hint">Un code de vérification vous sera envoyé par WhatsApp.</div>
          </div>
          <Recaptcha onVerify={setCaptchaToken} />
          <button className="btn btn-block" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? 'Envoi en cours...' : 'Recevoir le code'}
          </button>
        </form>
      )}

      {tab === 'phone' && otpSent && (
        <form onSubmit={submitPhoneCode}>
          <div className="field">
            <label>Code reçu par WhatsApp</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              placeholder="Saisir le code à 6 chiffres"
              style={{ letterSpacing: 4, fontSize: 20, textAlign: 'center' }}
            />
            <div className="hint">Entrez le code envoyé sur votre WhatsApp.</div>
          </div>
          <button className="btn btn-block" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? 'Connexion...' : mode === 'register' ? 'Créer le compte' : 'Se connecter'}
          </button>
          <div className="spacer" />
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setOtpSent(false)}>
            Changer de numéro
          </button>
        </form>
      )}

      {tab === 'federated' && (
        <SocialButtons disabled={busy} onSelect={handleFederated} />
      )}

      {mode === 'login' && isPasskeySupported() && (
        <>
          <div className="divider"><span>ou</span></div>
          <button className="btn btn-success btn-block" disabled={busy} onClick={handlePasskeyLogin}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            Se connecter avec un Clé secrète
          </button>
        </>
      )}

      {/* Footer links */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #E0E0E0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
            Vous représentez une organisation ?{' '}
            <Link to="/onboarding/new" style={{ color: '#1A73E8', fontWeight: 600 }}>
              Demandez son inscription
            </Link>
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
            Vous venez d'être approuvé ?{' '}
            <Link to="/activate" style={{ color: '#1A73E8', fontWeight: 600 }}>
              Activez votre compte administrateur
            </Link>
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
            Mode de connexion oublié ?{' '}
            <Link to="/recovery" style={{ color: '#1A73E8', fontWeight: 600 }}>
              Récupérer l'accès à mon compte
            </Link>
          </p>
        </div>

        <div style={{
          marginTop: 16,
          padding: '14px 16px',
          background: 'rgba(26,115,232,0.05)',
          border: '1px solid rgba(26,115,232,0.18)',
          borderRadius: 8,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: '#5F6368', marginBottom: 10 }}>
            Membre d'une organisation Palabre ?
          </div>
          <Link to="/org/join" className="btn btn-block" style={{ textDecoration: 'none', fontSize: 14 }}>
            Rejoindre mon organisation
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
