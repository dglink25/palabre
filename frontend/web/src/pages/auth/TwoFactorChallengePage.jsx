import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPasskeyTwoFactor, isPasskeySupported } from '../../lib/webauthn';
import { friendlyMessage } from '../../lib/errorMessages';
import { Alert } from '../../components/ui';
import AuthLayout from '../../components/AuthLayout';

export default function TwoFactorChallengePage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify() {
    setError(''); setBusy(true);
    try {
      await verifyPasskeyTwoFactor();
      navigate('/profile');
    } catch (e) { setError(friendlyMessage(e)); } finally { setBusy(false); }
  }

  return (
    <AuthLayout>
      <h1>Vérification en deux étapes</h1>
      <p className="text-secondary">Confirmez votre identité avec l'une de vos clé secrète.</p>
      <Alert variant="danger">{error}</Alert>
      {!isPasskeySupported() && (
        <Alert variant="warning">Ce navigateur ne prend pas en charge les passkeys.</Alert>
      )}
      <button className="btn btn-block" disabled={busy || !isPasskeySupported()} onClick={verify}>
        Vérifier avec une clé secrète
      </button>
    </AuthLayout>
  );
}
