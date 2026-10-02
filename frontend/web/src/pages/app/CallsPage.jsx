import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// ── Icônes ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICO = {
  phone:     ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  video:     ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  micOff:    ['M1 1l22 22', 'M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6', 'M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v3', 'M8 19h8'],
  camOff:    ['M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10', 'M1 1l22 22'],
  phoneOff:  ['M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96', 'M1 1l22 22'],
  mic:       ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3', 'M8 22h8'],
  cam:       ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  incoming:  ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  missed:    ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
};

// ── Historique des appels ─────────────────────────────────────────────────────
const MOCK_CALLS = [
  { id: 1, name: 'Alice Martin', type: 'outgoing', callType: 'audio', date: new Date(Date.now() - 600000), duration: '3:24', status: 'ended' },
  { id: 2, name: 'Bob Dupont', type: 'missed', callType: 'video', date: new Date(Date.now() - 3600000), duration: null, status: 'missed' },
  { id: 3, name: 'Carole Ehouman', type: 'incoming', callType: 'audio', date: new Date(Date.now() - 86400000), duration: '12:07', status: 'ended' },
  { id: 4, name: 'David Kouassi', type: 'outgoing', callType: 'audio', date: new Date(Date.now() - 172800000), duration: '0:45', status: 'ended' },
];

function formatCallDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ── Composant appel actif (WebRTC) ────────────────────────────────────────────
function ActiveCallOverlay({ peer, callType, onEnd }) {
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    startWebRTC();
    return () => {
      clearInterval(t);
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startWebRTC() {
    try {
      const constraints = callType === 'video'
        ? { video: true, audio: true }
        : { video: false, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };
    } catch {
      // permission refusee ou pas de camera - on continue quand meme
    }
  }

  function cleanup() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  }

  function toggleMute() {
    setMuted(m => {
      const next = !m;
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }

  function toggleCam() {
    setCamOff(c => {
      const next = !c;
      streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0d0d0d',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Video remote */}
      {callType === 'video' ? (
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, #1a2a4a 0%, #0d0d0d 100%)' }} />
      )}

      {/* Infos appelé */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--color-primary-blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: '#fff',
          margin: '0 auto 16px',
          boxShadow: '0 0 0 8px rgba(26,115,232,0.25)',
        }}>
          {peer?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{peer || 'Appel en cours'}</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 4 }}>{mm}:{ss}</div>
      </div>

      {/* Video locale (petit cadre) */}
      {callType === 'video' && (
        <video ref={localVideoRef} autoPlay playsInline muted
          style={{
            position: 'absolute', bottom: 100, right: 20,
            width: 120, height: 160, objectFit: 'cover',
            borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)',
            zIndex: 2,
          }} />
      )}

      {/* Controles */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 20, alignItems: 'center' }}>
        <CtrlBtn onClick={toggleMute} active={muted} danger={false} label={muted ? 'Activer micro' : 'Couper micro'}>
          <Ico d={muted ? ICO.micOff : ICO.mic} size={22} />
        </CtrlBtn>
        {callType === 'video' && (
          <CtrlBtn onClick={toggleCam} active={camOff} danger={false} label={camOff ? 'Activer camera' : 'Couper camera'}>
            <Ico d={camOff ? ICO.camOff : ICO.cam} size={22} />
          </CtrlBtn>
        )}
        <CtrlBtn onClick={() => { cleanup(); onEnd(); }} danger label="Raccrocher">
          <Ico d={ICO.phoneOff} size={22} />
        </CtrlBtn>
      </div>
    </div>
  );
}

