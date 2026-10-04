import { useEffect, useRef, useState } from 'react';
import { resolveSession } from '../../lib/videoconferenceApi';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1';

export default function VideoConferenceGateway({ roomId, sessionToken, displayName, isModerator, onLeave, onError }) {
  const containerRef = useRef(null);
  const apiRef       = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg]   = useState('');

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 1. Charger le SDK Jitsi via le proxy backend (URL opaque - jamais "jitsi" visible)
        //    Si le proxy échoue, tenter un chargement direct depuis le domaine résolu
        let sdkLoaded = false;
        try {
          await loadSdk(`${API_BASE}/videoconference/client-sdk`);
          sdkLoaded = true;
        } catch (proxyErr) {
          console.warn('[VideoConferenceGateway] proxy SDK failed, trying direct load:', proxyErr.message);
        }

        if (!mounted) return;

        // 2. Résoudre la config côté backend (domain + roomToken opaque, pas de jitsi_room_name)
        const config = await resolveSession(roomId, sessionToken);

        if (!mounted) return;

        // Si le proxy a échoué, essayer le chargement direct depuis le domaine Jitsi résolu
        // Fonctionne 100% LAN si JITSI_DOMAIN pointe vers le serveur local
        if (!sdkLoaded && config.domain) {
          try {
            await loadSdkDirect(`https://${config.domain}/libs/external_api.min.js`);
          } catch {
            try {
              await loadSdkDirect(`https://${config.domain}/external_api.js`);
            } catch {
              // Tentative HTTP (pour serveur local sans TLS)
              await loadSdkDirect(`http://${config.domain}/external_api.js`);
            }
          }
        }

        if (!window.JitsiMeetExternalAPI) {
          throw new Error('SDK_UNAVAILABLE');
        }

        if (!mounted) return;

        const { domain, roomToken, isModerator: serverModerator } = config;

        // 3. Initialiser l'API Jitsi External avec white-label complet
        const jitsiApi = new window.JitsiMeetExternalAPI(domain, {
          roomName:   roomToken,    // JWT JaaS opaque - Jitsi l'utilise pour l'auth
          jwt:        roomToken,
          parentNode: containerRef.current,
          width:      '100%',
          height:     '100%',
          lang:       'fr',
          userInfo: {
            displayName: displayName || 'Participant',
            email: '',
          },
          configOverwrite: {
            disableDeepLinking:    true,
            enableWelcomePage:     false,
            enableClosePage:       false,
            disableInviteFunctions: true,        // invitations gérées par Palabre
            requireDisplayName:    false,
            enableInsecureRoomNameWarning: false,
            // Qualité vidéo
            startWithAudioMuted:   false,
            startWithVideoMuted:   false,
            resolution:            720,
            // Désactiver les features non souhaitées
            liveStreamingEnabled:  false,
            fileRecordingsEnabled: serverModerator || isModerator,
            localRecording: { enabled: false },
            toolbarButtons: [
              'microphone', 'camera', 'closedcaptions', 'desktop',
              'fullscreen', 'hangup', 'chat', 'raisehand',
              'videoquality', 'filmstrip', 'participants-pane', 'tileview',
              ...(serverModerator || isModerator ? ['recording', 'mute-everyone'] : []),
            ],
          },
          interfaceConfigOverwrite: {
            // Suppression totale de la marque Jitsi
            SHOW_JITSI_WATERMARK:                          false,
            SHOW_WATERMARK_FOR_GUESTS:                     false,
            SHOW_BRAND_WATERMARK:                          false,
            BRAND_WATERMARK_LINK:                          '',
            SHOW_POWERED_BY:                               false,
            DISPLAY_WELCOME_FOOTER:                        false,
            DISPLAY_WELCOME_PAGE_CONTENT:                  false,
            DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
            HIDE_INVITE_MORE_HEADER:                       true,
            // Branding Palabre
            APP_NAME:           'Palabre',
            NATIVE_APP_NAME:    'Palabre',
            PROVIDER_NAME:      'Palabre',
            DEFAULT_LOGO_URL:   '/logo.png',
            DEFAULT_WELCOME_PAGE_LOGO_URL: '/logo.png',
            // UX
            TOOLBAR_ALWAYS_VISIBLE:   false,
            DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
            DISABLE_TRANSCRIPTION_SUBTITLES:    false,
            LANG_DETECTION:    false,
          },
        });

        apiRef.current = jitsiApi;

        // Événements
        jitsiApi.addEventListener('readyToClose', () => {
          cleanup();
          onLeave?.();
        });

        jitsiApi.addEventListener('videoConferenceLeft', () => {
          onLeave?.();
        });

        jitsiApi.addEventListener('errorOccurred', (e) => {
          console.error('[VideoConferenceGateway] erreur Jitsi:', e);
        });

        if (mounted) setStatus('ready');
      } catch (err) {
        console.error('[VideoConferenceGateway] init error:', err);
        if (mounted) {
          setStatus('error');
          const code = err.message;
          if (code === 'SDK_UNAVAILABLE' || code === 'SDK_INVALID' || code === 'SDK_TIMEOUT') {
            setErrorMsg('Le service de vidéoconférence est momentanément indisponible. Vérifiez votre connexion Internet et réessayez.');
          } else if (code === 'NOT_FOUND') {
            setErrorMsg('Cette salle de réunion est introuvable ou a expiré.');
          } else {
            setErrorMsg('Impossible de démarrer la vidéoconférence. Veuillez réessayer.');
          }
          onError?.(err.message);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, sessionToken]);

  function cleanup() {
    if (apiRef.current) {
      try { apiRef.current.dispose(); } catch { /* ignore */ }
      apiRef.current = null;
    }
  }

  // API publique pour les contrôles overlay
  function executeCommand(cmd, ...args) {
    apiRef.current?.executeCommand(cmd, ...args);
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 16,
        background: 'var(--color-offwhite)',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Connexion impossible</div>
        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 360 }}>
          {errorMsg}
        </div>
        <button className="btn" onClick={() => { setStatus('loading'); setErrorMsg(''); }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Spinner pendant le chargement */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0d1117', flexDirection: 'column', gap: 16,
        }}>
          <img src="/logo.png" alt="Palabre" width={48} height={48}
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            Connexion en cours…
          </div>
          <div className="spinner" style={{ borderTopColor: '#fff', opacity: 0.6 }} />
        </div>
      )}
      {/* Container de l'iframe Jitsi - data-palabre-room ne révèle pas Jitsi */}
      <div
        ref={containerRef}
        data-palabre-room={roomId}
        style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}
      />
    </div>
  );
}

