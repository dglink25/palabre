import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolveInvitation, joinRoom } from '../../lib/videoconferenceApi';

const Ico = ({ d, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  video:  ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  lock:   ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  check:  ['M20 6 9 17l-5-5'],
  warn:   ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  arrow:  ['M5 12h14', 'M12 5l7 7-7 7'],
};

/**
 * JoinByInvitationPage
 * Route : /join/v/:token  (ProtectedRoute — redirige vers /login si non auth)
 *
 * Résout le token d'invitation, affiche les informations de la réunion,
 * puis redirige vers la room une fois l'utilisateur admis.
 */
export default function JoinByInvitationPage() {
  const { token }  = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [state,   setState]   = useState('loading'); // loading|ready|joining|error
  const [info,    setInfo]    = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Résoudre le token dès le montage
  useEffect(() => {
    if (!user) return; // ProtectedRoute gère la redirection vers /login
    resolveInvitation(token)
      .then(data => { setInfo(data); setState('ready'); })
      .catch(err => { setErrorMsg(err.message || 'Invitation invalide ou expirée.'); setState('error'); });
  }, [token, user]);

  async function handleJoin() {
    setState('joining');
    try {
      const result = await joinRoom(info.roomId, token);
      if (result.status === 'admitted') {
        // Redirige vers la room — tenant ou publique
        const path = info.orgId
          ? `/app/videoconference/${info.roomId}`
          : `/videoconference/${info.roomId}`;
        navigate(path, { replace: true });
      } else {
        // En salle d'attente — rediriger quand même, la page VideoRoomPage gère l'attente
        const path = info.orgId
          ? `/app/videoconference/${info.roomId}`
          : `/videoconference/${info.roomId}`;
        navigate(path, { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Impossible de rejoindre cette réunion.');
      setState('error');
    }
  }

  // ── Chargement ────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={centerStyle}>
        <div className="spinner" style={{ marginBottom: 16 }} />
        <div style={{ color: 'var(--color-text-secondary)' }}>Vérification de l'invitation…</div>
      </div>
    );
  }

  // ── Erreur ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={centerStyle}>
        <div style={iconCircle('rgba(234,67,53,0.1)')}>
          <Ico d={ICONS.warn} size={28} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Invitation invalide</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, maxWidth: 380, textAlign: 'center', margin: '0 0 24px' }}>
          {errorMsg}
        </p>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <button className="btn btn-secondary">Retour à l'accueil</button>
        </Link>
      </div>
    );
  }

  // ── Prêt à rejoindre ──────────────────────────────────────────────────────
  return (
    <div style={centerStyle}>
      <div style={{ ...iconCircle('rgba(26,115,232,0.1)'), color: 'var(--color-primary-blue)' }}>
        <Ico d={ICONS.video} size={28} />
      </div>

      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, textAlign: 'center' }}>
        Vous êtes invité(e)
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, textAlign: 'center', margin: '0 0 24px' }}>
        {info.hostName} vous invite à rejoindre une réunion Palabre.
      </p>

      {/* Carte réunion */}
      <div style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: '20px 24px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        marginBottom: 24,
      }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          {info.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Organisée par <strong>{info.hostName}</strong></span>
          {info.status === 'active' && (
            <span style={{ color: 'var(--color-success-green)', fontWeight: 600 }}>
              ● En cours
            </span>
          )}
          {info.status === 'scheduled' && (
            <span>⏰ Planifiée</span>
          )}
        </div>
      </div>

      <button
        className="btn"
        onClick={handleJoin}
        disabled={state === 'joining' || !['active', 'scheduled'].includes(info.status)}
        style={{ width: '100%', maxWidth: 420, padding: '12px 0', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {state === 'joining' ? 'Connexion…' : (
          <>
            Rejoindre la réunion
            <Ico d={ICONS.arrow} size={16} />
          </>
        )}
      </button>

      {!['active', 'scheduled'].includes(info.status) && (
        <p style={{ color: 'var(--color-alert-red)', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
          Cette réunion est terminée ou annulée.
        </p>
      )}
    </div>
  );
}

const centerStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  minHeight: '60vh', padding: '32px 16px', gap: 16,
};

function iconCircle(bg) {
  return {
    width: 68, height: 68, borderRadius: '50%',
    background: bg, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, flexShrink: 0,
  };
}
