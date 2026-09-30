import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import QRCode from 'qrcode';

function Ico({ d, size = 18, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICO = {
  vpn:     ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  invite:  ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  link:    ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  guide:   ['M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'],
  copy:    ['M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866', 'M18.5 8H11c-1.105 0-2 .911-2 2.036v9.928C9 21.09 9.895 22 11 22h7.5c1.105 0 2-.911 2-2.036V10.036C20.5 8.912 19.605 8 18.5 8z'],
  check:   ['M20 6L9 17l-5-5'],
  chevron: ['M9 18l6-6-6-6'],
  info:    ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01'],
  qr:      ['M3 3h6v6H3z', 'M15 3h6v6h-6z', 'M3 15h6v6H3z', 'M15 15h2v2h-2z', 'M19 15v2', 'M15 19h2', 'M19 19h2', 'M19 21v-2'],
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} title="Copier" style={{
      border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px',
      color: copied ? 'var(--color-success-green)' : 'var(--color-text-secondary)',
      display: 'inline-flex', alignItems: 'center',
    }}>
      <Ico d={copied ? ICO.check : ICO.copy} size={14} color={copied ? 'var(--color-success-green)' : 'var(--color-text-secondary)'} />
    </button>
  );
}

function VpnDot({ status }) {
  const colors = { active: 'var(--color-success-green)', degraded: 'var(--color-warning-amber)', offline: 'var(--color-alert-red)', unknown: '#bbb' };
  const labels = {
    active:   'Connexion etablie',
    degraded: 'Signal instable',
    offline:  'Connexion interrompue',
    unknown:  'En attente de connexion',
  };
  const c = colors[status] || colors.unknown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
      <span style={{ color: c, fontWeight: 600 }}>{labels[status] || 'Inconnu'}</span>
    </span>
  );
}

