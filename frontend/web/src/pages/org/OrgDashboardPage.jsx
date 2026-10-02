import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import QRCode from 'qrcode';

// ── Palette institutionnelle ─────────────────────────────────────────────────
const C = {
  blue:   '#1A73E8',
  green:  '#34A853',
  amber:  '#FBBC05',
  red:    '#EA4335',
  text:   '#111827',
  soft:   '#4B5563',
  muted:  '#9CA3AF',
  border: '#E5E7EB',
  rule:   '#F3F4F6',
  bg:     '#FFFFFF',
  bgSoft: '#FAFAFA',
};

// ── Icônes sobres ────────────────────────────────────────────────────────────
function Ico({ d, size = 16, color = 'currentColor', stroke = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICO = {
  vpn:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  invite: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  link:   ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  guide:  'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  copy:   ['M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866', 'M18.5 8H11c-1.105 0-2 .911-2 2.036v9.928C9 21.09 9.895 22 11 22h7.5c1.105 0 2-.911 2-2.036V10.036C20.5 8.912 19.605 8 18.5 8z'],
  check:  'M20 6L9 17l-5-5',
  arrow:  'M9 18l6-6-6-6',
  info:   ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01'],
  msg:    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  dots:   ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
};

// ── Bouton copier discret ────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copier' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} title={label} style={{
      border: 'none', background: 'none', cursor: 'pointer',
      padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600,
      color: copied ? C.green : C.soft,
      transition: 'color .15s',
      fontFamily: 'inherit',
    }}>
      <Ico d={copied ? ICO.check : ICO.copy} size={12} color={copied ? C.green : C.soft} />
      {copied ? 'Copié' : label}
    </button>
  );
}

// ── Métadonnées VPN ──────────────────────────────────────────────────────────
const VPN = {
  active:   { color: C.green, label: 'Connexion établie',  hint: 'Le tunnel chiffré est opérationnel.' },
  degraded: { color: C.amber, label: 'Signal instable',    hint: 'La liaison avec le serveur central est dégradée.' },
  offline:  { color: C.red,   label: 'Hors ligne',         hint: 'Aucune communication avec le serveur central.' },
  unknown:  { color: C.muted, label: 'Non configuré',      hint: 'Le tunnel VPN n\'est pas encore établi.' },
};

// ── Définition des étapes d'installation ─────────────────────────────────────
const STEPS = [
  { n: 1, title: 'Préparation du serveur',     detail: 'Ubuntu 22.04 LTS ou Debian 12 - 4 vCPU, 8 Go RAM minimum', cmd: null },
  { n: 2, title: 'Installation de Docker',     detail: 'Environnement d\'exécution des conteneurs Palabre',       cmd: 'curl -fsSL https://get.docker.com | sh' },
  { n: 3, title: 'Déploiement du tenant',      detail: 'Clonage du dépôt et script d\'installation interactif',   cmd: './setup.sh' },
  { n: 4, title: 'Liaison de l\'organisation', detail: 'QR code de provisioning ou payload JSON',                 cmd: null },
  { n: 5, title: 'Vérification du tunnel',     detail: 'Statut attendu : « Connexion établie »',                  cmd: null },
];

