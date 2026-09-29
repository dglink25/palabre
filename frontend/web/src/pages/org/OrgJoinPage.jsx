import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import { useAuth } from '../../context/AuthContext';

// ── Icônes SVG ─────────────────────────────────────────────────────────────
const Ico = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ICO = {
  qr:      ['M3 3h6v6H3z', 'M15 3h6v6h-6z', 'M3 15h6v6H3z', 'M15 15h2v2h-2z', 'M19 15v2', 'M15 19h2', 'M19 19h2', 'M19 21v-2'],
  cam:     ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  img:     ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  key:     ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'],
  org:     ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  check:   ['M20 6L9 17l-5-5'],
  back:    ['M19 12H5', 'M12 5l-7 7 7 7'],
  x:       ['M18 6L6 18', 'M6 6l12 12'],
  stop:    ['M18 6L6 18', 'M6 6l12 12'],
};

// ── Utilitaire : parse le payload QR ──────────────────────────────────────
function parseQrPayload(raw) {
  try {
    const obj = JSON.parse(raw);
    if (obj.orgId) return obj;
  } catch (_) {}
  // Format URL ?orgId=...&joinCode=...
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://x.x?${raw}`);
    const orgId    = url.searchParams.get('orgId');
    const joinCode = url.searchParams.get('joinCode');
    if (orgId) return { orgId, joinCode };
  } catch (_) {}
  return null;
}

