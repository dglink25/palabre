import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useConfirm } from '../../components/ui';
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

// ── Rendu d'un contenu média dans une bulle ──────────────────────────────────
function MediaContent({ content, mine }) {
  let ref = null;
  try { ref = JSON.parse(content); } catch { return <span>{content}</span>; }
  if (!ref || !ref.url) return <span style={{ opacity: 0.6, fontSize: 12 }}>Fichier joint</span>;

  const { url, name, mimeType } = ref;

  if (mimeType?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
        <img src={url} alt={name} style={{ maxWidth: 220, maxHeight: 200, borderRadius: 8, display: 'block' }} />
      </a>
    );
  }
  if (mimeType?.startsWith('video/')) {
    return <video src={url} controls style={{ maxWidth: 220, borderRadius: 8, display: 'block' }} />;
  }
  if (mimeType?.startsWith('audio/')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <span style={{ fontSize: 16 }}>🎵</span>
        <audio src={url} controls style={{ height: 32, maxWidth: 180 }} />
      </div>
    );
  }
  // Document ou autre fichier
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      color: mine ? '#fff' : 'var(--color-primary-blue)',
      textDecoration: 'none', fontSize: 13,
    }}>
      <span style={{ fontSize: 20 }}>📎</span>
      <span style={{ wordBreak: 'break-all' }}>{name || 'Fichier'}</span>
    </a>
  );
}

