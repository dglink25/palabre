/**
 * StatsChart.jsx - Developer Portal
 *
 * Statistiques d'usage - design institutionnel.
 * Cartes métriques fond #EAF2FD / icône #1A73E8 (pas de gradient).
 * Sélecteur de période sobre, graphique barres SVG minimaliste.
 *
 * Requirements couverts : 12.1, 12.3, 12.5
 */

import { useState, useEffect, useCallback } from 'react';
import developerApi from '../api/developerApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d',    label: '7 jours'     },
  { value: '30d',   label: '30 jours'    },
  { value: '90d',   label: '90 jours'    },
];

const DEFAULT_PERIOD = '30d';

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconMessage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 24 }) {
  return (
    <span
      role="status"
      aria-label="Chargement…"
      style={{
        display:        'inline-block',
        width:          size,
        height:         size,
        border:         '2px solid #E0E0E0',
        borderTopColor: '#1A73E8',
        borderRadius:   '50%',
        animation:      'dev-spin 0.7s linear infinite',
        flexShrink:     0,
      }}
    />
  );
}

// ─── Carte métrique ───────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, loading }) {
  return (
    <div
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E0E0E0',
        borderRadius: 8,
        padding:      '16px 20px',
        display:      'flex',
        alignItems:   'center',
        gap:          14,
        flex:         '1 1 180px',
        minWidth:     0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width:           36,
          height:          36,
          borderRadius:    8,
          backgroundColor: '#EAF2FD',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          color:           color,
          flexShrink:      0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontSize:      11,
          color:         '#5F6368',
          margin:        '0 0 3px',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          fontWeight:    600,
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
        }}>
          {label}
        </p>
        {loading ? (
          <Spinner size={18} />
        ) : (
          <p style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: 0, lineHeight: 1.2 }}>
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Graphique barres SVG ─────────────────────────────────────────────────────

