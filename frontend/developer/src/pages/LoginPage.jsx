import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../lib/authApi';
import { federatedProviders } from '../lib/firebase';

// ─── Icônes SVG officielles ───────────────────────────────────────────────────

function IconWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

function ErrorAlert({ message }) {
  if (!message) return null;
  return (
    <div role="alert" aria-live="polite" style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 14px',
      background: 'rgba(234,67,53,.06)',
      border: '1px solid #EA4335',
      borderLeft: '4px solid #EA4335',
      borderRadius: 8,
      color: '#EA4335',
      fontSize: 14,
      marginBottom: 16,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{message}</span>
    </div>
  );
}

function InfoAlert({ message }) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 14px',
      background: 'rgba(26,115,232,.06)',
      border: '1px solid #1A73E8',
      borderLeft: '4px solid #1A73E8',
      borderRadius: 8,
      color: '#1A73E8',
      fontSize: 14,
      marginBottom: 16,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span>{message}</span>
    </div>
  );
}

// ─── Utilitaire erreur lisible ────────────────────────────────────────────────

function friendlyError(err) {
  if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'FEDERATED_CANCELLED') return null;
  if (err?.code === 'auth/popup-blocked') return 'La fenêtre popup a été bloquée. Autorisez les popups et réessayez.';
  if (err?.code === 'auth/network-request-failed') return 'Erreur réseau. Vérifiez votre connexion et réessayez.';
  if (err?.code === 'auth/account-exists-with-different-credential') {
    return 'Ce compte existe déjà avec un autre mode de connexion. Utilisez la même méthode qu\'à votre première connexion.';
  }
  const apiMsg = err?.response?.data?.error?.message || err?.response?.data?.message;
  if (apiMsg) return apiMsg;
  if (err?.message && !err.message.startsWith('Firebase:')) return err.message;
  return 'Une erreur est survenue. Veuillez réessayer.';
}

// ─── Formulaire OTP WhatsApp ──────────────────────────────────────────────────

function OtpWhatsApp({ onSuccess }) {
  const [phone, setPhone]     = useState('');
  const [code, setCode]       = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');

  async function requestOtp(e) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      await authApi.post('/phone/otp', { phone, purpose: 'login' });
      setOtpSent(true);
      setInfo('Un code de vérification a été envoyé sur votre WhatsApp.');
    } catch (err) { setError(friendlyError(err) || ''); }
    finally { setBusy(false); }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { data } = await authApi.post('/phone/login', { phone, code });
      onSuccess(data);
    } catch (err) { setError(friendlyError(err) || ''); }
    finally { setBusy(false); }
  }

  const btnStyle = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', height: 44,
    background: disabled ? '#E0E0E0' : '#1A73E8',
    color: '#FFFFFF',
    border: 'none', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 150ms ease',
  });

  if (!otpSent) {
    return (
      <form onSubmit={requestOtp} noValidate>
        <ErrorAlert message={error} />
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="otp-phone" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#202124' }}>
            Numéro de téléphone WhatsApp
          </label>
          <input
            id="otp-phone" type="tel"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+229 97 00 00 00"
            required autoComplete="tel"
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid #E0E0E0', borderRadius: 8,
              fontFamily: 'inherit', fontSize: 15, color: '#202124',
              background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 13, color: '#5F6368', marginTop: 5 }}>
            Incluez le code pays. Un code à 6 chiffres vous sera envoyé par WhatsApp.
          </p>
        </div>
        <button type="submit" disabled={busy || !phone.trim()} style={btnStyle(busy || !phone.trim())}>
          <IconWhatsApp />
          {busy ? 'Envoi…' : 'Recevoir le code WhatsApp'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} noValidate>
      <InfoAlert message={info} />
      <ErrorAlert message={error} />
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="otp-code" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#202124' }}>
          Code reçu par WhatsApp
        </label>
        <input
          id="otp-code" type="text" inputMode="numeric"
          value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="123456" required autoFocus
          autoComplete="one-time-code" maxLength={8}
          style={{
            width: '100%', padding: '12px',
            border: '1px solid #E0E0E0', borderRadius: 8,
            fontFamily: 'inherit', fontSize: 22, fontWeight: 700,
            letterSpacing: '0.4em', textAlign: 'center',
            color: '#202124', background: '#FFFFFF',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: 13, color: '#5F6368', marginTop: 5 }}>
          Code envoyé au {phone}.
        </p>
      </div>
      <button type="submit" disabled={busy || code.length < 4} style={btnStyle(busy || code.length < 4)}>
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button type="button"
          onClick={() => { setOtpSent(false); setCode(''); setInfo(''); setError(''); }}
          style={{ background: 'none', border: 'none', color: '#1A73E8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
          Changer de numéro
        </button>
      </div>
    </form>
  );
}

