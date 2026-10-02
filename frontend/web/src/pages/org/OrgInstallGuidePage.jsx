/**
 * OrgInstallGuidePage — Guide d'installation du serveur tenant Palabre.
 * Design institutionnel sobre : typographie forte, filets colorés discrets,
 * timeline typographique, blocs de code sobres. Palette stricte, sans dégradé.
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/apiClient';

// ── Palette institutionnelle ─────────────────────────────────────────────────
const C = {
  primary: '#1A73E8',
  success: '#34A853',
  warning: '#FBBC05',
  danger: '#EA4335',
  text: '#111827',
  textSoft: '#4B5563',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderSoft: '#F3F4F6',
  bg: '#FFFFFF',
  bgSoft: '#FAFAFA',
  ink: '#1E1E2E',
};

// ── Styles globaux (animations discrètes + responsive) ───────────────────────
const STYLES = `
  @keyframes gi-fade {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .gi-reveal { opacity: 0; animation: gi-fade .5s ease-out forwards; }
  .gi-link { transition: color .15s ease, border-color .15s ease; }
  .gi-link:hover { color: ${C.primary}; border-color: ${C.primary}; }
  .gi-row { transition: background-color .15s ease; }
  .gi-row:hover { background: ${C.bgSoft}; }
  .gi-btn { transition: background-color .15s ease; }
  .gi-btn:hover { background: #1557B0; }

  @media (max-width: 720px) {
    .gi-hero { padding: 28px 0 24px !important; }
    .gi-hero-meta { flex-direction: column; align-items: flex-start !important; gap: 12px !important; }
    .gi-step-grid { grid-template-columns: 1fr !important; }
    .gi-step-num { width: 56px !important; }
    .gi-step-body { padding-left: 20px !important; }
  }
`;

function useStyles() {
  useEffect(() => {
    const id = 'gi-styles';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = STYLES;
    document.head.appendChild(s);
  }, []);
}

// ── Reveal au scroll ─────────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); }
    }, { threshold });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on];
}

// ── Icônes ───────────────────────────────────────────────────────────────────
const P = {
  server:   'M2 3h20v6H2zM2 11h20v6H2zM6 7h.01M6 15h.01M18 7h2M18 15h2',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  copy:     'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  check:    'M20 6L9 17l-5-5',
  info:     'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01',
  warning:  'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  key:      'M7.5 11a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3',
  headset:  'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  docker:   'M21 8H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2zM6 12h.01M10 12h.01M14 12h.01',
  qrcode:   'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M17 17v4M21 14v3h-4',
};

function Icon({ name, size = 20, color = 'currentColor' }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      {d.split('z').filter(Boolean).map((p, i) => (
        <path key={i} d={p + (p.trim().endsWith('z') ? '' : '')} />
      ))}
    </svg>
  );
}

// ── Bloc de code sobre ───────────────────────────────────────────────────────
function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{
      marginBottom: 18,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: C.bgSoft,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.4px',
          color: C.textSoft, textTransform: 'uppercase',
          fontFamily: "'JetBrains Mono','Fira Code',monospace",
        }}>
          {label}
        </span>
        <button onClick={copy} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: copied ? C.success : C.textSoft,
          fontSize: 12, fontWeight: 600, padding: '2px 6px',
          display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'inherit',
        }}>
          <Icon name={copied ? 'check' : 'copy'} size={13} color={copied ? C.success : C.textSoft} />
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <pre style={{
        background: C.ink, color: '#D4D4D4',
        margin: 0, padding: '16px 18px',
        fontSize: 12.5, lineHeight: 1.75,
        overflowX: 'auto', whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
      }}>{code}</pre>
    </div>
  );
}

// ── Callout sobre ────────────────────────────────────────────────────────────
function Callout({ type = 'info', children }) {
  const cfg = {
    info:    { color: C.primary, label: 'Information' },
    warning: { color: C.warning, label: 'Vigilance' },
    danger:  { color: C.danger,  label: 'Important' },
    success: { color: C.success, label: 'Bonne pratique' },
  }[type];
  return (
    <div style={{
      borderLeft: `3px solid ${cfg.color}`,
      padding: '2px 0 2px 16px',
      margin: '20px 0',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.6px',
        textTransform: 'uppercase', color: cfg.color, marginBottom: 4,
      }}>{cfg.label}</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.7, color: C.textSoft }}>
        {children}
      </div>
    </div>
  );
}

// ── Étape sobre ──────────────────────────────────────────────────────────────
function Step({ n, total, iconName, color, label, title, desc, children }) {
  const isLast = n === total;
  const [ref, on] = useReveal(0.06);
  return (
    <div ref={ref} className={on ? 'gi-reveal' : ''} style={{
      display: 'grid',
      gridTemplateColumns: '80px 1fr',
      gap: 0,
      opacity: on ? undefined : 0,
      animationDelay: `${(n - 1) * 0.06}s`,
    }}>
      {/* Colonne numéro */}
      <div className="gi-step-num" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 2,
      }}>
        <div style={{
          fontSize: 40, fontWeight: 800, lineHeight: 1,
          color: C.border, letterSpacing: '-1.5px',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(n).padStart(2, '0')}
        </div>
        {!isLast && (
          <div style={{
            width: 1, flex: 1, minHeight: 40,
            background: C.border, marginTop: 12,
          }} />
        )}
      </div>

      {/* Corps */}
      <div className="gi-step-body" style={{
        paddingLeft: 28, paddingBottom: isLast ? 0 : 56,
        borderLeft: `1px solid ${C.border}`,
        paddingTop: 2,
      }}>
        {/* Surtitre */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.6px',
            textTransform: 'uppercase', color: color,
          }}>
            <Icon name={iconName} size={13} color={color} />
            {label}
          </span>
        </div>

        {/* Titre */}
        <h3 style={{
          margin: '0 0 10px 0',
          fontSize: 'clamp(1.1rem, 2.2vw, 1.3rem)',
          fontWeight: 700,
          color: C.text,
          lineHeight: 1.35,
          letterSpacing: '-0.2px',
        }}>{title}</h3>

        {/* Description */}
        <p style={{
          margin: '0 0 20px 0',
          color: C.textSoft,
          lineHeight: 1.75,
          fontSize: 15,
        }}>{desc}</p>

        {children}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function OrgInstallGuidePage() {
  useStyles();
  const { user } = useAuth();
  const orgId = user?.orgId || '';
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (!orgId) return;
    api.get('/org/me').then(d => setOrgName(d?.name || '')).catch(() => {});
  }, [orgId]);

  const folderName = orgName
    ? `palabre_${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
    : 'palabre_mon_organisation';

  const TOTAL = 6;

  return (
    <div style={{
      maxWidth: 820, margin: '0 auto',
      fontFamily: 'var(--font-stack)',
      color: C.text,
      padding: '0 4px',
    }}>

      {/* ── En-tête ── */}
      <header style={{ paddingBottom: 32, borderBottom: `1px solid ${C.border}`, marginBottom: 40 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: C.primary, marginBottom: 12,
        }}>
          Documentation technique
        </div>
        <h1 style={{
          margin: '0 0 12px 0',
          fontSize: 'clamp(1.6rem, 3.5vw, 2.1rem)',
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: '-0.5px',
          color: C.text,
        }}>
          Installation du serveur tenant
        </h1>
        <div className="gi-hero-meta" style={{
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <p style={{
            margin: 0, color: C.textSoft, fontSize: 15, lineHeight: 1.7,
            maxWidth: 520,
          }}>
            Installez et connectez votre infrastructure Palabre en six étapes.
            Toutes les commandes sont prêtes à copier.
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingLeft: 24, borderLeft: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1 }}>~30</div>
            <div style={{
              fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
              letterSpacing: '0.8px', fontWeight: 700, lineHeight: 1.3,
            }}>minutes<br />estimées</div>
          </div>
        </div>
      </header>

      {/* ── Identifiant organisation ── */}
      {orgId && (
        <section style={{
          display: 'flex', alignItems: 'flex-start', gap: 16,
          padding: '16px 0 16px 20px',
          borderLeft: `3px solid ${C.primary}`,
          marginBottom: 40,
        }}>
          <Icon name="key" size={18} color={C.primary} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.6px',
              textTransform: 'uppercase', color: C.textMuted, marginBottom: 6,
            }}>
              Identifiant de votre organisation — à conserver
            </div>
            <code style={{
              fontSize: 15, fontWeight: 600,
              color: C.primary, letterSpacing: '0.3px',
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
              wordBreak: 'break-all',
            }}>{orgId}</code>
          </div>
        </section>
      )}

      {/* ── Prérequis ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: C.textMuted,
          margin: '0 0 16px 0',
        }}>Prérequis</h2>
        <div className="gi-step-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 0,
          borderTop: `1px solid ${C.border}`,
        }}>
          {[
            { icon: 'server',   color: C.primary, title: '4 vCPU · 8 Go RAM', sub: 'Configuration minimale' },
            { icon: 'terminal', color: C.success, title: 'Ubuntu 22.04 LTS',  sub: 'Système recommandé' },
            { icon: 'shield',   color: C.warning, title: 'IP publique fixe',  sub: 'ou nom de domaine' },
            { icon: 'docker',   color: C.primary, title: 'Docker + Compose',  sub: 'Seul prérequis logiciel' },
          ].map(({ icon, color, title, sub }) => (
            <div key={title} style={{
              padding: '16px 0',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              paddingRight: 16,
            }}>
              <Icon name={icon} size={16} color={color} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{title}</div>
                <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ ÉTAPES ══ */}
      <Step n={1} total={TOTAL} iconName="server" color={C.primary}
        label="Infrastructure" title="Préparez votre serveur"
        desc="Provisionnez un serveur dédié ou une machine virtuelle avec le système d'exploitation recommandé. Assurez-vous que le serveur dispose d'une connexion Internet stable et d'une adresse IP publique fixe.">
        <ul style={{
          margin: '0 0 20px 0', paddingLeft: 20,
          lineHeight: 2, color: C.textSoft, fontSize: 14.5,
        }}>
          <li><strong style={{ color: C.text }}>Système :</strong> Ubuntu Server 22.04 LTS ou Debian 12</li>
          <li><strong style={{ color: C.text }}>Ressources :</strong> 4 vCPU · 8 Go RAM · 100 Go SSD</li>
          <li><strong style={{ color: C.text }}>Réseau :</strong> adresse IP publique fixe ou nom de domaine</li>
        </ul>
        <Callout type="danger">
          <strong>Ports à ouvrir dans votre pare-feu avant de continuer.</strong>
        </Callout>
        <CodeBlock label="Configuration pare-feu — ufw" code={`sudo ufw allow 51820/udp    # WireGuard VPN (tunnel chiffré)
