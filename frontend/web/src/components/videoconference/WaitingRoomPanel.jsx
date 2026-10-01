import { useState, useEffect, useCallback } from 'react';
import { getParticipants, admitParticipant, kickParticipant } from '../../lib/videoconferenceApi';

const Ico = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  check: ['M20 6 9 17l-5-5'],
  x:     ['M18 6L6 18', 'M6 6l12 12'],
  user:  ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
};

/**
 * WaitingRoomPanel
 * Affiché pour l'hôte/modérateur pendant une session active.
 * Montre les participants actifs et ceux en salle d'attente.
 */
export default function WaitingRoomPanel({ roomId, currentUserId, onAdmit }) {
  const [participants, setParticipants] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    try {
      const data = await getParticipants(roomId);
      setParticipants(data || []);
    } catch { /* silencieux */ }
  }, [roomId]);

  // Polling toutes les 5 secondes pour la salle d'attente
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const active  = participants.filter(p => p.status === 'active');
  const waiting = participants.filter(p => p.status === 'waiting');

  async function handleAdmit(userId) {
    setActionLoading(s => ({ ...s, [userId]: 'admitting' }));
    try {
      await admitParticipant(roomId, userId);
      onAdmit?.(userId);
      await load();
    } catch (err) {
      console.error('admit error', err);
    } finally {
      setActionLoading(s => ({ ...s, [userId]: null }));
    }
  }

  async function handleKick(userId) {
    setActionLoading(s => ({ ...s, [userId]: 'kicking' }));
    try {
      await kickParticipant(roomId, userId);
      await load();
    } catch (err) {
      console.error('kick error', err);
    } finally {
      setActionLoading(s => ({ ...s, [userId]: null }));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Participants actifs */}
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          Participants ({active.length})
        </div>
        {active.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>Aucun participant actif</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {active.map(p => (
              <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: p.role === 'host' ? 'var(--color-primary-blue)' : 'var(--color-offwhite)',
                  border: '1.5px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12, color: p.role === 'host' ? '#fff' : 'var(--color-text)',
                }}>
                  {p.fullName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.fullName}{p.userId === currentUserId ? ' (vous)' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                    {p.role === 'host' ? 'Hôte' : p.role === 'moderator' ? 'Modérateur' : 'Participant'}
                  </div>
                </div>
                {/* Expulser (pas soi-même, pas l'hôte) */}
                {p.userId !== currentUserId && p.role !== 'host' && (
                  <button
                    onClick={() => handleKick(p.userId)}
                    disabled={!!actionLoading[p.userId]}
                    title="Exclure"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--color-alert-red)', padding: 4, borderRadius: 4, display: 'flex',
                      opacity: actionLoading[p.userId] ? 0.5 : 1,
                    }}
                  >
                    <Ico d={ICONS.x} size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salle d'attente */}
      {waiting.length > 0 && (
        <div style={{ padding: '12px 16px', flex: 1, overflowY: 'auto' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
            color: 'var(--color-alert-orange, #f57c00)', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--color-alert-orange, #f57c00)', color: '#fff', fontSize: 10, fontWeight: 700,
            }}>{waiting.length}</span>
            En attente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {waiting.map(p => (
              <div key={p.userId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(245,124,0,0.07)', border: '1px solid rgba(245,124,0,0.2)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(245,124,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12, color: 'var(--color-alert-orange, #f57c00)',
                }}>
                  {p.fullName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.fullName}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleAdmit(p.userId)}
                    disabled={!!actionLoading[p.userId]}
                    title="Admettre"
                    style={{
                      width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--color-success-green)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: actionLoading[p.userId] ? 0.5 : 1,
                    }}
                  >
                    <Ico d={ICONS.check} size={13} />
                  </button>
                  <button
                    onClick={() => handleKick(p.userId)}
                    disabled={!!actionLoading[p.userId]}
                    title="Refuser"
                    style={{
                      width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--color-alert-red)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: actionLoading[p.userId] ? 0.5 : 1,
                    }}
                  >
                    <Ico d={ICONS.x} size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {waiting.length === 0 && active.length > 0 && (
        <div style={{ padding: '12px 16px', flex: 1, color: 'var(--color-text-secondary)', fontSize: 13 }}>
          Salle d'attente vide
        </div>
      )}
    </div>
  );
}
