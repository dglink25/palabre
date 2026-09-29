import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// ── Liste des conversations ───────────────────────────────────────────────────

export function ConversationsListPage() {
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/conversations')
      .then(setConvs)
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', gap: 0 }}>
      {/* Panneau liste */}
      <div style={{
        width: 320, flexShrink: 0,
        background: 'var(--color-white)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Messages</h2>
          <Link to="/app/conversations/new" className="btn btn-sm" style={{ padding: '6px 12px' }}>
            + Nouveau
          </Link>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? <div style={{ padding: 16 }}><Spinner /></div> : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>Aucune conversation.</p>
                <Link to="/app/conversations/new" className="btn btn-sm">Demarrer une conversation</Link>
              </div>
            ) : convs.map(c => (
              <div key={c.id}
                onClick={() => navigate(`/app/conversations/${c.id}`)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--color-white)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-white)'}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-primary-blue)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                }}>
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name || 'Conversation'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.lastMessage || 'Aucun message'}
                  </div>
                </div>
                {c.unread > 0 && (
                  <div style={{
                    marginLeft: 'auto', flexShrink: 0,
                    background: 'var(--color-primary-blue)', color: '#fff',
                    borderRadius: 10, padding: '2px 7px', fontSize: 11, fontWeight: 700,
                  }}>{c.unread}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone vide (sélectionner une conversation) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-offwhite)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.3, marginBottom: 16 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Selectionnez une conversation ou commencez-en une nouvelle.</p>
        </div>
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export function ChatPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [convInfo, setConvInfo] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/conversations/${id}/messages`),
      api.get(`/conversations/${id}`),
    ])
      .then(([msgs, conv]) => { setMessages(msgs); setConvInfo(conv); })
      .catch(e => setError(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    const optimistic = { id: Date.now(), from: user?.id, content, sentAt: new Date().toISOString(), isMine: true, status: 'sending' };
    setMessages(prev => [...prev, optimistic]);
    try {
      await api.post(`/conversations/${id}/messages`, { content });
    } catch {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'failed' } : m));
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
      {/* Liste sidebar */}
      <div style={{ width: 320, flexShrink: 0, background: 'var(--color-white)', borderRight: '1px solid var(--color-border)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/app/conversations" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: 13 }}>← Retour</Link>
        </div>
        {convInfo && (
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
              {(convInfo.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{convInfo.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-success-green)' }}>En ligne</div>
            </div>
          </div>
        )}
      </div>

      {/* Zone chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-offwhite)' }}>
        {/* En-tête */}
        <div style={{ padding: '12px 16px', background: 'var(--color-white)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontWeight: 600 }}>{convInfo?.name || 'Conversation'}</div>
          <Link to={`/app/call?peer=${convInfo?.peerId}&type=audio`} className="btn btn-sm btn-secondary" style={{ padding: '6px 10px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </Link>
          <Link to={`/app/call?peer=${convInfo?.peerId}&type=video`} className="btn btn-sm btn-secondary" style={{ padding: '6px 10px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </Link>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? <Spinner /> : messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.isMine || m.from === user?.id ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '65%',
                padding: '10px 14px',
                borderRadius: m.isMine || m.from === user?.id ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.isMine || m.from === user?.id ? 'var(--color-primary-blue)' : 'var(--color-white)',
                color: m.isMine || m.from === user?.id ? '#fff' : 'var(--color-text-primary)',
                border: m.isMine || m.from === user?.id ? 'none' : '1px solid var(--color-border)',
                fontSize: 14,
                lineHeight: 1.5,
              }}>
                {m.content || m.decryptedText || '🔒 Message chiffre'}
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4, textAlign: 'right' }}>
                  {new Date(m.sentAt || m.clientTs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {m.status === 'sending' && ' ·'}
                  {m.status === 'failed' && ' ✕'}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Saisie */}
        <form onSubmit={send} style={{ padding: '12px 16px', background: 'var(--color-white)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ecrire un message..."
            style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 24, fontSize: 14, outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button type="submit" className="btn" style={{ borderRadius: '50%', width: 44, height: 44, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={!text.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
