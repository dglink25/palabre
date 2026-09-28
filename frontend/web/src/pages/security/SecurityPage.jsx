import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { federatedProviders } from '../../lib/firebase';
import { registerPasskey, isPasskeySupported } from '../../lib/webauthn';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

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
    } catch (e) { setError(friendlyMessage(e)); }
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
    <div className="fade-in">
      <h1>Sécurité</h1>
      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      <div className="card">
        <h2>Passkeys</h2>
        <p className="text-secondary">
          Un passkey remplace le mot de passe : Touch ID, Windows Hello, votre empreinte, ou une clé de
          sécurité physique. {user?.twoFactorEnabled ? <Badge variant="success">Vérification en deux étapes activée</Badge> : <Badge variant="neutral">Non activée</Badge>}
        </p>
        <table style={{ marginBottom: 16 }}>
          <thead><tr><th>Nom</th><th>Ajouté le</th><th /></tr></thead>
          <tbody>
            {passkeys.map((c) => (
              <tr key={c.id}>
                <td>{c.label || 'Passkey sans nom'}</td>
                <td className="text-secondary">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                <td><button className="btn btn-danger" onClick={() => removePasskey(c.id)}>Supprimer</button></td>
              </tr>
            ))}
            {passkeys.length === 0 && <tr><td colSpan="3" className="text-secondary">Aucun passkey enregistré.</td></tr>}
          </tbody>
        </table>
        <button className="btn" onClick={addPasskey}>Ajouter un passkey</button>
        <p className="text-secondary" style={{ marginTop: 12 }}>
          Une fois un passkey ajouté, vous pouvez aussi l'utiliser pour vous connecter directement depuis
          l'écran de connexion, sans téléphone ni compte social.
        </p>
      </div>

      <div className="card">
        <h2>Questions de sécurité</h2>
        <p className="text-secondary">Utilisées en cas de mode de connexion oublié.</p>
        <form onSubmit={saveAnswers}>
          {questions.map((q) => (
            <div className="field" key={q.id}>
              <label>{q.label_fr}</label>
              <input value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
            </div>
          ))}
          <button className="btn">Enregistrer les réponses</button>
        </form>
      </div>

      <div className="card">
        <h2>Moyens de connexion associés</h2>
        <table style={{ marginBottom: 16 }}>
          <thead><tr><th>Type</th><th>Référence</th><th>Vérifié</th></tr></thead>
          <tbody>
            {recoveryMethods.map((m, i) => (
              <tr key={i}><td>{m.method_type}</td><td>{m.reference}</td><td>{m.verified ? <Badge variant="success">Oui</Badge> : <Badge variant="neutral">Non</Badge>}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="text-secondary">Associer un nouveau moyen (uniquement s'il n'est pas déjà utilisé par un autre compte) :</p>
        {['google', 'github', 'facebook', 'apple', 'tiktok'].map((key) => (
          <button key={key} className="btn btn-secondary" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => linkProvider(key)}>
            Associer {key}
          </button>
        ))}
      </div>
    </div>
  );
}