// ─── Connexion fédérée Google / GitHub ───────────────────────────────────────

function FederatedLogin({ onSuccess }) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  const handleProvider = useCallback(async (providerKey) => {
    setError(''); setBusy(true);
    try {
      const { idToken } = await federatedProviders[providerKey]();
      const { data } = await authApi.post('/federated/login', { idToken });
      onSuccess(data);
    } catch (err) {
      const msg = friendlyError(err);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  }, [onSuccess]);

  const socialBtn = {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '10px 16px', marginBottom: 10,
    background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: '#202124',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    transition: 'background 150ms ease, border-color 150ms ease',
  };

  return (
    <div>
      <ErrorAlert message={error} />
      <button type="button" disabled={busy} style={socialBtn}
        onClick={() => handleProvider('google')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F9FA'; e.currentTarget.style.borderColor = '#c9cccf'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E0E0E0'; }}>
        <span style={{ display: 'flex', alignItems: 'center', width: 20, flexShrink: 0 }}><IconGoogle /></span>
        Continuer avec Google
      </button>
      <button type="button" disabled={busy} style={socialBtn}
        onClick={() => handleProvider('github')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F9FA'; e.currentTarget.style.borderColor = '#c9cccf'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E0E0E0'; }}>
        <span style={{ display: 'flex', alignItems: 'center', width: 20, flexShrink: 0 }}><IconGitHub /></span>
        Continuer avec GitHub
      </button>
      <p style={{ fontSize: 13, color: '#5F6368', textAlign: 'center', marginTop: 8 }}>
        Utilisez le même compte que votre profil Palabre.
      </p>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('social');

  function handleSuccess(data) {
    if (data?.accessToken) localStorage.setItem('palabre_access_token', data.accessToken);
    navigate('/dashboard', { replace: true });
  }

  const tabStyle = (active) => ({
    flex: 1, padding: '9px 12px',
    border: 'none', borderRadius: 6,
    fontFamily: 'inherit', fontSize: 14, fontWeight: active ? 600 : 400,
    background: active ? '#FFFFFF' : 'transparent',
    color: active ? '#202124' : '#5F6368',
    boxShadow: active ? '0 1px 3px rgba(32,33,36,.12)' : 'none',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  });

  return (
    /* Layout bleu identique à auth-layout du frontend Palabre */
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1A73E8',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', flexShrink: 0,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="Palabre" style={{ width: 30, height: 30 }} />
          <span style={{ fontWeight: 700, fontSize: 20, color: '#FFFFFF', letterSpacing: '0.5px' }}>
            Palabre
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
            color: '#FFFFFF', background: 'rgba(255,255,255,.20)',
            padding: '2px 7px', borderRadius: 3,
          }}>Dev</span>
        </a>
        <a
          href="https://palabre.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,.5)',
            borderRadius: 8,
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Retour à Palabre
        </a>
      </div>

      {/* Corps — carte centrée */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px 48px',
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(32,33,36,.16)',
          width: '100%',
          maxWidth: 440,
          padding: '40px 36px',
        }}>
          {/* Logo + titre */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img
              src="/logo.png"
              alt="Palabre"
              style={{ width: 56, height: 56, marginBottom: 14, display: 'block', margin: '0 auto 14px' }}
            />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>
              Palabre for Developers
            </h1>
            <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
              Connectez-vous pour accéder à votre portail développeur
            </p>
          </div>

          {/* Onglets méthode */}
          <div
            role="tablist"
            aria-label="Méthode de connexion"
            style={{
              display: 'flex',
              background: '#F1F3F4',
              borderRadius: 8,
              padding: 4,
              gap: 4,
              marginBottom: 24,
            }}
          >
            <button role="tab" aria-selected={tab === 'social'}    style={tabStyle(tab === 'social')}    onClick={() => setTab('social')}>Google / GitHub</button>
            <button role="tab" aria-selected={tab === 'whatsapp'}  style={tabStyle(tab === 'whatsapp')}  onClick={() => setTab('whatsapp')}>OTP WhatsApp</button>
          </div>

          {/* Contenu */}
          {tab === 'social'   && <FederatedLogin onSuccess={handleSuccess} />}
          {tab === 'whatsapp' && <OtpWhatsApp    onSuccess={handleSuccess} />}

          {/* Pied de page */}
          <div style={{
            marginTop: 24, paddingTop: 20,
            borderTop: '1px solid #E0E0E0',
            textAlign: 'center', fontSize: 13, color: '#5F6368',
          }}>
            Nouveau sur Palabre ?{' '}
            <a href="https://palabre.app" target="_blank" rel="noopener noreferrer"
              style={{ color: '#1A73E8', fontWeight: 500 }}>
              Créez un compte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
