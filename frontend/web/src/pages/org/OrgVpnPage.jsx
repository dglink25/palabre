import { useState } from 'react';
import { Alert } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export default function OrgVpnPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('unknown'); // unknown | active | offline

  return (
    <div>
      <h1>Tunnel VPN WireGuard</h1>
      <p className="text-secondary">
        Etape 9 : Configuration du tunnel entre votre serveur local et le service central Palabre.
      </p>

      {status === 'unknown' && (
        <Alert variant="warning">
          Statut VPN inconnu. Le serveur local n'a pas encore envoye de heartbeat.
        </Alert>
      )}
      {status === 'active' && (
        <Alert variant="success">Tunnel VPN actif. Dernier heartbeat recu il y a moins d'une minute.</Alert>
      )}
      {status === 'offline' && (
        <Alert variant="danger">Tunnel VPN hors ligne. Verifiez votre serveur local.</Alert>
      )}

      <div className="card" style={{ borderTop: '4px solid var(--color-primary-blue)' }}>
        <h2>Instructions de configuration</h2>
        <ol style={{ lineHeight: 2.2, paddingLeft: 20, fontSize: 15 }}>
          <li>
            Recuperez le <strong>code QR</strong> transmis par le super-administrateur lors de l'approbation
            de votre dossier (recu par e-mail et WhatsApp).
          </li>
          <li>
            Sur votre serveur local, ouvrez l'interface d'administration Palabre tenant.
          </li>
          <li>
            Allez dans <strong>Parametres &gt; VPN &gt; Configurer le tunnel</strong>.
          </li>
          <li>
            Scannez le QR code ou copiez-collez le contenu JSON du payload.
          </li>
          <li>
            Le tunnel WireGuard s'etablit automatiquement. Le statut ci-dessus
            passe a <strong>Actif</strong> des le premier heartbeat confirme.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2>Contenu du QR code</h2>
        <p className="text-secondary">
          Le QR code encode les informations suivantes. Ces secrets ne sont jamais re-affichables
          apres la premiere connexion — contactez le super-administrateur si vous les avez perdus.
        </p>
        <table>
          <tbody>
            <tr><td style={{ width: 200, color: 'var(--color-text-secondary)', padding: '8px 0' }}>Identifiant tenant</td><td><code>{user?.orgId || '-'}</code></td></tr>
            <tr><td style={{ color: 'var(--color-text-secondary)', padding: '8px 0' }}>Cle VPN (privee)</td><td><code>***** (confidentiel)</code></td></tr>
            <tr><td style={{ color: 'var(--color-text-secondary)', padding: '8px 0' }}>Jeton de controle</td><td><code>***** (confidentiel)</code></td></tr>
            <tr><td style={{ color: 'var(--color-text-secondary)', padding: '8px 0' }}>URL heartbeat</td><td><code>{window.location.origin}/api/v1/tenants/heartbeat</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
