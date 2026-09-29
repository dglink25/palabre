import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { federatedProviders } from '../../lib/firebase';
import { getDeviceInfo } from '../../lib/device';
import { useAuth } from '../../context/AuthContext';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import AuthLayout from '../../components/AuthLayout';

// ── Étapes ────────────────────────────────────────────────────────────────────
// 1. Saisie de l'identifiant org + code d'activation
// 2. Choix du moyen de connexion (téléphone / email / Google)
// 3. Saisie du code OTP (téléphone ou email)
// 4. Session ouverte → dashboard

const STEP_CODE    = 'code';
const STEP_METHOD  = 'method';
const STEP_OTP     = 'otp';

export default function AdminActivationPage() {
  const { applySession } = useAuth();
  const navigate         = useNavigate();

  // Étape courante
  const [step, setStep] = useState(STEP_CODE);

  // Données de l'étape 1
  const [orgId, setOrgId]   = useState('');
  const [code,  setCode]    = useState('');

  // Données retournées par /invitations/activate
  const [activationToken, setActivationToken] = useState('');
  const [phoneHint,  setPhoneHint]  = useState('');
  const [emailHint,  setEmailHint]  = useState('');
  const [hasPhone,   setHasPhone]   = useState(false);
  const [hasEmail,   setHasEmail]   = useState(false);
  const [fullName,   setFullName]   = useState('');

  // Étape 3 — méthode choisie + hint affiché
  const [chosenMethod, setChosenMethod] = useState('');
  const [otpHint,      setOtpHint]      = useState('');
  const [otp,          setOtp]          = useState('');

  // UI
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [expired,  setExpired]  = useState(false);  // code expiré
  const [renewed,  setRenewed]  = useState(false);  // renouvellement envoyé

  // ── Étape 1 : valider le code d'activation ──────────────────────────────────
  async function submitCode(e) {
    e.preventDefault();
    if (!orgId.trim() || !code.trim()) {
      setError('Identifiant et code d\'activation sont requis.');
      return;
    }
    setError(''); setExpired(false); setRenewed(false); setBusy(true);
    try {
      const res = await api.post('/onboarding/invitations/activate', {
        organizationId: orgId.trim(),
        code: code.trim(),
      }, { auth: false });

      setActivationToken(res.activationToken);
      setPhoneHint(res.phoneHint);
      setEmailHint(res.emailHint);
      setHasPhone(res.hasPhone);
      setHasEmail(res.hasEmail);
      setFullName(res.fullName || '');
      setStep(STEP_METHOD);
    } catch (e) {
      if (e?.code === 'INVITATION_EXPIRED') {
        setExpired(true);
        setError('');
      } else {
        setError(friendlyMessage(e));
      }
    } finally { setBusy(false); }
  }

  async function renewCode() {
    if (!orgId.trim()) { setError('Entrez d\'abord l\'identifiant de l\'organisation.'); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/onboarding/invitations/renew', { organizationId: orgId.trim() }, { auth: false });
      setRenewed(true);
      setExpired(false);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally { setBusy(false); }
  }

  // ── Étape 2 : choisir téléphone ou email → envoyer OTP ──────────────────────
  async function chooseMethod(method) {
    setError(''); setBusy(true);
    try {
      const res = await api.post('/onboarding/invitations/send-otp', {
        activationToken,
        method,
      }, { auth: false });
      setChosenMethod(method);
      setOtpHint(res.hint);
      setStep(STEP_OTP);
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  // ── Étape 2 bis : continuer avec Google ─────────────────────────────────────
  async function continueWithGoogle() {
    setError(''); setBusy(true);
    try {
      const { idToken } = await federatedProviders.google();
      const session = await api.post('/onboarding/invitations/link', {
        activationToken,
        method:     'google',
        credential: { idToken },
        ...getDeviceInfo(),
      }, { auth: false });
      applySession(session);
      if (session.user?.isSuperAdmin) navigate('/admin');
      else if (session.user?.orgId) navigate('/org/dashboard');
      else navigate('/profile');
    } catch (e) { setError(friendlyMessage(e)); setBusy(false); }
  }

  // ── Étape 3 : soumettre le code OTP ─────────────────────────────────────────
  async function submitOtp(e) {
    e.preventDefault();
    if (!otp.trim()) { setError('Entrez le code reçu.'); return; }
    setError(''); setBusy(true);
    try {
      const session = await api.post('/onboarding/invitations/link', {
        activationToken,
        method:     chosenMethod,
        credential: { code: otp.trim() },
        ...getDeviceInfo(),
      }, { auth: false });
      applySession(session);
      if (session.user?.isSuperAdmin) navigate('/admin');
      else if (session.user?.orgId) navigate('/org/dashboard');
      else navigate('/profile');
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      {/* ── Étape 1 : code d'activation ── */}
      {step === STEP_CODE && (
        <>
          <h1>Activer votre compte administrateur</h1>
          <p className="text-secondary">
            Saisissez l'identifiant de votre organisation et le code d'activation
            reçus par e-mail et WhatsApp.
          </p>
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Code expiré */}
          {expired && (
            <div style={{ marginBottom: 16 }}>
              <Alert variant="warning">
                <strong>Code expire.</strong> Votre code d'activation n'est plus valable (duree de validite : 72h).
                Vous pouvez en demander un nouveau ci-dessous.
              </Alert>
              {!renewed ? (
                <button
                  className="btn btn-block"
                  onClick={renewCode}
                  disabled={busy}
                  style={{ marginTop: 8 }}
                >
                  {busy ? <Spinner /> : 'Recevoir un nouveau code par e-mail et WhatsApp'}
                </button>
              ) : (
                <Alert variant="success">
                  Nouveau code envoye. Verifiez votre e-mail et votre WhatsApp puis saisissez-le ci-dessus.
                </Alert>
              )}
            </div>
          )}
          <form onSubmit={submitCode}>
            <div className="field">
              <label>Identifiant de l'organisation</label>
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label>Code d'activation</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXXXXXX"
                autoComplete="off"
                style={{ letterSpacing: 4, fontWeight: 'bold' }}
              />
            </div>
            <button className="btn btn-block" disabled={busy}>
              {busy ? <Spinner /> : 'Valider le code'}
            </button>
          </form>
          <div className="spacer" />
          <p className="text-secondary">
            Compte déjà activé ? <Link to="/login">Se connecter</Link>
          </p>
        </>
      )}

      {/* ── Étape 2 : choisir le moyen de connexion ── */}
      {step === STEP_METHOD && (
        <>
          <h1>Bienvenue{fullName ? `, ${fullName}` : ''}</h1>
          <p className="text-secondary">
            Votre code est valide. Choisissez comment vous connecter à votre compte
            administrateur <strong>Palabre</strong>. Ce choix ne s'applique qu'à cette
            première connexion. Vous pourrez ajouter d'autres moyens depuis vos paramètres.
          </p>
          {error && <Alert variant="danger">{error}</Alert>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {/* Téléphone */}
            {hasPhone && (
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start' }}
                onClick={() => chooseMethod('phone')}
                disabled={busy}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                <span>
                  <strong>Continuer avec le téléphone</strong>
                  <br />
                  <small style={{ color: 'var(--color-text-secondary)' }}>Code envoyé au {phoneHint}</small>
                </span>
              </button>
            )}

            {/* Email */}
            {hasEmail && (
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start' }}
                onClick={() => chooseMethod('email')}
                disabled={busy}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span>
                  <strong>Continuer avec l'e-mail</strong>
                  <br />
                  <small style={{ color: 'var(--color-text-secondary)' }}>Code envoyé à {emailHint}</small>
                </span>
              </button>
            )}

            {/* Google */}
            {hasEmail && (
              <>
                <div className="divider">ou</div>
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}
                  onClick={continueWithGoogle}
                  disabled={busy}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continuer avec Google
                </button>
              </>
            )}
          </div>

          {busy && <div style={{ marginTop: 16, textAlign: 'center' }}><Spinner /></div>}

          <div className="spacer" />
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => { setStep(STEP_CODE); setError(''); }}
          >
            Retour
          </button>
        </>
      )}

      {/* ── Étape 3 : saisie OTP ── */}
      {step === STEP_OTP && (
        <>
          <h1>Vérification</h1>
          <p className="text-secondary">
            {chosenMethod === 'phone'
              ? `Un code OTP a été envoyé par WhatsApp au numéro se terminant par ${otpHint}.`
              : `Un code de vérification a été envoyé à l'adresse ${otpHint}.`}
          </p>
          {error && <Alert variant="danger">{error}</Alert>}
          <form onSubmit={submitOtp}>
            <div className="field">
              <label>Code de vérification</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="------"
                maxLength={6}
                style={{ letterSpacing: 8, fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}
                autoFocus
              />
            </div>
            <button className="btn btn-block" disabled={busy}>
              {busy ? <Spinner /> : 'Confirmer et accéder au dashboard'}
            </button>
          </form>
          <div className="spacer" />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setStep(STEP_METHOD); setOtp(''); setError(''); }}
            >
              Changer de méthode
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => chooseMethod(chosenMethod)}
              disabled={busy}
            >
              Renvoyer le code
            </button>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
