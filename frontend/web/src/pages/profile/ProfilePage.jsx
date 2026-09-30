import { useState } from 'react';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// SVG icons (inline, no external deps)
const UserIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const MailIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const BellIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const CameraIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const GlobeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
);
const ClockIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.7s linear infinite' }}>
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>
);

// Section card header
function CardHeader({ icon, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #F0F0F0' }}>
      <span style={{ color, display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#202124' }}>{children}</h2>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState({});

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [sector, setSector] = useState(user?.sector || '');
  const [locale, setLocale] = useState(user?.locale || 'fr');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Porto-Novo');

  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState('idle');

  const [notifEmail, setNotifEmail] = useState(!!user?.preferences?.notifications?.email);
  const [notifPush, setNotifPush] = useState(!!user?.preferences?.notifications?.push);

  const setLoadingKey = (key, value) => setLoading(prev => ({ ...prev, [key]: value }));

  async function saveInfo(e) {
    e.preventDefault();
    setError(''); setNotice('');
    setLoadingKey('info', true);
    try {
      await api.patch('/me', { fullName, sector, locale, timezone });
      await refreshProfile();
      setNotice('Profil mis à jour.');
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setLoadingKey('info', false); }
  }

  async function uploadPhoto(file) {
    setError(''); setNotice('');
    setLoadingKey('photo', true);
    const form = new FormData();
    form.append('photo', file);
    try {
      await api.upload('/me/photo', form);
      await refreshProfile();
      setNotice('Photo mise à jour.');
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setLoadingKey('photo', false); }
  }

  async function requestEmailCode(e) {
    e.preventDefault();
    setError(''); setNotice('');
    setLoadingKey('emailRequest', true);
    try {
      await api.post('/me/email/request-verification', { email: emailInput });
      setEmailStep('code_sent');
      setNotice('Code envoyé par e-mail.');
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setLoadingKey('emailRequest', false); }
  }

  async function confirmEmail(e) {
    e.preventDefault();
    setError(''); setNotice('');
    setLoadingKey('emailConfirm', true);
    try {
      await api.post('/me/email/confirm', { email: emailInput, code: emailCode });
      await refreshProfile();
      setEmailStep('idle');
      setEmailCode('');
      setNotice('Adresse e-mail vérifiée et associée à votre compte.');
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setLoadingKey('emailConfirm', false); }
  }

  async function savePreferences() {
    setError(''); setNotice('');
    setLoadingKey('prefs', true);
    try {
      await api.patch('/me/preferences', { notifications: { email: notifEmail, push: notifPush } });
      await refreshProfile();
      setNotice('Préférences enregistrées.');
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setLoadingKey('prefs', false); }
  }

  // Get initials for avatar
  const initials = (user?.fullName || user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'slideUp 0.3s ease' }}>
      {/* Profile header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        marginBottom: 28,
        padding: '20px 24px',
        background: '#fff',
        border: '1px solid #E0E0E0',
        borderRadius: 10,
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt="Photo de profil"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#1A73E8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{initials}</span>
            </div>
          )}
          {loading.photo && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.75)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SpinnerIcon />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 800, color: '#202124' }}>
            {user?.fullName || 'Profil'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: '#5F6368', fontSize: 14 }}>{user?.email || 'Aucun e-mail'}</span>
            {user?.isSuperAdmin && <Badge variant="danger">Super-administrateur</Badge>}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* Personal info card */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <CardHeader icon={<UserIcon />} color="#1A73E8">Informations personnelles</CardHeader>

        <form onSubmit={saveInfo}>
          {/* Photo upload */}
          <div className="field">
            <label>Photo de profil</label>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #E0E0E0',
              background: '#F8F9FA',
              cursor: 'pointer',
              fontSize: 14,
              color: '#5F6368',
              transition: 'border-color 0.15s, background 0.15s',
              height: 40,
            }}>
              <CameraIcon />
              Changer la photo
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files[0] && uploadPhoto(e.target.files[0])}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label>Nom complet</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div className="field">
              <label>Secteur d'activité</label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex. Finance, Santé..." />
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <GlobeIcon /> Langue
              </label>
              <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ClockIcon /> Fuseau horaire
              </label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Porto-Novo" />
            </div>
          </div>

          <button
            className="btn"
            type="submit"
            disabled={loading.info}
            style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loading.info ? <SpinnerIcon /> : <CheckIcon />}
            Enregistrer
          </button>
        </form>
      </div>

      {/* Email card */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <CardHeader icon={<MailIcon />} color="#8b5cf6">Adresse e-mail</CardHeader>

        <p style={{ color: '#5F6368', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          Actuelle : <strong style={{ color: '#202124' }}>{user?.email || 'aucune'}</strong>
          {user?.emailVerified ? (
            <Badge variant="success">Vérifiée</Badge>
          ) : user?.email ? (
            <Badge variant="warning">Non vérifiée</Badge>
          ) : null}
        </p>

        {emailStep === 'idle' ? (
          <form onSubmit={requestEmailCode}>
            <div className="field">
              <label>Nouvelle adresse e-mail</label>
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="adresse@exemple.com" />
            </div>
            <button
              className="btn"
              type="submit"
              disabled={loading.emailRequest}
              style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {loading.emailRequest ? <SpinnerIcon /> : <MailIcon size={14} />}
              Envoyer un code de vérification
            </button>
          </form>
        ) : (
          <form onSubmit={confirmEmail}>
            <div className="field">
              <label>Code reçu par e-mail</label>
              <input
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="Code à 6 chiffres"
                style={{ letterSpacing: 4, fontSize: 20, textAlign: 'center' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                className="btn"
                type="submit"
                disabled={loading.emailConfirm}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {loading.emailConfirm ? <SpinnerIcon /> : <CheckIcon />}
                Confirmer
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => { setEmailStep('idle'); setEmailCode(''); }}
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Notification preferences */}
      <div className="card" style={{ padding: '24px' }}>
        <CardHeader icon={<BellIcon />} color="#f59e0b">Préférences de notification</CardHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[
            {
              key: 'email',
              checked: notifEmail,
              onChange: setNotifEmail,
              label: 'Notifications par e-mail',
              desc: 'Recevez un résumé et les alertes importantes par e-mail',
            },
            {
              key: 'push',
              checked: notifPush,
              onChange: setNotifPush,
              label: 'Notifications push',
              desc: 'Recevez des notifications en temps réel sur votre appareil',
            },
          ].map(({ key, checked, onChange, label, desc }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #E0E0E0',
                background: checked ? 'rgba(26,115,232,0.04)' : '#F8F9FA',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
                borderColor: checked ? 'rgba(26,115,232,0.2)' : '#E0E0E0',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#1A73E8', marginTop: 2, cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#202124' }}>{label}</div>
                <div style={{ fontSize: 13, color: '#5F6368', marginTop: 2 }}>{desc}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          className="btn"
          onClick={savePreferences}
          disabled={loading.prefs}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {loading.prefs ? <SpinnerIcon /> : <CheckIcon />}
          Enregistrer les préférences
        </button>
      </div>
    </div>
  );
}
