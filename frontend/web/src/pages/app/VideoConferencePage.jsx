import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listRooms, cancelRoom } from '../../lib/videoconferenceApi';
import CreateRoomModal from '../../components/videoconference/CreateRoomModal';
import RoomCard from '../../components/videoconference/RoomCard';

const Ico = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  plus:    ['M12 5v14', 'M5 12h14'],
  video:   ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  history: ['M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z', 'M12 6v6l4 2'],
};

function formatDuration(min) {
  if (!min) return '-';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export default function VideoConferencePage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [data,     setData]     = useState({ rooms: [], history: [] });
  const [loading,  setLoading]  = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error,    setError]    = useState('');

  const isAdmin = user?.role === 'org_admin' || user?.isSuperAdmin;

  const load = useCallback(async () => {
    try {
      const res = await listRooms();
      setData(res || { rooms: [], history: [] });
    } catch (err) {
      setError(err.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCreated(room) {
    setShowCreate(false);
    if (room.status === 'active') {
      navigate(`/app/videoconference/${room.id}`);
    } else {
      load();
    }
  }

  const active    = data.rooms.filter(r => r.status === 'active');
  const scheduled = data.rooms.filter(r => r.status === 'scheduled');

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Vidéoconférences</h2>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginTop: 3 }}>
            Réunions et conférences de votre organisation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Actualiser">
            <Ico d={ICONS.refresh} size={15} />
          </button>
          <button className="btn" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico d={ICONS.plus} size={16} />
            Nouvelle réunion
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(234,67,53,0.08)', color: 'var(--color-alert-red)', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Chargement…
        </div>
      ) : (
        <>
          {/* En cours */}
          {active.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionHeader label="En cours" count={active.length} accent="#16a34a" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {active.map(r => <RoomCard key={r.id} room={r} />)}
              </div>
            </section>
          )}

          {/* À venir */}
          {scheduled.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionHeader label="À venir" count={scheduled.length} accent="#2563eb" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {scheduled.map(r => <RoomCard key={r.id} room={r} />)}
              </div>
            </section>
          )}

          {/* Vide */}
          {active.length === 0 && scheduled.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: 'var(--color-white)', borderRadius: 12,
              border: '1px solid var(--color-border)', marginBottom: 32,
            }}>
              <div style={{ marginBottom: 16, opacity: 0.35 }}>
                <Ico d={ICONS.video} size={48} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Aucune réunion en cours</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 20 }}>
                Lancez ou planifiez une réunion pour démarrer.
              </div>
              <button className="btn" onClick={() => setShowCreate(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Ico d={ICONS.plus} size={16} />
                Nouvelle réunion
              </button>
            </div>
          )}

          {/* Historique (admin uniquement) */}
          {isAdmin && data.history.length > 0 && (
            <section>
              <SectionHeader label="Historique" count={data.history.length} icon={ICONS.history} />
              <div style={{
                background: 'var(--color-white)', border: '1px solid var(--color-border)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div className="history-row" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-secondary)', fontSize: 12, borderBottom: '1px solid var(--color-border)' }}>
                  <span>Réunion</span>
                  <span className="hide-mobile">Date</span>
                  <span className="hide-mobile">Durée</span>
                  <span className="hide-mobile">Participants</span>
                  <span>Enreg.</span>
                </div>
                {data.history.map(r => (
                  <HistoryRow key={r.id} room={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {showCreate && (
        <CreateRoomModal onCreated={handleCreated} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function SectionHeader({ label, count, accent, icon }) {
  const Ico2 = ({ d }) => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {accent && <span style={{ width: 3, height: 16, borderRadius: 2, background: accent, flexShrink: 0 }} />}
      {icon && <span style={{ color: 'var(--color-text-secondary)' }}><Ico2 d={icon} /></span>}
      <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span style={{
        padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700,
        background: 'var(--color-offwhite)', color: 'var(--color-text-secondary)',
      }}>{count}</span>
    </div>
  );
}

function HistoryRow({ room }) {
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const dur = min => {
    if (!min) return '-';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="history-row"
    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
    onMouseLeave={e => e.currentTarget.style.background = ''}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{room.title}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {room.hostName && `Par ${room.hostName}`}
        </div>
      </div>
      <div className="hide-mobile" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{fmt(room.startedAt)}</div>
      <div className="hide-mobile" style={{ fontSize: 13 }}>{dur(room.durationMin)}</div>
      <div className="hide-mobile" style={{ fontSize: 13 }}>{room.participantCount ?? '-'}</div>
      <div style={{ fontSize: 13 }}>
        {room.recordingAvailable
          ? <span style={{ color: 'var(--color-success-green)', fontWeight: 600 }}>✓</span>
          : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
      </div>
    </div>
  );
}
