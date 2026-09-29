import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { friendlyMessage } from '../../lib/errorMessages';

export default function OrgVpnPage() {
  const { user } = useAuth();
  const [vpnData, setVpnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

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
    // Rafraîchir toutes les 30s pour suivre les heartbeats en temps réel
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const vpnStatus  = vpnData?.vpnStatus  || 'unknown';
  const orgStatus  = vpnData?.orgStatus  || 'unknown';
  const secondsAgo = vpnData?.secondsAgo;

  function statusLabel() {
    if (vpnStatus === 'active')   return { variant: 'success', text: 'Tunnel actif' };
    if (vpnStatus === 'degraded') return { variant: 'warning', text: 'Signal faible - dernier heartbeat il y a plus de 2 min' };
    if (vpnStatus === 'offline')  return { variant: 'danger',  text: 'Tunnel hors ligne - aucun heartbeat depuis plus de 5 min' };
    return { variant: 'warning', text: 'Statut inconnu - le serveur local n\'a pas encore envoye de heartbeat' };
  }

  function lastSeenLabel() {
    if (secondsAgo === null || secondsAgo === undefined) return 'Jamais';
    if (secondsAgo < 60)   return `Il y a ${secondsAgo}s`;
    if (secondsAgo < 3600) return `Il y a ${Math.floor(secondsAgo / 60)} min`;
    return `Il y a ${Math.floor(secondsAgo / 3600)} h`;
  }

  const status = statusLabel();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Tunnel VPN WireGuard</h1>
        <button className="btn btn-sm btn-secondary" onClick={load} disabled={loading}>
          {loading ? <Spinner /> : 'Actualiser'}
        </button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Statut en temps réel */}
      <Alert variant={status.variant}>{status.text}</Alert>

      {/* Tableau de bord rapide */}
      {vpnData && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: 'Statut VPN',         value: vpnStatus,       accentColor: vpnStatus === 'active' ? 'var(--color-success-green)' : 'var(--color-alert-red)' },
            { label: 'Statut organisation', value: orgStatus,       accentColor: 'var(--color-text-secondary)' },
            { label: 'Dernier heartbeat',   value: lastSeenLabel(), accentColor: 'var(--color-text-secondary)' },
          ].map((s) => (
            <div key={s.label} style={{
              flex: 1, minWidth: 160,
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: s.accentColor,
              }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)' }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="card">
        <h2>Configuration du tunnel</h2>
        <ol style={{ lineHeight: 2.2, paddingLeft: 20, fontSize: 15 }}>
          <li>
            Recuperez le <strong>code QR</strong> transmis lors de l'approbation de votre dossier
            (recu par e-mail et WhatsApp depuis le super-administrateur).
          </li>
          <li>Sur votre serveur local, lancez l'agent tenant Palabre.</li>
          <li>Scannez le QR code depuis l'application mobile ou collez le payload JSON sur
            la <a href="/org/link">page de liaison</a>.
          </li>
          <li>L'agent etablit le tunnel WireGuard automatiquement et commence a envoyer des heartbeats.</li>
          <li>Le statut ci-dessus passe a <strong>Actif</strong> des que le premier heartbeat est recu.</li>
        </ol>
      </div>

      {/* Informations techniques */}
      <div className="card">
        <h2>Informations techniques</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)', width: 200 }}>Identifiant tenant</td>
              <td style={{ padding: '10px 0', fontFamily: 'monospace', fontSize: 13 }}>{user?.orgId || '-'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>Cle VPN (privee)</td>
              <td style={{ padding: '10px 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Confidentielle - stockee sur votre appareil lors de la liaison</td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: 'var(--color-text-secondary)' }}>URL heartbeat</td>
              <td style={{ padding: '10px 0', fontSize: 13, fontFamily: 'monospace' }}>
                {window.location.origin}/api/v1/org/tenants/heartbeat
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-secondary" style={{ marginTop: 12, fontSize: 13 }}>
          Si vous avez perdu le QR code avant de configurer le tunnel, contactez le
          super-administrateur pour regenerer un nouveau code QR depuis la page de la demande.
        </p>
      </div>
    </div>
  );
}