function BarChart({ metrics, height = 140 }) {
  const maxValue  = Math.max(...metrics.map((m) => m.value), 1);
  const barWidth  = 56;
  const barGap    = 20;
  const paddingX  = 12;
  const paddingTop = 10;
  const labelH    = 32;
  const svgWidth  = metrics.length * (barWidth + barGap) - barGap + paddingX * 2;
  const svgHeight = height + paddingTop + labelH;

  return (
    <div
      role="img"
      aria-label="Graphique en barres des métriques"
      style={{ overflowX: 'auto', width: '100%' }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ display: 'block', minWidth: svgWidth }}
        aria-hidden="true"
      >
        {/* Lignes de grille */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + height - ratio * height;
          return (
            <line
              key={ratio}
              x1={paddingX} y1={y}
              x2={svgWidth - paddingX} y2={y}
              stroke="#E0E0E0"
              strokeWidth="1"
              strokeDasharray={ratio === 0 ? undefined : '3 3'}
            />
          );
        })}

        {/* Barres */}
        {metrics.map((metric, i) => {
          const barHeight = maxValue > 0 ? (metric.value / maxValue) * height : 0;
          const x = paddingX + i * (barWidth + barGap);
          const y = paddingTop + height - barHeight;

          return (
            <g key={metric.label}>
              <rect
                x={x} y={y}
                width={barWidth}
                height={Math.max(barHeight, metric.value > 0 ? 2 : 0)}
                rx="4"
                fill={metric.color}
                opacity="0.9"
              />
              {metric.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(y - 5, paddingTop + 8)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#5F6368"
                >
                  {metric.value.toLocaleString('fr-FR')}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={paddingTop + height + 18}
                textAnchor="middle"
                fontSize="11"
                fill="#9aa0a6"
              >
                {metric.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── StatsChart ───────────────────────────────────────────────────────────────

export default function StatsChart({ projectId }) {
  const [period,  setPeriod]  = useState(DEFAULT_PERIOD);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await developerApi.get(`/projects/${projectId}/stats`, {
        params: { period },
      });
      const raw = data?.stats ?? data ?? {};
      setStats({
        messages_sent: Number(raw.messages_sent ?? 0),
        calls_made:    Number(raw.calls_made    ?? 0),
        active_users:  Number(raw.active_users  ?? 0),
        api_calls:     Number(raw.api_calls     ?? 0),
      });
    } catch {
      // req 12.5 : zéros sans message d'erreur
      setStats({ messages_sent: 0, calls_made: 0, active_users: 0, api_calls: 0 });
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const metrics = [
    { key: 'messages_sent', label: 'Messages envoyés',  shortLabel: 'Messages',    icon: <IconMessage />, color: '#1A73E8', value: stats?.messages_sent ?? 0 },
    { key: 'calls_made',    label: 'Appels effectués',  shortLabel: 'Appels',      icon: <IconPhone />,   color: '#1557b0', value: stats?.calls_made    ?? 0 },
    { key: 'active_users',  label: 'Utilisateurs actifs', shortLabel: 'Utilisateurs', icon: <IconUsers />, color: '#34A853', value: stats?.active_users  ?? 0 },
    { key: 'api_calls',     label: 'Appels API',        shortLabel: 'API',         icon: <IconCode />,    color: '#1A73E8', value: stats?.api_calls     ?? 0 },
  ];

  const selectedPeriodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  return (
    <section aria-label="Statistiques du projet">
      {/* En-tête */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            12,
        marginBottom:   20,
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: 0 }}>
            Statistiques
          </h2>
          <p style={{ fontSize: 14, color: '#5F6368', margin: '4px 0 0' }}>
            Données pour la période : <strong>{selectedPeriodLabel}</strong>
          </p>
        </div>

        {/* Sélecteur de période */}
        <fieldset
          style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}
          aria-label="Sélectionner une période"
        >
          <legend style={{ display: 'none' }}>Période</legend>
          {PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                aria-pressed={isActive}
                style={{
                  padding:      '6px 14px',
                  border:       `1px solid ${isActive ? '#1A73E8' : '#E0E0E0'}`,
                  borderRadius: 6,
                  background:   isActive ? '#1A73E8' : '#FFFFFF',
                  color:        isActive ? '#FFFFFF' : '#5F6368',
                  fontSize:     13,
                  fontWeight:   isActive ? 600 : 400,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  transition:   'all 150ms ease',
                  whiteSpace:   'nowrap',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      {/* Cartes métriques */}
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}
        role="list"
        aria-label="Résumé des métriques"
      >
        {metrics.map((metric) => (
          <div key={metric.key} role="listitem" style={{ flex: '1 1 180px', minWidth: 0 }}>
            <MetricCard
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              color={metric.color}
              loading={loading}
            />
          </div>
        ))}
      </div>

      {/* Graphique barres */}
      <div
        style={{
          background:   '#FFFFFF',
          border:       '1px solid #E0E0E0',
          borderRadius: 8,
          padding:      '20px 24px',
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#202124', margin: '0 0 16px' }}>
          Vue d'ensemble - {selectedPeriodLabel}
        </h3>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
            <Spinner size={28} />
          </div>
        ) : (
          <BarChart metrics={metrics} height={140} />
        )}

        {/* Légende */}
        <div
          style={{
            display:    'flex',
            flexWrap:   'wrap',
            gap:        16,
            marginTop:  16,
            paddingTop: 14,
            borderTop:  '1px solid #E0E0E0',
          }}
          aria-label="Légende"
        >
          {metrics.map((metric) => (
            <div
              key={metric.key}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5F6368' }}
            >
              <span
                aria-hidden="true"
                style={{
                  display:      'inline-block',
                  width:        10,
                  height:       10,
                  borderRadius: 2,
                  background:   metric.color,
                  flexShrink:   0,
                }}
              />
              {metric.label}
            </div>
          ))}
        </div>
      </div>

      {/* Note zéros req 12.5 */}
      {!loading && stats && metrics.every((m) => m.value === 0) && (
        <p
          style={{ fontSize: 13, color: '#9aa0a6', textAlign: 'center', margin: '16px 0 0' }}
          aria-live="polite"
        >
          Aucune activité enregistrée pour cette période.
        </p>
      )}
    </section>
  );
}
