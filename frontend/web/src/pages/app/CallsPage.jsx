/**
 * CallsPage — Appels audio/vidéo P2P WebRTC avec signaling complet.
 *
 * Architecture :
 * - Signaling (offer / answer / ICE) via le channel Phoenix "user:{id}" (type call_signal)
 * - TURN credentials récupérés depuis le backend avant chaque appel
 * - Sonnerie d'appel entrant via l'événement "msg:receive" (type call_signal)
 * - Historique persisté via POST/GET /api/v1/calls
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../lib/apiClient';
import { Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const WS_URL = import.meta.env.VITE_MESSAGE_ROUTER_URL || 'ws://localhost:4020';

// ── Icônes ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ICO = {
  phone:    ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  video:    ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  phoneOff: ['M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96', 'M1 1l22 22'],
  mic:      ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3', 'M8 22h8'],
  micOff:   ['M1 1l22 22', 'M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6', 'M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v3', 'M8 19h8'],
  cam:      ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  camOff:   ['M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10', 'M1 1l22 22'],
  speaker:  ['M11 5L6 9H2v6h4l5 4V5z', 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'],
};

function CtrlBtn({ onClick, danger, active, label, children }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} style={{
      width: 56, height: 56, borderRadius: '50%', border: 'none',
      background: danger ? 'var(--color-alert-red)'
        : active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
      color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'transform 0.1s, background 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
    onMouseLeave={e => e.currentTarget.style.transform = ''}>
      {children}
    </button>
  );
}

function formatDuration(d) {
  if (!d) return '';
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = d % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function formatCallDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ── Overlay appel actif ────────────────────────────────────────────────────────
function ActiveCallOverlay({ callId, peer, callType, isIncoming, ws, userId, onEnd, onCallStarted }) {
  const [state, setState] = useState(isIncoming ? 'incoming' : 'calling'); // incoming|calling|active|ended
  const [elapsed, setElapsed]   = useState(0);
  const [muted, setMuted]       = useState(false);
  const [camOff, setCamOff]     = useState(false);
  const [speakerOn, setSpeaker] = useState(true);
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef     = useRef(null);
  const streamRef = useRef(null);
  const callIdRef = useRef(callId);
  const timerRef  = useRef(null);
  const { notify } = useNotification();

  // ── Initialiser WebRTC ────────────────────────────────────────────────────
  const initPeerConnection = useCallback(async (iceServers) => {
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    try {
      const constraints = callType === 'video'
        ? { video: { facingMode: 'user' }, audio: true }
        : { video: false, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
    } catch (err) {
      notify.error('Impossible d\'accéder au micro/caméra : ' + err.message);
    }

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        _sendSignal({ signal_type: 'call:signal', call_id: callIdRef.current, signal: { type: 'candidate', candidate: e.candidate } });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setState('active');
        onCallStarted?.();
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        hangup('disconnected');
      }
    };

    return pc;
  }, [callType]); // eslint-disable-line

  // ── Envoyer un signal via WebSocket Phoenix ───────────────────────────────
  function _sendSignal(payload) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        topic: `user:${userId}`,
        event: 'msg:send',
        payload: {
          id:         `sig_${Date.now()}`,
          to:         peer.id,
          ciphertext: JSON.stringify(payload),
          type:       'call_signal',
          timestamp:  Date.now(),
        },
        ref: `sig_${Date.now()}`,
      }));
    }
  }

  // ── Lancer un appel sortant ───────────────────────────────────────────────
  useEffect(() => {
    if (isIncoming) return;

    (async () => {
      try {
        const { iceServers } = await api.get('/calls/turn-credentials');
        const pc = await initPeerConnection(iceServers);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        _sendSignal({ signal_type: 'call:signal', call_id: callIdRef.current, signal: offer });
      } catch (err) {
        notify.error('Erreur appel : ' + err.message);
        hangup('error');
      }
    })();
    return () => { clearInterval(timerRef.current); };
  }, []); // eslint-disable-line

  // ── Écouter les signaux entrants via le WebSocket ─────────────────────────
  useEffect(() => {
    if (!ws) return;
    const origOnMessage = ws.onmessage;
    ws.onmessage = async (e) => {
      origOnMessage?.(e);
      try {
        const msg = JSON.parse(e.data);
        if (msg.event !== 'msg:receive') return;
        const payload = msg.payload;
        if (payload.type !== 'call_signal') return;
        let sig;
        try { sig = JSON.parse(payload.ciphertext || payload.content || '{}'); } catch { return; }
        if (sig.call_id !== callIdRef.current) return;

        if (sig.signal_type === 'call:signal' && sig.signal) {
          const pc = pcRef.current;
          if (!pc) return;
          const s = sig.signal;
          if (s.type === 'offer') {
            // Côté appelé : répondre à l'offer
            await pc.setRemoteDescription(new RTCSessionDescription(s));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            _sendSignal({ signal_type: 'call:signal', call_id: callIdRef.current, signal: answer });
          } else if (s.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(s));
          } else if (s.type === 'candidate' && s.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(s.candidate));
          }
        }
        if (sig.signal_type === 'call:rejected' || sig.signal_type === 'call:ended') {
          hangup('remote_ended');
        }
      } catch { /* ignore */ }
    };
    return () => { ws.onmessage = origOnMessage; };
  }, [ws]); // eslint-disable-line

  // ── Répondre à un appel entrant ───────────────────────────────────────────
  async function answer() {
    try {
      const { iceServers } = await api.get('/calls/turn-credentials');
      await initPeerConnection(iceServers);
      await api.patch(`/calls/${callIdRef.current}`, { status: 'active' });
      setState('connecting');
    } catch (err) {
      notify.error('Erreur : ' + err.message);
      hangup('error');
    }
  }

  // ── Raccrocher ────────────────────────────────────────────────────────────
  async function hangup(reason = 'user_hangup') {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    if (reason !== 'disconnected' && reason !== 'remote_ended') {
      _sendSignal({ signal_type: 'call:ended', call_id: callIdRef.current });
      try {
        await api.patch(`/calls/${callIdRef.current}`, {
          status: reason === 'rejected' ? 'rejected' : 'ended'
        });
      } catch { /* ignore */ }
    }
    setState('ended');
    onEnd?.();
  }

  // ── Contrôles ─────────────────────────────────────────────────────────────
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
  function toggleSpeaker() {
    setSpeaker(s => {
      const next = !s;
      if (remoteAudioRef.current) remoteAudioRef.current.muted = !next;
      return next;
    });
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const peerName = peer?.name || 'Interlocuteur';
  const peerInitial = peerName.charAt(0).toUpperCase();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#0a0f1e',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '40px 24px 48px',
    }}>
      {/* Audio élément caché pour son distant */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Fond vidéo distant */}
      {callType === 'video' && (
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
      )}
      {callType !== 'video' && (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, #1a2a4a, #0a0f1e)' }} />
      )}

      {/* Haut : info appelé */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'var(--color-primary-blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, fontWeight: 800, color: '#fff',
          margin: '0 auto 16px',
          boxShadow: '0 0 0 12px rgba(26,115,232,0.15), 0 0 0 24px rgba(26,115,232,0.06)',
          animation: state === 'calling' || state === 'incoming' ? 'pulse 1.8s ease-in-out infinite' : 'none',
        }}>
          {peerInitial}
        </div>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{peerName}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 6 }}>
          {state === 'calling'    && 'Appel en cours…'}
          {state === 'incoming'   && (isIncoming ? 'Appel entrant' : '')}
          {state === 'connecting' && 'Connexion…'}
          {state === 'active'     && `${mm}:${ss}`}
          {state === 'ended'      && 'Appel terminé'}
        </div>
      </div>

      {/* Vidéo locale */}
      {callType === 'video' && (
        <video ref={localVideoRef} autoPlay playsInline muted
          style={{
            position: 'absolute', bottom: 120, right: 20,
            width: 110, height: 150, objectFit: 'cover',
            borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)',
            zIndex: 2,
          }} />
      )}

      {/* Contrôles */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Appel entrant : décrocher / rejeter */}
        {state === 'incoming' && (
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <CtrlBtn danger onClick={() => hangup('rejected')} label="Rejeter">
                <Ico d={ICO.phoneOff} size={24} />
              </CtrlBtn>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Rejeter</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <CtrlBtn onClick={answer} label="Décrocher">
                <Ico d={ICO.phone} size={24} />
              </CtrlBtn>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Décrocher</div>
            </div>
          </div>
        )}

        {/* Appel en cours : contrôles */}
        {(state === 'calling' || state === 'connecting' || state === 'active') && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <CtrlBtn onClick={toggleMute} active={muted} label={muted ? 'Activer micro' : 'Couper micro'}>
                <Ico d={muted ? ICO.micOff : ICO.mic} size={22} />
              </CtrlBtn>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>{muted ? 'Micro off' : 'Micro'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <CtrlBtn onClick={toggleSpeaker} active={!speakerOn} label="Haut-parleur">
                <Ico d={ICO.speaker} size={22} />
              </CtrlBtn>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>{speakerOn ? 'HP on' : 'HP off'}</div>
            </div>
            {callType === 'video' && (
              <div style={{ textAlign: 'center' }}>
                <CtrlBtn onClick={toggleCam} active={camOff} label="Caméra">
                  <Ico d={camOff ? ICO.camOff : ICO.cam} size={22} />
                </CtrlBtn>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>{camOff ? 'Cam off' : 'Cam'}</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <CtrlBtn danger onClick={() => hangup('user_hangup')} label="Raccrocher">
                <Ico d={ICO.phoneOff} size={24} />
              </CtrlBtn>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>Raccrocher</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 12px rgba(26,115,232,0.15), 0 0 0 24px rgba(26,115,232,0.06); }
          50%      { box-shadow: 0 0 0 18px rgba(26,115,232,0.20), 0 0 0 36px rgba(26,115,232,0.08); }
        }
      `}</style>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const { user }       = useAuth();
  const { notify }     = useNotification();

  const [activeCall, setActiveCall]   = useState(null);  // { callId, peer:{id,name}, callType, isIncoming }
  const [incomingCall, setIncomingCall] = useState(null);
  const [history, setHistory]          = useState([]);
  const [contacts, setContacts]        = useState([]);
  const [loadingHist, setLoadingHist]  = useState(true);
  const [newCallPeer, setNewCallPeer]  = useState('');
  const [showDialer, setShowDialer]    = useState(false);

  const wsRef    = useRef(null);
  const ringRef  = useRef(null);

  // ── WebSocket Phoenix pour les signaux d'appels entrants ─────────────────
  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem('palabre_access_token');
    if (!token) return;

    let ws, destroyed = false, reconnectTm;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(`${WS_URL}/socket/websocket?token=${token}&device_id=web&platform=web`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ topic: `user:${user.id}`, event: 'phx_join', payload: {}, ref: '1' }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event !== 'msg:receive') return;
          const p = msg.payload;
          if (p.type !== 'call_signal') return;
          let sig;
          try { sig = JSON.parse(p.ciphertext || p.content || '{}'); } catch { return; }
          if (sig.signal_type === 'call:incoming') {
            setIncomingCall({ callId: sig.call_id, callType: sig.call_type || 'audio', caller: { id: sig.caller_id, name: sig.caller_name, photo: sig.caller_photo } });
            // Sonnerie
            if (!ringRef.current) {
              const audio = new Audio('/audio/ringtone.mp3');
              audio.loop = true;
              audio.play().catch(() => {});
              ringRef.current = audio;
            }
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!destroyed) reconnectTm = setTimeout(connect, 3000);
      };
    }
    connect();
    return () => { destroyed = true; clearTimeout(reconnectTm); ws?.close(); };
  }, [user?.id]); // eslint-disable-line

  // ── Charger l'historique et les contacts ──────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/calls/history').catch(() => []),
      api.get('/contacts').catch(() => []),
    ]).then(([hist, ctcs]) => {
      setHistory(Array.isArray(hist) ? hist : []);
      setContacts(Array.isArray(ctcs) ? ctcs : []);
    }).finally(() => setLoadingHist(false));
  }, []);

  // ── Démarrer un appel sortant ─────────────────────────────────────────────
  async function startCall(peerId, peerName, callType = 'audio') {
    try {
      const { callId } = await api.post('/calls', { calleeId: peerId, callType });
      setShowDialer(false);
      setActiveCall({ callId, peer: { id: peerId, name: peerName }, callType, isIncoming: false });
    } catch (err) {
      notify.error(friendlyMessage(err));
    }
  }

  // ── Répondre à un appel entrant ───────────────────────────────────────────
  function answerIncoming() {
    if (!incomingCall) return;
    ringRef.current?.pause(); ringRef.current = null;
    setActiveCall({ callId: incomingCall.callId, peer: incomingCall.caller, callType: incomingCall.callType, isIncoming: true });
    setIncomingCall(null);
  }

  // ── Rejeter un appel entrant ──────────────────────────────────────────────
  async function rejectIncoming() {
    if (!incomingCall) return;
    ringRef.current?.pause(); ringRef.current = null;
    try { await api.patch(`/calls/${incomingCall.callId}`, { status: 'rejected' }); } catch { /* ignore */ }
    setIncomingCall(null);
  }

  // ── Fin d'appel ───────────────────────────────────────────────────────────
  async function handleCallEnd() {
    setActiveCall(null);
    // Recharger l'historique
    const hist = await api.get('/calls/history').catch(() => []);
    setHistory(Array.isArray(hist) ? hist : []);
  }

  // ── Appel via URL params (?peer=id&type=audio) ────────────────────────────
  const peerParam = searchParams.get('peer');
  const typeParam = searchParams.get('type') || 'audio';
  useEffect(() => {
    if (peerParam && user?.id && contacts.length > 0 && !activeCall) {
      const c = contacts.find(x => x.id === peerParam);
      if (c) startCall(c.id, c.fullName, typeParam);
    }
  }, [peerParam, contacts]); // eslint-disable-line

  // ── Bannière appel entrant ────────────────────────────────────────────────
  const IncomingBanner = incomingCall && !activeCall ? (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 250,
      background: 'var(--color-text-primary)', color: '#fff',
      borderRadius: 16, padding: '16px 20px', minWidth: 280,
      boxShadow: 'var(--shadow-lg)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--color-success-green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0,
        }}>
          {(incomingCall.caller?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{incomingCall.caller?.name || 'Appel entrant'}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            {incomingCall.callType === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={rejectIncoming} style={{
          flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
          background: 'var(--color-alert-red)', color: '#fff',
          fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>Rejeter</button>
        <button onClick={answerIncoming} style={{
          flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
          background: 'var(--color-success-green)', color: '#fff',
          fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>Décrocher</button>
      </div>
    </div>
  ) : null;

  // ── Afficher l'overlay d'appel actif ─────────────────────────────────────
  if (activeCall) {
    return (
      <>
        {IncomingBanner}
        <ActiveCallOverlay
          callId={activeCall.callId}
          peer={activeCall.peer}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          ws={wsRef.current}
          userId={user?.id}
          onEnd={handleCallEnd}
          onCallStarted={() => {}}
        />
      </>
    );
  }

  return (
    <>
      {IncomingBanner}

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Appels</h2>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginTop: 2 }}>
            Audio et vidéo chiffrés de bout en bout
          </div>
        </div>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => setShowDialer(v => !v)}>
          <Ico d={ICO.phone} size={16} /> Nouvel appel
        </button>
      </div>

      {/* Composeur */}
      {showDialer && (
        <div style={{
          background: 'var(--color-white)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 20, marginBottom: 24,
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Sélectionner un contact</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <input value={newCallPeer} onChange={e => setNewCallPeer(e.target.value)}
              placeholder="Nom du contact…"
              style={{ flex: 1, minWidth: 180, padding: '9px 12px', border: '1px solid var(--color-border)', fontSize: 15, borderRadius: 8 }} />
          </div>
          {contacts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {contacts.filter(c => !newCallPeer || c.fullName?.toLowerCase().includes(newCallPeer.toLowerCase())).slice(0, 10).map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--color-offwhite)', border: '1px solid var(--color-border)',
                  borderRadius: 40, padding: '6px 14px 6px 6px',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-primary-blue)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{c.fullName?.charAt(0)?.toUpperCase() || '?'}</div>
                  <span style={{ fontSize: 14 }}>{c.fullName}</span>
                  <button onClick={() => startCall(c.id, c.fullName, 'audio')}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-success-green)', padding: 2 }} title="Appel audio">
                    <Ico d={ICO.phone} size={15} />
                  </button>
                  <button onClick={() => startCall(c.id, c.fullName, 'video')}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary-blue)', padding: 2 }} title="Appel vidéo">
                    <Ico d={ICO.video} size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Historique des appels
        </div>
        {loadingHist ? (
          <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
        ) : history.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>
              <Ico d={ICO.phone} size={40} />
            </div>
            <p>Aucun appel pour l'instant.</p>
          </div>
        ) : history.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
            borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
          onMouseLeave={e => e.currentTarget.style.background = ''}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: c.status === 'missed' ? 'var(--color-alert-red)'
                : c.direction === 'incoming' ? 'var(--color-success-green)'
                : 'var(--color-primary-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 16,
            }}>
              {(c.peerName || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{c.peerName || 'Inconnu'}</div>
              <div style={{ fontSize: 13, color: c.status === 'missed' ? 'var(--color-alert-red)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.callType === 'video' ? <Ico d={ICO.video} size={12} /> : <Ico d={ICO.phone} size={12} />}
                {c.direction === 'incoming' ? 'Entrant' : 'Sortant'}
                {c.status === 'missed' && ' · Manqué'}
                {c.durationSeconds > 0 && ` · ${formatDuration(c.durationSeconds)}`}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              {formatCallDate(c.createdAt)}
            </div>
            {c.peerId && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => startCall(c.peerId, c.peerName, 'audio')} title="Rappeler audio"
                  style={{ width: 34, height: 34, border: '1px solid var(--color-border)', background: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success-green)' }}>
                  <Ico d={ICO.phone} size={14} />
                </button>
                <button onClick={() => startCall(c.peerId, c.peerName, 'video')} title="Rappeler vidéo"
                  style={{ width: 34, height: 34, border: '1px solid var(--color-border)', background: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-blue)' }}>
                  <Ico d={ICO.video} size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
