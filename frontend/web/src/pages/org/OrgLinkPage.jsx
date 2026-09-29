import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

/**
 * Page de liaison admin — "Joindre mon serveur local"
 *
 * L'administrateur d'organisation a installé son tenant sur son serveur.
 * Il scanne (ou colle) le QR payload généré lors de l'approbation.
 * → Liaison directe app web ↔ serveur local ↔ serveur central
 *
 * Le QR payload contient :
 *   { tenantId, controlToken, vpnPrivateKey, vpnPublicKey, heartbeatUrl }
 *
 * Seuls tenantId et controlToken sont envoyés au backend pour liaison.
 * vpnPrivateKey reste côté client (clé privée, jamais transmise).
 */
export default function OrgLinkPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [payloadText, setPayloadText] = useState('');
  const [parsed,      setParsed]      = useState(null);
  const [step,        setStep]        = useState('input'); // input | confirm | done
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');

  function parsePayload() {
    setError('');
    try {
      const data = JSON.parse(payloadText.trim());
      if (!data.tenantId || !data.controlToken) {
        setError('Payload invalide : tenantId et controlToken sont requis.');
        return;
      }
      setParsed(data);
      setStep('confirm');
    } catch {
      setError('Format JSON invalide. Collez le contenu exact du QR code.');
    }
  }

  async function confirmLink() {
    setError(''); setBusy(true);
    try {
      const result = await api.post('/org/link/admin', {
        tenantId:     parsed.tenantId,
        controlToken: parsed.controlToken,
      });
      await refreshProfile();
      setStep('done');
      setTimeout(() => navigate('/org/dashboard'), 1500);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Lier mon organisation</h1>
      <p className="text-secondary">
        Collez le contenu du QR code transmis lors de l'approbation de votre dossier
        pour connecter votre compte à votre serveur local.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {step === 'done' && (
        <Alert variant="success">
          Organisation liée avec succès. Redirection vers votre tableau de bord...
        </Alert>
      )}

      {step === 'input' && (
        <div className="card">
          <div className="field">
            <label>Contenu du QR code (payload JSON)</label>
            <textarea
              rows={8}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              placeholder={`{\n  "tenantId": "...",\n  "controlToken": "...",\n  ...\n}`}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
            <div className="hint">
              Récupérez ce contenu depuis l'e-mail reçu lors de l'approbation,
              ou demandez-le au super-administrateur.
            </div>
          </div>
          <button className="btn btn-block" onClick={parsePayload} disabled={!payloadText.trim()}>
            Analyser le payload
          </button>
        </div>
      )}

      {step === 'confirm' && parsed && (
        <div className="card">
          <h2>Confirmer la liaison</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)', width: 160 }}>Identifiant tenant</td>
                <td style={{ padding: '10px 0', fontFamily: 'monospace', fontSize: 13 }}>{parsed.tenantId}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>Heartbeat URL</td>
                <td style={{ padding: '10px 0', fontSize: 13 }}>{parsed.heartbeatUrl || 'Non specifie'}</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>Cle VPN</td>
                <td style={{ padding: '10px 0', fontSize: 13, color: 'var(--color-success-green)' }}>
                  Presente (stockee localement, jamais transmise)
                </td>
              </tr>
            </tbody>
          </table>

          <Alert variant="warning">
            Cette action lie votre compte à l'organisation identifiée ci-dessus.
            Assurez-vous que le payload provient bien du super-administrateur Palabre.
          </Alert>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-success btn-block" onClick={confirmLink} disabled={busy}>
              {busy ? <Spinner /> : 'Confirmer la liaison'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setStep('input'); setParsed(null); setError(''); }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h2>Comment obtenir le payload ?</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 15 }}>
          <li>Votre dossier d'organisation doit avoir été approuvé par le super-administrateur.</li>
          <li>Lors de l'approbation, un QR code est généré et affiché sur la page du dossier.</li>
          <li>Téléchargez l'image PNG du QR code et scannez-le avec un lecteur QR.</li>
          <li>Le contenu JSON obtenu est à coller dans le champ ci-dessus.</li>
        </ol>
      </div>
    </div>
  );
}
