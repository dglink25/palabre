import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { federatedProviders } from '../../lib/firebase';
import { registerPasskey, isPasskeySupported } from '../../lib/webauthn';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// SVG icons
const ShieldIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const KeyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);
const HelpCircleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const LinkIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
);
const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// Section card header
function CardHeader({ icon, color, children, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color, display: 'inline-flex' }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#202124' }}>{children}</h2>
      </div>
      {badge}
    </div>
  );
}

export default function SecurityPage() {
  const { user, refreshProfile } = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});

  const [passkeys, setPasskeys] = useState([]);
  const [recoveryMethods, setRecoveryMethods] = useState([]);

  async function loadAll() {
    try {
      const [qs, keys, methods] = await Promise.all([
        api.get('/security/questions', { auth: false }),
        api.get('/security/passkeys'),
        api.get('/me/recovery-methods'),
      ]);
      setQuestions(qs);
      setPasskeys(keys);
      setRecoveryMethods(methods);
    } catch (e) { setError(friendlyMessage(e)); }
  }
  useEffect(() => { loadAll(); }, []);

  async function saveAnswers(e) {
    e.preventDefault();
    setError(''); setNotice('');
    const payload = Object.entries(answers)
      .filter(([, v]) => v)
      .map(([questionId, answer]) => ({ questionId, answer }));
    try {
      await api.put('/security/questions/answers', { answers: payload });
      setNotice('Réponses enregistrées — elles pourront servir à récupérer votre compte.');
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function addPasskey() {
    setError(''); setNotice('');
    if (!isPasskeySupported()) {
      setError("Ce navigateur ne prend pas en charge les passkeys. Essayez avec Chrome, Safari ou Edge à jour.");
      return;
    }
    const label = window.prompt('Nom pour ce passkey (ex. "MacBook personnel", "Clé YubiKey")', navigator.platform || 'Cet appareil');
    if (label === null) return;
    try {
      await registerPasskey(label || 'Passkey');
      await refreshProfile();
      loadAll();
      setNotice('Passkey enregistré. Il pourra être utilisé pour vous connecter directement ou confirmer votre identité.');
    } catch (e) {
      // Ne pas afficher d'erreur si l'utilisateur a simplement annulé
      if (e.code === 'PASSKEY_CANCELLED') return;
      setError(friendlyMessage(e));
    }
  }

  async function removePasskey(id) {
    setError(''); setNotice('');
    try {
      await api.delete(`/security/passkeys/${id}`);
      await refreshProfile();
      loadAll();
      setNotice('Passkey supprimé.');
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function linkProvider(key) {
    setError(''); setNotice('');
    try {
      const { idToken } = await federatedProviders[key]();
      await api.post('/auth/federated/link', { idToken });
      loadAll();
      setNotice('Moyen de connexion associé à votre compte.');
    } catch (e) { setError(friendlyMessage(e)); }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'slideUp 0.3s ease' }}>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px 0', color: '#202124' }}>Sécurité</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
          Gérez vos méthodes d'authentification et de récupération de compte.
        </p>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {/* Passkeys section */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <CardHeader
          icon={<KeyIcon />}
          color="#1A73E8"
          badge={user?.twoFactorEnabled
            ? <Badge variant="success">2FA actif</Badge>
            : <Badge variant="neutral">2FA inactif</Badge>}
        >
          Passkeys
        </CardHeader>

        <p style={{ color: '#5F6368', fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>
          Un passkey remplace le mot de passe : Touch ID, Windows Hello, votre empreinte, ou une clé de sécurité physique.
        </p>

        {passkeys.length > 0 ? (
          <div style={{ border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            {passkeys.map((c, idx) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '13px 16px',
                  borderBottom: idx < passkeys.length - 1 ? '1px solid #E0E0E0' : 'none',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(26,115,232,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <KeyIcon size={15} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#202124' }}>{c.label || 'Passkey sans nom'}</div>
                    <div style={{ fontSize: 12, color: '#5F6368' }}>Ajouté le {new Date(c.createdAt).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => removePasskey(c.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <TrashIcon />
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '20px',
            background: '#F8F9FA',
            borderRadius: 8,
            textAlign: 'center',
            marginBottom: 16,
            border: '1px dashed #E0E0E0',
          }}>
            <div style={{ color: '#5F6368', fontSize: 14 }}>Aucun passkey enregistré.</div>
          </div>
        )}

        <button
          className="btn"
          onClick={addPasskey}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <PlusIcon />
          Ajouter une clé secrète
        </button>
        <p style={{ color: '#5F6368', fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
          Une fois un passkey ajouté, vous pouvez l'utiliser pour vous connecter directement depuis l'écran de connexion.
        </p>
      </div>

      {/* Security questions */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <CardHeader icon={<HelpCircleIcon />} color="#FBBC05">Questions de sécurité</CardHeader>

        <p style={{ color: '#5F6368', fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>
          Ces réponses seront utilisées pour récupérer votre compte en cas de perte d'accès.
        </p>

        <form onSubmit={saveAnswers}>
          {questions.map((q) => (
            <div className="field" key={q.id}>
              <label>{q.label_fr}</label>
              <input
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder="Votre réponse..."
              />
            </div>
          ))}
          {questions.length === 0 && (
            <p style={{ color: '#5F6368', fontSize: 14 }}>Chargement des questions...</p>
          )}
          <button className="btn" type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Enregistrer les réponses
          </button>
        </form>
      </div>

      {/* Recovery methods */}
      <div className="card" style={{ padding: '24px' }}>
        <CardHeader icon={<LinkIcon />} color="#34A853">Moyens de connexion associés</CardHeader>

        {recoveryMethods.length > 0 ? (
          <div style={{ border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden', marginBottom: 18 }}>
            {recoveryMethods.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < recoveryMethods.length - 1 ? '1px solid #E0E0E0' : 'none',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#202124', marginRight: 8, textTransform: 'capitalize' }}>
                    {m.method_type}
                  </span>
                  <span style={{ fontSize: 13, color: '#5F6368' }}>{m.reference}</span>
                </div>
                {m.verified
                  ? <Badge variant="success">Vérifié</Badge>
                  : <Badge variant="neutral">Non vérifié</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px', background: '#F8F9FA', borderRadius: 8, marginBottom: 18, border: '1px dashed #E0E0E0' }}>
            <p style={{ color: '#5F6368', fontSize: 14, margin: 0 }}>Aucun moyen de connexion associé.</p>
          </div>
        )}

        <p style={{ color: '#5F6368', fontSize: 14, marginBottom: 14, lineHeight: 1.6 }}>
          Associer un nouveau moyen (uniquement s'il n'est pas déjà utilisé par un autre compte) :
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['google', 'github', 'facebook', 'apple', 'tiktok'].map((key) => (
            <button
              key={key}
              className="btn btn-secondary btn-sm"
              onClick={() => linkProvider(key)}
              style={{ textTransform: 'capitalize' }}
            >
              Associer {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
