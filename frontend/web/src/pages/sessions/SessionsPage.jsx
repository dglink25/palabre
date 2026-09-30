import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';

// SVG icons
const MonitorIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);
const SmartphoneIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);
const LogOutIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const RefreshIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);

function getDeviceIcon(platform) {
  const p = (platform || '').toLowerCase();
  if (p.includes('android') || p.includes('ios') || p.includes('mobile') || p.includes('phone')) {
    return <SmartphoneIcon />;
  }
  return <MonitorIcon />;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      setSessions(await api.get('/sessions'));
    } catch (e) { setError(friendlyMessage(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function revoke(id) {
    setError(''); setNotice('');
    try {
      await api.delete(`/sessions/${id}`);
      setNotice('Session déconnectée.');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  async function revokeOthers() {
    setError(''); setNotice('');
    try {
      await api.delete('/sessions/others');
      setNotice('Tous les autres appareils ont été déconnectés.');
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'slideUp 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px 0', color: '#202124' }}>Sessions &amp; appareils</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5F6368' }}>
            {sessions.length} appareil{sessions.length !== 1 ? 's' : ''} connecté{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshIcon />
          Actualiser
        </button>
      </div>

      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : (
        <>
          {/* Sessions list */}
          <div style={{ background: '#fff', border: '1px solid #E0E0E0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            {sessions.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#5F6368', fontSize: 14 }}>
                Aucune session active.
              </div>
            )}
            {sessions.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 20px',
                  borderBottom: idx < sessions.length - 1 ? '1px solid #E0E0E0' : 'none',
                  background: s.isCurrent ? 'rgba(26,115,232,0.03)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!s.isCurrent) e.currentTarget.style.background = '#F8F9FA'; }}
                onMouseLeave={e => { e.currentTarget.style.background = s.isCurrent ? 'rgba(26,115,232,0.03)' : 'transparent'; }}
              >
                {/* Device icon */}
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: s.isOnline ? 'rgba(52,168,83,0.1)' : '#F8F9FA',
                  border: `1px solid ${s.isOnline ? 'rgba(52,168,83,0.2)' : '#E0E0E0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: s.isOnline ? '#34A853' : '#5F6368',
                }}>
                  {getDeviceIcon(s.platform)}
                </div>

                {/* Device info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#202124' }}>
                      {s.platform || 'Appareil'}{s.model ? ` — ${s.model}` : ''}
                    </span>
                    {s.isCurrent && <Badge variant="primary">Cet appareil</Badge>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Online indicator */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: s.isOnline ? '#34A853' : '#E0E0E0',
                        display: 'inline-block',
                        ...(s.isOnline ? { boxShadow: '0 0 0 2px rgba(52,168,83,0.2)' } : {}),
                      }} />
                      <span style={{ color: s.isOnline ? '#34A853' : '#5F6368', fontWeight: 500 }}>
                        {s.isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </span>
                    <span style={{ color: '#E0E0E0' }}>·</span>
                    <span style={{ fontSize: 12, color: '#5F6368' }}>
                      Dernière activité : {new Date(s.last_active_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Revoke button */}
                {!s.isCurrent && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => revoke(s.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                  >
                    <LogOutIcon />
                    Déconnecter
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Revoke all others */}
          {sessions.length > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: '#fff',
              border: '1px solid #E0E0E0',
              borderRadius: 8,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#202124' }}>Déconnecter tous les autres appareils</div>
                <div style={{ fontSize: 13, color: '#5F6368' }}>
                  Conserve uniquement votre session actuelle
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={revokeOthers}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <LogOutIcon />
                Tout déconnecter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
