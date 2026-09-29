import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

/**
 * Page pour rejoindre une organisation.
 *
 * Deux méthodes :
 * 1. Saisie manuelle : identifiant organisation + code d'invitation
 * 2. Scan QR code (web : via webcam ou import image)
 *
 * Flux :
 *   → Prévisualisation de l'organisation (nom, logo)
 *   → Confirmation
 *   → Liaison membership → redirect dashboard
 */
export default function OrgJoinPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [orgId,    setOrgId]    = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [preview,  setPreview]  = useState(null);
  const [step,     setStep]     = useState('form'); // form | preview | done
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  // Charger la prévisualisation quand l'orgId est saisi
  async function loadPreview() {
    if (!orgId.trim()) return;
    setError(''); setBusy(true);
    try {
      const data = await api.get(`/org/join-info/${orgId.trim()}`);
      setPreview(data);
      setStep('preview');
    } catch (e) {
      setError(friendlyMessage(e));
    } finally { setBusy(false); }
  }

  async function confirmJoin() {
    if (!joinCode.trim()) { setError('Le code d\'invitation est requis.'); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/org/join', { orgId: orgId.trim(), joinCode: joinCode.trim() });
      await refreshProfile();
      setStep('done');
      setTimeout(() => navigate('/profile'), 1500);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1>Rejoindre une organisation</h1>
      <p className="text-secondary">
        Entrez l'identifiant et le code d'invitation fournis par votre administrateur,
        ou scannez le QR code de votre organisation.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {step === 'done' && (
        <Alert variant="success">
          Vous avez rejoint l'organisation. Redirection en cours...
        </Alert>
      )}

      {step === 'form' && (
        <div className="card">
          <div className="field">
            <label>Identifiant de l'organisation</label>
            <input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <button className="btn btn-block" onClick={loadPreview} disabled={busy || !orgId.trim()}>
            {busy ? <Spinner /> : 'Suivant'}
          </button>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="card">
          {/* Aperçu organisation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '16px', background: 'var(--color-offwhite)', borderRadius: 8 }}>
            {preview.logoUrl
              ? <img src={preview.logoUrl} alt={preview.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
              : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20 }}>
                  {preview.name.charAt(0).toUpperCase()}
                </div>
              )
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{preview.name}</div>
              <div className="text-secondary" style={{ fontSize: 13 }}>
                {[preview.sector, preview.city, preview.country].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div className="field">
            <label>Code d'invitation (fourni par votre administrateur)</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="XXXXXXXX"
              style={{ letterSpacing: 4, fontWeight: 'bold', fontSize: 18 }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-block btn-success" onClick={confirmJoin} disabled={busy}>
              {busy ? <Spinner /> : 'Confirmer et rejoindre'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setStep('form'); setPreview(null); setError(''); }}>
              Retour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