// ═════════════════════════════════════════════════════════════════════════════
export default function OrgDashboardPage() {
  const { user } = useAuth();
  const [org, setOrg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const qrRef = useRef(null);

  useEffect(() => {
    api.get('/org/me')
      .then(setOrg)
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (org?.id && qrRef.current) {
      QRCode.toCanvas(qrRef.current, org.id, {
        width: 116, margin: 0,
        color: { dark: C.text, light: '#FFFFFF' },
      }).catch(() => {});
    }
  }, [org]);

  const vpn = VPN[org?.vpn?.status] || VPN.unknown;
  const orgId = org?.id || user?.orgId || '';

  if (loading) {
    return (
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '80px 0', textAlign: 'center' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', color: C.text }}>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* ═══════════════════════════════════════════════════════════════════
          EN-TÊTE DOCUMENTAIRE
          Un titre, un surtitre, une méta-ligne. Pas de décoration.
      ═══════════════════════════════════════════════════════════════════ */}
      <header style={{ paddingBottom: 28, borderBottom: `1px solid ${C.border}`, marginBottom: 36 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: C.blue, marginBottom: 10,
        }}>
          Espace administrateur · Organisation
        </div>

        <h1 style={{
          margin: '0 0 14px 0',
          fontSize: 'clamp(1.6rem, 3.4vw, 2rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.6px',
          color: C.text,
        }}>
          {org?.name || user?.fullName || 'Tableau de bord'}
        </h1>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          fontSize: 13.5, color: C.soft,
        }}>
          <span>
            <span style={{ color: C.muted }}>Compte · </span>
            {user?.fullName || user?.email || 'Administrateur'}
          </span>
          {org?.sector && (
            <span>
              <span style={{ color: C.muted }}>Secteur · </span>
              {org.sector}
            </span>
          )}
          {(org?.city || org?.country) && (
            <span>
              <span style={{ color: C.muted }}>Localisation · </span>
              {[org.city, org.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          BLOC 1 - ÉTAT DE L'INFRASTRUCTURE
          Le message dominant. On comprend en 3 secondes où on en est.
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 40,
        alignItems: 'flex-start',
        paddingBottom: 32,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 36,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '1px',
            textTransform: 'uppercase', color: C.muted, marginBottom: 12,
          }}>
            État de l'infrastructure
          </div>

          {/* Statut dominant, typographique */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: vpn.color, display: 'inline-block',
            }} />
            <span style={{
              fontSize: 'clamp(1.15rem, 2.4vw, 1.35rem)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.3px',
            }}>
              {vpn.label}
            </span>
          </div>

          <p style={{
            margin: '0 0 20px 0',
            fontSize: 14.5,
            lineHeight: 1.7,
            color: C.soft,
            maxWidth: 520,
          }}>
            {vpn.hint}
          </p>

          {/* Appel à l'action contextuel, texte uniquement */}
          {org?.vpn?.status && org.vpn.status !== 'active' && (
            <Link to="/org/vpn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 600, color: C.blue,
              textDecoration: 'none',
              borderBottom: `1px solid ${C.blue}`,
              paddingBottom: 2,
            }}>
              Diagnostiquer le tunnel
              <Ico d={ICO.arrow} size={13} color={C.blue} />
            </Link>
          )}
          {(!org?.vpn?.status || org.vpn.status === 'active') && (
            <Link to="/org/guide" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 600, color: C.blue,
              textDecoration: 'none',
              borderBottom: `1px solid ${C.blue}`,
              paddingBottom: 2,
            }}>
              Consulter le guide d'installation
              <Ico d={ICO.arrow} size={13} color={C.blue} />
            </Link>
          )}
        </div>

        {/* QR de provisioning - sans fioriture */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px',
            textTransform: 'uppercase', color: C.muted, marginBottom: 10,
          }}>
            QR d'invitation
          </div>
          <div style={{
            border: `1px solid ${C.border}`,
            padding: 8, display: 'inline-block', background: '#fff',
          }}>
            <canvas ref={qrRef} />
          </div>
          <div style={{
            fontSize: 11, color: C.muted, marginTop: 8, maxWidth: 130, lineHeight: 1.5,
          }}>
            À scanner par vos membres pour rejoindre l'organisation
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          BLOC 2 - IDENTIFICATION
          Table de définition classique. Aucune carte, juste des filets.
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: C.muted, marginBottom: 16,
        }}>
          Identification de l'organisation
        </div>

        {/* Identifiant - mis en avant */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, padding: '14px 0',
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 11, color: C.muted, textTransform: 'uppercase',
              letterSpacing: '0.6px', marginBottom: 4, fontWeight: 600,
            }}>
              Identifiant organisation
            </div>
            <code style={{
              fontSize: 14, color: C.text, fontWeight: 600,
              fontFamily: "'JetBrains Mono','Fira Code',monospace",
              wordBreak: 'break-all',
            }}>
              {orgId || '-'}
            </code>
          </div>
          {orgId && <CopyBtn text={orgId} label="Copier l'identifiant" />}
        </div>

        {/* Métadonnées en grille de définitions */}
        <dl style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 0,
          margin: 0,
        }}>
          {[
            { label: 'Statut',        value: org?.status === 'active' ? 'Actif' : org?.status === 'pending' ? 'En cours de validation' : org?.status },
            { label: 'Rôle du compte', value: 'Administrateur' },
            { label: 'Membres',       value: org?.memberCount != null ? `${org.memberCount}` : null },
            { label: 'Créée le',      value: org?.createdAt ? new Date(org.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null },
          ].filter(r => r.value).map(({ label, value }) => (
            <div key={label} style={{
              padding: '14px 0',
              borderBottom: `1px solid ${C.rule}`,
            }}>
              <dt style={{
                fontSize: 11, color: C.muted, textTransform: 'uppercase',
                letterSpacing: '0.6px', marginBottom: 4, fontWeight: 600,
              }}>{label}</dt>
              <dd style={{ margin: 0, fontSize: 14, color: C.text, fontWeight: 500 }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          BLOC 3 - PROCHAINES ÉTAPES
          Une checklist éditoriale, pas une grille de widgets.
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 40 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 16, flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '1px',
            textTransform: 'uppercase', color: C.muted,
          }}>
            Installation du tenant - 5 étapes
          </div>
          <Link to="/org/guide" style={{
            fontSize: 13, fontWeight: 600, color: C.blue,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            Guide détaillé <Ico d={ICO.arrow} size={12} color={C.blue} />
          </Link>
        </div>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: `1px solid ${C.border}` }}>
          {STEPS.map((s) => (
            <li key={s.n} style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr auto',
              alignItems: 'center',
              gap: 16,
              padding: '14px 0',
              borderBottom: `1px solid ${C.rule}`,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.muted,
                fontFamily: "'JetBrains Mono',monospace",
                fontVariantNumeric: 'tabular-nums',
              }}>
                {String(s.n).padStart(2, '0')}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 13, color: C.soft, lineHeight: 1.6 }}>
                  {s.detail}
                </div>
              </div>
              {s.cmd && (
                <code style={{
                  fontSize: 12, color: C.soft,
                  fontFamily: "'JetBrains Mono',monospace",
                  background: C.bgSoft,
                  padding: '4px 10px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}>
                  {s.cmd}
                </code>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          BLOC 4 - NAVIGATION
          Liste éditoriale, pas de grille de cartes colorées.
      ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: C.muted, marginBottom: 16,
        }}>
          Gestion de l'organisation
        </div>

        <nav style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { to: '/org/vpn',       label: 'Tunnel VPN',           desc: 'État du serveur local et diagnostic de la liaison',        icon: ICO.vpn },
            { to: '/org/invite',    label: 'Invitations membres',  desc: 'Générer et gérer les codes d\'invitation',                 icon: ICO.invite },
            { to: '/org/link',      label: 'Liaison du tenant',    desc: 'Scanner ou coller le QR code de provisioning',             icon: ICO.link },
            { to: '/org/guide',     label: 'Guide d\'installation',desc: 'Procédure complète de déploiement du serveur',             icon: ICO.guide },
            { to: '/app/conversations', label: 'Messages',         desc: 'Conversations chiffrées avec vos membres',                 icon: ICO.msg },
          ].map((item, i, arr) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr auto',
                alignItems: 'center',
                gap: 16,
                padding: '16px 4px',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.rule}` : `1px solid ${C.border}`,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'padding-left .18s ease, background .18s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.paddingLeft = '10px';
                e.currentTarget.style.background = C.bgSoft;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.paddingLeft = '4px';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Ico d={item.icon} size={18} color={C.soft} />
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, color: C.soft }}>
                  {item.desc}
                </div>
              </div>
              <Ico d={ICO.arrow} size={14} color={C.muted} />
            </Link>
          ))}
        </nav>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PIED - Mention institutionnelle discrète
      ═══════════════════════════════════════════════════════════════════ */}
      <footer style={{
        paddingTop: 24,
        borderTop: `1px solid ${C.border}`,
        fontSize: 12.5,
        color: C.muted,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <span>
          Palabre - Infrastructure de communication souveraine
        </span>
        <a href="mailto:support@palabre.app" style={{
          color: C.soft, textDecoration: 'none', fontWeight: 600,
        }}>
          support@palabre.app
        </a>
      </footer>

    </div>
  );
}