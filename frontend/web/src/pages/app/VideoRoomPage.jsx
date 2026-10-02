import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useConfirm } from '../../components/ui';
import {
  getRoom, joinRoom, leaveRoom, endRoom,
  startRecording, stopRecording, inviteUsers
} from '../../lib/videoconferenceApi';
import VideoConferenceGateway from '../../components/videoconference/VideoConferenceGateway';
import WaitingRoomPanel from '../../components/videoconference/WaitingRoomPanel';

const Ico = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  users:   ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  record:  ['M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
  stop:    ['M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z'],
  leave:   ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  end:     ['M18 6L6 18', 'M6 6l12 12'],
  share:   ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13'],
  invite:  ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  chevron: ['M15 18l-6-6 6-6'],
};

export default function VideoRoomPage() {
  const { roomId }   = useParams();
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const { notify }   = useNotification();
  const { confirm, ConfirmModal } = useConfirm();

  const [room,         setRoom]        = useState(null);
  const [joinState,    setJoinState]   = useState('loading'); // loading|waiting|admitted|error
  const [sessionToken, setSessionToken] = useState(null);
  const [errorMsg,     setErrorMsg]    = useState('');
  const [sidePanel,    setSidePanel]   = useState('participants'); // 'participants'|null
  const [recording,    setRecording]   = useState(false);
  const [showInvite,   setShowInvite]  = useState(false);
  const [inviteQuery,  setInviteQuery] = useState('');
  const pollingRef = useRef(null);

  // ── Charger la room et tenter de rejoindre ──────────────────────────────
  const tryJoin = useCallback(async () => {
    try {
      const r = await getRoom(roomId);
      setRoom(r);

      if (!['active', 'scheduled'].includes(r.status)) {
        setJoinState('error');
        setErrorMsg('Cette réunion est terminée ou annulée.');
        return;
      }

      const result = await joinRoom(roomId);

      if (result.status === 'admitted') {
        setSessionToken(result.sessionToken);
        setJoinState('admitted');
      } else {
        setJoinState('waiting');
        // Polling pour détecter l'admission
        pollingRef.current = setInterval(async () => {
          try {
            const fresh = await joinRoom(roomId);
            if (fresh.status === 'admitted') {
              clearInterval(pollingRef.current);
              setSessionToken(fresh.sessionToken);
              setJoinState('admitted');
            }
          } catch { /* ignore */ }
        }, 3000);
      }
    } catch (err) {
      setJoinState('error');
      setErrorMsg(err.message || 'Impossible de rejoindre cette réunion.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    tryJoin();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [tryJoin]);

  async function handleLeave() {
    try { await leaveRoom(roomId); } catch { /* ignore */ }
    navigate(-1);
  }

  async function handleEndRoom() {
    const ok = await confirm({
      title: 'Terminer la réunion',
      message: 'Cela mettra fin à la réunion pour tous les participants. Cette action est irréversible.',
      confirmLabel: 'Terminer la réunion',
      danger: true,
    });
    if (!ok) return;
    try {
      await endRoom(roomId);
      navigate(-1);
    } catch (err) {
      notify.error(err.message);
    }
  }

  async function toggleRecording() {
    try {
      if (recording) {
        await stopRecording(roomId);
        setRecording(false);
        notify.success('Enregistrement arrêté.');
      } else {
        await startRecording(roomId);
        setRecording(true);
        notify.success('Enregistrement démarré.');
      }
    } catch (err) {
      notify.error(err.message);
    }
  }

  async function handleInvite() {
    const emails = inviteQuery.split(',').map(e => e.trim()).filter(Boolean);
    if (!emails.length) return;
    try {
      await inviteUsers(roomId, emails);
      setInviteQuery('');
      setShowInvite(false);
      notify.success('Invitations envoyées.');
    } catch (err) {
      notify.error(err.message);
    }
  }

  const isHost = room?.hostUserId === user?.id || room?.myRole === 'host' || room?.myRole === 'moderator';

  // ── États de chargement / attente ────────────────────────────────────────
  if (joinState === 'loading') {
    return (
      <>
        <ConfirmModal />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: 16 }}>
          <div className="spinner" />
          <div style={{ color: 'var(--color-text-secondary)' }}>Connexion à la réunion…</div>
        </div>
      </>
    );
  }

  if (joinState === 'error') {
    return (
      <>
        <ConfirmModal />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Accès impossible</div>
          <div style={{ color: 'var(--color-text-secondary)', maxWidth: 380 }}>{errorMsg}</div>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Retour</button>
        </div>
      </>
    );
  }

  if (joinState === 'waiting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(26,115,232,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico d={ICONS.users} size={32} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>En salle d'attente</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 15, maxWidth: 380 }}>
            Votre demande a été transmise à l'hôte. Vous serez admis automatiquement dès qu'il vous accepte.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--color-primary-blue)',
              animation: `pulse 1.4s ${i * 0.2}s infinite`,
              opacity: 0.7,
            }} />
          ))}
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Annuler</button>
      </div>
    );
  }

  // ── Session active ────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0d1117',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Palabre" width={28} height={28}
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
              {room?.title || 'Réunion'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {room?.participantCount || 0} participant{(room?.participantCount || 0) > 1 ? 's' : ''}
            </div>
          </div>
          {recording && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 12,
              background: 'rgba(234,67,53,0.2)', color: '#ea4335',
              fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ea4335', animation: 'pulse 1s infinite' }} />
              Enregistrement
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Panneau participants */}
          <TopBtn
            onClick={() => setSidePanel(p => p === 'participants' ? null : 'participants')}
            active={sidePanel === 'participants'}
            title="Participants"
            icon={ICONS.users}
          />
          {/* Inviter */}
          <TopBtn onClick={() => setShowInvite(v => !v)} title="Inviter" icon={ICONS.invite} />
          {/* Enregistrement (host/moderateur) */}
          {isHost && (
            <TopBtn
              onClick={toggleRecording}
              active={recording}
              danger={recording}
              title={recording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
              icon={recording ? ICONS.stop : ICONS.record}
            />
          )}
          {/* Quitter */}
          <button onClick={handleLeave} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: 'var(--color-alert-red)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Ico d={ICONS.leave} size={15} />
            Quitter
          </button>
          {isHost && (
            <button onClick={handleEndRoom} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(234,67,53,0.5)',
              background: 'transparent', color: '#ea4335',
              cursor: 'pointer', fontSize: 13,
            }} title="Terminer pour tous">
              Terminer pour tous
            </button>
          )}
        </div>
      </div>

      {/* Corps */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Zone vidéo principale */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <VideoConferenceGateway
            roomId={roomId}
            sessionToken={sessionToken}
            displayName={user?.fullName || 'Participant'}
            isModerator={isHost}
            onLeave={handleLeave}
            onError={msg => { setErrorMsg(msg); setJoinState('error'); }}
          />
        </div>

        {/* Panneau latéral */}
        {sidePanel && (
          <div style={{
            width: 280, background: 'rgba(15,20,30,0.96)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                {sidePanel === 'participants' ? 'Participants' : 'Chat'}
              </span>
              <button onClick={() => setSidePanel(null)} style={{
                border: 'none', background: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', padding: 4,
              }}>
                <Ico d={ICONS.end} size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {sidePanel === 'participants' && (
                <WaitingRoomPanel
                  roomId={roomId}
                  currentUserId={user?.id}
                  onAdmit={() => {}}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal invitation */}
      {showInvite && (
        <div style={{
          position: 'absolute', top: 60, right: 16, zIndex: 200,
          background: 'rgba(20,25,35,0.98)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, padding: 16, width: 300,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            Inviter des participants
          </div>
          <input
            value={inviteQuery}
            onChange={e => setInviteQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="Email ou nom (séparés par une virgule)"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: '#fff',
              fontSize: 13, boxSizing: 'border-box', outline: 'none',
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setShowInvite(false)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13,
            }}>
              Annuler
            </button>
            <button onClick={handleInvite} className="btn" style={{ flex: 1, fontSize: 13 }}>
              Inviter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBtn({ onClick, active, danger, title, icon }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer',
      background: active
        ? (danger ? 'rgba(234,67,53,0.3)' : 'rgba(26,115,232,0.3)')
        : 'rgba(255,255,255,0.08)',
      color: active ? (danger ? '#ea4335' : '#4a9eff') : 'rgba(255,255,255,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(icon) ? icon.map((d, i) => <path key={i} d={d} />) : <path d={icon} />}
      </svg>
    </button>
  );
}
