/**
 * SuperAdminContext - Contexte global pour le super-administrateur
 *
 * Responsabilités :
 *   - Maintenir la connexion WebSocket support active sur TOUTES les pages
 *   - Diffuser la présence "admin en ligne" en permanence
 *   - Recevoir les notifications d'appels entrants (son + notification push)
 *   - Exposer l'état de la file d'attente à tous les composants admin
 *
 * Le WebSocket se reconnecte automatiquement après coupure réseau.
 * La session ne se déconnecte jamais côté support tant que le super-admin
 * est authentifié, quelle que soit la page affichée.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supportWs } from '../lib/supportApi';

const SuperAdminContext = createContext(null);

// Son d'alerte pour les appels entrants (ton bref généré par Web Audio API)
function _playIncomingAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.4);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.4 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.4 + 0.3);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.35);
    }
  } catch { /* Web Audio non disponible */ }
}

// Notification système du navigateur
function _showBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/logo.png', tag: 'support-incoming' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body, icon: '/logo.png', tag: 'support-incoming' });
    });
  }
}

export function SuperAdminProvider({ children }) {
  const { user } = useAuth();
  const [queueStatus, setQueueStatus] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null); // { callId, userId, sessionId }
  const [wsConnected, setWsConnected] = useState(false);
  const connectedRef = useRef(false);

  const isSuperAdmin = !!user?.isSuperAdmin;

  // Connexion WebSocket globale — s'établit dès la connexion du super-admin
  // et reste active quelle que soit la page affichée
  useEffect(() => {
    if (!isSuperAdmin) {
      if (connectedRef.current) {
        supportWs.disconnect();
        connectedRef.current = false;
        setWsConnected(false);
      }
      return;
    }

    // Connecter si pas déjà connecté
    if (!supportWs.isConnected) {
      supportWs.connect();
    }
    connectedRef.current = true;

    const offConnected = supportWs.on('connected', () => {
      setWsConnected(true);
    });

    const offDisconnected = supportWs.on('disconnected', () => {
      setWsConnected(false);
    });

    // Appel entrant → son + notification
    const offIncoming = supportWs.on('support:call:incoming', (meta) => {
      setIncomingCall(meta);
      _playIncomingAlert();
      _showBrowserNotification(
        'Appel entrant - Service client',
        'Un utilisateur souhaite parler a un conseiller.'
      );
      // Effacer l'alerte après 30 secondes
      setTimeout(() => setIncomingCall(null), 30000);
    });

    // Mise à jour file d'attente
    const offQueue = supportWs.on('support:queue:update', (data) => {
      setQueueStatus(prev => prev ? {
        ...prev,
        queueLength: data?.updates?.length ?? prev.queueLength,
      } : prev);
    });

    const offStatus = supportWs.on('support:status', (data) => {
      setQueueStatus(data);
    });

    // L'appel est pris → effacer l'alerte
    const offAnswered = supportWs.on('support:call:answered', () => {
      setIncomingCall(null);
    });

    // L'appel se termine
    const offEnded = supportWs.on('support:call:ended', () => {
      setIncomingCall(null);
    });

    // Si l'admin se reconnecte, demander le statut actuel
    const offReconnected = supportWs.on('connected', () => {
      setWsConnected(true);
    });

    return () => {
      offConnected();
      offDisconnected();
      offIncoming();
      offQueue();
      offStatus();
      offAnswered();
      offEnded();
      offReconnected();
      // NE PAS déconnecter ici — le WS reste actif entre les changements de page
    };
  }, [isSuperAdmin]);

  // Demander la permission de notifications au montage
  useEffect(() => {
    if (!isSuperAdmin) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isSuperAdmin]);

  const dismissIncomingCall = useCallback(() => setIncomingCall(null), []);

  return (
    <SuperAdminContext.Provider value={{ queueStatus, incomingCall, wsConnected, dismissIncomingCall }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  return useContext(SuperAdminContext);
}