sudo ufw allow 80/tcp       # HTTP  (redirection vers HTTPS)
sudo ufw allow 443/tcp      # HTTPS (interface web et API)
sudo ufw allow 22/tcp       # SSH   (si pas déjà ouvert)
sudo ufw enable
sudo ufw status`} />
      </Step>

      <Step n={2} total={TOTAL} iconName="docker" color={C.primary}
        label="Environnement d'exécution" title="Installez Docker et Docker Compose"
        desc="Docker est le seul prérequis logiciel. L'ensemble du serveur tenant Palabre s'exécute dans des conteneurs isolés, garantissant une installation propre et reproductible.">
        <CodeBlock label="Installation Docker — Ubuntu 22.04 / Debian 12" code={`# Télécharger et exécuter le script d'installation officiel
curl -fsSL https://get.docker.com -o install-docker.sh
sudo sh install-docker.sh

# Ajouter votre utilisateur au groupe docker (évite d'utiliser sudo)
sudo usermod -aG docker $USER

# Recharger les groupes sans se déconnecter
newgrp docker

# Vérifier les installations
docker --version
docker compose version`} />
        <Callout type="info">
          Si vous obtenez <code>Docker version 24+</code> et <code>Docker Compose version 2.2+</code>, votre environnement est prêt.
        </Callout>
      </Step>

      <Step n={3} total={TOTAL} iconName="download" color={C.success}
        label="Déploiement" title="Téléchargez et installez le paquet tenant"
        desc="Le dépôt Palabre contient uniquement les fichiers nécessaires à votre tenant. L'installation interactive génère automatiquement votre configuration à partir du QR code de provisioning.">
        <CodeBlock label="Clonage du dépôt — méthode recommandée (SSH)" code={`# Cloner le dépôt Palabre dans un dossier dédié
