import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { createRoom, createPublicRoom } from '../../lib/videoconferenceApi';

const Ico = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  close:    ['M18 6L6 18', 'M6 6l12 12'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z'],
  clock:    ['M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z', 'M12 6v6l4 2'],
  lock:     ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  unlock:   ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 9.9-1'],
  user:     ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  x:        ['M18 6L6 18', 'M6 6l12 12'],
  search:   ['M21 21l-4.35-4.35', 'M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z'],
};

/**
 * Modal de création / planification d'une vidéoconférence.
 * isPublic = true → création sans tenant (page d'accueil)
 */
export default function CreateRoomModal({ isPublic = false, onCreated, onClose }) {
  const [title,       setTitle]       = useState('');
  const [mode,        setMode]        = useState('immediate'); // 'immediate' | 'scheduled'
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [duration,    setDuration]    = useState(60);
  const [policy,      setPolicy]      = useState('closed');
  const [inviteQuery, setInviteQuery] = useState('');
  const [contacts,    setContacts]    = useState([]);
  const [selected,    setSelected]    = useState([]); // { id, fullName, email }
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Charger les contacts (tenant uniquement)
  useEffect(() => {
    if (isPublic) return;
    api.get('/contacts').then(c => setContacts(c || [])).catch(() => {});
  }, [isPublic]);

  const filtered = contacts.filter(c =>
    !selected.find(s => s.id === c.id) &&
    (c.fullName?.toLowerCase().includes(inviteQuery.toLowerCase()) ||
     c.email?.toLowerCase().includes(inviteQuery.toLowerCase()))
  ).slice(0, 8);

  function addInvitee(contact) {
    setSelected(s => [...s, contact]);
    setInviteQuery('');
  }
  function removeInvitee(id) {
    setSelected(s => s.filter(c => c.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Le titre est obligatoire.'); return; }

    let scheduledAt = null;
    if (mode === 'scheduled') {
      if (!date || !time) { setError('La date et l\'heure sont obligatoires.'); return; }
      scheduledAt = new Date(`${date}T${time}`).toISOString();
      const minDate = new Date(Date.now() + 5 * 60 * 1000);
      if (new Date(scheduledAt) < minDate) {
        setError('La date doit être au moins 5 minutes dans le futur.');
        return;
      }
    }

    setLoading(true);
    try {
      const inviteeIds       = selected.map(s => s.id);
      const inviteeIdentifiers = selected.map(s => s.email || s.fullName);

      const room = isPublic
        ? await createPublicRoom({
            title: title.trim(), accessPolicy: policy,
            immediate: mode === 'immediate', scheduledAt,
            estimatedDurationMin: duration, inviteeIdentifiers,
          })
        : await createRoom({
            title: title.trim(), accessPolicy: policy,
            immediate: mode === 'immediate', scheduledAt,
            estimatedDurationMin: duration, inviteeIds,
          });

      onCreated(room);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        background: 'var(--color-white)',
        borderRadius: 16, width: '100%', maxWidth: 560,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* En-tête */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)',
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {mode === 'scheduled' ? 'Planifier une réunion' : 'Nouvelle réunion'}
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
            <Ico d={ICONS.close} size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
          {/* Titre */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Titre de la réunion *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex : Réunion d'équipe hebdomadaire"
              maxLength={255}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid var(--color-border)', fontSize: 15,
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Démarrage
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['immediate', 'Maintenant'], ['scheduled', 'Planifier']].map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => setMode(val)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: mode === val ? '2px solid var(--color-primary-blue)' : '1.5px solid var(--color-border)',
                    background: mode === val ? 'rgba(26,115,232,0.07)' : 'transparent',
                    color: mode === val ? 'var(--color-primary-blue)' : 'var(--color-text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sélecteur date/heure (si planifié) */}
          {mode === 'scheduled' && (
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-offwhite)', borderRadius: 10 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--color-border)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Heure</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--color-border)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Durée estimée (minutes)</label>
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 60)}
                  min={1} max={480}
                  style={{ width: 120, padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--color-border)', fontSize: 14 }} />
              </div>
            </div>
          )}

          {/* Politique d'accès */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Accès
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['closed', ICONS.lock,   'Fermé',  'Invitation requise pour rejoindre'],
                ['open',   ICONS.unlock, 'Ouvert', 'Tout membre peut rejoindre directement'],
              ].map(([val, ico, lbl, desc]) => (
                <button key={val} type="button"
                  onClick={() => setPolicy(val)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    border: policy === val ? '2px solid var(--color-primary-blue)' : '1.5px solid var(--color-border)',
                    background: policy === val ? 'rgba(26,115,232,0.06)' : 'transparent',
                    textAlign: 'left',
                  }}
                >
                  <Ico d={ico} size={18} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: policy === val ? 'var(--color-primary-blue)' : 'var(--color-text)' }}>{lbl}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Invitations */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Inviter des participants
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={inviteQuery}
                onChange={e => setInviteQuery(e.target.value)}
                placeholder={isPublic ? 'Email ou nom d\'utilisateur...' : 'Rechercher un membre...'}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1.5px solid var(--color-border)', fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
              {inviteQuery && filtered.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--color-white)', border: '1px solid var(--color-border)',
                  borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  overflow: 'hidden', marginTop: 4,
                }}>
                  {filtered.map(c => (
                    <button key={c.id} type="button" onClick={() => addInvitee(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px', border: 'none',
                        background: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--color-primary-blue)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                      }}>
                        {c.fullName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Invités sélectionnés */}
            {selected.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {selected.map(s => (
                  <span key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(26,115,232,0.1)', color: 'var(--color-primary-blue)',
                    border: '1px solid rgba(26,115,232,0.25)',
                    borderRadius: 20, padding: '4px 10px 4px 8px',
                    fontSize: 13, fontWeight: 500,
                  }}>
                    {s.fullName || s.email}
                    <button type="button" onClick={() => removeInvitee(s.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}>
                      <Ico d={ICONS.x} size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(234,67,53,0.08)', color: 'var(--color-alert-red)',
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn" disabled={loading || !title.trim()}>
              {loading ? 'Création…' : mode === 'scheduled' ? 'Planifier la réunion' : 'Lancer la réunion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