// ── Scanner webcam ────────────────────────────────────────────────────────
function QrScanner({ onResult, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const streamRef = useRef(null);
  const [camError, setCamError] = useState('');

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        tick();
      })
      .catch(err => {
        if (active) setCamError('Impossible d\'acceder a la camera. Verifiez les permissions.');
      });

    function tick() {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !active) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width  = video.videoWidth;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          const parsed = parseQrPayload(code.data);
          if (parsed) {
            streamRef.current?.getTracks().forEach(t => t.stop());
            onResult(parsed);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onResult]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px',
        background: 'rgba(0,0,0,0.8)',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}>
          <Ico d={ICO.back} size={22} />
        </button>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Scanner le QR code</span>
      </div>

      {/* Zone video */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {camError ? (
          <div style={{ color: '#fff', textAlign: 'center', padding: 32 }}>
            <Ico d={ICO.cam} size={40} />
            <p style={{ marginTop: 16, opacity: 0.8 }}>{camError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {/* Cadre de scan */}
            <div style={{
              position: 'absolute',
              width: 240, height: 240,
              border: '3px solid rgba(255,255,255,0.8)',
              borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }}>
              {/* Coins colorés */}
              {[['top:0;left:0', 'border-top-color: #1A73E8; border-left-color: #1A73E8'],
                ['top:0;right:0', 'border-top-color: #1A73E8; border-right-color: #1A73E8'],
                ['bottom:0;left:0', 'border-bottom-color: #1A73E8; border-left-color: #1A73E8'],
                ['bottom:0;right:0', 'border-bottom-color: #1A73E8; border-right-color: #1A73E8'],
              ].map(([pos, color], i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 28, height: 28,
                  border: '4px solid transparent',
                  borderRadius: 4,
                  ...Object.fromEntries(pos.split(';').map(s => s.split(':'))),
                  ...Object.fromEntries(color.split(';').map(s => {
                    const [k, v] = s.trim().split(': ');
                    return [k.replace(/-([a-z])/g, (_, l) => l.toUpperCase()), v];
                  })),
                }} />
              ))}
            </div>
            <div style={{
              position: 'absolute',
              bottom: 60,
              color: 'rgba(255,255,255,0.8)',
              fontSize: 15,
              textAlign: 'center',
              padding: '0 32px',
            }}>
              Pointez la camera vers le QR code de votre organisation
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Import d'image ─────────────────────────────────────────────────────────
function readQrFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          resolve(code.data);
        } else {
          reject(new Error('Aucun QR code detecte dans cette image.'));
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Page principale ────────────────────────────────────────────────────────
export default function OrgJoinPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [orgId,       setOrgId]       = useState('');
  const [joinCode,    setJoinCode]    = useState('');
  const [preview,     setPreview]     = useState(null);
  const [step,        setStep]        = useState('form'); // form | preview | done
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [tab,         setTab]         = useState('manual'); // manual | qr

  // ── Callback quand le scanner ou l'image donne un résultat ───────────────
  const handleQrResult = useCallback(async (parsed) => {
    setShowScanner(false);
    setError('');
    if (!parsed?.orgId) { setError('QR code invalide — identifiant organisation introuvable.'); return; }
    setOrgId(parsed.orgId);
    if (parsed.joinCode) setJoinCode(parsed.joinCode);
    // Charger la prévisualisation directement
    setBusy(true);
    try {
      const data = await api.get(`/org/join-info/${parsed.orgId}`);
      setPreview(data);
      setStep('preview');
      // Si le joinCode est dans le QR, on peut aussi auto-rejoindre
      if (parsed.joinCode) {
        // Pré-remplir mais laisser l'utilisateur confirmer
        setJoinCode(parsed.joinCode);
      }
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // ── Import image ─────────────────────────────────────────────────────────
  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const raw    = await readQrFromFile(file);
      const parsed = parseQrPayload(raw);
      if (!parsed) throw new Error('QR code Palabre invalide (format non reconnu).');
      await handleQrResult(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  // ── Prévisualisation manuelle ─────────────────────────────────────────────
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

  // ── Confirmer ─────────────────────────────────────────────────────────────
  async function confirmJoin() {
    if (!joinCode.trim()) { setError('Le code d\'invitation est requis.'); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/org/join', { orgId: orgId.trim(), joinCode: joinCode.trim() });
      await refreshProfile();
      setStep('done');
      setTimeout(() => navigate('/app'), 1800);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally { setBusy(false); }
  }

  // ── Scanner plein écran ───────────────────────────────────────────────────
  if (showScanner) {
    return <QrScanner onResult={handleQrResult} onClose={() => setShowScanner(false)} />;
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>

      {/* Titre */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: 24 }}>Rejoindre une organisation</h1>
        <p className="text-secondary" style={{ margin: 0 }}>
          Utilisez le code fourni par votre administrateur ou scannez le QR code de votre organisation.
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {step === 'done' && (
        <Alert variant="success">
          Vous avez rejoint l'organisation. Redirection vers votre espace...
        </Alert>
      )}

      {step === 'form' && (
        <>
          {/* Onglets Manuel / QR code */}
          <div style={{
            display: 'flex', border: '1px solid var(--color-border)',
            borderRadius: 8, overflow: 'hidden', marginBottom: 20,
          }}>
            {[
              ['manual', 'Saisie manuelle', ICO.key],
              ['qr',     'QR code',         ICO.qr],
            ].map(([v, label, icon]) => (
              <button key={v} onClick={() => setTab(v)}
                style={{
                  flex: 1, padding: '11px 14px', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: tab === v ? 'var(--color-primary-blue)' : 'var(--color-white)',
                  color: tab === v ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: 16, fontWeight: tab === v ? 700 : 400,
                  transition: 'background 0.15s, color 0.15s',
                }}>
                <Ico d={icon} size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Onglet saisie manuelle ── */}
          {tab === 'manual' && (
            <div className="card">
              <div className="field">
                <label>Identifiant de l'organisation</label>
                <input
                  value={orgId}
                  onChange={e => setOrgId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onKeyDown={e => e.key === 'Enter' && loadPreview()}
                />
                <div className="hint">Fourni par votre administrateur avec le code d'invitation.</div>
              </div>
              <button className="btn btn-block" onClick={loadPreview}
                disabled={busy || !orgId.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {busy ? <Spinner /> : <><Ico d={ICO.org} size={17} /> Rechercher l'organisation</>}
              </button>
            </div>
          )}

          {/* ── Onglet QR code ── */}
          {tab === 'qr' && (
            <div className="card">
              <p className="text-secondary" style={{ margin: '0 0 20px 0', fontSize: 15 }}>
                Scannez le QR code affiche dans votre tableau de bord administrateur
                ou importez une image de ce QR code.
              </p>

              {/* Bouton webcam */}
              <button
                className="btn btn-block"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, fontSize: 17 }}
                onClick={() => setShowScanner(true)}
              >
                <Ico d={ICO.cam} size={20} />
                Scanner avec la camera
              </button>

              {/* Bouton import image */}
              <button
                className="btn btn-secondary btn-block"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 17 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Ico d={ICO.img} size={20} />
                Importer une image du QR code
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageFile}
              />

              <p className="text-secondary" style={{ marginTop: 16, fontSize: 13 }}>
                Autorisation camera requise pour le scan en direct. L'import d'image fonctionne sans camera.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Prévisualisation + saisie code ── */}
      {step === 'preview' && preview && (
        <div className="card">

          {/* Apercu organisation */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
            padding: '14px 16px', background: 'var(--color-offwhite)',
            border: '1px solid var(--color-border)', borderRadius: 8,
          }}>
            {preview.logoUrl
              ? <img src={preview.logoUrl} alt={preview.name}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : (
                <div style={{
                  width: 48, height: 48, borderRadius: 8, flexShrink: 0,
                  background: 'var(--color-primary-blue)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 20,
                }}>
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
            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <Ico d={ICO.check} size={20} />
            </div>
          </div>

          <div className="field">
            <label>Code d'invitation</label>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="XXXXXXXX"
              style={{ letterSpacing: 4, fontWeight: 700, fontSize: 20, textTransform: 'uppercase' }}
              autoFocus={!joinCode}
            />
            <div className="hint">Code unique fourni par votre administrateur.</div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              className="btn btn-success"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={confirmJoin} disabled={busy}
            >
              {busy ? <Spinner /> : <><Ico d={ICO.check} size={17} /> Confirmer et rejoindre</>}
            </button>
            <button className="btn btn-secondary"
              onClick={() => { setStep('form'); setPreview(null); setError(''); setJoinCode(''); }}>
              Retour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
