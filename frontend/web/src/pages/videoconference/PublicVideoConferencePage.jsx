import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createPublicRoom } from '../../lib/videoconferenceApi';
import { api } from '../../lib/apiClient';

const Ico = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  video:    ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  lock:     ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  unlock:   ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 9.9-1'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z'],
  x:        ['M18 6L6 18', 'M6 6l12 12'],
  copy:     ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1'],
  check:    ['M20 6 9 17l-5-5'],
  arrow:    ['M5 12h14', 'M12 5l7 7-7 7'],
};

/**
 * PublicVideoConferencePage
 * Route : /videoconference (ProtectedRoute — authentification obligatoire)
 * Permet à tout utilisateur Palabre authentifié de créer ou planifier
 * une réunion sans appartenir à une organisation.
 */
export default function PublicVideoConferencePage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [title,       setTitle]       = useState('');
  const [mode,        setMode]        = useState('immediate');
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [duration,    setDuration]    = useState(60);
  const [policy,      setPolicy]      = useState('closed');
  const [inviteQuery, setInviteQuery] = useState('');
  const [selected,    setSelected]    = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [created,     setCreated]     = useState(null); // room créée
  const [copied,      setCopied]      = useState(false);

  // Recherche d'utilisateurs Palabre (email ou nom)
  async function searchUsers(q) {
    setInviteQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      // Utilise l'endpoint contacts si disponible, sinon skip
      const results = await api.get(`/contacts?q=${encodeURIComponent(q)}`).catch(() => []);
      setSearchResults((results || []).filter(c => !selected.find(s => s.id === c.id)).slice(0, 6));
    } catch { setSearchResults([]); }
  }

  function addInvitee(c) {
    setSelected(s => [...s, c]);
    setInviteQuery('');
    setSearchResults([]);
  }
  function removeInvitee(id) { setSelected(s => s.filter(c => c.id !== id)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Le titre est obligatoire.'); return; }

    let scheduledAt = null;
    if (mode === 'scheduled') {
      if (!date || !time) { setError('La date et l\'heure sont obligatoires.'); return; }
      scheduledAt = new Date(`${date}T${time}`).toISOString();
      if (new Date(scheduledAt) < new Date(Date.now() + 5 * 60 * 1000)) {
        setError('La date doit être au moins 5 minutes dans le futur.');
        return;
      }
    }

    setLoading(true);
    try {
      const inviteeIdentifiers = selected.map(s => s.email || s.fullName).filter(Boolean);
      // Ajouter les identifiants saisis manuellement
      if (inviteQuery.trim()) inviteeIdentifiers.push(inviteQuery.trim());

      const room = await createPublicRoom({
        title: title.trim(), accessPolicy: policy,
        immediate: mode === 'immediate', scheduledAt,
        estimatedDurationMin: duration, inviteeIdentifiers,
      });
      setCreated(room);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(created.shareLink || created.joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Écran de confirmation après création ─────────────────────────────────
  if (created) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 16px' }}>
        <div style={{
          background: 'var(--color-white)', borderRadius: 16,
          border: '1px solid var(--color-border)',
          padding: 32, textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(22,163,74,0.1)', color: 'var(--color-success-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Ico d={ICONS.check} size={28} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
            {created.status === 'active' ? 'Réunion prête !' : 'Réunion planifiée'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, margin: '0 0 24px' }}>
            {created.status === 'active'
              ? `"${created.title}" est prête. Partagez le lien pour inviter des participants.`
              : `"${created.title}" a été planifiée. Les invités seront notifiés.`}
          </p>

          {/* Lien partageable */}
          <div style={{
            display: 'flex', gap: 8, padding: 10,
            background: 'var(--color-offwhite)', borderRadius: 8,
            border: '1px solid var(--color-border)', marginBottom: 20,
          }}>
            <input
              readOnly
              value={created.shareLink || created.joinUrl || ''}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 13, color: 'var(--color-text)', outline: 'none',
              }}
            />
            <button onClick={copyLink} style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: copied ? 'var(--color-success-green)' : 'var(--color-primary-blue)',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600,
              flexShrink: 0,
            }}>
              <Ico d={copied ? ICONS.check : ICONS.copy} size={14} />
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }}
              onClick={() => setCreated(null)}>
              Nouvelle réunion
            </button>
            {created.status === 'active' && (
              <button className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => navigate(`/videoconference/${created.id}`)}>
                Rejoindre <Ico d={ICONS.arrow} size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Formulaire de création ────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>

      {/* En-tête */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(26,115,232,0.1)', color: 'var(--color-primary-blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Ico d={ICONS.video} size={24} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Créer une réunion</h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 15 }}>
          Lancez ou planifiez une réunion et invitez des participants.
        </p>
      </div>

      <div style={{
        background: 'var(--color-white)', borderRadius: 16,
        border: '1px solid var(--color-border)',
        padding: '24px 28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <form onSubmit={handleSubmit}>

          {/* Titre */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Titre de la réunion *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex : Réunion de lancement, Séminaire annuel…"
              maxLength={255}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid var(--color-border)', fontSize: 15,
                boxSizing: 'border-box', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              autoFocus
            />
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Démarrage</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['immediate', 'Maintenant'], ['scheduled', 'Planifier']].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setMode(val)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: mode === val ? '2px solid var(--color-primary-blue)' : '1.5px solid var(--color-border)',
                    background: mode === val ? 'rgba(26,115,232,0.07)' : 'transparent',
                    color: mode === val ? 'var(--color-primary-blue)' : 'var(--color-text)',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Date/heure */}
          {mode === 'scheduled' && (
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-offwhite)', borderRadius: 10 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Heure</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Durée estimée</label>
                <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 14, background: 'var(--color-white)' }}>
                  {[15, 30, 45, 60, 90, 120, 180, 240, 480].map(v => (
                    <option key={v} value={v}>{v < 60 ? `${v} min` : `${Math.floor(v/60)}h${v%60 ? v%60+'min' : ''}`}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Accès */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Accès</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['closed', ICONS.lock, 'Fermé', 'Invitation requise'], ['open', ICONS.unlock, 'Ouvert', 'Tout le monde']].map(([val, ico, lbl, desc]) => (
                <button key={val} type="button" onClick={() => setPolicy(val)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: policy === val ? '2px solid var(--color-primary-blue)' : '1.5px solid var(--color-border)',
                    background: policy === val ? 'rgba(26,115,232,0.06)' : 'transparent',
                  }}
                >
                  <Ico d={ico} size={16} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: policy === val ? 'var(--color-primary-blue)' : 'var(--color-text)' }}>{lbl}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Invitations */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Inviter (optionnel)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={inviteQuery}
                onChange={e => searchUsers(e.target.value)}
                placeholder="Email ou nom d'utilisateur Palabre"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid var(--color-border)', fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--color-white)', border: '1px solid var(--color-border)',
                  borderRadius: 10, marginTop: 4, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                }}>
                  {searchResults.map(c => (
                    <button key={c.id} type="button" onClick={() => addInvitee(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {c.fullName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selected.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {selected.map(s => (
                  <span key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'rgba(26,115,232,0.1)', color: 'var(--color-primary-blue)',
                    borderRadius: 20, padding: '4px 10px 4px 8px', fontSize: 13,
                  }}>
                    {s.fullName || s.email}
                    <button type="button" onClick={() => removeInvitee(s.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}>
                      <Ico d={ICONS.x} size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(234,67,53,0.08)', color: 'var(--color-alert-red)', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn" disabled={loading || !title.trim()}
            style={{ width: '100%', padding: '12px 0', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ico d={ICONS.video} size={16} />
            {loading ? 'Création…' : mode === 'scheduled' ? 'Planifier la réunion' : 'Lancer maintenant'}
          </button>
        </form>
      </div>
    </div>
  );
}
