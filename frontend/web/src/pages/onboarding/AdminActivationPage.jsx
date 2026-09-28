import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { getDeviceInfo } from '../../lib/device';
import { useAuth } from '../../context/AuthContext';
import { Alert } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import AuthLayout from '../../components/AuthLayout';

export default function AdminActivationPage() {
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const session = await api.post('/onboarding/invitations/activate', {
        organizationId, code, ...getDeviceInfo(),
      }, { auth: false });
      applySession(session);
      navigate('/profile');
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  return (
    <AuthLayout>
      <h1>Activer votre compte administrateur</h1>
      <p className="text-secondary">Utilisez le code d'activation reçu par e-mail et WhatsApp après l'approbation de votre organisation.</p>
      <Alert variant="danger">{error}</Alert>
      <form onSubmit={submit}>
        <div className="field">
          <label>Identifiant de l'organisation</label>
          <input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
        </div>
        <div className="field">
          <label>Code d'activation</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn btn-block" disabled={busy}>Activer</button>
      </form>
      <div className="spacer" />
      <p className="text-secondary">
        Vous avez déjà activé votre compte ? <Link to="/login">Se connecter</Link>.
      </p>
    </AuthLayout>
  );
}
