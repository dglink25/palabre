/**
 * SupportPage - Page principale du service client (/support)
 *
 * Flux :
 *   1. Ouverture → onglet Messagerie actif par défaut
 *   2. L'agent IA accueille l'utilisateur avec le menu IVR
 *   3. L'utilisateur choisit une option → l'agent répond via RAG
 *   4. L'utilisateur tape 8 (ou l'agent suggère le transfert) → onglet Appel activé
 *   5. L'onglet Appel tente de joindre le super-admin humain
 *
 * L'agent AI est TOUJOURS le premier point de contact.
 * Le super-admin humain n'est sollicité qu'en option 8 ou sur demande explicite.
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supportApi, supportWs } from '../../lib/supportApi';
import SupportChatPanel from './SupportChatPanel';
import SupportCallPanel from './SupportCallPanel';

const TAB_CHAT = 'chat';
const TAB_CALL = 'call';

export default function SupportPage() {
  const { user }                = useAuth();
  const [tab, setTab]           = useState(TAB_CHAT); // chat par défaut - l'AI répond en premier
  const [session, setSession]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeCall, setActiveCall]   = useState(null);
  const [queuePos, setQueuePos]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const wsRef                   = useRef(false);

  useEffect(() => {
    if (!user) return;
    loadSession();

    // Ne connecter le WS qu'une seule fois
    if (!wsRef.current) {
      supportWs.connect();
      wsRef.current = true;
    }

    const offMsg    = supportWs.on('support:message:new', (msg) =>
      setMessages(prev => [...prev, msg])
    );
    const offAns    = supportWs.on('support:call:answered',  () =>
      setActiveCall(c => c ? { ...c, status: 'active' } : null)
    );
    const offHold   = supportWs.on('support:call:hold',      () =>
      setActiveCall(c => c ? { ...c, status: 'hold' } : null)
    );
    const offResume = supportWs.on('support:call:resumed',   () =>
      setActiveCall(c => c ? { ...c, status: 'active' } : null)
    );
    const offEnd    = supportWs.on('support:call:ended',     () => {
      setActiveCall(null);
      setQueuePos(null);
    });
    const offQ      = supportWs.on('support:queue:update',   (p) =>
      setQueuePos(p?.position ?? null)
    );
    const offVid    = supportWs.on('support:video:invite',   (p) =>
      setMessages(prev => [...prev, p.message])
    );
    const offRes    = supportWs.on('support:session:resolved', () =>
      setSession(s => s ? { ...s, status: 'resolved' } : s)
    );

    return () => {
      offMsg(); offAns(); offHold(); offResume();
      offEnd(); offQ(); offVid(); offRes();
      supportWs.disconnect();
      wsRef.current = false;
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

  // Callback appelé par SupportChatPanel quand l'utilisateur choisit
  // l'option 8 (parler à un conseiller) dans le menu IVR
  function handleTransferToAgent() {
    setTab(TAB_CALL);
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
        <button className="btn btn-primary" onClick={loadSession} style={{ marginTop: 12 }}>
          Reessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

      {/* En-tete */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#202124' }}>
          Service client
        </h1>
        <p style={{ color: '#5F6368', fontSize: 14, margin: '4px 0 0' }}>
          Notre assistant vous repond immediatement. Tapez 8 pour parler a un conseiller.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E0E0E0', marginBottom: 24 }}>
        {[
          { id: TAB_CHAT, label: 'Messagerie' },
          { id: TAB_CALL, label: 'Appel avec un conseiller' },
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
          onTransferToAgent={handleTransferToAgent}
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