git clone --filter=blob:none --sparse \\
  git@github.com:dglink25/palabre.git ${folderName}
cd ${folderName}

# Récupérer uniquement les dossiers nécessaires
git sparse-checkout set tenant services coturn

# Se placer dans le dossier tenant
cd tenant`} />
        <CodeBlock label="Alternative — HTTPS (sans clé SSH configurée)" code={`git clone --filter=blob:none --sparse \\
  https://github.com/dglink25/palabre.git ${folderName}
cd ${folderName}
git sparse-checkout set tenant services coturn
cd tenant`} />
        <CodeBlock label="Installation interactive guidée" code={`chmod +x setup.sh
./setup.sh

# Informations demandées :
#   1. Identifiant organisation  →  ${orgId || 'VOTRE_ORG_ID'}
#   2. Token de contrôle         →  (QR code reçu par e-mail)
#   3. Clé privée WireGuard      →  (QR code)
#   4. Clé publique WireGuard    →  (QR code)
#   5. URL du serveur central    →  https://api.palabre.app`} />
        <Callout type="info">
          L'installation complète prend environ 5 à 10 minutes selon la bande passante.
          Une fois terminée, tous les services démarrent automatiquement.
        </Callout>
      </Step>

      <Step n={4} total={TOTAL} iconName="qrcode" color={C.warning}
        label="Liaison sécurisée" title="Liez votre organisation via le QR code"
        desc="Le QR code de provisioning vous a été transmis par e-mail lors de l'approbation de votre dossier. Il contient les clés cryptographiques nécessaires à l'établissement du tunnel chiffré avec le serveur central.">
        <div className="gi-step-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
          borderTop: `1px solid ${C.border}`, marginBottom: 8,
        }}>
          {[
            { letter: 'A', label: 'Application mobile (recommandé)', color: C.primary,
              steps: [
                'Ouvrez Palabre sur votre téléphone',
                'Tableau de bord → Lier mon organisation',
                'Scannez le QR code reçu par e-mail',
                'La liaison s\'établit en moins d\'une minute',
              ] },
            { letter: 'B', label: 'Navigateur web', color: C.success,
              steps: [
                'Accédez à Tunnel VPN → Page de liaison',
                'Collez le contenu JSON du QR code',
                'Cliquez sur Confirmer la liaison',
                'Vérifiez le statut dans le tableau de bord',
              ] },
          ].map(({ letter, label, color, steps }) => (
            <div key={letter} style={{
              padding: '18px 20px 18px 0',
              borderBottom: `1px solid ${C.border}`,
              paddingRight: 24,
            }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: color,
                  fontFamily: "'JetBrains Mono',monospace",
                }}>{letter}.</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{label}</span>
              </div>
              <ol style={{
                margin: 0, paddingLeft: 18, lineHeight: 1.9,
                color: C.textSoft, fontSize: 14,
              }}>
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          ))}
        </div>
        <Callout type="warning">
          <strong>QR code perdu ou expiré ?</strong> Rendez-vous dans <strong>Tunnel VPN</strong> et utilisez « Régénérer le code ». L'ancien code sera automatiquement révoqué.
        </Callout>
      </Step>

      <Step n={5} total={TOTAL} iconName="shield" color={C.primary}
        label="Vérification" title="Vérifiez la connexion du tunnel VPN"
        desc="Une fois le tunnel établi, confirmez que votre serveur communique correctement avec le serveur central Palabre. Le statut doit passer à « Connexion établie » dans votre tableau de bord.">
        <CodeBlock label="Diagnostics — état du tunnel et logs" code={`# Afficher les logs en temps réel de l'agent de liaison
docker logs palabre-agent --tail 50 -f

# Vérifier l'état du tunnel WireGuard
sudo wg show

# Tester la connectivité avec le serveur central
ping -c 4 api.palabre.app`} />
        <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 8 }}>
          {[
            { label: 'Tableau de bord → Tunnel VPN', detail: 'Statut : « Connexion établie »', ok: true },
            { label: 'Délai de connexion', detail: 'Moins de 5 minutes après démarrage', ok: true },
            { label: 'Port 51820/UDP', detail: 'Doit être ouvert dans le pare-feu', ok: false },
          ].map(({ label, detail, ok }) => (
            <div key={label} className="gi-row" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 4px', borderBottom: `1px solid ${C.border}`,
            }}>
              <Icon name={ok ? 'check' : 'info'} size={15}
                color={ok ? C.success : C.primary} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{label}</span>
                <span style={{ color: C.textMuted, fontSize: 13, marginLeft: 8 }}>— {detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Step>

      <Step n={6} total={TOTAL} iconName="users" color={C.success}
        label="Mise en service" title="Invitez votre équipe"
        desc="Votre serveur est opérationnel. Générez des codes d'invitation pour vos collaborateurs. Les communications sont chiffrées de bout en bout dès la première connexion.">
        <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 8 }}>
          {[
            'Accédez à Invitations membres dans la navigation latérale',
            'Cliquez sur « Générer un code d\'invitation »',
            'Partagez le code ou le QR code à vos collaborateurs',
            'Vos membres saisissent le code dans l\'application mobile',
            'Les communications sont actives et chiffrées immédiatement',
          ].map((text, i) => (
            <div key={i} className="gi-row" style={{
              display: 'flex', alignItems: 'baseline', gap: 14,
              padding: '12px 4px', borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.textMuted,
                fontFamily: "'JetBrains Mono',monospace",
                minWidth: 20,
              }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 14.5, color: C.text, lineHeight: 1.6 }}>{text}</span>
            </div>
          ))}
        </div>
        <Callout type="success">
          <strong>Bonne pratique :</strong> générez un code par collaborateur pour pouvoir révoquer individuellement les accès. Les codes peuvent être régénérés à tout moment — l'ancien est automatiquement invalidé.
        </Callout>
      </Step>

      {/* ── Support ── */}
      <section style={{
        marginTop: 56, paddingTop: 32,
        borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
      }}>
        <Icon name="headset" size={20} color={C.primary} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{
            margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: C.text,
          }}>Besoin d'assistance ?</h3>
          <p style={{
            margin: '0 0 16px 0', color: C.textSoft, lineHeight: 1.7, fontSize: 14.5,
          }}>
            Le service client Palabre est disponible depuis le bouton en bas à droite de votre écran.
            Pour récupérer un QR code perdu, utilisez la page <strong>Tunnel VPN</strong> de votre tableau de bord.
          </p>
          <a href="mailto:support@palabre.app" className="gi-btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', background: C.primary, color: '#fff',
            borderRadius: 4, textDecoration: 'none',
            fontSize: 13.5, fontWeight: 600,
          }}>
            <Icon name="headset" size={14} color="#fff" />
            Contacter le support
          </a>
        </div>
      </section>

    </div>
  );
}