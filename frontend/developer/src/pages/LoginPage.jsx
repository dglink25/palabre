/**
 * LoginPage.jsx — Developer Portal
 *
 * Page de connexion institutionnelle — style Stripe / Twilio.
 * Fond #1A73E8, carte blanche centrée, logo /logo.png.
 * Icônes SVG Lucide stroke-only, zéro emoji.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../lib/authApi';
import { federatedProviders } from '../lib/firebase';

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconAlertCircle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// Icône Google (multi-couleur — cas particulier accepté)
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendlyError(err) {
  if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'FEDERATED_CANCELLED') return null;
  if (err?.code === 'auth/popup-blocked')
    return 'La fenêtre popup a été bloquée. Autorisez les popups et réessayez.';
  if (err?.code === 'auth/network-request-failed')
    return 'Erreur réseau. Vérifiez votre connexion et réessayez.';
  if (err?.code === 'auth/account-exists-with-different-credential')
    return 'Ce compte existe avec un autre mode de connexion. Utilisez la même méthode qu\'à votre première connexion.';
  const apiMsg = err?.response?.data?.error?.message || err?.response?.data?.message;
  if (apiMsg) return apiMsg;
  if (err?.message && !err.message.startsWith('Firebase:')) return err.message;
  return 'Une erreur est survenue. Veuillez réessayer.';
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

function ErrorAlert({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display:     'flex',
        alignItems:  'flex-start',
        gap:         8,
        padding:     '10px 14px',
        background:  'rgba(234,67,53,.06)',
        border:      '1px solid #EA4335',
        borderLeft:  '3px solid #EA4335',
        borderRadius: 6,
        color:       '#EA4335',
        fontSize:    14,
        marginBottom: 14,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}><IconAlertCircle /></span>
      <span>{message}</span>
    </div>
  );
}

function InfoAlert({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display:     'flex',
        alignItems:  'flex-start',
        gap:         8,
        padding:     '10px 14px',
        background:  'rgba(26,115,232,.06)',
        border:      '1px solid #1A73E8',
        borderLeft:  '3px solid #1A73E8',
        borderRadius: 6,
        color:       '#1A73E8',
        fontSize:    14,
        marginBottom: 14,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}><IconInfo /></span>
      <span>{message}</span>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return (
    <span
      role="status"
      aria-label="Chargement…"
      style={{
        display:       'inline-block',
        width:         size,
        height:        size,
        border:        '2px solid rgba(255,255,255,.3)',
        borderTopColor: '#fff',
        borderRadius:  '50%',
        animation:     'dev-spin 0.7s linear infinite',
        flexShrink:    0,
      }}
    />
  );
}

// ─── Formulaire OTP WhatsApp ──────────────────────────────────────────────────

function OtpWhatsApp({ onSuccess }) {
  const [phone,   setPhone]   = useState('');
  const [code,    setCode]    = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');

  const inputStyle = {
    width:        '100%',
    padding:      '9px 12px',
    border:       '1px solid #E0E0E0',
    borderRadius: 8,
    fontFamily:   'inherit',
    fontSize:     14,
    color:        '#202124',
    background:   '#FFFFFF',
    outline:      'none',
    boxSizing:    'border-box',
    transition:   'border-color 150ms ease',
  };

  const btnPrimary = (disabled) => ({
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    width:           '100%',
    height:          40,
    background:      disabled ? '#dadce0' : '#1A73E8',
    color:           disabled ? '#5F6368' : '#FFFFFF',
    border:          'none',
    borderRadius:    8,
    fontFamily:      'inherit',
    fontSize:        14,
    fontWeight:      600,
    cursor:          disabled ? 'not-allowed' : 'pointer',
    transition:      'background 150ms ease',
  });

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

  if (!otpSent) {
    return (
      <form onSubmit={requestOtp} noValidate>
        <ErrorAlert message={error} />
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="otp-phone"
            style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#202124' }}
          >
            Numéro WhatsApp
          </label>
          <input
            id="otp-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+229 97 00 00 00"
            required
            autoComplete="tel"
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = '#1A73E8'; }}
            onBlur={(e)  => { e.target.style.borderColor = '#E0E0E0'; }}
          />
          <p style={{ fontSize: 12, color: '#5F6368', marginTop: 5 }}>
            Incluez le code pays. Un code à 6 chiffres vous sera envoyé.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy || !phone.trim()}
          style={btnPrimary(busy || !phone.trim())}
        >
          {busy ? <Spinner /> : <IconPhone />}
          {busy ? 'Envoi…' : 'Recevoir le code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} noValidate>
      <InfoAlert message={info} />
      <ErrorAlert message={error} />
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="otp-code"
          style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#202124' }}
        >
          Code reçu par WhatsApp
        </label>
        <input
          id="otp-code"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          required
          autoFocus
          autoComplete="one-time-code"
          maxLength={8}
          style={{
            ...inputStyle,
            fontSize:      20,
            fontWeight:    700,
            letterSpacing: '0.4em',
            textAlign:     'center',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#1A73E8'; }}
          onBlur={(e)  => { e.target.style.borderColor = '#E0E0E0'; }}
        />
        <p style={{ fontSize: 12, color: '#5F6368', marginTop: 5 }}>
          Code envoyé au {phone}.
        </p>
      </div>
      <button
        type="submit"
        disabled={busy || code.length < 4}
        style={btnPrimary(busy || code.length < 4)}
      >
        {busy ? <Spinner /> : null}
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => { setOtpSent(false); setCode(''); setInfo(''); setError(''); }}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            4,
            background:     'none',
            border:         'none',
            color:          '#1A73E8',
            fontSize:       13,
            cursor:         'pointer',
            fontFamily:     'inherit',
          }}
        >
          <IconArrowLeft />
          Changer de numéro
        </button>
      </div>
    </form>
  );
}

// ─── Connexion fédérée ────────────────────────────────────────────────────────

function FederatedLogin({ onSuccess }) {
  const [busy,  setBusy]  = useState(false);
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

  const socialBtnStyle = {
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    width:       '100%',
    padding:     '10px 16px',
    marginBottom: 10,
    background:  '#FFFFFF',
    border:      '1px solid #E0E0E0',
    borderRadius: 8,
    fontFamily:  'inherit',
    fontSize:    14,
    fontWeight:  500,
    color:       '#202124',
    cursor:      busy ? 'not-allowed' : 'pointer',
    opacity:     busy ? 0.6 : 1,
    transition:  'background 150ms ease, border-color 150ms ease',
  };

  return (
    <div>
      <ErrorAlert message={error} />
      <button
        type="button"
        disabled={busy}
        style={socialBtnStyle}
        onClick={() => handleProvider('google')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F9FA'; e.currentTarget.style.borderColor = '#c9cccf'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E0E0E0'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><IconGoogle /></span>
        Continuer avec Google
      </button>
      <button
        type="button"
        disabled={busy}
        style={socialBtnStyle}
        onClick={() => handleProvider('github')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F9FA'; e.currentTarget.style.borderColor = '#c9cccf'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E0E0E0'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><IconGitHub /></span>
        Continuer avec GitHub
      </button>
      <p style={{ fontSize: 12, color: '#5F6368', textAlign: 'center', marginTop: 6 }}>
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
    flex:         1,
    padding:      '8px 12px',
    border:       'none',
    borderRadius: 6,
    fontFamily:   'inherit',
    fontSize:     13,
    fontWeight:   active ? 600 : 400,
    background:   active ? '#FFFFFF' : 'transparent',
    color:        active ? '#202124' : '#5F6368',
    boxShadow:    active ? '0 1px 2px rgba(32,33,36,.10)' : 'none',
    cursor:       'pointer',
    transition:   'all 150ms ease',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1A73E8' }}>
      {/* Topbar */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '18px 40px',
        flexShrink:     0,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="Palabre" style={{ width: 28, height: 28 }} />
          <span style={{ fontWeight: 700, fontSize: 18, color: '#FFFFFF', letterSpacing: '0.3px' }}>
            Palabre
          </span>
          <span style={{
            fontSize:    10,
            fontWeight:  700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color:       '#FFFFFF',
            background:  'rgba(255,255,255,.20)',
            padding:     '1px 6px',
            borderRadius: 3,
          }}>
            Dev
          </span>
        </a>
        <a
          href="https://palabre.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding:        '7px 14px',
            background:     'transparent',
            color:          '#FFFFFF',
            border:         '1px solid rgba(255,255,255,.4)',
            borderRadius:   8,
            fontFamily:     'inherit',
            fontSize:       13,
            fontWeight:     500,
            textDecoration: 'none',
          }}
        >
          Retour à Palabre
        </a>
      </div>

      {/* Corps centré */}
      <div style={{
        flex:           1,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '16px 24px 48px',
      }}>
        <div style={{
          background:   '#FFFFFF',
          borderRadius: 12,
          boxShadow:    '0 8px 32px rgba(32,33,36,.16)',
          width:        '100%',
          maxWidth:     420,
          padding:      '36px',
        }}>
          {/* Logo + titre */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img
              src="/logo.png"
              alt="Palabre"
              style={{ width: 52, height: 52, display: 'block', margin: '0 auto 12px' }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>
              Palabre for Developers
            </h1>
            <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
              Connectez-vous pour accéder à votre portail
            </p>
          </div>

          {/* Onglets méthode */}
          <div
            role="tablist"
            aria-label="Méthode de connexion"
            style={{
              display:      'flex',
              background:   '#F1F3F4',
              borderRadius: 8,
              padding:      4,
              gap:          4,
              marginBottom: 20,
            }}
          >
            <button
              role="tab"
              aria-selected={tab === 'social'}
              style={tabStyle(tab === 'social')}
              onClick={() => setTab('social')}
            >
              Google / GitHub
            </button>
            <button
              role="tab"
              aria-selected={tab === 'whatsapp'}
              style={tabStyle(tab === 'whatsapp')}
              onClick={() => setTab('whatsapp')}
            >
              OTP WhatsApp
            </button>
          </div>

          {/* Contenu */}
          {tab === 'social'   && <FederatedLogin onSuccess={handleSuccess} />}
          {tab === 'whatsapp' && <OtpWhatsApp    onSuccess={handleSuccess} />}

          {/* Pied */}
          <div style={{
            marginTop:  20,
            paddingTop: 18,
            borderTop:  '1px solid #E0E0E0',
            textAlign:  'center',
            fontSize:   13,
            color:      '#5F6368',
          }}>
            Nouveau sur Palabre ?{' '}
            <a
              href="https://palabre.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1A73E8', fontWeight: 500 }}
            >
              Créez un compte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
