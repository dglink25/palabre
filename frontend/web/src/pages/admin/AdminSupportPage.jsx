/**
 * AdminSupportPage — Dashboard service client pour le super-admin
 * Route : /admin/support
 * Panneau gauche : sessions actives + file d'attente + appels en hold
 * Panneau droit  : chat + contrôles appel + lancement vidéo
 */
import { useState, useEffect, useCallback } from 'react';
import { supportApi, supportWs } from '../../lib/supportApi';

// ── Icônes ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  chat:    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  phone:   'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  phoneOff:['M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.32-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96', 'M1 1l22 22'],
  pause:   ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  play:    'M5 3l14 9-14 9V3z',
  video:   ['M23 7 16 12 23 17 23 7', 'M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1'],
  check:   'M20 6L9 17l-5-5',
  send:    ['M22 2L11 13', 'M22 2L15 22 11 13 2 9 22 2'],
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  search:  ['M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
  user:    ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    open:    { bg: '#E8F0FE', color: '#1A73E8', label: 'Ouvert' },
    resolved:{ bg: '#E6F4EA', color: '#34A853', label: 'Résolu' },
    active:  { bg: '#E6F4EA', color: '#34A853', label: 'Actif' },
    queued:  { bg: '#FFF8E1', color: '#FBBC05', label: 'En file' },
    hold:    { bg: '#FFF3E0', color: '#FF6D00', label: 'En attente' },
  }[status] || { bg: '#F1F3F4', color: '#5F6368', label: status };

  return (
    <span style={{ padding: '2px 8px', background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
}

// ── Durée depuis une date ─────────────────────────────────────────────────────
function elapsed(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

// ── Décodeur ciphertext (placeholder E2E) ────────────────────────────────────
function decode(ciphertext) {
  try { return JSON.parse(ciphertext)?.text || ciphertext; }
  catch { return ciphertext; }
}

export default function AdminSupportPage() {
  const [sessions, setSessions]     = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [holdCalls, setHoldCalls]   = useState([]);
  const [selected, setSelected]     = useState(null); // session sélectionnée
  const [messages, setMessages]     = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState(null);
  // Historique
  const [historyTab, setHistoryTab] = useState(false);
  const [history, setHistory]       = useState([]);
  const [histSearch, setHistSearch] = useState({ userId: '', fromDate: '', toDate: '', channel: '' });

  // ── Chargement initial ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supportApi.admin.getSessions();
      setSessions(data.sessions || []);
      setQueueStatus(data.queueStatus || null);
      setHoldCalls(data.holdCalls || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    supportWs.connect();

    const offNew    = supportWs.on('support:call:incoming', () => load());
    const offMsg    = supportWs.on('support:message:new',   (msg) => {
      setMessages(prev => {
        if (selected && msg.session_id === selected.id) return [...prev, msg];
        return prev;
      });
      // Rafraîchir la liste si la session n'est pas sélectionnée
      load();
    });
    const offQ      = supportWs.on('support:queue:update', () => load());
    const offEnd    = supportWs.on('support:call:ended',   () => { load(); setActiveCall(null); });
    const offAns    = supportWs.on('support:call:answered', (p) => {
      setActiveCall(c => c ? { ...c, status: 'active' } : c);
    });
    const offHold   = supportWs.on('support:call:hold',    (p) => {
      setActiveCall(c => c ? { ...c, status: 'hold' } : c);
      load();
    });
    const offResume = supportWs.on('support:call:resumed', (p) => {
      setActiveCall(c => c ? { ...c, status: 'active' } : c);
    });

    return () => {
      offNew(); offMsg(); offQ(); offEnd(); offAns(); offHold(); offResume();
      supportWs.disconnect();
    };
  }, [load]);

  // ── Sélectionner une session ──────────────────────────────────────────────
  const selectSession = async (session) => {
    setSelected(session);
    setMessages([]);
    setActiveCall(null);
    try {
      const data = await supportApi.admin.getSession(session.id);
      setMessages(data.messages || []);
      setActiveCall(data.activeCall || null);
    } catch (e) { setError(e.message); }
  };

  // ── Actions appel ─────────────────────────────────────────────────────────
  const doCallAction = async (action, callId) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      let result;
      if (action === 'answer') result = await supportApi.admin.answerCall(selected.id, callId);
      if (action === 'hold')   result = await supportApi.admin.holdCall(selected.id, callId);
      if (action === 'resume') result = await supportApi.admin.resumeCall(selected.id, callId);
      if (action === 'hangup') { result = await supportApi.admin.hangup(selected.id, callId); setActiveCall(null); return; }
      if (result) setActiveCall(c => c ? { ...c, status: result.status } : c);
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  // ── Lancer vidéo ──────────────────────────────────────────────────────────
  const startVideo = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const data = await supportApi.admin.startVideo(selected.id);
      setMessages(prev => [...prev, data.message]);
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  // ── Résoudre session ──────────────────────────────────────────────────────
  const resolveSession = async () => {
    if (!selected) return;
    if (!window.confirm('Marquer cette session comme résolue ?')) return;
    setActionLoading(true);
    try {
      await supportApi.admin.resolve(selected.id);
      setSelected(s => s ? { ...s, status: 'resolved' } : s);
      load();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  // ── Envoyer un message ────────────────────────────────────────────────────
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !selected) return;
    const ciphertext = JSON.stringify({ text });
    supportWs.sendMessage({ sessionId: selected.id, ciphertext, type: 'text', clientTs: Date.now() });
    setMessages(prev => [...prev, {
      id: `local_${Date.now()}`, session_id: selected.id,
      sender_type: 'super_admin', ciphertext, type: 'text', status: 'sending',
      client_ts: Date.now(), _local: true,
    }]);
    setInput('');
  };

  // ── Historique ────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    try {
      const params = {};
      if (histSearch.userId)   params.userId   = histSearch.userId;
      if (histSearch.fromDate) params.fromDate = histSearch.fromDate;
      if (histSearch.toDate)   params.toDate   = histSearch.toDate;
      if (histSearch.channel)  params.channel  = histSearch.channel;
      const data = await supportApi.admin.getHistory(params);
      setHistory(data.history || []);
    } catch (e) { setError(e.message); }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Service client</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {queueStatus && (
            <span style={{ fontSize: 13, color: '#5F6368' }}>
              File : <strong>{queueStatus.queueLength}</strong> — Hold : <strong>{holdCalls.length}</strong>
              {queueStatus.adminOnline
                ? <span style={{ marginLeft: 8, color: '#34A853', fontWeight: 600 }}>● En ligne</span>
                : <span style={{ marginLeft: 8, color: '#EA4335', fontWeight: 600 }}>● Hors ligne</span>}
            </span>
          )}
          <button onClick={() => { setHistoryTab(v => !v); if (!historyTab) loadHistory(); }}
            style={{ padding: '6px 14px', border: '1px solid #E0E0E0', background: historyTab ? '#E8F0FE' : '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
            {historyTab ? 'Sessions actives' : 'Historique'}
          </button>
          <button onClick={load} title="Rafraîchir" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#5F6368' }}>
            <Ico d={ICONS.refresh} size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 24px', background: '#FDE8E8', borderBottom: '1px solid #EA4335', fontSize: 13, color: '#EA4335' }}>
          {error} <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: 8, color: '#EA4335', fontWeight: 700 }}>×</button>
        </div>
      )}

      {historyTab ? (
        /* ── Onglet Historique ── */
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input placeholder="ID utilisateur" value={histSearch.userId}
              onChange={e => setHistSearch(s => ({ ...s, userId: e.target.value }))}
              style={inputStyle} />
            <input type="date" value={histSearch.fromDate}
              onChange={e => setHistSearch(s => ({ ...s, fromDate: e.target.value }))}
              style={inputStyle} />
            <input type="date" value={histSearch.toDate}
              onChange={e => setHistSearch(s => ({ ...s, toDate: e.target.value }))}
              style={inputStyle} />
            <select value={histSearch.channel}
              onChange={e => setHistSearch(s => ({ ...s, channel: e.target.value }))}
              style={inputStyle}>
              <option value="">Tous les canaux</option>
              <option value="chat">Chat</option>
              <option value="call">Appel</option>
              <option value="video">Vidéo</option>
            </select>
            <button onClick={loadHistory} style={btnStyle('#1A73E8')}>
              <Ico d={ICONS.search} size={14} /> Rechercher
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E0E0E0' }}>
                {['Utilisateur', 'Canal', 'Statut', 'Créé le', 'Résolu le'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#5F6368' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F1F3F4' }}>
                  <td style={{ padding: '8px 12px' }}>{s.user_name || s.user_id}</td>
                  <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{s.channel}</td>
                  <td style={{ padding: '8px 12px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '8px 12px', color: '#5F6368' }}>{new Date(s.created_at).toLocaleDateString('fr')}</td>
                  <td style={{ padding: '8px 12px', color: '#5F6368' }}>{s.resolved_at ? new Date(s.resolved_at).toLocaleDateString('fr') : '—'}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9AA0A6' }}>Aucune session dans l'historique</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Sessions actives ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Panneau gauche — liste des sessions */}
          <aside style={{ width: 300, borderRight: '1px solid #E0E0E0', overflowY: 'auto', flexShrink: 0 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9AA0A6', fontSize: 13 }}>Chargement…</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9AA0A6', fontSize: 13 }}>Aucune session active</div>
            ) : sessions.map(s => (
              <button key={s.id} onClick={() => selectSession(s)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '12px 16px', border: 'none', borderBottom: '1px solid #F1F3F4',
                  background: selected?.id === s.id ? '#E8F0FE' : '#fff',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#202124' }}>{s.user_name || 'Utilisateur'}</span>
                  {s.call_status && <StatusBadge status={s.call_status} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#5F6368', textTransform: 'capitalize' }}>{s.channel}</span>
                  <span style={{ fontSize: 11, color: '#9AA0A6' }}>{elapsed(s.created_at)}</span>
                </div>
                {s.queue_position && (
                  <div style={{ fontSize: 11, color: '#FBBC05', marginTop: 2 }}>File #{s.queue_position}</div>
                )}
              </button>
            ))}
          </aside>

          {/* Panneau droit — chat + contrôles */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA0A6', fontSize: 14 }}>
                Sélectionnez une session pour commencer
              </div>
            ) : (
              <>
                {/* En-tête session */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{selected.user_name || 'Utilisateur'}</span>
                    <StatusBadge status={selected.status} />
                    {activeCall && <StatusBadge status={activeCall.status} />}
                  </div>

                  {/* Contrôles appel + vidéo */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Décrocher si en file */}
                    {activeCall && activeCall.status === 'queued' && (
                      <button onClick={() => doCallAction('answer', activeCall.id)} disabled={actionLoading}
                        style={btnStyle('#34A853')} title="Décrocher">
                        <Ico d={ICONS.phone} size={14} /> Décrocher
                      </button>
                    )}
                    {/* Hold si actif */}
                    {activeCall && activeCall.status === 'active' && (
                      <button onClick={() => doCallAction('hold', activeCall.id)} disabled={actionLoading}
                        style={btnStyle('#FF6D00')} title="Mettre en attente">
                        <Ico d={ICONS.pause} size={14} /> Attente
                      </button>
                    )}
                    {/* Reprendre si en hold */}
                    {activeCall && activeCall.status === 'hold' && (
                      <button onClick={() => doCallAction('resume', activeCall.id)} disabled={actionLoading}
                        style={btnStyle('#1A73E8')} title="Reprendre">
                        <Ico d={ICONS.play} size={14} /> Reprendre
                      </button>
                    )}
                    {/* Raccrocher si actif/hold */}
                    {activeCall && ['active', 'hold'].includes(activeCall.status) && (
                      <button onClick={() => doCallAction('hangup', activeCall.id)} disabled={actionLoading}
                        style={btnStyle('#EA4335')} title="Raccrocher">
                        <Ico d={ICONS.phoneOff} size={14} /> Raccrocher
                      </button>
                    )}
                    {/* Lancer vidéo */}
                    {selected.status === 'open' && (
                      <button onClick={startVideo} disabled={actionLoading}
                        style={btnStyle('#1A73E8')} title="Lancer une vidéoconférence">
                        <Ico d={ICONS.video} size={14} /> Vidéo
                      </button>
                    )}
                    {/* Résoudre */}
                    {selected.status === 'open' && (
                      <button onClick={resolveSession} disabled={actionLoading}
                        style={btnStyle('#34A853')} title="Marquer comme résolu">
                        <Ico d={ICONS.check} size={14} /> Résolu
                      </button>
                    )}
                  </div>
                </div>

                {/* Zone messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#FAFAFA' }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9AA0A6', fontSize: 13, paddingTop: 40 }}>Aucun message</div>
                  ) : messages.map(msg => {
                    if (msg.type === 'system') return (
                      <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', background: '#F1F3F4', fontSize: 12, color: '#5F6368' }}>
                          {decode(msg.ciphertext)}
                        </span>
                      </div>
                    );
                    if (msg.type === 'video_invite') return (
                      <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                        <span style={{ display: 'inline-block', padding: '6px 14px', background: '#E8F0FE', border: '1px solid #1A73E8', fontSize: 12, color: '#1A73E8', fontWeight: 600 }}>
                          📹 Invitation vidéoconférence envoyée
                        </span>
                      </div>
                    );
                    const isAdmin = msg.sender_type === 'super_admin';
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                        <div style={{
                          maxWidth: '70%', padding: '8px 12px',
                          background: isAdmin ? '#1A73E8' : '#fff',
                          border: isAdmin ? 'none' : '1px solid #E0E0E0',
                          color: isAdmin ? '#fff' : '#202124',
                          fontSize: 13, lineHeight: 1.5,
                        }}>
                          {decode(msg.ciphertext)}
                          <span style={{ display: 'block', fontSize: 10, marginTop: 2, textAlign: 'right', color: isAdmin ? 'rgba(255,255,255,0.7)' : '#9AA0A6' }}>
                            {msg._local ? '…' : msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Zone saisie admin */}
                {selected.status === 'open' && (
                  <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, padding: '8px 16px', borderTop: '1px solid #E0E0E0' }}>
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Répondre au client…"
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #E0E0E0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }}
                    />
                    <button type="submit" disabled={!input.trim()} style={{ ...btnStyle('#1A73E8'), opacity: !input.trim() ? 0.5 : 1 }}>
                      <Ico d={ICONS.send} size={14} /> Envoyer
                    </button>
                  </form>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// ── Styles helpers ────────────────────────────────────────────────────────────
const inputStyle = {
  padding: '6px 10px',
  border: '1px solid #E0E0E0',
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  outline: 'none',
  minWidth: 140,
};

function btnStyle(bg) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    background: bg,
    color: '#fff',
    border: 'none',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  };
}
