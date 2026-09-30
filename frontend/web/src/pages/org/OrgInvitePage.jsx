import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'palabre_invite_code';

// SVG icons
const QrIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h6v6H3z"/><path d="M15 3h6v6h-6z"/><path d="M3 15h6v6H3z"/>
    <path d="M15 15h2v2h-2z"/><path d="M19 15v2"/><path d="M15 19h2"/><path d="M19 19h2"/><path d="M19 21v-2"/>
  </svg>
);
const DownloadIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const RefreshCwIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
);
const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export default function OrgInvitePage() {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [joinCode, setJoinCode] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');

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

  useEffect(() => {
    if (!joinCode || !canvasRef.current || !user?.orgId) return;
    const payload = JSON.stringify({ orgId: user.orgId, joinCode });
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#202124', light: '#ffffff' },
    }).catch(err => console.error('[QR]', err));
  }, [joinCode, user?.orgId]);

  async function generate() {
    setError(''); setNotice(''); setBusy(true);
    try {
      const result = await api.post('/org/join-code/generate');
      const code = result.joinCode;
      const orgId = result.orgId || user?.orgId;
      localStorage.setItem(
        STORAGE_KEY + '_' + orgId,
        JSON.stringify({ code, orgId, generatedAt: Date.now() })
      );
      setJoinCode(code);
      setNotice('Nouveau code généré. Partagez-le à vos membres.');
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', animation: 'slideUp 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px 0', color: '#202124' }}>
          Invitations membres
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#5F6368', lineHeight: 1.6 }}>
          Générez un code d'invitation pour permettre à vos membres de rejoindre votre organisation.
        </p>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {/* Main invite card */}
      <div style={{
        background: '#fff',
        border: '1px solid #E0E0E0',
        borderRadius: 10,
        padding: '24px',
        marginBottom: 16,
      }}>
        <p style={{ margin: '0 0 18px 0', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Code d'invitation actuel
        </p>

        {joinCode ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* QR code */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                padding: 12,
                border: '1px solid #E0E0E0',
                borderRadius: 8,
                display: 'inline-block',
                background: '#fff',
              }}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                onClick={downloadQr}
              >
                <DownloadIcon />
                Télécharger le QR
              </button>
            </div>

            {/* Code info */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Identifiant organisation
                </div>
                <code style={{
                  fontSize: 12,
                  background: '#F8F9FA',
                  border: '1px solid #E0E0E0',
                  borderRadius: 6,
                  padding: '6px 10px',
                  display: 'block',
                  wordBreak: 'break-all',
                  color: '#202124',
                  lineHeight: 1.5,
                }}>
                  {user?.orgId}
                </code>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Code d'invitation
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: 10,
                  color: '#1A73E8',
                  background: 'rgba(26,115,232,0.06)',
                  border: '1px solid rgba(26,115,232,0.2)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'inline-block',
                }}>
                  {joinCode}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: '#5F6368', lineHeight: 1.6 }}>
                Partagez cet identifiant et ce code à vos membres.
                Le code peut être régénéré à tout moment (l'ancien devient invalide).
              </p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ color: '#C0C0C0', marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <QrIcon size={52} />
            </div>
            <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
              Aucun code généré. Cliquez sur le bouton ci-dessous pour en créer un.
            </p>
          </div>
        )}

        {/* Generate button */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F0F0F0' }}>
          <button
            className="btn btn-block"
            onClick={generate}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {busy
              ? <Spinner />
              : joinCode
                ? <><RefreshCwIcon /> Régénérer un nouveau code</>
                : <><PlusIcon /> Générer un code d'invitation</>
            }
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#fff',
        border: '1px solid #E0E0E0',
        borderRadius: 10,
        padding: '20px 24px',
      }}>
        <p style={{ margin: '0 0 14px 0', fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Instructions pour les membres
        </p>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {[
            <>Ouvrir <strong>Palabre</strong> (web ou mobile) et aller dans "Rejoindre une organisation"</>,
            <>Scanner le <strong>QR code</strong> ci-dessus ou saisir l'identifiant + le code manuellement</>,
            <>Confirmer — accès immédiat aux conversations et appels</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 14, color: '#202124', lineHeight: 1.75, marginBottom: 4 }}>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
