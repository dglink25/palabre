import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/apiClient';

function Ico({ d, size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICO = {
  copy:    ['M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866', 'M18.5 8H11c-1.105 0-2 .911-2 2.036v9.928C9 21.09 9.895 22 11 22h7.5c1.105 0 2-.911 2-2.036V10.036C20.5 8.912 19.605 8 18.5 8z'],
  check:   ['M20 6L9 17l-5-5'],
  server:  ['M20 6H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M6 10h.01', 'M10 10h.01'],
  docker:  ['M21 8H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z', 'M6 12h.01', 'M10 12h.01', 'M14 12h.01'],
  download:['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  qr:      ['M3 3h6v6H3z', 'M15 3h6v6h-6z', 'M3 15h6v6H3z', 'M15 15h2v2h-2z', 'M19 15v2', 'M15 19h2', 'M19 19h2', 'M19 21v-2'],
  shield:  ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  users:   ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  fire:    ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  info:    ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01'],
};

function CopyBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }
  return (
    <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #313244' }}>
      {label && (
        <div style={{ background: '#181825', padding: '6px 14px', fontSize: 12, color: '#a6adc8', letterSpacing: '0.5px', fontFamily: 'monospace' }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#1e1e2e', color: '#cdd6f4',
          margin: 0, padding: '14px 16px',
          fontSize: 14, lineHeight: 1.8,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxWidth: '100%',
          boxSizing: 'border-box',
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
        }}>
          {code}
        </pre>
        <button
          onClick={copy}
          title="Copier"
          style={{
            position: 'absolute', top: 10, right: 10,
            background: copied ? 'rgba(52,168,83,0.2)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, cursor: 'pointer',
            padding: '5px 10px', color: copied ? '#a6e3a1' : '#a6adc8',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
            transition: 'all 0.15s',
          }}>
          <Ico d={copied ? ICO.check : ICO.copy} size={13} color={copied ? '#a6e3a1' : '#a6adc8'} />
          {copied ? 'Copie !' : 'Copier'}
        </button>
      </div>
    </div>
  );
}

function StepCard({ n, icon, color, title, desc, children }) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
      {/* Indicateur vertical */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: `${color}18`, border: `2px solid ${color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico d={icon} size={20} color={color} />
        </div>
        <div style={{ width: 2, flex: 1, minHeight: 20, background: 'var(--color-border)', marginTop: 4 }} />
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, paddingBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
          Etape {n}
        </div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: '0 0 16px 0', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          {desc}
        </p>
        {children}
      </div>
    </div>
  );
}

export default function OrgInstallGuidePage() {
  const { user } = useAuth();
  const orgId = user?.orgId || '';

  // Charger le nom de l'organisation pour générer le nom de dossier
  const [orgName, setOrgName] = useState('');
  useEffect(() => {
    if (!orgId) return;
    api.get('/org/me')
      .then(d => setOrgName(d?.name || ''))
      .catch(() => {});
  }, [orgId]);

  // Nom de dossier : palabre_<nom_org_sanitisé> - ex: palabre_acme_corp
  const folderName = orgName
    ? `palabre_${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
    : 'palabre_mon_organisation';

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* En-tete */}
      <div style={{ paddingBottom: 20, marginBottom: 32, borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ margin: 0 }}>Guide d'installation</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)' }}>
          Installez et connectez votre serveur tenant Palabre en 6 etapes.
          Toutes les commandes sont pret-a-copier.
        </p>
      </div>

      {/* Identifiant en evidence */}
      {orgId && (
        <div style={{
          background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.25)',
          borderRadius: 8, padding: '14px 18px', marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Ico d={ICO.shield} size={20} color="var(--color-primary-blue)" />
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
              Identifiant de votre organisation - a conserver precieusement
            </div>
            <code style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-blue)', letterSpacing: '0.5px' }}>
              {orgId}
            </code>
          </div>
        </div>
      )}

      {/* Etapes */}
      <StepCard n={1} icon={ICO.server} color="var(--color-primary-blue)"
        title="Preparez votre serveur"
        desc="Provisionnez un serveur dedie ou une machine virtuelle avec le systeme d'exploitation recommande.">
        <ul style={{ paddingLeft: 22, margin: '0 0 12px 0' }}>
          <li>Ubuntu Server 22.04 LTS ou Debian 12 - recommande</li>
          <li>Minimum : <strong>4 vCPU, 8 Go RAM, 100 Go SSD</strong>, connexion internet stable</li>
          <li>Adresse IP publique fixe ou nom de domaine pointe sur votre serveur</li>
        </ul>
        <div style={{ background: 'rgba(234,67,53,0.06)', border: '1px solid rgba(234,67,53,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 14 }}>
          <strong>Ports a ouvrir dans votre pare-feu :</strong>
          <CopyBlock label="ufw (Ubuntu)" code={`sudo ufw allow 51820/udp    # WireGuard VPN
sudo ufw allow 80/tcp       # HTTP
sudo ufw allow 443/tcp      # HTTPS
sudo ufw allow 22/tcp       # SSH (si pas deja ouvert)
sudo ufw enable
sudo ufw status`} />
        </div>
      </StepCard>

      <StepCard n={2} icon={ICO.docker} color="var(--color-primary-blue)"
        title="Installez Docker et Docker Compose"
        desc="Docker est le seul prerequis logiciel. Le tenant Palabre s'execute entierement dans des conteneurs.">
        <CopyBlock label="Installation Docker (Ubuntu/Debian)" code={`# Telecharger et executer le script d'installation officiel
curl -fsSL https://get.docker.com -o install-docker.sh
sudo sh install-docker.sh

# Ajouter votre utilisateur au groupe docker (pas besoin de sudo)
sudo usermod -aG docker $USER

# Recharger les groupes sans se deconnecter
newgrp docker

# Verifier les installations
docker --version
docker compose version`} />
      </StepCard>

      <StepCard n={3} icon={ICO.download} color="var(--color-success-green)"
        title="Telechargez et configurez le paquet tenant Palabre"
        desc="Le tenant est inclus dans le depot Palabre. Vous allez cloner uniquement le dossier tenant/ necessaire a votre installation.">
        <CopyBlock label="Cloner uniquement le dossier tenant (sparse checkout - SSH)" code={`# Cloner le depot Palabre dans un dossier propre a votre organisation
git clone --filter=blob:none --sparse git@github.com:dglink25/palabre.git ${folderName}
cd ${folderName}

# Recuperer uniquement les dossiers necessaires
git sparse-checkout set tenant services coturn

# Se placer dans le dossier tenant
cd tenant`} />
        <CopyBlock label="Alternative - HTTPS (si pas de cle SSH configuree)" code={`git clone --filter=blob:none --sparse https://github.com/dglink25/palabre.git ${folderName}
cd ${folderName}
git sparse-checkout set tenant services coturn
cd tenant`} />
        <CopyBlock label="Lancer l'installation interactive" code={`# Rendre le script executable et lancer l'installation
chmod +x setup.sh
./setup.sh

# Le script va vous demander :
#   1. Identifiant organisation : ${orgId || 'VOTRE_ORG_ID'}
#   2. Token de controle         : (dans le QR code recu par e-mail)
#   3. Cle privee WireGuard      : (dans le QR code)
#   4. Cle publique WireGuard    : (dans le QR code)
#   5. URL du serveur central    : https://api.palabre.app (par defaut)
# Il genere automatiquement le .env et demarre tous les services`} />
      </StepCard>

      <StepCard n={4} icon={ICO.qr} color="var(--color-warning-amber)"
        title="Liez votre organisation via le QR code de provisioning"
        desc="Le QR code de provisioning vous a ete transmis par e-mail lors de l'approbation. Il contient les cles de liaison securisees avec le serveur central.">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Option A - Depuis l'application mobile (recommande)</div>
          <ol style={{ paddingLeft: 22, margin: 0 }}>
            <li>Ouvrez Palabre sur votre telephone</li>
            <li>Allez dans <strong>Tableau de bord &gt; Lier mon organisation</strong></li>
            <li>Scannez le QR code de provisioning recu par e-mail</li>
            <li>La liaison s'etablit automatiquement</li>
          </ol>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Option B - Depuis le navigateur web</div>
          <ol style={{ paddingLeft: 22, margin: 0 }}>
            <li>Allez dans <strong>Tunnel VPN &gt; Page de liaison</strong></li>
            <li>Collez le contenu JSON du QR code (disponible dans l'email)</li>
            <li>Confirmez la liaison</li>
          </ol>
        </div>
        <div style={{ background: 'rgba(251,188,5,0.08)', border: '1px solid rgba(251,188,5,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 14 }}>
          <strong>QR code perdu ?</strong> Contactez le super-administrateur Palabre depuis votre espace
          <strong> Tunnel VPN</strong> pour regenerer un nouveau code. L'ancien sera revoque.
        </div>
      </StepCard>

      <StepCard n={5} icon={ICO.shield} color="var(--color-primary-blue)"
        title="Verifiez la connexion du tunnel VPN"
        desc="Une fois le tunnel etabli, verifiez que votre serveur communique bien avec le serveur central.">
        <CopyBlock label="Verification des logs de l'agent" code={`# Voir les logs de l'agent de liaison
docker logs palabre-agent --tail 50 -f

# Verifier l'etat du tunnel WireGuard
sudo wg show

# Tester la connectivite avec le serveur central
ping api.palabre.app`} />
        <ul style={{ paddingLeft: 22, margin: 0 }}>
          <li>Dans votre tableau de bord, allez dans <strong>Tunnel VPN</strong></li>
          <li>Le statut doit passer a <strong>"Connexion etablie"</strong> apres le premier heartbeat</li>
          <li>Si le statut reste "En attente" apres 5 minutes, verifiez les logs ci-dessus</li>
          <li>Assurez-vous que le port 51820/UDP est bien ouvert sur votre pare-feu</li>
        </ul>
      </StepCard>

      <StepCard n={6} icon={ICO.users} color="var(--color-success-green)"
        title="Invitez vos membres"
        desc="Votre serveur est operationnel. Generez des codes d'invitation pour vos collaborateurs.">
        <ol style={{ paddingLeft: 22, margin: '0 0 12px 0' }}>
          <li>Allez dans <strong>Invitations membres</strong> dans la navigation</li>
          <li>Cliquez sur <strong>"Generer un code d'invitation"</strong></li>
          <li>Partagez le code ou le QR code a vos collaborateurs</li>
          <li>Vos membres saisissent le code dans l'application mobile ou web</li>
          <li>Les communications sont chiffrees de bout en bout des la premiere connexion</li>
        </ol>
        <div style={{ background: 'rgba(52,168,83,0.06)', border: '1px solid rgba(52,168,83,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 14 }}>
          Le code d'invitation peut etre regenere a tout moment. L'ancien code devient invalide des qu'un nouveau est genere.
        </div>
      </StepCard>

      {/* Aide */}
      <div style={{
        background: '#fff', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '18px 22px', marginTop: 8,
        display: 'flex', gap: 16, alignItems: 'flex-start',
      }}>
        <Ico d={ICO.info} size={20} color="var(--color-primary-blue)" />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Besoin d'aide ?</div>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Si vous rencontrez des difficultes lors de l'installation, consultez la documentation
            technique fournie avec le paquet tenant ou contactez le support Palabre.
            Pour recuperer un QR code perdu, utilisez la page <strong>Tunnel VPN</strong> de votre tableau de bord.
          </p>
        </div>
      </div>
    </div>
  );
}
