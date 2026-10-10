/**
 * AdminIncomingCallBanner - Bandeau d'alerte appel entrant pour le super-admin
 * Affiché en haut de toutes les pages admin quand un appel arrive,
 * quelle que soit la page courante.
 */
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '../context/SuperAdminContext';

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default function AdminIncomingCallBanner() {
  const { incomingCall, dismissIncomingCall } = useSuperAdmin();
  const navigate = useNavigate();

  if (!incomingCall) return null;

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(234,67,53,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(234,67,53,0); }
          100% { box-shadow: 0 0 0 0 rgba(234,67,53,0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1F3A5F',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        animation: 'slideDown 0.3s ease',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        {/* Icone animée */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#EA4335',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'pulse-ring 1.2s infinite',
        }}>
          <PhoneIcon />
        </div>

        {/* Texte */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Appel entrant — Service client
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            Un utilisateur souhaite parler a un conseiller.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { navigate('/admin/support'); dismissIncomingCall(); }}
            style={{
              padding: '7px 16px',
              background: '#34A853',
              color: '#fff',
              border: 'none',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Prendre l'appel
          </button>
          <button
            onClick={dismissIncomingCall}
            style={{
              padding: '7px 12px',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Ignorer
          </button>
        </div>
      </div>
      {/* Espace compensatoire pour ne pas masquer le contenu */}
      <div style={{ height: 60 }} />
    </>
  );
}
