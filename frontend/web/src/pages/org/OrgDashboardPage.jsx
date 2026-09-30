import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import QRCode from 'qrcode';

const C = {
  blue:   '#1A73E8',
  green:  '#34A853',
  amber:  '#FBBC05',
  red:    '#EA4335',
  purple: '#7B61FF',
  text:   '#202124',
  sub:    '#5F6368',
  border: '#E0E0E0',
  bg:     '#F8F9FA',
};

function Ico({ d, size = 18, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICO = {
  vpn:    ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  invite: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  link:   ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  guide:  ['M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'],
  copy:   ['M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866', 'M18.5 8H11c-1.105 0-2 .911-2 2.036v9.928C9 21.09 9.895 22 11 22h7.5c1.105 0 2-.911 2-2.036V10.036C20.5 8.912 19.605 8 18.5 8z'],
  check:  ['M20 6L9 17l-5-5'],
  right:  ['M9 18l6-6-6-6'],
  info:   ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01'],
  msg:    ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy} title="Copier" style={{
      border: 'none', background: 'none', cursor: 'pointer', padding: '3px 7px',
      color: copied ? C.green : C.sub, display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, transition: 'color 0.15s',
    }}>
      <Ico d={copied ? ICO.check : ICO.copy} size={13} color={copied ? C.green : C.sub} />
      {copied ? 'Copie' : 'Copier'}
    </button>
  );
}

const VPN_COLORS = { active: C.green, degraded: C.amber, offline: C.red, unknown: '#9E9E9E' };
const VPN_LABELS = { active: 'Connexion etablie', degraded: 'Signal instable', offline: 'Hors ligne', unknown: 'En attente' };

const ACTIONS = [
  { label: 'Tunnel VPN',         desc: 'Etat du serveur local',   color: C.blue,   to: '/org/vpn',   icon: ICO.vpn },
  { label: 'Invitations',        desc: 'Inviter des membres',      color: C.green,  to: '/org/invite', icon: ICO.invite },
  { label: 'Lier le tenant',     desc: 'Scanner le QR serveur',   color: C.amber,  to: '/org/link',  icon: ICO.link },
  { label: 'Guide installation', desc: 'Configurer le serveur',   color: C.purple, to: '/org/guide', icon: ICO.guide },
  { label: 'Messages',           desc: 'Discuter avec vos membres',color: C.blue,   to: '/app/conversations', icon: ICO.msg },
];

