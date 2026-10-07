/**
 * SupportChatPanel - Panneau de messagerie du service client avec agent IA
 *
 * Flux IVR intégré au chat :
 *   1. Ouverture → agent accueille, présente le menu (options 1-4, 8, 0)
 *   2. L'utilisateur saisit un chiffre → agent confirme le contexte choisi
 *   3. L'utilisateur pose sa question → agent répond via RAG ciblé
 *   4. Si l'agent ne trouve pas → propose le transfert (option 8)
 *   5. Option 8 → message humain envoyé via WebSocket au super-admin
 *   6. Option 0 → session annulée proprement
 *   7. Toute saisie en contexte actif est traitée comme une question de suivi
 *      (le contexte conversationnel est maintenu par le service AI via conversation_id)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { supportWs } from '../../lib/supportApi';
import { ivrApi } from '../../lib/aiApi';

// ── Icônes ────────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const VideoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_LABELS = { sent: '✓', delivered: '✓✓', read: '✓✓' };
const STATUS_COLORS = { sent: '#9AA0A6', delivered: '#9AA0A6', read: '#1A73E8' };

// ── Décodeur ciphertext (placeholder E2E) ─────────────────────────────────────
function decodeText(ciphertext) {
  try {
    const obj = JSON.parse(ciphertext);
    return obj.text || ciphertext;
  } catch { return ciphertext; }
}

// ── Message système affiché localement (non persisté) ────────────────────────
let _localMsgId = 0;
function localMsg(text, type = 'agent') {
  return {
    id:          `local_${++_localMsgId}`,
    sender_type: type,
    ciphertext:  JSON.stringify({ text }),
    type:        'text',
    status:      'delivered',
    client_ts:   Date.now(),
    server_ts:   null,
    _local:      true,
    _agent:      type === 'agent',
  };
}

// ── Composant bouton option IVR ───────────────────────────────────────────────
function OptionButton({ opt, onClick }) {
  return (
    <button
      onClick={() => onClick(opt.key)}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         8,
        padding:     '7px 14px',
        border:      '1px solid #DADCE0',
        background:  '#fff',
        fontFamily:  'Inter, sans-serif',
        fontSize:    13,
        color:       '#202124',
        cursor:      'pointer',
        textAlign:   'left',
        transition:  'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#F8F9FA'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      <span style={{
        minWidth:    22,
        height:      22,
        background:  '#1F3A5F',
        color:       '#fff',
        fontSize:    12,
        fontWeight:  700,
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        flexShrink:  0,
      }}>
        {opt.key}
      </span>
      {opt.label}
    </button>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────
export default function SupportChatPanel({ session, messages, setMessages, user }) {
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  // État IVR : null | 'greeting' | 'menu' | 'context_selected' | 'chatting' | 'transfer' | 'ended'
  const [ivrState, setIvrState]       = useState(null);
  const [ivrOptions, setIvrOptions]   = useState([]);
  const [ivrContext, setIvrContext]    = useState(null); // { kbType, ivrOption, label }
  const [conversationId, setConvId]   = useState(null);
  const bottomRef                     = useRef(null);
  const inputRef                      = useRef(null);

  // Scroll automatique
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Acquitter la lecture
  useEffect(() => {
    if (!session || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.server_ts) supportWs.sendReadAck(session.id, last.server_ts);
  }, [session, messages.length]);

  // Charger le greeting IVR à l'ouverture si la session est vide
  useEffect(() => {
    if (!session || ivrState !== null) return;
    if (messages.filter(m => !m._agent).length === 0) {
      loadGreeting();
    } else {
      // Session existante avec historique : reprendre en mode chat direct
      setIvrState('chatting');
    }
  }, [session]);

  const loadGreeting = useCallback(async () => {
    setIvrState('greeting');
    setAiLoading(true);
    try {
      const data = await ivrApi.greeting(user?.id || null);
      const welcomeMsg = localMsg(data.message, 'agent');
      setMessages(prev => [...prev, welcomeMsg]);
      setIvrOptions(data.options || []);
      setIvrState('menu');
    } catch {
      setMessages(prev => [...prev, localMsg(
        'Le service client est momentanement indisponible. Vous pouvez envoyer votre message et un conseiller vous repondra.',
        'agent'
      )]);
      setIvrState('chatting');
    } finally {
      setAiLoading(false);
    }
  }, [user, setMessages]);

  // Traiter la sélection d'une option IVR (clic sur bouton ou saisie chiffre)
  const handleOptionSelect = useCallback(async (key) => {
    // Afficher le choix de l'utilisateur
    setMessages(prev => [...prev, localMsg(`Touche ${key}`, 'user_choice')]);
    setIvrOptions([]);
    setAiLoading(true);

    try {
      const result = await ivrApi.route(key);

      if (result.action === 'end_session') {
        setMessages(prev => [...prev, localMsg(result.message, 'agent')]);
        setIvrState('ended');
        return;
      }

      if (result.action === 'transfer_to_agent') {
        setMessages(prev => [...prev, localMsg(result.message, 'agent')]);
        setIvrState('transfer');
        // Envoyer un message système au super-admin via WebSocket
        if (session) {
          supportWs.sendMessage({
            sessionId:  session.id,
            ciphertext: JSON.stringify({ text: 'L\'utilisateur demande a parler a un conseiller.' }),
            type:       'system',
            clientTs:   Date.now(),
          });
        }
        return;
      }

      if (result.action === 'reprompt') {
        setMessages(prev => [...prev, localMsg(result.message, 'agent')]);
        setIvrOptions(ivrOptions);
        return;
      }

      // Option valide : afficher la confirmation et passer en mode chat
      setMessages(prev => [...prev, localMsg(result.message, 'agent')]);
      setIvrContext({
        kbType:    result.kb_type,
        ivrOption: key,
        label:     result.option?.label || '',
      });
      setIvrState('chatting');
      inputRef.current?.focus();
    } catch {
      setMessages(prev => [...prev, localMsg('Une erreur est survenue. Posez directement votre question.', 'agent')]);
      setIvrState('chatting');
    } finally {
      setAiLoading(false);
    }
  }, [session, ivrOptions, setMessages]);

  // Traiter la saisie de l'utilisateur
  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !session || sending) return;

    // Détecter si l'utilisateur saisit une touche IVR en mode menu
    if (ivrState === 'menu' && /^[0-9]$/.test(text)) {
      setInput('');
      handleOptionSelect(text);
      return;
    }

    // En mode transfert ou ended, envoyer directement au super-admin
    if (ivrState === 'transfer' || ivrState === 'ended') {
      setSending(true);
      try {
        const ciphertext = JSON.stringify({ text });
        supportWs.sendMessage({ sessionId: session.id, ciphertext, type: 'text', clientTs: Date.now() });
        setInput('');
        setMessages(prev => [...prev, {
          id: `local_${Date.now()}`, sender_id: user?.id,
          sender_type: 'user', ciphertext, type: 'text',
          status: 'sending', client_ts: Date.now(), _local: true,
        }]);
      } finally {
        setSending(false);
      }
      return;
    }

    // Mode chatting : envoyer à l'agent AI (RAG)
    setSending(true);
    const userMsgLocal = {
      id: `local_${Date.now()}`, sender_id: user?.id,
      sender_type: 'user', ciphertext: JSON.stringify({ text }),
      type: 'text', status: 'sending', client_ts: Date.now(), _local: true,
    };
    setMessages(prev => [...prev, userMsgLocal]);
    setInput('');

    setAiLoading(true);
    try {
      const result = await ivrApi.ask({
        message:        text,
        conversationId: conversationId || null,
        kbType:         ivrContext?.kbType || null,
        ivrOption:      ivrContext?.ivrOption || null,
      });

      if (result.conversation_id && !conversationId) {
        setConvId(result.conversation_id);
      }

      // Afficher la réponse de l'agent
      setMessages(prev => [...prev, localMsg(result.answer, 'agent')]);

      // Si l'agent suggère un transfert
      if (result.suggest_transfer) {
        setMessages(prev => [...prev, localMsg(
          `${result.transfer_message}\n\nVoulez-vous parler a un conseiller ? Tapez 8.`,
          'agent'
        )]);
        setIvrOptions([{ key: '8', label: 'Parler a un conseiller' }, { key: '0', label: 'Non merci' }]);
      }

      // Aussi envoyer au super-admin via WebSocket pour garder la trace
      if (session) {
        supportWs.sendMessage({
          sessionId:  session.id,
          ciphertext: JSON.stringify({ text }),
          type:       'text',
          clientTs:   Date.now(),
        });
      }
    } catch {
      setMessages(prev => [...prev, localMsg(
        'Je n\'ai pas pu traiter votre demande. Votre message a ete transmis a un conseiller.',
        'agent'
      )]);
      setIvrState('transfer');
      if (session) {
        supportWs.sendMessage({
          sessionId:  session.id,
          ciphertext: JSON.stringify({ text }),
          type:       'text',
          clientTs:   Date.now(),
        });
      }
    } finally {
      setSending(false);
      setAiLoading(false);
    }
  }, [input, session, sending, ivrState, ivrContext, conversationId, user, handleOptionSelect, setMessages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // ── Rendu d'un message ────────────────────────────────────────────────────
  const renderMessage = (msg) => {
    if (msg.type === 'system') {
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
          <span style={{ display: 'inline-block', padding: '4px 12px', background: '#F8F9FA', border: '1px solid #E0E0E0', fontSize: 12, color: '#5F6368' }}>
            {decodeText(msg.ciphertext)}
          </span>
        </div>
      );
    }

    if (msg.type === 'video_invite') {
      let invite;
      try { invite = JSON.parse(msg.ciphertext); } catch { invite = {}; }
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '12px 0' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#E8F0FE', border: '1px solid #1A73E8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1A73E8', fontWeight: 600, fontSize: 14 }}>
              <VideoIcon /> Invitation videoconference
            </div>
            <a href={`/videoconference/${invite.roomId}`}
              style={{ display: 'inline-block', padding: '8px 20px', background: '#1A73E8', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Rejoindre
            </a>
          </div>
        </div>
      );
    }

    const isAgent  = msg._agent || msg.sender_type === 'super_admin';
    const isChoice = msg.sender_type === 'user_choice';

    if (isChoice) {
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <span style={{ padding: '4px 12px', background: '#E8F0FE', border: '1px solid #1A73E8', fontSize: 13, color: '#1A73E8', fontWeight: 600 }}>
            {decodeText(msg.ciphertext)}
          </span>
        </div>
      );
    }

    return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: isAgent ? 'flex-start' : 'flex-end', marginBottom: 10, alignItems: 'flex-end', gap: 8 }}>
        {isAgent && (
          <div style={{ width: 28, height: 28, background: '#1F3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8" /><rect x="8" y="2" width="8" height="4" rx="1" />
              <path d="M3 10h18M3 14h18M3 18h18" /><rect x="2" y="8" width="20" height="14" rx="2" />
            </svg>
          </div>
        )}
        <div style={{
          maxWidth:   '72%',
          padding:    '9px 13px',
          background: isAgent ? '#F8F9FA' : '#1A73E8',
          border:     isAgent ? '1px solid #E0E0E0' : 'none',
          color:      isAgent ? '#202124' : '#fff',
          fontSize:   14,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
        }}>
          {decodeText(msg.ciphertext)}
          {!isAgent && (
            <span style={{ display: 'block', textAlign: 'right', fontSize: 10, marginTop: 3, color: msg._local ? 'rgba(255,255,255,0.5)' : (STATUS_COLORS[msg.status] ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)') }}>
              {msg._local ? '…' : STATUS_LABELS[msg.status] || ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  const isDisabled = session?.status === 'resolved' || ivrState === 'ended';
  const placeholder = ivrState === 'menu'
    ? 'Entrez le numero de l\'option ou tapez votre question…'
    : ivrState === 'transfer'
    ? 'Votre message sera lu par un conseiller…'
    : 'Posez votre question…';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '62vh', minHeight: 420 }}>

      {/* Bandeau contexte IVR sélectionné */}
      {ivrContext && ivrState === 'chatting' && (
        <div style={{ padding: '6px 12px', background: '#E8F0FE', borderBottom: '1px solid #C5D8FF', fontSize: 12, color: '#1A73E8', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Contexte : {ivrContext.label}</span>
          <button onClick={() => { setIvrContext(null); setIvrOptions([]); loadGreeting(); }}
            style={{ border: 'none', background: 'none', fontSize: 11, color: '#1A73E8', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            Changer d'option
          </button>
        </div>
      )}

      {/* Zone messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 10px', border: '1px solid #E0E0E0', background: '#fff', marginBottom: 8 }}>
        {messages.length === 0 && ivrState === null && (
          <div style={{ textAlign: 'center', color: '#9AA0A6', fontSize: 14, paddingTop: 40 }}>Chargement…</div>
        )}
        {messages.map(renderMessage)}

        {/* Indicateur de frappe agent */}
        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, background: '#1F3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="8" width="20" height="14" rx="2" />
              </svg>
            </div>
            <div style={{ padding: '8px 14px', background: '#F8F9FA', border: '1px solid #E0E0E0', fontSize: 13, color: '#9AA0A6' }}>
              En cours de traitement…
            </div>
          </div>
        )}

        {/* Boutons options IVR */}
        {ivrOptions.length > 0 && !aiLoading && (
          <div style={{ marginTop: 12, marginBottom: 4 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ivrOptions.map(opt => (
                <OptionButton key={opt.key} opt={opt} onClick={handleOptionSelect} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Zone saisie */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDisabled ? 'Session terminee.' : placeholder}
          rows={2}
          disabled={isDisabled || aiLoading}
          style={{
            flex:       1,
            resize:     'none',
            padding:    '10px 12px',
            border:     '1px solid #E0E0E0',
            fontFamily: 'Inter, sans-serif',
            fontSize:   14,
            outline:    'none',
            background: isDisabled ? '#F8F9FA' : '#fff',
            color:      '#202124',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || isDisabled || aiLoading}
          style={{
            padding:    '0 16px',
            background: '#1A73E8',
            color:      '#fff',
            border:     'none',
            cursor:     'pointer',
            display:    'flex',
            alignItems: 'center',
            opacity:    (!input.trim() || sending || isDisabled || aiLoading) ? 0.45 : 1,
          }}
          aria-label="Envoyer"
        >
          <SendIcon />
        </button>
      </form>

      {session?.status === 'resolved' && (
        <p style={{ fontSize: 12, color: '#5F6368', textAlign: 'center', marginTop: 8 }}>
          Cette session est resolue. Rechargez la page pour en ouvrir une nouvelle.
        </p>
      )}
    </div>
  );
}