function CtrlBtn({ onClick, danger, active, label, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 56, height: 56, borderRadius: '50%', border: 'none',
        background: danger ? 'var(--color-alert-red)' : active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.1s, background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      {children}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const peerParam = searchParams.get('peer');
  const typeParam = searchParams.get('type') || 'audio';

  const [activeCall, setActiveCall] = useState(
    peerParam ? { peer: peerParam, callType: typeParam } : null
  );
  const [calls, setCalls] = useState(MOCK_CALLS);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [newCallPeer, setNewCallPeer] = useState('');
  const [showDialer, setShowDialer] = useState(false);

  useEffect(() => {
    api.get('/contacts')
      .then(c => setContacts(c || []))
      .catch(() => setContacts([]))
      .finally(() => setLoadingContacts(false));
  }, []);

  function startCall(peer, callType) {
    setActiveCall({ peer, callType });
    setShowDialer(false);
  }

  if (activeCall) {
    return (
      <ActiveCallOverlay
        peer={activeCall.peer}
        callType={activeCall.callType}
        onEnd={() => {
          setCalls(prev => [
            { id: Date.now(), name: activeCall.peer, type: 'outgoing', callType: activeCall.callType, date: new Date(), duration: null, status: 'ended' },
            ...prev,
          ]);
          setActiveCall(null);
        }}
      />
    );
  }

  return (
    <div>
      {/* En-tete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Appels</h2>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginTop: 2 }}>
            Audio et video chiffres de bout en bout
          </div>
        </div>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => setShowDialer(v => !v)}>
          <Ico d={ICO.phone} size={16} />
          Nouvel appel
        </button>
      </div>

      {/* Composeur rapide */}
      {showDialer && (
        <div style={{
          background: 'var(--color-white)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 20, marginBottom: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Lancer un appel</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={newCallPeer}
              onChange={e => setNewCallPeer(e.target.value)}
              placeholder="Nom ou identifiant du contact..."
              style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1px solid var(--color-border)', fontSize: 16, borderRadius: 6 }}
            />
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => newCallPeer.trim() && startCall(newCallPeer.trim(), 'audio')}>
              <Ico d={ICO.phone} size={16} /> Audio
            </button>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => newCallPeer.trim() && startCall(newCallPeer.trim(), 'video')}>
              <Ico d={ICO.video} size={16} /> Video
            </button>
          </div>

          {!loadingContacts && contacts.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Contacts disponibles
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {contacts.slice(0, 8).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-offwhite)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '4px 12px 4px 4px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {c.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span style={{ fontSize: 14 }}>{c.fullName}</span>
                    <button onClick={() => startCall(c.fullName, 'audio')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-success-green)', padding: 2 }} title="Appel audio">
                      <Ico d={ICO.phone} size={14} />
                    </button>
                    <button onClick={() => startCall(c.fullName, 'video')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary-blue)', padding: 2 }} title="Appel video">
                      <Ico d={ICO.video} size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 15, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Historique des appels
        </div>
        {calls.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Ico d={ICO.phone} size={40} />
            <p style={{ marginTop: 12 }}>Aucun appel dans l'historique.</p>
          </div>
        ) : (
          <div>
            {calls.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                borderBottom: '1px solid var(--color-border)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: c.type === 'missed' ? 'var(--color-alert-red)' : c.type === 'incoming' ? 'var(--color-success-green)' : 'var(--color-primary-blue)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 16,
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: c.type === 'missed' ? 'var(--color-alert-red)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.callType === 'video' ? <Ico d={ICO.video} size={12} /> : <Ico d={ICO.phone} size={12} />}
                    {c.type === 'incoming' ? 'Entrant' : c.type === 'outgoing' ? 'Sortant' : 'Manque'}
                    {c.duration && <span>· {c.duration}</span>}
                  </div>
                </div>

                {/* Date */}
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                  {formatCallDate(c.date)}
                </div>

                {/* Rappeler */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startCall(c.name, 'audio')} title="Rappeler en audio"
                    style={{ width: 34, height: 34, border: '1px solid var(--color-border)', background: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success-green)' }}>
                    <Ico d={ICO.phone} size={14} />
                  </button>
                  <button onClick={() => startCall(c.name, 'video')} title="Rappeler en video"
                    style={{ width: 34, height: 34, border: '1px solid var(--color-border)', background: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-blue)' }}>
                    <Ico d={ICO.video} size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
