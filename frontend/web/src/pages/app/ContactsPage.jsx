import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// ── Icônes ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ICO = {
  search: ['M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
  msg:    ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  call:   ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  video:  ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  user:   ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  users:  ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
};

// Couleur selon le statut de presence
function presenceColor(status) {
  if (status === 'online')  return 'var(--color-success-green)';
  if (status === 'away')    return 'var(--color-warning-amber)';
  if (status === 'busy')    return 'var(--color-alert-red)';
  return '#bbb';
}
function presenceLabel(status) {
  if (status === 'online') return 'En ligne';
  if (status === 'away')   return 'Absent';
  if (status === 'busy')   return 'Occupe';
  return 'Hors ligne';
}

// ── Carte contact ─────────────────────────────────────────────────────────────
function ContactCard({ contact, navigate }) {
  const initial = (contact.fullName || contact.email || '?').charAt(0).toUpperCase();
  const name = contact.fullName || contact.email || 'Inconnu';
  const presence = contact.presence || 'offline';

  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'box-shadow 0.15s, transform 0.1s',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      {/* Avatar + presence */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--color-primary-blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 18,
        }}>
          {contact.photoUrl
            ? <img src={contact.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initial}
        </div>
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 12, height: 12, borderRadius: '50%',
          background: presenceColor(presence),
          border: '2px solid var(--color-white)',
        }} title={presenceLabel(presence)} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 13, color: presenceColor(presence) }}>{presenceLabel(presence)}</div>
        {contact.jobTitle && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>{contact.jobTitle}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <ActionBtn
          title="Envoyer un message"
          color="var(--color-primary-blue)"
          onClick={() => navigate(`/app/conversations?peer=${contact.id}`)}
        >
          <Ico d={ICO.msg} size={15} />
        </ActionBtn>
        <ActionBtn
          title="Appel audio"
          color="var(--color-success-green)"
          onClick={() => navigate(`/app/calls?peer=${name}&type=audio`)}
        >
          <Ico d={ICO.call} size={15} />
        </ActionBtn>
        <ActionBtn
          title="Appel video"
          color="#7B61FF"
          onClick={() => navigate(`/app/calls?peer=${name}&type=video`)}
        >
          <Ico d={ICO.video} size={15} />
        </ActionBtn>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, color, title, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{
        width: 34, height: 34, border: `1px solid ${color}22`, borderRadius: 8,
        background: `${color}10`, color, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.transform = 'scale(1.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.transform = ''; }}
    >
      {children}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [query, setQuery]       = useState('');
  const [filter, setFilter]     = useState('all'); // all | online | offline

  useEffect(() => {
    api.get('/contacts')
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(c => {
    const matchQ = !query || (c.fullName || c.email || '').toLowerCase().includes(query.toLowerCase());
    const matchF = filter === 'all'
      || (filter === 'online' && c.presence === 'online')
      || (filter === 'offline' && c.presence !== 'online');
    return matchQ && matchF;
  });

  // Groupement alphabetique
  const grouped = filtered.reduce((acc, c) => {
    const letter = (c.fullName || c.email || '?').charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});

  const onlineCount = contacts.filter(c => c.presence === 'online').length;

  return (
    <div>
      {/* En-tete */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Contacts</h2>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginTop: 2 }}>
          <Ico d={ICO.users} size={14} /> {contacts.length} membre{contacts.length > 1 ? 's' : ''} · {onlineCount} en ligne
        </div>
      </div>

      {/* Barre de recherche + filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>
            <Ico d={ICO.search} size={16} />
          </span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un contact..."
            style={{ width: '100%', padding: '9px 12px 9px 38px', border: '1px solid var(--color-border)', fontSize: 16, borderRadius: 8, outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          {[['all', 'Tous'], ['online', 'En ligne'], ['offline', 'Hors ligne']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{
                padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 15,
                background: filter === v ? 'var(--color-primary-blue)' : 'var(--color-white)',
                color: filter === v ? '#fff' : 'var(--color-text-secondary)',
                transition: 'background 0.15s, color 0.15s',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Chargement */}
      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>}

      {/* Liste vide */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <Ico d={ICO.user} size={48} />
          <p style={{ marginTop: 16, fontSize: 16 }}>
            {query ? `Aucun contact pour "${query}".` : 'Aucun contact dans votre organisation.'}
          </p>
          <p style={{ fontSize: 14 }}>
            Les membres de votre organisation apparaissent ici une fois connectes.
          </p>
        </div>
      )}

      {/* Grille par lettre */}
      {!loading && Object.keys(grouped).sort().map(letter => (
        <div key={letter} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)',
            textTransform: 'uppercase', letterSpacing: '1px',
            paddingBottom: 6, marginBottom: 10,
            borderBottom: '1px solid var(--color-border)',
          }}>
            {letter}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {grouped[letter].map(c => (
              <ContactCard key={c.id} contact={c} navigate={navigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
