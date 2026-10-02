/**
 * SupportCallPanel - Appel audio du service client
 * Gère l'initiation, la file d'attente, le hold et le raccrochage.
 */
import { useState, useEffect, useRef } from 'react';
import { supportApi, supportWs } from '../../lib/supportApi';

// Icône téléphone SVG
const PhoneIcon = ({ off = false } = {}) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    {off && <line x1="1" y1="1" x2="23" y2="23" />}
  </svg>
);

export default function SupportCallPanel({ session, activeCall, setActiveCall, queuePosition, setQueuePosition, onSwitchToChat }) {
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [unavailable, setUnavailable] = useState(false); // affiché seulement après tentative d'appel
  const audioRef                  = useRef(null);
  const peerConnRef               = useRef(null);

  // Charger le statut du service - silencieux, sert juste à pré-afficher
  // le délai estimé dans la file, PAS à bloquer le bouton d'appel.
  useEffect(() => {
    supportApi.getStatus().then(setStatus).catch(() => {});
  }, []);

  // Musique d'attente - jouer/arrêter selon l'état de l'appel
  useEffect(() => {
    const shouldPlay = activeCall && ['queued', 'hold'].includes(activeCall.status);
    if (shouldPlay) {
      if (audioRef.current) {
        audioRef.current.volume = 0.3;
        audioRef.current.loop   = true;
        audioRef.current.play().catch(() => {});
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [activeCall?.status]);

  // Écouter les events de l'appel
  useEffect(() => {
    const offAns  = supportWs.on('support:call:answered', () => {
      setActiveCall(c => c ? { ...c, status: 'active' } : c);
    });
    const offHold = supportWs.on('support:call:hold', () => {
      setActiveCall(c => c ? { ...c, status: 'hold' } : c);
    });
    const offEnd  = supportWs.on('support:call:ended', () => {
      setActiveCall(null);
      setQueuePosition(null);
      _closeRtc();
    });
    const offQ    = supportWs.on('support:queue:update', (p) => {
      if (activeCall && p.callId === activeCall.id) {
        setQueuePosition(p.position);
      }
    });
    // Signaling WebRTC entrant (depuis le super-admin)
    const offSig  = supportWs.on('support:call:signal', async (p) => {
      if (!peerConnRef.current) return;
      const { signal } = p;
      if (signal.type === 'answer') {
        await peerConnRef.current.setRemoteDescription(signal);
      } else if (signal.type === 'candidate') {
        await peerConnRef.current.addIceCandidate(signal.candidate);
      }
    });

    return () => { offAns(); offHold(); offEnd(); offQ(); offSig(); };
  }, [activeCall]);

  // ── Initier un appel ────────────────────────────────────────────────────
  const handleCall = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const result = await supportApi.initiateCall();
      if (result.callId) {
        setActiveCall({ id: result.callId, status: 'queued' });
        setQueuePosition(result.position);
        await _startWebRtc(result.callId);
      }
    } catch (e) {
      if (e.code === 'ADMIN_OFFLINE' || e.code === 'QUEUE_FULL') {
        setUnavailable(true);
        onSwitchToChat?.();
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Raccrocher ──────────────────────────────────────────────────────────
  const handleHangup = async () => {
    if (!activeCall) return;
    setLoading(true);
    try {
      await supportApi.hangup(activeCall.id);
      setActiveCall(null);
      setQueuePosition(null);
      _closeRtc();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── WebRTC ──────────────────────────────────────────────────────────────
  async function _startWebRtc(callId) {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          // Le serveur TURN est configuré en production
        ],
      });
      peerConnRef.current = pc;

      // Audio only - pas de vidéo
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // ICE candidates → signal
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          supportWs.sendCallSignal(callId, { type: 'candidate', candidate: e.candidate });
        }
      };

      // Lecture de l'audio distant
      pc.ontrack = (e) => {
        if (audioRef.current && e.streams[0]) {
          audioRef.current.srcObject = e.streams[0];
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      supportWs.sendCallSignal(callId, offer);
    } catch (err) {
      console.error('[support:call] WebRTC error:', err);
    }
  }

  function _closeRtc() {
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
  }

  // ── Rendu ───────────────────────────────────────────────────────────────

  const callState = activeCall?.status;

  return (
    <div style={{
      border: '1px solid #E0E0E0',
      background: '#fff',
      padding: 32,
      textAlign: 'center',
    }}>
      {/* Musique d'attente (src = fichier audio public) */}
      {/* Le <audio> joue la musique quand en file ou en hold */}
      <audio
        ref={audioRef}
        src="/audio/hold-music.mp3"
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Statut du service - affiché UNIQUEMENT après une tentative d'appel échouée */}
      {!activeCall && unavailable && (
        <div style={{
          padding: '10px 16px',
          background: '#FFF8E1',
          border: '1px solid #FBBC05',
          marginBottom: 20,
          fontSize: 13,
          color: '#5F6368',
        }}>
          Le service vocal est momentanément indisponible. Nous vous avons redirigé vers la messagerie.
        </div>
      )}

      {/* Info délai estimé quand la file est chargée et que l'admin est disponible */}
      {!activeCall && !unavailable && status?.available && status?.queueLength > 0 && (
        <div style={{
          padding: '8px 14px',
          background: '#E8F0FE',
          border: '1px solid #C5D8F8',
          marginBottom: 20,
          fontSize: 13,
          color: '#1A73E8',
        }}>
          {status.queueLength} personne(s) en attente - délai estimé : ~{status.estimatedWaitMinutes} min
        </div>
      )}

      {/* État en file d'attente */}
      {callState === 'queued' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#E8F0FE',
            marginBottom: 16,
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1A73E8', animation: 'pulse 1.5s infinite' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#202124', margin: '0 0 4px' }}>
            En attente
          </p>
          {queuePosition && (
            <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
              Position : <strong>{queuePosition}</strong> - nous allons vous répondre dans quelques instants.
            </p>
          )}
        </div>
      )}

      {/* Appel en hold */}
      {callState === 'hold' && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#FBBC05', margin: '0 0 4px' }}>
            Appel en attente
          </p>
          <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
            Votre conseiller revient dans quelques instants…
          </p>
        </div>
      )}

      {/* Appel actif */}
      {callState === 'active' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#E6F4EA',
            marginBottom: 16,
          }}>
            <PhoneIcon />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#34A853', margin: 0 }}>
            En communication avec le support
          </p>
        </div>
      )}

      {/* Pas d'appel en cours */}
      {!activeCall && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#5F6368', marginBottom: 20 }}>
            Appelez directement le service client pour parler à un conseiller.
          </p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#FDE8E8', border: '1px solid #EA4335', fontSize: 13, color: '#EA4335' }}>
          {error}
        </div>
      )}

      {/* Bouton principal */}
      {!activeCall ? (
        <button
          onClick={handleCall}
          disabled={loading || !session}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 28px',
            background: '#34A853',
            color: '#fff',
            border: 'none',
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <PhoneIcon />
          {loading ? 'Connexion…' : 'Appeler le support'}
        </button>
      ) : (
        <button
          onClick={handleHangup}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 28px',
            background: '#EA4335',
            color: '#fff',
            border: 'none',
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <PhoneIcon off />
          Raccrocher
        </button>
      )}
    </div>
  );
}
