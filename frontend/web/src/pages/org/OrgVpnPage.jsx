import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { friendlyMessage } from '../../lib/errorMessages';

// SVG icons
const WifiIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/>
    <line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>
);
const InfoIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const RefreshIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);
const ListIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

// Status config
const VPN_STATUS_CONFIG = {
  active:   { label: 'Connexion établie', color: '#34A853', bg: 'rgba(52,168,83,0.08)', border: 'rgba(52,168,83,0.25)', alert: 'success' },
  degraded: { label: 'Signal instable', color: '#FBBC05', bg: 'rgba(251,188,5,0.08)', border: 'rgba(251,188,5,0.3)', alert: 'warning' },
  offline:  { label: 'Connexion interrompue', color: '#EA4335', bg: 'rgba(234,67,53,0.06)', border: 'rgba(234,67,53,0.2)', alert: 'danger' },
  unknown:  { label: 'En attente de connexion', color: '#FBBC05', bg: 'rgba(251,188,5,0.08)', border: 'rgba(251,188,5,0.3)', alert: 'warning' },
};

const ORG_STATUS_LABELS = {
  active:    'Active',
  pending:   'En cours d\'activation',
  suspended: 'Suspendue',
  unknown:   'Inconnue',
};

// Status messages
const VPN_ALERT_TEXT = {
  active:   'Le serveur local est joignable - tunnel opérationnel.',
  degraded: 'Signal instable - dernier contact il y a plus de 2 minutes.',
  offline:  'Connexion interrompue - aucun contact depuis plus de 5 minutes.',
  unknown:  'En attente de connexion - le serveur local n\'a pas encore envoyé de signal.',
};

export default function OrgVpnPage() {
  const { user } = useAuth();
  const [vpnData, setVpnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.orgId) return;
    setLoading(true);
    try {
      const data = await api.get(`/org/tenants/${user.orgId}/status`);
      setVpnData(data);
      setError('');
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user?.orgId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const vpnStatus  = vpnData?.vpnStatus  || 'unknown';
  const orgStatus  = vpnData?.orgStatus  || 'unknown';
  const secondsAgo = vpnData?.secondsAgo;

  const statusConfig = VPN_STATUS_CONFIG[vpnStatus] || VPN_STATUS_CONFIG.unknown;

  function lastSeenLabel() {
    if (secondsAgo === null || secondsAgo === undefined) return 'Jamais';
    if (secondsAgo < 60)   return `Il y a ${secondsAgo}s`;
    if (secondsAgo < 3600) return `Il y a ${Math.floor(secondsAgo / 60)} min`;
    return `Il y a ${Math.floor(secondsAgo / 3600)} h`;
  }

  const orgStatusColor = orgStatus === 'active' ? '#34A853' : '#5F6368';

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'slideUp 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px 0', color: '#202124' }}>
            Tunnel VPN WireGuard
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
            Surveillance du tunnel de connexion à votre infrastructure locale
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {loading ? <Spinner /> : <RefreshIcon />}
          Actualiser
        </button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Status banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        background: statusConfig.bg,
        border: `1px solid ${statusConfig.border}`,
        borderRadius: 10,
        marginBottom: 20,
      }}>
        <span style={{ display: 'inline-flex', color: statusConfig.color }}>
          <WifiIcon size={20} />
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#202124' }}>{statusConfig.label}</div>
          <div style={{ fontSize: 13, color: '#5F6368', marginTop: 2 }}>{VPN_ALERT_TEXT[vpnStatus]}</div>
        </div>
        <span style={{
          marginLeft: 'auto',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: statusConfig.color,
          flexShrink: 0,
          ...(vpnStatus === 'active' ? { boxShadow: `0 0 0 3px ${statusConfig.color}30` } : {}),
        }} />
      </div>

      {/* Status cards */}
      {vpnData && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            {
              label: 'Statut VPN',
              value: statusConfig.label,
              color: statusConfig.color,
              bg: statusConfig.bg,
              border: statusConfig.border,
            },
            {
              label: 'Organisation',
              value: ORG_STATUS_LABELS[orgStatus] || orgStatus,
              color: orgStatusColor,
              bg: orgStatus === 'active' ? 'rgba(52,168,83,0.06)' : '#F8F9FA',
              border: orgStatus === 'active' ? 'rgba(52,168,83,0.2)' : '#E0E0E0',
            },
            {
              label: 'Dernier contact',
              value: lastSeenLabel(),
              color: '#5F6368',
              bg: '#F8F9FA',
              border: '#E0E0E0',
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                flex: '1 1 160px',
                background: card.bg,
                border: `1px solid ${card.border}`,
                borderRadius: 8,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: card.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700, marginBottom: 3 }}>
                  {card.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#202124' }}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Setup instructions */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          <span style={{ color: '#1A73E8', display: 'inline-flex' }}><ListIcon /></span>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#202124' }}>Configuration du tunnel</h2>
        </div>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {[
            <>Récupérez le <strong>code QR</strong> transmis lors de l'approbation de votre dossier (reçu par e-mail et WhatsApp depuis le super-administrateur).</>,
            <>Sur votre serveur local, lancez l'<strong>agent tenant Palabre</strong>.</>,
            <>Scannez le QR code depuis l'application mobile ou collez le payload JSON sur la <a href="/org/link" style={{ color: '#1A73E8' }}>page de liaison</a>.</>,
            <>L'agent établit le tunnel WireGuard automatiquement et commence à envoyer des heartbeats.</>,
            <>Le statut ci-dessus passe à <strong style={{ color: '#34A853' }}>Actif</strong> dès que le premier heartbeat est reçu.</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 14, color: '#202124', lineHeight: 1.7, marginBottom: 8 }}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Technical info */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          <span style={{ color: '#5F6368', display: 'inline-flex' }}><InfoIcon /></span>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#202124' }}>Informations techniques</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['Identifiant tenant', user?.orgId || '-', false],
              ['Clé VPN (privée)', 'Confidentielle - stockée sur votre appareil lors de la liaison', false],
              ['URL heartbeat', `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api/v1'}/org/tenants/heartbeat`, true],
            ].map(([label, value, isMono]) => (
              <tr key={label}
                onMouseEnter={e => e.currentTarget.style.background = '#F8F9FA'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ transition: 'background 0.1s' }}
              >
                <td style={{ padding: '11px 0', color: '#5F6368', width: 200, fontSize: 13, borderBottom: '1px solid #E0E0E0', verticalAlign: 'top' }}>
                  {label}
                </td>
                <td style={{ padding: '11px 0 11px 12px', fontSize: 13, borderBottom: '1px solid #E0E0E0', color: '#202124' }}>
                  {isMono
                    ? <code style={{ background: '#F8F9FA', border: '1px solid #E0E0E0', borderRadius: 4, padding: '2px 8px', fontSize: 12, wordBreak: 'break-all' }}>
                        {value}
                      </code>
                    : value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: '#5F6368', marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
          Si vous avez perdu le QR code avant de configurer le tunnel, contactez le super-administrateur pour régénérer un nouveau code QR depuis la page de la demande.
        </p>
      </div>
    </div>
  );
}
