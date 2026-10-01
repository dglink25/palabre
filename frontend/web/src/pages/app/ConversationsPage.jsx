import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../lib/apiClient';
import { Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

const WS_URL = import.meta.env.VITE_MESSAGE_ROUTER_URL || 'ws://localhost:4020';

// ── Utilitaires ───────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, online = false }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--color-primary-blue)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      }}>{initial}</div>
      {online && (
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 11, height: 11, borderRadius: '50%',
          background: 'var(--color-success-green)',
          border: '2px solid var(--color-white)',
        }} />
      )}
    </div>
  );
}

function Tick({ status }) {
  if (status === 'read') return <span style={{ color: 'var(--color-primary-blue)', fontSize: 13 }}>✓✓</span>;
  if (status === 'delivered') return <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>✓✓</span>;
  if (status === 'sending') return <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>○</span>;
  if (status === 'failed') return <span style={{ color: 'var(--color-alert-red)', fontSize: 13 }}>✕</span>;
  return <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>✓</span>;
}

// ── Liste des conversations ───────────────────────────────────────────────────
export function ConversationsListPage() {
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotification();
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get('/conversations')
      .then(d => setConvs(Array.isArray(d) ? d : []))
      .catch(e => notify.error(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const fmt = (d) => {
    if (!d) return '';
    const now = new Date();
    const date = new Date(d);
    const diff = now - date;
    if (diff < 86400000) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: 'var(--color-white)' }}>
      {/* Panneau liste — style WhatsApp */}
      <div style={{
        width: 360, flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-white)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', background: 'var(--color-offwhite)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Discussions</h2>
          <Link to="/app/conversations/new" style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--color-primary-blue)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none', fontSize: 20, fontWeight: 300,
          }}>+</Link>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
          ) : convs.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <p style={{ marginBottom: 12 }}>Aucune conversation.</p>
              <Link to="/app/conversations/new" className="btn btn-sm">Demarrer</Link>
            </div>
          ) : convs.map(c => (
            <div key={c.id}
              onClick={() => navigate(`/app/conversations/${c.id}`)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-offwhite)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <Avatar name={c.name} size={48} online={c.online} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: c.unread > 0 ? 'var(--color-success-green)' : 'var(--color-text-secondary)' }}>
                    {fmt(c.lastMessageAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {c.lastMessage || 'Aucun message'}
                  </span>
                  {c.unread > 0 && (
                    <span style={{
                      background: 'var(--color-success-green)', color: '#fff',
                      borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>{c.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone vide */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" style={{ opacity: 0.2, marginBottom: 16 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p style={{ fontSize: 15 }}>Selectionnez une conversation</p>
        </div>
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export function ChatPage() {
  const { id }  = useParams();
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [loading,   setLoading]   = useState(true);
  const [convInfo,  setConvInfo]  = useState(null);
  const [convs,     setConvs]     = useState([]);
  const bottomRef = useRef(null);
  const wsRef     = useRef(null);
  const inputRef  = useRef(null);

  // ── Charger données initiales ─────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/conversations/${id}/messages`),
      api.get(`/conversations/${id}`),
      api.get('/conversations'),
    ])
      .then(([msgs, conv, all]) => {
        setMessages(Array.isArray(msgs) ? msgs : []);
        setConvInfo(conv);
        setConvs(Array.isArray(all) ? all : []);
      })
      .catch(e => notify.error(friendlyMessage(e)))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  // ── WebSocket temps réel ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem('palabre_access_token') ||
                  sessionStorage.getItem('palabre_access_token');
    if (!token) return;

    let ws;
    let reconnectTimer;
    let reconnectDelay = 1000;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      try {
        ws = new WebSocket(`${WS_URL}/socket/websocket?token=${token}&device_id=web&platform=web`);
        wsRef.current = ws;
      } catch { return; }

      ws.onopen = () => {
        reconnectDelay = 1000;
        // Rejoindre le channel utilisateur
        ws.send(JSON.stringify({
          topic: `user:${user.id}`,
          event: 'phx_join',
          payload: {},
          ref: '1',
        }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === 'incoming_message' || msg.event === 'new_message') {
            const payload = msg.payload;
            // Ajouter le message seulement si on est dans la bonne conversation
            if (payload.to === user.id || payload.from === user.id) {
              setMessages(prev => {
                // Déduplication
                if (prev.find(m => m.id === payload.id)) return prev;
                return [...prev, {
                  id:      payload.id || Date.now(),
                  from:    payload.from,
                  content: payload.content || payload.ciphertext,
                  sentAt:  payload.sentAt || new Date().toISOString(),
                  isMine:  payload.from === user.id,
                  status:  payload.status || 'delivered',
                }];
              });
            }
          }
          if (msg.event === 'delivery_receipt') {
            setMessages(prev => prev.map(m =>
              m.id === msg.payload.msg_id ? { ...m, status: 'delivered' } : m
            ));
          }
          if (msg.event === 'read_receipt') {
            setMessages(prev => prev.map(m =>
              m.id === msg.payload.msg_id ? { ...m, status: 'read' } : m
            ));
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (destroyed) return;
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connect();
        }, reconnectDelay);
      };
    }

    connect();

    // Heartbeat Phoenix (30s)
    const hbInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
      }
    }, 30000);

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      clearInterval(hbInterval);
      ws?.close();
    };
  }, [user?.id]); // eslint-disable-line

  // ── Scroll en bas ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Envoi ─────────────────────────────────────────────────────────────────
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    inputRef.current?.focus();

    const optimisticId = `opt_${Date.now()}`;
    const optimistic = {
      id: optimisticId, from: user?.id, content,
      sentAt: new Date().toISOString(), isMine: true, status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const sent = await api.post(`/conversations/${id}/messages`, { content });
      setMessages(prev => prev.map(m =>
        m.id === optimisticId ? { ...sent, isMine: true } : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === optimisticId ? { ...m, status: 'failed' } : m
      ));
      notify.error(friendlyMessage(err));
    }
  }

  const fmt = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>

      {/* ── Liste latérale ── */}
      <div style={{
        width: 320, flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-white)',
      }}>
        <div style={{
          padding: '14px 16px', background: 'var(--color-offwhite)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button onClick={() => navigate('/app/conversations')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', color: 'var(--color-text-secondary)', fontSize: 18 }}>
            ←
          </button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Messages</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.map(c => (
            <div key={c.id}
              onClick={() => navigate(`/app/conversations/${c.id}`)}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                background: c.id === id ? 'rgba(26,115,232,0.08)' : '',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (c.id !== id) e.currentTarget.style.background = 'var(--color-offwhite)'; }}
              onMouseLeave={e => { if (c.id !== id) e.currentTarget.style.background = ''; }}
            >
              <Avatar name={c.name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: c.id === id ? 700 : 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastMessage || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

        {/* Header */}
        <div style={{
          padding: '10px 16px', background: 'var(--color-offwhite)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {convInfo && <Avatar name={convInfo.name} size={40} online={convInfo.online} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{convInfo?.name || '...'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-success-green)' }}>
              {convInfo?.online ? 'En ligne' : 'Hors ligne'}
            </div>
          </div>
          {/* Boutons appel */}
          <Link to={`/app/calls?peer=${convInfo?.peerId}&type=audio`}
            style={{ padding: '7px', borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }}
            title="Appel audio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </Link>
          <Link to={`/app/calls?peer=${convInfo?.peerId}&type=video`}
            style={{ padding: '7px', borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }}
            title="Appel video">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </Link>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          ) : messages.map(m => {
            const mine = m.isMine || m.from === user?.id;
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '65%', padding: '8px 12px',
                  background: mine ? 'var(--color-primary-blue)' : '#fff',
                  color: mine ? '#fff' : 'var(--color-text-primary)',
                  borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  fontSize: 14, lineHeight: 1.5,
                }}>
                  <div>{m.content || m.decryptedText || <span style={{ opacity: 0.6, fontSize: 12 }}>Message chiffre</span>}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
                    <span style={{ fontSize: 11, opacity: mine ? 0.75 : 0.5 }}>
                      {fmt(m.sentAt || m.created_at)}
                    </span>
                    {mine && <Tick status={m.status} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Saisie */}
        <form onSubmit={send} style={{
          padding: '10px 16px', background: 'var(--color-offwhite)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ecrire un message..."
            style={{
              flex: 1, padding: '10px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 24, fontSize: 15, outline: 'none',
              background: '#fff',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button type="submit"
            disabled={!text.trim()}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: text.trim() ? 'var(--color-primary-blue)' : 'var(--color-border)',
              border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', transition: 'background 0.15s',
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
