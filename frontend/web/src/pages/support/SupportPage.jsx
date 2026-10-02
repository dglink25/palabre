/**
 * SupportPage - Page principale du service client (/support)
 * Tabs : Messagerie | Appel audio
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supportApi, supportWs } from '../../lib/supportApi';
import SupportChatPanel from './SupportChatPanel';
import SupportCallPanel from './SupportCallPanel';

const TAB_CHAT = 'chat';
const TAB_CALL = 'call';

export default function SupportPage() {
  const { user }              = useAuth();
  const [tab, setTab]         = useState(TAB_CHAT);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [queuePos, setQueuePos]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Charger la session au montage
  useEffect(() => {
    if (!user) return;
    loadSession();
    supportWs.connect();

    // Écoute des events WebSocket
    const offMsg  = supportWs.on('support:message:new',      (msg) => setMessages(prev => [...prev, msg]));
    const offAns  = supportWs.on('support:call:answered',    (p)   => setActiveCall(c => c ? { ...c, status: 'active' } : null));
    const offHold = supportWs.on('support:call:hold',        (p)   => setActiveCall(c => c ? { ...c, status: 'hold' } : null));
    const offResume = supportWs.on('support:call:resumed',   (p)   => setActiveCall(c => c ? { ...c, status: 'active' } : null));
    const offEnd  = supportWs.on('support:call:ended',       (p)   => setActiveCall(null));
    const offQ    = supportWs.on('support:queue:update',     (p)   => setQueuePos(p.position));
    const offVid  = supportWs.on('support:video:invite',     (p)   => {
      // Ajouter le message invite dans la liste
      setMessages(prev => [...prev, p.message]);
    });
    const offRes  = supportWs.on('support:session:resolved', () => {
      setSession(s => s ? { ...s, status: 'resolved' } : s);
    });

    return () => {
      offMsg(); offAns(); offHold(); offResume(); offEnd(); offQ(); offVid(); offRes();
      supportWs.disconnect();
    };
  }, [user]);

  async function loadSession() {
    setLoading(true);
    setError(null);
    try {
      const data = await supportApi.getMySession();
      setSession(data.session);
      setMessages(data.messages || []);
      setActiveCall(data.activeCall || null);
      setQueuePos(data.queuePosition);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={loadSession} style={{ marginTop: 12 }}>Réessayer</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#202124' }}>Service client</h1>
        <p style={{ color: '#5F6368', fontSize: 14, margin: '4px 0 0' }}>
          Contactez le support Palabre directement.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E0E0E0', marginBottom: 24 }}>
        {[
          { id: TAB_CHAT, label: 'Messagerie' },
          { id: TAB_CALL, label: 'Appel audio' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #1A73E8' : '2px solid transparent',
              background: 'transparent',
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? '#1A73E8' : '#5F6368',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === TAB_CHAT && (
        <SupportChatPanel
          session={session}
          messages={messages}
          setMessages={setMessages}
          user={user}
        />
      )}
      {tab === TAB_CALL && (
        <SupportCallPanel
          session={session}
          activeCall={activeCall}
          setActiveCall={setActiveCall}
          queuePosition={queuePos}
          setQueuePosition={setQueuePos}
          onSwitchToChat={() => setTab(TAB_CHAT)}
        />
      )}
    </div>
  );
}
