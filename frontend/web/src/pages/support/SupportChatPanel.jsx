/**
 * SupportChatPanel - Panneau de messagerie du service client
 * Messages chiffrés E2E, indicateurs de statut, invitation vidéo.
 */
import { useState, useRef, useEffect } from 'react';
import { supportWs } from '../../lib/supportApi';

const STATUS_LABELS = { sent: '✓', delivered: '✓✓', read: '✓✓' };
const STATUS_COLORS = { sent: '#9AA0A6', delivered: '#9AA0A6', read: '#1A73E8' };

// Icône vidéo SVG
const VideoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

// Icône envoi SVG
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export default function SupportChatPanel({ session, messages, setMessages, user }) {
  const [input, setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef           = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Acquitter la lecture lors de l'ouverture
  useEffect(() => {
    if (!session || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      supportWs.sendReadAck(session.id, lastMsg.server_ts);
    }
  }, [session, messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !session) return;

    setSending(true);
    try {
      // Chiffrement E2E - le ciphertext est opaque côté serveur.
      // En production, utiliser libsignal ou libsodium pour chiffrer.
      // Ici le texte est wrappé en JSON comme placeholder (à remplacer).
      const ciphertext = JSON.stringify({ text });
      supportWs.sendMessage({
        sessionId:  session.id,
        ciphertext,
        type:       'text',
        clientTs:   Date.now(),
      });
      setInput('');

      // Message optimiste local
      setMessages(prev => [...prev, {
        id:          `local_${Date.now()}`,
        sender_id:   user.id,
        sender_type: 'user',
        ciphertext,
        type:        'text',
        status:      'sending',
        client_ts:   Date.now(),
        server_ts:   null,
        _local:      true,
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Décoder le texte depuis le ciphertext (placeholder E2E)
  const decodeText = (ciphertext) => {
    try {
      const obj = JSON.parse(ciphertext);
      return obj.text || ciphertext;
    } catch { return ciphertext; }
  };

  const renderMessage = (msg) => {
    const isMine = msg.sender_type === 'user';

    // Message système
    if (msg.type === 'system') {
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: '#F8F9FA',
            border: '1px solid #E0E0E0',
            fontSize: 12,
            color: '#5F6368',
          }}>
            {decodeText(msg.ciphertext)}
          </span>
        </div>
      );
    }

    // Invitation vidéo
    if (msg.type === 'video_invite') {
      let invite;
      try { invite = JSON.parse(msg.ciphertext); } catch { invite = {}; }
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '12px 0' }}>
          <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            background: '#E8F0FE',
            border: '1px solid #1A73E8',
            maxWidth: 300,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1A73E8', fontWeight: 600, fontSize: 14 }}>
              <VideoIcon /> Invitation vidéoconférence
            </div>
            <a
              href={`/videoconference/${invite.roomId}`}
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                background: '#1A73E8',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Rejoindre la vidéoconférence
            </a>
          </div>
        </div>
      );
    }

    // Message texte normal
    return (
      <div key={msg.id} style={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}>
        <div style={{
          maxWidth: '70%',
          padding: '8px 12px',
          background: isMine ? '#1A73E8' : '#F1F3F4',
          color: isMine ? '#fff' : '#202124',
          fontSize: 14,
          lineHeight: 1.5,
          position: 'relative',
        }}>
          {decodeText(msg.ciphertext)}
          {/* Statut livraison */}
          {isMine && (
            <span style={{
              display: 'block',
              textAlign: 'right',
              fontSize: 11,
              marginTop: 2,
              color: msg._local ? '#9AA0A6' : (STATUS_COLORS[msg.status] || '#9AA0A6'),
            }}>
              {msg._local ? '…' : STATUS_LABELS[msg.status] || ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 400 }}>
      {/* Zone messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 8px',
        border: '1px solid #E0E0E0',
        background: '#fff',
        marginBottom: 8,
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9AA0A6', fontSize: 14, paddingTop: 40 }}>
            Démarrez la conversation en envoyant un message.
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrivez votre message…"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 12px',
            border: '1px solid #E0E0E0',
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            outline: 'none',
            background: '#fff',
          }}
          disabled={session?.status === 'resolved'}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || session?.status === 'resolved'}
          style={{
            padding: '0 16px',
            background: '#1A73E8',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: (!input.trim() || sending) ? 0.5 : 1,
          }}
          aria-label="Envoyer"
        >
          <SendIcon />
        </button>
      </form>

      {session?.status === 'resolved' && (
        <p style={{ fontSize: 12, color: '#5F6368', textAlign: 'center', marginTop: 8 }}>
          Cette session est résolue. Rechargez la page pour ouvrir une nouvelle session.
        </p>
      )}
    </div>
  );
}
