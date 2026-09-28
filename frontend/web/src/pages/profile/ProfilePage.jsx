import { useState } from 'react';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { Camera, Mail, Bell, User, Globe, Clock, Shield, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [emailStep, setEmailStep] = useState('idle'); // idle | code_sent

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
  };

  const cardVariants = {
    hidden: { scale: 0.98, opacity: 0, y: 20 },
    visible: { scale: 1, opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const buttonHover = { scale: 1.02 };
  const buttonTap = { scale: 0.98 };

  const Spinner = () => <Loader2 className="animate-spin" size={16} />;

  return (
    <motion.div
      className="profile-container"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}
    >
      {/* Header avec avatar et badge */}
      <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          {user?.photoUrl ? (
            <motion.img
              src={user.photoUrl}
              alt="Photo de profil"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <User size={32} color="#94a3b8" />
            </div>
          )}
          {loading.photo && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner />
            </div>
          )}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Profil</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ color: '#64748b', fontSize: 14 }}>{user?.email || 'Aucun e-mail'}</span>
            {user?.isSuperAdmin && <Badge variant="danger">Super-administrateur</Badge>}
          </div>
        </div>
      </motion.div>

      {/* Alertes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Alert variant="danger">{error}</Alert>
          </motion.div>
        )}
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Alert variant="success">{notice}</Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carte Informations personnelles */}
      <motion.div className="card" variants={cardVariants} style={{ marginBottom: 20, padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <User size={20} color="#3b82f6" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Informations personnelles</h2>
        </div>

        <form onSubmit={saveInfo}>
          <div className="field">
            <label>Photo de profil</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <motion.label
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#475569'
                }}
              >
                <Camera size={16} />
                Changer la photo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files[0] && uploadPhoto(e.target.files[0])}
                />
              </motion.label>
              {loading.photo && <Spinner />}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="field">
              <label>Nom complet</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>Secteur d'activité</label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} />
            </div>
            <div className="field">
              <label><Globe size={14} style={{ marginRight: 4 }} /> Langue</label>
              <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="field">
              <label><Clock size={14} style={{ marginRight: 4 }} /> Fuseau horaire</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>

          <motion.button
            className="btn"
            type="submit"
            disabled={loading.info}
            whileHover={buttonHover}
            whileTap={buttonTap}
            style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
          >
            {loading.info ? <Spinner /> : <Check size={16} />}
            Enregistrer
          </motion.button>
        </form>
      </motion.div>

      {/* Carte Adresse e-mail */}
      <motion.div className="card" variants={cardVariants} style={{ marginBottom: 20, padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Mail size={20} color="#8b5cf6" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Adresse e-mail</h2>
        </div>

        <p style={{ color: '#64748b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          Actuelle : {user?.email || 'aucune'}
          {user?.emailVerified ? (
            <Badge variant="success"><Check size={12} style={{ marginRight: 4 }} /> Vérifiée</Badge>
          ) : user?.email ? (
            <Badge variant="warning"><X size={12} style={{ marginRight: 4 }} /> Non vérifiée</Badge>
          ) : null}
        </p>

        <AnimatePresence mode="wait">
          {emailStep === 'idle' ? (
            <motion.form
              key="email-request"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={requestEmailCode}
            >
              <div className="field">
                <label>Nouvelle adresse e-mail</label>
                <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
              </div>
              <motion.button
                className="btn"
                type="submit"
                disabled={loading.emailRequest}
                whileHover={buttonHover}
                whileTap={buttonTap}
                style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {loading.emailRequest ? <Spinner /> : <Mail size={16} />}
                Envoyer un code de vérification
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="email-confirm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={confirmEmail}
            >
              <div className="field">
                <label>Code reçu par e-mail</label>
                <input
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="Saisissez le code à 6 chiffres"
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <motion.button
                  className="btn"
                  type="submit"
                  disabled={loading.emailConfirm}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {loading.emailConfirm ? <Spinner /> : <Check size={16} />}
                  Confirmer
                </motion.button>
                <motion.button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => { setEmailStep('idle'); setEmailCode(''); }}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                >
                  Annuler
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Carte Préférences de notification */}
      <motion.div className="card" variants={cardVariants} style={{ padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Bell size={20} color="#f59e0b" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Préférences de notification</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.label
            whileHover={{ scale: 1.01 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: '#f8fafc' }}
          >
            <input
              type="checkbox"
              checked={notifEmail}
              onChange={(e) => setNotifEmail(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Notifications par e-mail</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Recevez un résumé et les alertes importantes par e-mail</div>
            </div>
          </motion.label>

          <motion.label
            whileHover={{ scale: 1.01 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: '#f8fafc' }}
          >
            <input
              type="checkbox"
              checked={notifPush}
              onChange={(e) => setNotifPush(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Notifications push</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Recevez des notifications en temps réel sur votre appareil</div>
            </div>
          </motion.label>
        </div>

        <motion.button
          className="btn"
          onClick={savePreferences}
          disabled={loading.prefs}
          whileHover={buttonHover}
          whileTap={buttonTap}
          style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading.prefs ? <Spinner /> : <Shield size={16} />}
          Enregistrer les préférences
        </motion.button>
      </motion.div>
    </motion.div>
  );
}