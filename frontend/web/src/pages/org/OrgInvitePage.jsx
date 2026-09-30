import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'palabre_invite_code';

export default function OrgInvitePage() {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [joinCode, setJoinCode] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');

  // ── Restaurer le code depuis localStorage au montage ────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY + '_' + user?.orgId);
    if (stored) {
      try {
        const { code } = JSON.parse(stored);
        if (code) setJoinCode(code);
      } catch (_) {}
    }
    setLoading(false);
  }, [user?.orgId]);

  // ── Générer le QR dès que joinCode ET canvasRef sont prêts ────────────────
  useEffect(() => {
    if (!joinCode || !canvasRef.current || !user?.orgId) return;
    const payload = JSON.stringify({ orgId: user.orgId, joinCode });
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#202124', light: '#ffffff' },
    }).catch(err => console.error('[QR]', err));
  }, [joinCode, user?.orgId]);

  // ── Générer un nouveau code ──────────────────────────────────────────────
  async function generate() {
    setError(''); setNotice(''); setBusy(true);
    try {
      const result = await api.post('/org/join-code/generate');
      const code = result.joinCode;
      const orgId = result.orgId || user?.orgId;

      // Persister dans localStorage pour survivre aux actualisations
      localStorage.setItem(
        STORAGE_KEY + '_' + orgId,
        JSON.stringify({ code, orgId, generatedAt: Date.now() })
      );

      setJoinCode(code);
      setNotice('Nouveau code genere. Partagez-le a vos membres.');
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ paddingBottom: 20, marginBottom: 28, borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ margin: 0 }}>Invitations membres</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 15 }}>
          Generez un code d'invitation pour permettre a vos membres de rejoindre votre organisation.
        </p>
      </div>

      {error  && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* ── Code + QR ── */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '24px', marginBottom: 20 }}>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Code d'invitation actuel
        </p>

        {joinCode ? (
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* QR code */}
            <div style={{ flexShrink: 0 }}>
              <canvas ref={canvasRef}
                style={{ display: 'block', border: '1px solid var(--color-border)', borderRadius: 6 }} />
              <button className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 10 }} onClick={downloadQr}>
                Telecharger le QR code
              </button>
            </div>

            {/* Infos texte */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Identifiant organisation
                </div>
                <code style={{
                  fontSize: 12, background: 'var(--color-offwhite)',
                  border: '1px solid var(--color-border)', borderRadius: 4,
                  padding: '5px 8px', display: 'block', wordBreak: 'break-all',
                }}>
                  {user?.orgId}
                </code>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Code d'invitation
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 30, fontWeight: 800,
                  letterSpacing: 10, color: 'var(--color-primary-blue)',
                }}>
                  {joinCode}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Partagez cet identifiant et ce code a vos membres.
                Le code peut etre regenere a tout moment (l'ancien devient invalide).
              </p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3, marginBottom: 12 }}>
              <path d="M3 3h6v6H3z"/><path d="M15 3h6v6h-6z"/><path d="M3 15h6v6H3z"/>
              <path d="M15 15h2v2h-2z"/><path d="M19 15v2"/><path d="M15 19h2"/><path d="M19 19h2"/><path d="M19 21v-2"/>
            </svg>
            <p style={{ fontSize: 15 }}>Aucun code genere. Cliquez sur le bouton ci-dessous.</p>
          </div>
        )}

        <button
          className="btn btn-block"
          style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={generate}
          disabled={busy}
        >
          {busy ? <Spinner /> : joinCode ? 'Regenerer un nouveau code' : 'Generer un code d\'invitation'}
        </button>
      </div>

      {/* ── Instructions ── */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '20px 24px' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Instructions pour les membres
        </p>
        <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 2 }}>
          <li>Ouvrir Palabre (web ou mobile) et aller dans "Rejoindre une organisation"</li>
          <li>Scanner le QR code ci-dessus ou saisir l'identifiant + le code manuellement</li>
          <li>Confirmer — acces immediat aux conversations et appels</li>
        </ol>
      </div>
    </div>
  );
}