export default function OrgDashboardPage() {
  const { user } = useAuth();
  const [org,     setOrg]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    api.get('/org/me')
      .then(data => {
        setOrg(data);
        // Afficher le QR si l'identifiant org est disponible
        if (data?.id && qrCanvasRef.current) {
          QRCode.toCanvas(qrCanvasRef.current, data.id, { width: 140, margin: 1 });
        }
      })
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  // Générer QR après le rendu du canvas
  useEffect(() => {
    if (org?.id && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, org.id, { width: 140, margin: 1 });
    }
  }, [org]);

  const QUICK_ACTIONS = [
    { label: 'Tunnel VPN', desc: 'Statut du serveur local', color: 'var(--color-primary-blue)', to: '/org/vpn', icon: ICO.vpn },
    { label: 'Invitations', desc: 'Generer un code membre', color: 'var(--color-success-green)', to: '/org/invite', icon: ICO.invite },
    { label: 'Lier le tenant', desc: 'Scanner le QR serveur', color: 'var(--color-warning-amber)', to: '/org/link', icon: ICO.link },
    { label: 'Guide installation', desc: 'Documentation tenant', color: '#7B61FF', to: '/org/guide', icon: ICO.guide },
  ];

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <div style={{ paddingBottom: 20, marginBottom: 28, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Tableau de bord
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            {org?.name || 'Votre organisation'} — administration
          </p>
        </div>
        {org?.vpn && (
          <VpnDot status={org.vpn.status} />
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div style={{ padding: '40px 0', textAlign: 'center' }}><Spinner /></div>}

      {!loading && (
        <>
          {/* ── Bloc identifiant + QR ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, marginBottom: 28, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '20px 22px', alignItems: 'start' }}>
            <div>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Identification
              </p>

              {/* Identifiant */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Identifiant organisation</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <code style={{ fontSize: 13, background: 'var(--color-offwhite)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 10px', wordBreak: 'break-all', flex: 1 }}>
                    {org?.id || user?.orgId || <span style={{ color: 'var(--color-text-secondary)' }}>Non disponible</span>}
                  </code>
                  {(org?.id || user?.orgId) && <CopyBtn text={org?.id || user?.orgId} />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Partagez cet identifiant avec vos membres pour qu'ils rejoignent votre organisation.
                </div>
              </div>

              {/* Nom */}
              <InfoRow label="Nom" value={org?.name} />
              <InfoRow label="Pays" value={[org?.city, org?.country].filter(Boolean).join(', ')} />
              <InfoRow label="Secteur" value={org?.sector} />
              <InfoRow label="Statut" value={org?.status === 'active' ? 'Actif' : org?.status === 'pending' ? 'En attente' : org?.status} />

              {/* Compte */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                <InfoRow label="Compte" value={user?.fullName || user?.email || user?.phone} />
                <InfoRow label="Role" value="Administrateur d'organisation" />
              </div>
            </div>

            {/* QR code identifiant */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>QR identifiant</div>
              <canvas ref={qrCanvasRef} style={{ display: 'block', border: '1px solid var(--color-border)', borderRadius: 4 }} />
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6, maxWidth: 140 }}>
                Les membres peuvent scanner ce code
              </div>
            </div>
          </div>

          {/* ── Alerte VPN si offline ── */}
          {org?.vpn?.status && org.vpn.status !== 'active' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'rgba(234,67,53,0.05)', border: '1px solid rgba(234,67,53,0.2)', borderRadius: 8, marginBottom: 24 }}>
              <Ico d={ICO.info} size={18} color="var(--color-alert-red)" />
              <div style={{ flex: 1, fontSize: 14 }}>
                {org.vpn.status === 'unknown'
                  ? 'Le tunnel VPN n\'est pas encore configure. Suivez le guide d\'installation pour connecter votre serveur local.'
                  : 'Le tunnel VPN est hors ligne. Verifiez que votre serveur local est demarrage et envoie des heartbeats.'}
              </div>
              <Link to="/org/vpn" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary-blue)', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                Verifier <Ico d={ICO.chevron} size={14} color="var(--color-primary-blue)" />
              </Link>
            </div>
          )}

          {/* ── Actions rapides ── */}
          <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Actions
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 7, flexShrink: 0, background: `${a.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico d={a.icon} size={18} color={a.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)' }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>{a.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Guide d'installation inline ── */}
          <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Premiers pas — installation du tenant
          </p>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            {[
              { n: 1, title: 'Preparez votre serveur', desc: 'Ubuntu Server 22.04+ ou Debian 12. Minimum : 4 vCPU, 8 Go RAM, 100 Go SSD, connexion internet stable.' },
              { n: 2, title: 'Installez Docker', desc: 'curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER' },
              { n: 3, title: 'Telechargez le paquet tenant Palabre', desc: 'Recuperez le paquet fourni par le super-administrateur Palabre (e-mail de bienvenue).' },
              { n: 4, title: 'Liez votre organisation', desc: 'Sur votre mobile ou navigateur, allez dans "Lier le tenant" et scannez le QR code fourni lors de l\'approbation.' },
              { n: 5, title: 'Verifiez le statut VPN', desc: 'Une fois le tunnel actif, le statut passe a "Actif" dans la page VPN. Vos membres peuvent alors rejoindre l\'organisation.' },
            ].map((step, i, arr) => (
              <div key={step.n} style={{ display: 'flex', gap: 16, padding: '14px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'rgba(26,115,232,0.1)', color: 'var(--color-primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                  {step.n}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: step.n === 2 ? 'monospace' : 'inherit' }}>{step.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '12px 18px', background: 'var(--color-offwhite)', borderTop: '1px solid var(--color-border)' }}>
              <Link to="/org/guide" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Guide d'installation complet <Ico d={ICO.chevron} size={13} color="var(--color-primary-blue)" />
              </Link>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 700px) {
          .org-id-block { grid-template-columns: 1fr !important; }
          .org-actions-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .org-actions-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'baseline' }}>
      <span style={{ minWidth: 110, fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}
