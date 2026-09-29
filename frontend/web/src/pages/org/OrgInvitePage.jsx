import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

/**
 * Page de gestion des invitations de l'organisation.
 * Permet à l'admin de générer un code + QR code à partager aux membres.
 */
export default function OrgInvitePage() {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [joinCode, setJoinCode] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');

  async function generate() {
    setError(''); setNotice(''); setBusy(true);
    try {
      const result = await api.post('/org/join-code/generate');
      setJoinCode(result.joinCode);
      setNotice('Nouveau code genere. Partagez-le a vos membres.');
      // Générer le QR code avec orgId + joinCode — format JSON lu par le scanner web ET mobile
      if (canvasRef.current) {
        const payload = JSON.stringify({ orgId: result.orgId || user?.orgId, joinCode: result.joinCode });
        QRCode.toCanvas(canvasRef.current, payload, { width: 240, margin: 2, errorCorrectionLevel: 'M' });
      }
    } catch (e) {
      setError(friendlyMessage(e));
    } finally { setBusy(false); }
  }

  function downloadQr() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'palabre-invitation.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Invitations membres</h1>
      <p className="text-secondary">
        Generez un code d'invitation pour permettre a vos membres de rejoindre
        votre organisation depuis l'application Palabre (web ou mobile).
      </p>

      {error  && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="card">
        <h2>Code d'invitation actuel</h2>
        {joinCode ? (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
            <div>
              <canvas ref={canvasRef} style={{ display: 'block', border: '1px solid var(--color-border)' }} />
              <button className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={downloadQr}>
                Télécharger le QR code
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Identifiant organisation
              </p>
              <code style={{ fontSize: 13, display: 'block', marginBottom: 16, wordBreak: 'break-all' }}>
                {user?.orgId}
              </code>
              <p style={{ margin: '0 0 4px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Code d'invitation
              </p>
              <div style={{
                fontFamily: 'monospace', fontSize: 28, fontWeight: 800,
                letterSpacing: 8, color: 'var(--color-primary-blue)',
                padding: '12px 0',
              }}>
                {joinCode}
              </div>
              <p className="text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
                Partagez cet identifiant et ce code a vos membres. Le code peut etre
                regenere a tout moment (l'ancien devient invalide).
              </p>
            </div>
          </div>
        ) : (
          <p className="text-secondary">Aucun code genere. Cliquez sur le bouton ci-dessous pour en creer un.</p>
        )}

        <button
          className="btn btn-block"
          style={{ marginTop: 20 }}
          onClick={generate}
          disabled={busy}
        >
          {busy ? <Spinner /> : joinCode ? 'Regenerer un nouveau code' : 'Generer un code d\'invitation'}
        </button>
      </div>

      <div className="card">
        <h2>Instructions pour les membres</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 15 }}>
          <li>Le membre ouvre l'application Palabre (web ou mobile).</li>
          <li>Il clique sur "Rejoindre une organisation".</li>
          <li>Il scanne le QR code ou saisit l'identifiant + le code manuellement.</li>
          <li>Il confirme — il est automatiquement lié a votre organisation.</li>
        </ol>
      </div>
    </div>
  );
}
