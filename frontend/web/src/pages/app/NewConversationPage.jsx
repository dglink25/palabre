import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const Ico = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ICO = {
  search:  ['M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
  users:   ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  x:       ['M18 6L6 18', 'M6 6l12 12'],
  check:   ['M20 6L9 17l-5-5'],
  msg:     ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  group:   ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
};

export default function NewConversationPage() {
  const navigate = useNavigate();
  const [contacts, setContacts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [query, setQuery]         = useState('');
  const [selected, setSelected]   = useState([]); // ids
  const [mode, setMode]           = useState('direct'); // direct | group
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    api.get('/contacts')
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(c =>
    !query || (c.fullName || c.email || '').toLowerCase().includes(query.toLowerCase())
  );

  function toggleContact(id) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : mode === 'direct' ? [id] : [...prev, id]
    );
  }

  async function create() {
    if (selected.length === 0) return;
    setCreating(true);
    setError('');
    try {
      const body = mode === 'group'
        ? { participants: selected, name: groupName || 'Nouveau groupe', isGroup: true }
        : { participants: selected, isGroup: false };
      const conv = await api.post('/conversations', body);
      navigate(`/app/conversations/${conv.id}`);
    } catch (e) {
      setError(friendlyMessage(e));
      setCreating(false);
    }
  }

  const selectedContacts = contacts.filter(c => selected.includes(c.id));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 38, height: 38, border: '1px solid var(--color-border)', borderRadius: '50%', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico d={['M19 12H5', 'M12 5l-7 7 7 7']} size={16} />
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Nouvelle conversation</h2>
      </div>

      {/* Type direct / groupe */}
      <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        {[['direct', 'Message direct', ICO.msg], ['group', 'Groupe', ICO.group]].map(([v, l, ico]) => (
          <button key={v} onClick={() => { setMode(v); setSelected([]); }}
            style={{
              flex: 1, padding: '10px 14px', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: mode === v ? 'var(--color-primary-blue)' : 'var(--color-white)',
              color: mode === v ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 16, fontWeight: mode === v ? 700 : 400,
              transition: 'background 0.15s, color 0.15s',
            }}>
            <Ico d={ico} size={15} /> {l}
          </button>
        ))}
      </div>

      {/* Nom du groupe */}
      {mode === 'group' && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Nom du groupe..."
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', fontSize: 16, borderRadius: 8, outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>
      )}

      {/* Participants selectionnés */}
      {selectedContacts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {selectedContacts.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(26,115,232,0.1)', border: '1px solid rgba(26,115,232,0.3)',
              borderRadius: 20, padding: '4px 10px 4px 6px', fontSize: 14,
            }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {(c.fullName || '?').charAt(0).toUpperCase()}
              </div>
              <span style={{ color: 'var(--color-primary-blue)', fontWeight: 600 }}>{c.fullName || c.email}</span>
              <button onClick={() => toggleContact(c.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 0, display: 'flex' }}>
                <Ico d={ICO.x} size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>
          <Ico d={ICO.search} size={16} />
        </span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un membre..."
          style={{ width: '100%', padding: '9px 12px 9px 38px', border: '1px solid var(--color-border)', fontSize: 16, borderRadius: 8, outline: 'none' }}
          onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Liste contacts */}
      <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Aucun contact trouve.
          </div>
        ) : filtered.map(c => {
          const isSelected = selected.includes(c.id);
          return (
            <div key={c.id}
              onClick={() => toggleContact(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                background: isSelected ? 'rgba(26,115,232,0.06)' : 'var(--color-white)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-offwhite)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-white)'; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-primary-blue)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 15,
              }}>
                {(c.fullName || c.email || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.fullName || 'Inconnu'}</div>
                {c.email && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{c.email}</div>}
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--color-primary-blue)' : 'var(--color-border)'}`,
                background: isSelected ? 'var(--color-primary-blue)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
                {isSelected && <Ico d={ICO.check} size={13} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bouton créer */}
      <button
        onClick={create}
        disabled={selected.length === 0 || creating}
        className="btn btn-block"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17 }}
      >
        {creating ? <Spinner /> : <Ico d={ICO.msg} size={17} />}
        {mode === 'group' ? 'Creer le groupe' : 'Demarrer la conversation'}
      </button>
    </div>
  );
}
