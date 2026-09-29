/**
 * Étape 7 — Guide d'installation transmis à l'administrateur de l'organisation.
 * Étape 9 — Configuration VPN via QR code.
 * Étape 10 — Génération APK.
 *
 * Cette page est accessible uniquement au super-administrateur pour
 * consulter et transmettre le guide à une organisation approuvée.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const STATUS_VARIANT = { pending: 'warning', active: 'success', suspended: 'danger' };
const STATUS_LABEL   = { pending: 'En attente', active: 'Active', suspended: 'Suspendue' };

export default function InstallationGuidePage() {
  const [params] = useSearchParams();
  const orgId = params.get('org');

  const [org,     setOrg]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [orgSearch, setOrgSearch] = useState(orgId || '');

  useEffect(() => {
    if (orgId) loadOrg(orgId);
  }, [orgId]);

  async function loadOrg(id) {
    if (!id) return;
    setLoading(true); setError('');
    try {
      // Récupère les infos de l'organisation depuis la liste des demandes approuvées
      const list = await api.get(`/onboarding/admin/requests?status=approved&pageSize=100`);
      const found = list.items.find((r) => r.organization_id === id || r.id === id);
      if (!found) { setError('Organisation introuvable.'); setOrg(null); }
      else setOrg(found);
    } catch (e) { setError(friendlyMessage(e)); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <h1>Guide d'installation</h1>
      <p className="text-secondary">
        Etapes 7 a 10 du workflow : transmettre les instructions a l'administrateur de l'organisation apres approbation.
      </p>

      {/* Recherche organisation */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Identifiant de l'organisation ou ID de la demande</label>
            <input
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <button className="btn" onClick={() => loadOrg(orgSearch)} disabled={loading}>
            Charger
          </button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <Spinner />}

      {org && (
        <>
          {/* Recap organisation */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0' }}>{org.step1_organization?.name}</h2>
                <p className="text-secondary" style={{ margin: 0 }}>
                  {org.step2_leader?.fullName} · {org.step2_leader?.email} · {org.step2_leader?.phone}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[org.status] || 'neutral'}>
                {STATUS_LABEL[org.status] || org.status}
              </Badge>
            </div>
            {org.organization_id && (
              <p style={{ marginTop: 12, fontSize: 13 }}>
                <strong>ID organisation :</strong> <code>{org.organization_id}</code>
              </p>
            )}
          </div>

          {/* Etape 7 — Guide */}
          <div className="card">
            <h2>Etape 7 : Guide d'installation (a transmettre a l'administrateur)</h2>
            <ol style={{ lineHeight: 2, paddingLeft: 20 }}>
              <li>
                <strong>Recevez votre identifiant et code d'activation</strong> par e-mail et WhatsApp.
                Rendez-vous sur <a href="/activate" target="_blank" rel="noreferrer">la page d'activation</a> pour creer votre compte administrateur.
              </li>
              <li>
                <strong>Preparez un serveur physique ou virtuel</strong> avec Ubuntu Server 22.04+ ou Debian 12.
                Minimum recommande : 4 vCPU, 8 Go RAM, 100 Go SSD, connexion internet stable.
              </li>
              <li>
                <strong>Installez Docker et Docker Compose</strong> :
                <pre style={{ background: 'var(--color-offwhite)', padding: '10px 14px', fontSize: 13, marginTop: 8, overflowX: 'auto' }}>
                  {`curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER`}
                </pre>
              </li>
              <li>
                <strong>Telechargez le paquet tenant Palabre</strong> fourni par le super-administrateur,
                ou clonez le depot de deploiement.
              </li>
              <li>
                <strong>Scannez le code QR</strong> depuis l'interface de configuration VPN — voir l'etape 9 ci-dessous.
              </li>
              <li>
                <strong>Generez l'APK</strong> de votre organisation — voir l'etape 10 ci-dessous.
              </li>
            </ol>
          </div>

          {/* Etape 9 — VPN */}
          <div className="card">
            <h2>Etape 9 : Configuration du tunnel VPN WireGuard</h2>
            <p className="text-secondary">
              Le code QR a ete genere lors de l'approbation du dossier et transmis par e-mail.
              Si l'administrateur l'a perdu, retournez sur la page de la demande pour le retrouver.
            </p>
            <div style={{ background: 'var(--color-offwhite)', padding: '16px', marginTop: 12, fontSize: 13 }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Sur le serveur local de l'organisation :</p>
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
                <li>Demarrez l'interface d'administration Palabre tenant.</li>
                <li>Allez dans <strong>Parametres &gt; VPN &gt; Configurer le tunnel</strong>.</li>
                <li>Scannez le code QR avec la camera de votre appareil ou importez l'image.</li>
                <li>Le tunnel WireGuard s'etablit automatiquement vers le service central.</li>
                <li>Le statut passe a "Actif" une fois le premier heartbeat confirme.</li>
              </ol>
            </div>
            {org.organization_id && (
              <p style={{ marginTop: 12 }}>
                <Link to={`/admin/onboarding/${org.id}`}>
                  Voir la demande pour retrouver le code QR
                </Link>
              </p>
            )}
          </div>

          {/* Etape 10 — APK */}
          <div className="card">
            <h2>Etape 10 : Generation de l'APK</h2>
            <p className="text-secondary">
              L'administrateur de l'organisation genere l'APK depuis son tableau de bord.
              L'APK est preconfigure avec l'identite visuelle et les parametres de l'organisation.
            </p>
            <div style={{ background: 'var(--color-offwhite)', padding: '16px', marginTop: 12, fontSize: 13 }}>
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
                <li>Connectez-vous au tableau de bord administrateur de l'organisation.</li>
                <li>Allez dans <strong>Organisation &gt; Application mobile &gt; Generer l'APK</strong>.</li>
                <li>Patientez pendant la compilation (2 a 5 minutes).</li>
                <li>Telechargez l'APK et partagez-le a vos utilisateurs.</li>
                <li>Les utilisateurs s'inscrivent directement depuis l'application.</li>
              </ol>
            </div>
          </div>
        </>
      )}

      {!org && !loading && !error && (
        <div className="card">
          <p className="text-secondary">
            Saisissez l'identifiant d'une organisation approuvee pour afficher son guide d'installation.
            Ou consultez la <Link to="/admin/onboarding?status=approved">liste des organisations approuvees</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
