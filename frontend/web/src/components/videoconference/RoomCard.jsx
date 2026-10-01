import { Link } from 'react-router-dom';

const Ico = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  video:    ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  clock:    ['M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z', 'M12 6v6l4 2'],
  users:    ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  lock:     ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z'],
  rec:      ['M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', 'M2 12h3', 'M19 12h3'],
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1) return 'À l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h}h`;
}

const STATUS_CONFIG = {
  active:    { label: 'En cours',  color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   dot: '#16a34a' },
  scheduled: { label: 'Planifiée', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  dot: '#2563eb' },
  ended:     { label: 'Terminée',  color: '#6b7280', bg: 'rgba(107,114,128,0.08)', dot: '#9ca3af' },
  cancelled: { label: 'Annulée',   color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  dot: '#dc2626' },
};

export default function RoomCard({ room, isPublic = false }) {
  const cfg    = STATUS_CONFIG[room.status] || STATUS_CONFIG.ended;
  const roomPath = isPublic ? `/videoconference/${room.id}` : `/app/videoconference/${room.id}`;

  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'box-shadow 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Icône statut */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico d={ICONS.video} size={20} />
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.title}
          </div>
          <span style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: cfg.bg, color: cfg.color, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
            {cfg.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
          {room.hostName && (
            <span>Par {room.hostName}</span>
          )}
          {room.status === 'active' && room.startedAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.clock} size={12} />
              {timeAgo(room.startedAt)}
            </span>
          )}
          {room.status === 'scheduled' && room.scheduledAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.calendar} size={12} />
              {formatDate(room.scheduledAt)}
            </span>
          )}
          {room.participantCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.users} size={12} />
              {room.participantCount} participant{room.participantCount > 1 ? 's' : ''}
            </span>
          )}
          {room.accessPolicy === 'closed' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.lock} size={12} />
              Fermée
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      {['active', 'scheduled'].includes(room.status) && (
        <Link to={roomPath} style={{ textDecoration: 'none', flexShrink: 0 }}>
          <button className={room.status === 'active' ? 'btn' : 'btn btn-secondary'}
            style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
            {room.status === 'active' ? 'Rejoindre →' : 'Détails'}
          </button>
        </Link>
      )}
    </div>
  );
}
