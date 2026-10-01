import { useState, useEffect } from 'react';
import { networkDetector } from '../lib/networkDetector';

/**
 * NetworkModeIndicator
 *
 * Badge discret affiché dans la sidebar qui indique le mode de connexion actif :
 *   🟢 Réseau local    — connexion directe au Tenant_Server
 *   🟠 Via serveur central — connexion relayée (hors réseau local)
 *   🔴 Hors ligne      — ni tenant ni relais ne répondent
 *
 * S'affiche uniquement si un tenant est configuré (organisation avec serveur local).
 * Invisible pour les utilisateurs sans organisation ou en mode public.
 */
export default function NetworkModeIndicator() {
  const [mode, setMode] = useState(networkDetector.getCurrentMode());

  useEffect(() => {
    const unsubscribe = networkDetector.onModeChange((newMode) => setMode(newMode));
    return unsubscribe;
  }, []);

  // Ne pas afficher si pas de tenant configuré
  if (!networkDetector.isTenantConfigured()) return null;

  const config = {
    direct:      { dot: '#16a34a', label: 'Réseau local',         title: 'Connexion directe au serveur de votre organisation' },
    relay:       { dot: '#f97316', label: 'Via serveur central',   title: 'Connexion relayée — vous êtes hors du réseau local' },
    unavailable: { dot: '#dc2626', label: 'Hors ligne',            title: 'Impossible de joindre le serveur. Vérifiez votre connexion.' },
  };

  const { dot, label, title } = config[mode] || config.relay;

  return (
    <div
      title={title}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           6,
        padding:       '6px 10px',
        margin:        '4px 8px',
        borderRadius:  8,
        background:    'rgba(0,0,0,0.06)',
        cursor:        'default',
        userSelect:    'none',
        transition:    'background 0.2s',
      }}
    >
      {/* Indicateur coloré (dot animé si relay) */}
      <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        <span style={{
          display:      'block',
          width:        8,
          height:       8,
          borderRadius: '50%',
          background:   dot,
        }} />
        {/* Pulse ring pour le mode relay */}
        {mode === 'relay' && (
          <span style={{
            position:     'absolute',
            inset:        -3,
            borderRadius: '50%',
            border:       `2px solid ${dot}`,
            opacity:      0.4,
            animation:    'network-pulse 1.5s ease-out infinite',
          }} />
        )}
      </span>

      {/* Libellé */}
      <span style={{
        fontSize:    11,
        fontWeight:  500,
        color:       'var(--color-text-secondary)',
        whiteSpace:  'nowrap',
        overflow:    'hidden',
        textOverflow:'ellipsis',
      }}>
        {label}
      </span>

      {/* Style CSS inline pour l'animation pulse */}
      <style>{`
        @keyframes network-pulse {
          0%   { transform: scale(0.8); opacity: 0.6; }
          70%  { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