export default function OrgDashboardPage() {
  const { user } = useAuth();
  const [org,     setOrg]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const qrRef = useRef(null);

  useEffect(() => {
    api.get('/org/me')
      .then(d => setOrg(d))
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (org?.id && qrRef.current) {
      QRCode.toCanvas(qrRef.current, org.id, {
        width: 130, margin: 1,
        color: { dark: C.text, light: '#fff' },
      }).catch(() => {});
    }
  }, [org]);

  const vpnColor = VPN_COLORS[org?.vpn?.status] || VPN_COLORS.unknown;
  const vpnLabel = VPN_LABELS[org?.vpn?.status] || VPN_LABELS.unknown;

  return (
    <div style={{ maxWidth: 940, margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 32, paddingBottom: 22, borderBottom: `1px solid ${C.border}`,
        flexWrap: 'wrap', gap: 12,
        animation: 'fadein 0.4s ease',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue, boxShadow: `0 0 0 3px ${C.blue}25` }} />
            <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>Admin organisation</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
            {org?.name || user?.fullName || 'Tableau de bord'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: C.sub }}>
            Gestion de votre organisation et de votre infrastructure
          </p>
        </div>
        {org?.vpn && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 20,
            background: `${vpnColor}12`, border: `1px solid ${vpnColor}30`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: vpnColor, display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: vpnColor }}>{vpnLabel}</span>
          </div>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div style={{ padding: '60px 0', textAlign: 'center' }}><Spinner /></div>}

      {!loading && (
        <>
          {/* ── Identifiant + QR ── */}
          <div style={{
            background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '22px 24px', marginBottom: 28,
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start',
            animation: 'fadein 0.5s ease',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 14 }}>
                Identification
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 5 }}>Identifiant organisation</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 6, overflow: 'hidden',
                }}>
                  <code style={{ flex: 1, padding: '8px 12px', fontSize: 13, color: C.text, wordBreak: 'break-all' }}>
                    {org?.id || user?.orgId || '—'}
                  </code>
                  {(org?.id || user?.orgId) && <CopyBtn text={org?.id || user?.orgId} />}
                </div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>
                  A partager avec vos membres pour rejoindre l'organisation
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Nom',     value: org?.name },
                  { label: 'Pays',    value: [org?.city, org?.country].filter(Boolean).join(', ') },
                  { label: 'Secteur', value: org?.sector },
                  { label: 'Statut',  value: org?.status === 'active' ? 'Actif' : org?.status === 'pending' ? 'En cours' : org?.status },
                  { label: 'Compte',  value: user?.fullName || user?.email },
                  { label: 'Role',    value: "Administrateur" },
                ].filter(r => r.value).map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>QR membres</div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, display: 'inline-block', background: '#fff' }}>
                <canvas ref={qrRef} />
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 6, maxWidth: 120 }}>
                Scannez pour rejoindre
              </div>
            </div>
          </div>

          {/* ── Alerte VPN offline ── */}
          {org?.vpn?.status && org.vpn.status !== 'active' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px', marginBottom: 24,
              background: org.vpn.status === 'unknown' ? `${C.amber}08` : `${C.red}06`,
              border: `1px solid ${org.vpn.status === 'unknown' ? C.amber : C.red}30`,
              borderRadius: 8, animation: 'fadein 0.4s ease',
            }}>
              <Ico d={ICO.info} size={18} color={org.vpn.status === 'unknown' ? C.amber : C.red} />
              <div style={{ flex: 1, fontSize: 14, color: C.text }}>
                {org.vpn.status === 'unknown'
                  ? 'Tunnel VPN non encore configure. Suivez le guide d\'installation.'
                  : 'Connexion VPN interrompue. Verifiez votre serveur local.'}
              </div>
              <Link to="/org/vpn" style={{ fontSize: 13, fontWeight: 600, color: C.blue, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                Verifier <Ico d={ICO.right} size={14} color={C.blue} />
              </Link>
            </div>
          )}

          {/* ── Actions ── */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
            Actions rapides
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
            {ACTIONS.map((a, i) => (
              <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textAlign: 'center', gap: 10,
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  animation: `fadein 0.4s ease ${i * 60}ms both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${a.color}22`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: `${a.color}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ico d={a.icon} size={20} color={a.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{a.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Guide rapide ── */}
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Premiers pas — installation du tenant</div>
              <Link to="/org/guide" style={{ fontSize: 13, fontWeight: 600, color: C.blue, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Guide complet <Ico d={ICO.right} size={13} color={C.blue} />
              </Link>
            </div>
            {[
              { n: 1, t: 'Preparez votre serveur',       d: 'Ubuntu 22.04+ ou Debian 12 — 4 vCPU, 8 Go RAM min' },
              { n: 2, t: 'Installez Docker',              d: 'curl -fsSL https://get.docker.com | sh' },
              { n: 3, t: 'Clonez et installez le tenant', d: 'git clone + ./setup.sh (script interactif)' },
              { n: 4, t: 'Liez votre organisation',       d: 'Scannez le QR code ou collez le payload JSON' },
              { n: 5, t: 'Verifiez le tunnel VPN',        d: 'Le statut passe a "Connexion etablie" apres le premier heartbeat' },
            ].map((s, i, arr) => (
              <div key={s.n} style={{
                display: 'flex', gap: 14, padding: '13px 20px',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.bg}` : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: `${C.blue}14`, color: C.blue,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 1, fontFamily: s.n === 2 ? 'monospace' : 'inherit' }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes fadein { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @media(max-width:760px){ .org-actions { grid-template-columns: repeat(3,1fr) !important; } }
        @media(max-width:480px){ .org-actions { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  );
}