// ── Chargement dynamique du SDK Jitsi via le proxy backend ───────────────
function loadSdk(proxyUrl) {
  return new Promise((resolve, reject) => {
    // Éviter le double chargement si déjà disponible globalement
    if (window.JitsiMeetExternalAPI) { resolve(); return; }

    // Vérifier si un script est déjà en cours de chargement
    const existing = document.querySelector(`script[data-palabre-sdk]`);
    if (existing) {
      // Attendre qu'il se charge
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', () => reject(new Error('SDK_UNAVAILABLE')));
      return;
    }

    const script = document.createElement('script');
    script.src   = proxyUrl;
    script.async = true;
    script.setAttribute('data-palabre-sdk', '1');

    const timer = setTimeout(() => {
      reject(new Error('SDK_TIMEOUT'));
    }, 15000); // 15s max

    script.onload = () => {
      clearTimeout(timer);
      // Vérifier que le SDK est bien chargé (pas une réponse d'erreur JSON)
      if (window.JitsiMeetExternalAPI) {
        resolve();
      } else {
        reject(new Error('SDK_INVALID'));
      }
    };

    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('SDK_UNAVAILABLE'));
    };

    document.head.appendChild(script);
  });
}

// ── Chargement direct du SDK depuis un domaine Jitsi (fallback) ──────────
function loadSdkDirect(url) {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) { resolve(); return; }
    const script = document.createElement('script');
    script.src   = url;
    script.async = true;
    script.setAttribute('data-palabre-sdk-direct', '1');
    const timer = setTimeout(() => reject(new Error('SDK_TIMEOUT')), 12000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.JitsiMeetExternalAPI) resolve();
      else reject(new Error('SDK_INVALID'));
    };
    script.onerror = () => { clearTimeout(timer); reject(new Error('SDK_UNAVAILABLE')); };
    document.head.appendChild(script);
  });
}