// ── Contenu d'une bulle (texte ou système) ────────────────────────────────────
function BubbleContent({ m, mine }) {
  if (m.type === 'media_ref') return <MediaContent content={m.content} mine={mine} />;
  if (m.type === 'system') {
    let sys = null;
    try { sys = JSON.parse(m.content); } catch { sys = null; }
    if (sys?.deleted) return <span style={{ fontStyle: 'italic', opacity: 0.65, fontSize: 13 }}>Ce message a été supprimé</span>;
    return <span style={{ fontStyle: 'italic', fontSize: 13 }}>{m.content}</span>;
  }
  if (m.editedAt) {
    return <>{m.content} <span style={{ fontSize: 10, opacity: 0.6 }}>modifié</span></>;
  }
  return <>{m.content || <span style={{ opacity: 0.6, fontSize: 12 }}>Message chiffré</span>}</>;
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
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: 'var(--color-white)', overflow: 'hidden' }}>
      {/* Panneau liste - pleine largeur sur mobile, 360px fixe sur desktop */}
      <div style={{
        width: 'min(360px, 100%)',
        flexShrink: 0,
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
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
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

      {/* Zone vide - cachée sur mobile quand la liste est visible */}
      <div className="conv-empty-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', minWidth: 0 }}>
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
  const { confirm, ConfirmModal } = useConfirm();
  const navigate = useNavigate();
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [loading,   setLoading]   = useState(true);
  const [convInfo,  setConvInfo]  = useState(null);
  const [convs,     setConvs]     = useState([]);
  const [editingId, setEditingId] = useState(null);  // ID du message en édition
  const [editText,  setEditText]  = useState('');
  const [recording, setRecording] = useState(false);  // enregistrement audio
  const bottomRef  = useRef(null);
  const wsRef      = useRef(null);
  const inputRef   = useRef(null);
  const fileRef    = useRef(null);
  const mediaRecRef = useRef(null);  // MediaRecorder

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

          // msg:receive — message entrant du message-router Phoenix
          if (msg.event === 'msg:receive') {
            const payload = msg.payload;
            // Ajouter le message seulement si on est dans la bonne conversation
            if (payload.to === user.id || payload.from === user.id) {
              setMessages(prev => {
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

          // Statut livré (2 traits gris)
          if (msg.event === 'msg:delivered') {
            setMessages(prev => prev.map(m =>
              m.id === msg.payload.id ? { ...m, status: 'delivered' } : m
            ));
          }

          // Statut lu (2 traits bleus)
          if (msg.event === 'msg:read') {
            setMessages(prev => prev.map(m =>
              m.id === msg.payload.msg_id ? { ...m, status: 'read' } : m
            ));
          }

          // Accusé d'envoi initial
          if (msg.event === 'msg:sent_ack') {
            setMessages(prev => prev.map(m =>
              m.id === msg.payload.id ? { ...m, status: msg.payload.status === 'queued' ? 'sent' : 'sent' } : m
            ));
          }

          // Présence d'un contact
          if (msg.event === 'presence:update') {
            // Les mises à jour de présence sont gérées au niveau de la liste de contacts
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

    // Heartbeat Phoenix toutes les 30s
    // — sur le topic "phoenix" pour maintenir le socket vivant
    // — sur le channel "user:{id}" avec event "heartbeat" pour la présence
    const hbInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        // Heartbeat Phoenix standard (maintient la connexion)
        ws.send(JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: `hb_${Date.now()}`,
        }));
        // Heartbeat présence sur le channel utilisateur
        ws.send(JSON.stringify({
          topic: `user:${user.id}`,
          event: 'heartbeat',
          payload: { ts: Date.now() },
          ref: `hbp_${Date.now()}`,
        }));
      }
    }, 30000);

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      clearInterval(hbInterval);
      ws?.close();
    };
  }, [user?.id]); // eslint-disable-line

  // ── Scroll en bas + accusé de lecture automatique ───────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Envoyer l'accusé de lecture pour le dernier message reçu
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const lastReceived = [...messages].reverse().find(m => !m.isMine && m.from !== user?.id && m.status !== 'read');
    if (lastReceived && convInfo?.peerId) {
      ws.send(JSON.stringify({
        topic:   `user:${user.id}`,
        event:   'msg:ack_read',
        payload: { msg_id: lastReceived.id, from: convInfo.peerId },
        ref:     `ack_${Date.now()}`,
      }));
    }
  }, [messages]); // eslint-disable-line

  // ── Envoi ─────────────────────────────────────────────────────────────────
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    inputRef.current?.focus();

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      id: msgId, from: user?.id, content,
      sentAt: new Date().toISOString(), isMine: true, status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);

    // Tenter l'envoi via WebSocket Phoenix (temps réel)
    const ws = wsRef.current;
    const wsSent = ws?.readyState === WebSocket.OPEN;
    if (wsSent) {
      ws.send(JSON.stringify({
        topic: `user:${user.id}`,
        event: 'msg:send',
        payload: {
          id:         msgId,
          to:         convInfo?.peerId,
          ciphertext: content,       // En prod : chiffrer avec Signal avant envoi
          type:       'text',
          timestamp:  Date.now(),
        },
        ref: msgId,
      }));
      // Message considéré "envoyé" — le Phoenix ack confirmera
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, status: 'sent' } : m
      ));
    }

    // Toujours persister via REST pour la durabilité et l'historique
    try {
      const sent = await api.post(`/conversations/${id}/messages`, { content });
      setMessages(prev => prev.map(m =>
        // Remplacer le message optimiste par la version serveur (avec vrai ID si différent)
        m.id === msgId ? { ...sent, isMine: true } : m
      ));
    } catch (err) {
      if (!wsSent) {
        // Ni WS ni REST → marquer comme échoué
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, status: 'failed' } : m
        ));
        notify.error(friendlyMessage(err));
      }
      // Si WS a fonctionné mais REST échoue, le message est quand même livré
    }
  }

  // ── Upload fichier / média ────────────────────────────────────────────────
  async function sendFile(file) {
    if (!file || !convInfo?.peerId) return;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      id: msgId, from: user?.id, type: 'media_ref',
      content: JSON.stringify({ url: URL.createObjectURL(file), name: file.name, mimeType: file.type }),
      sentAt: new Date().toISOString(), isMine: true, status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const form = new FormData();
      form.append('file', file);
      const sent = await api.upload(`/conversations/${id}/media`, form);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...sent, isMine: true } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'failed' } : m));
      notify.error(friendlyMessage(err));
    }
  }

  // ── Enregistrement audio ──────────────────────────────────────────────────
  async function toggleRecord() {
    if (recording) {
      // Arrêter l'enregistrement
      mediaRecRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec    = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        await sendFile(file);
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch {
      notify.error('Impossible d\'accéder au microphone.');
    }
  }

  // ── Modifier un message ───────────────────────────────────────────────────
  function startEdit(m) {
    setEditingId(m.id);
    setEditText(m.content || '');
  }

  async function saveEdit() {
    if (!editText.trim() || !editingId) return;
    try {
      const updated = await api.patch(`/conversations/${id}/messages/${editingId}`, { content: editText.trim() });
      setMessages(prev => prev.map(m => m.id === editingId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m));
      setEditingId(null); setEditText('');
    } catch (err) { notify.error(friendlyMessage(err)); }
  }

  // ── Supprimer un message ──────────────────────────────────────────────────
  async function deleteMessage(m, forEveryone) {
    const ok = await confirm({
      title: forEveryone ? 'Supprimer pour tout le monde' : 'Supprimer pour moi',
      message: forEveryone
        ? 'Ce message sera supprimé pour vous et votre interlocuteur.'
        : 'Ce message sera supprimé uniquement pour vous.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/conversations/${id}/messages/${m.id}`, { forEveryone });
      if (forEveryone) {
        setMessages(prev => prev.map(x => x.id === m.id
          ? { ...x, type: 'system', content: JSON.stringify({ deleted: true }) }
          : x
        ));
      } else {
        setMessages(prev => prev.filter(x => x.id !== m.id));
      }
    } catch (err) { notify.error(friendlyMessage(err)); }
  }

  // ── Envoi texte ───────────────────────────────────────────────────────────
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    inputRef.current?.focus();

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setMessages(prev => [...prev, {
      id: msgId, from: user?.id, content, type: 'text',
      sentAt: new Date().toISOString(), isMine: true, status: 'sending',
    }]);

    const ws = wsRef.current;
    const wsSent = ws?.readyState === WebSocket.OPEN;
    if (wsSent) {
      ws.send(JSON.stringify({
        topic: `user:${user.id}`, event: 'msg:send',
        payload: { id: msgId, to: convInfo?.peerId, ciphertext: content, type: 'text', timestamp: Date.now() },
        ref: msgId,
      }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
    }

    try {
      const sent = await api.post(`/conversations/${id}/messages`, { content });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...sent, isMine: true } : m));
    } catch (err) {
      if (!wsSent) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'failed' } : m));
        notify.error(friendlyMessage(err));
      }
    }
  }

  const fmt = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      <ConfirmModal />

      {/* Input fichier caché */}
      <input ref={fileRef} type="file" style={{ display: 'none' }}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        onChange={e => { if (e.target.files[0]) sendFile(e.target.files[0]); e.target.value = ''; }} />

      {/* ── Liste latérale ── */}
      <div style={{
        width: 'min(320px, 30%)', flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-white)', minWidth: 0,
      }} className="chat-sidebar">
        <div style={{ padding: '14px 16px', background: 'var(--color-offwhite)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/app/conversations')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', color: 'var(--color-text-secondary)', fontSize: 18 }}>←</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Messages</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.map(c => (
            <div key={c.id} onClick={() => navigate(`/app/conversations/${c.id}`)}
              style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: c.id === id ? 'rgba(26,115,232,0.08)' : '', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (c.id !== id) e.currentTarget.style.background = 'var(--color-offwhite)'; }}
              onMouseLeave={e => { if (c.id !== id) e.currentTarget.style.background = ''; }}>
              <Avatar name={c.name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: c.id === id ? 700 : 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

        {/* Header */}
        <div style={{ padding: '10px 16px', background: 'var(--color-offwhite)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {convInfo && <Avatar name={convInfo.name} size={40} online={convInfo.online} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{convInfo?.name || '...'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-success-green)' }}>
              {convInfo?.online ? 'En ligne' : 'Hors ligne'}
            </div>
          </div>
          <Link to={`/app/calls?peer=${convInfo?.peerId}&type=audio`}
            style={{ padding: 7, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }} title="Appel audio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </Link>
          <Link to={`/app/calls?peer=${convInfo?.peerId}&type=video`}
            style={{ padding: 7, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }} title="Appel vidéo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </Link>
        </div>

        {/* Zone messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          ) : messages.map(m => {
            const mine = m.isMine || m.from === user?.id;
            const isDeleted = (() => { try { return JSON.parse(m.content)?.deleted; } catch { return false; } })();

            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}
                onMouseEnter={e => { if (!isDeleted) e.currentTarget.querySelector?.('.msg-actions')?.style && (e.currentTarget.querySelector('.msg-actions').style.opacity = '1'); }}
                onMouseLeave={e => { e.currentTarget.querySelector?.('.msg-actions')?.style && (e.currentTarget.querySelector('.msg-actions').style.opacity = '0'); }}>

                {/* Actions (modifier / supprimer) — affichées au survol */}
                {mine && !isDeleted && (
                  <div className="msg-actions" style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6, opacity: 0, transition: 'opacity 0.15s' }}>
                    {m.type === 'text' && (
                      <button onClick={() => startEdit(m)} title="Modifier" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: 4, color: 'var(--color-text-secondary)' }}>✏️</button>
                    )}
                    <button onClick={() => deleteMessage(m, false)} title="Supprimer pour moi" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: 4, color: 'var(--color-text-secondary)' }}>🗑️</button>
                    <button onClick={() => deleteMessage(m, true)} title="Supprimer pour tout le monde" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, padding: 4, color: 'var(--color-alert-red)' }}>✕✕</button>
                  </div>
                )}

                <div style={{
                  maxWidth: '65%', padding: m.type === 'media_ref' ? '6px 8px' : '8px 12px',
                  background: mine ? 'var(--color-primary-blue)' : '#fff',
                  color: mine ? '#fff' : 'var(--color-text-primary)',
                  borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  fontSize: 14, lineHeight: 1.5,
                }}>
                  <BubbleContent m={m} mine={mine} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
                    <span style={{ fontSize: 11, opacity: mine ? 0.75 : 0.5 }}>{fmt(m.sentAt || m.created_at)}</span>
                    {mine && <Tick status={m.status} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Zone d'édition */}
        {editingId && (
          <div style={{ padding: '8px 16px', background: 'rgba(26,115,232,0.06)', borderTop: '1px solid var(--color-primary-blue)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--color-primary-blue)', fontWeight: 600 }}>Modifier :</span>
            <input value={editText} onChange={e => setEditText(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 14 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') { setEditingId(null); } }} />
            <button onClick={saveEdit} className="btn btn-sm">Enregistrer</button>
            <button onClick={() => setEditingId(null)} className="btn btn-sm btn-secondary">✕</button>
          </div>
        )}

        {/* Zone de saisie */}
        <form onSubmit={send} style={{
          padding: '10px 12px', background: 'var(--color-offwhite)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          {/* Pièce jointe */}
          <button type="button" onClick={() => fileRef.current?.click()} title="Envoyer un fichier"
            style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
            📎
          </button>
          {/* Enregistrement audio */}
          <button type="button" onClick={toggleRecord} title={recording ? 'Arrêter l\'enregistrement' : 'Enregistrer un audio'}
            style={{ width: 38, height: 38, border: 'none', background: recording ? 'rgba(234,67,53,0.12)' : 'none', borderRadius: '50%', cursor: 'pointer', color: recording ? 'var(--color-alert-red)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, transition: 'background 0.15s' }}>
            {recording ? '⏹️' : '🎤'}
          </button>
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            placeholder="Écrire un message…"
            style={{ flex: 1, padding: '10px 16px', border: '1px solid var(--color-border)', borderRadius: 24, fontSize: 15, outline: 'none', background: '#fff', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--color-primary-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button type="submit" disabled={!text.trim()} aria-label="Envoyer"
            style={{ width: 44, height: 44, borderRadius: '50%', background: text.trim() ? 'var(--color-primary-blue)' : 'var(--color-border)', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background 0.15s', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
