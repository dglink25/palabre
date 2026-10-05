/**
 * StatsChart.jsx - Developer Portal
 *
 * Affiche les statistiques d'usage d'un projet sous forme de graphiques en barres SVG.
 *
 * Fonctionnalités :
 *   - Sélecteur de période : today / 7d / 30d / 90d (défaut : 30d) (req 12.3)
 *   - Appel GET /projects/:id/stats?period=… à chaque changement de période
 *   - 4 métriques : messages envoyés, appels effectués, utilisateurs actifs, appels API (req 12.1)
 *   - Si aucune donnée, compteurs à zéro sans erreur ni état bloquant (req 12.5)
 *   - Graphiques barres SVG sans dépendance externe
 *
 * Requirements couverts : 12.1, 12.3, 12.5
 */

import { useState, useEffect, useCallback } from 'react';
import developerApi from '../api/developerApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d',    label: '7 jours' },
  { value: '30d',   label: '30 jours' },
  { value: '90d',   label: '90 jours' },
];

const DEFAULT_PERIOD = '30d';

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconMessage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconApi() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        display: 'inline-block',
        width: size,
        height: size,
        border: '3px solid var(--dev-color-neutral-200)',
        borderTopColor: 'var(--dev-color-brand-primary)',
        borderRadius: '50%',
        animation: 'dev-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Carte métrique ───────────────────────────────────────────────────────────

/**
 * MetricCard - affiche une métrique avec icône, label et valeur.
 */
function MetricCard({ icon, label, value, color, loading }) {
  return (
    <div
      style={{
        background: 'var(--dev-bg-surface)',
        border: '1px solid var(--dev-border-color)',
        borderRadius: 'var(--dev-border-radius-lg)',
        padding: 'var(--dev-space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--dev-space-4)',
        boxShadow: 'var(--dev-shadow-sm)',
        flex: '1 1 180px',
        minWidth: 0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--dev-border-radius-md)',
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 'var(--dev-font-size-xs)',
            color: 'var(--dev-text-muted)',
            margin: '0 0 var(--dev-space-1) 0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 'var(--dev-font-weight-medium)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </p>
        {loading ? (
          <Spinner size={20} />
        ) : (
          <p
            style={{
              fontSize: 'var(--dev-font-size-2xl)',
              fontWeight: 'var(--dev-font-weight-bold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
              lineHeight: 'var(--dev-line-height-tight)',
            }}
          >
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Graphique en barres SVG ──────────────────────────────────────────────────

/**
 * BarChart - graphique en barres SVG minimaliste, sans dépendance externe.
 *
 * @param {object}   props
 * @param {Array}    props.metrics  - tableau de { label, value, color }
 * @param {number}   [props.height] - hauteur SVG des barres (défaut 160)
 */
function BarChart({ metrics, height = 160 }) {
  const maxValue = Math.max(...metrics.map((m) => m.value), 1); // éviter division par zéro
  const barWidth  = 60;
  const barGap    = 24;
  const paddingX  = 16;
  const paddingTop = 12;
  const labelH    = 36; // espace pour les labels sous les barres
  const svgWidth  = metrics.length * (barWidth + barGap) - barGap + paddingX * 2;
  const svgHeight = height + paddingTop + labelH;

  return (
    <div
      role="img"
      aria-label="Graphique en barres des métriques du projet"
      style={{ overflowX: 'auto', width: '100%' }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ display: 'block', minWidth: svgWidth }}
        aria-hidden="true"
      >
        {/* Lignes de grille horizontales */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + height - ratio * height;
          return (
            <line
              key={ratio}
              x1={paddingX}
              y1={y}
              x2={svgWidth - paddingX}
              y2={y}
              stroke="var(--dev-color-neutral-200)"
              strokeWidth="1"
              strokeDasharray={ratio === 0 ? undefined : '4 4'}
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
              {/* Barre */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, metric.value > 0 ? 2 : 0)}
                rx="4"
                fill={metric.color}
                opacity="0.85"
              />

              {/* Valeur au-dessus de la barre */}
              {metric.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(y - 6, paddingTop + 10)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--dev-text-secondary)"
                >
                  {metric.value.toLocaleString('fr-FR')}
                </text>
              )}

              {/* Label sous la barre */}
              <text
                x={x + barWidth / 2}
                y={paddingTop + height + 20}
                textAnchor="middle"
                fontSize="11"
                fill="var(--dev-text-muted)"
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

// ─── Composant principal ──────────────────────────────────────────────────────

/**
 * StatsChart
 *
 * @param {object} props
 * @param {string} props.projectId - ID du projet dont on affiche les statistiques
 */
export default function StatsChart({ projectId }) {
  const [period, setPeriod]   = useState(DEFAULT_PERIOD);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch des statistiques ────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await developerApi.get(`/projects/${projectId}/stats`, {
        params: { period },
      });
      // L'API peut retourner les stats directement ou sous une clé "stats"
      const raw = data?.stats ?? data ?? {};
      setStats({
        messages_sent: Number(raw.messages_sent ?? 0),
        calls_made:    Number(raw.calls_made    ?? 0),
        active_users:  Number(raw.active_users  ?? 0),
        api_calls:     Number(raw.api_calls     ?? 0),
      });
    } catch {
      // Req 12.5 : si erreur ou aucune donnée → compteurs à zéro, sans message d'erreur
      setStats({
        messages_sent: 0,
        calls_made:    0,
        active_users:  0,
        api_calls:     0,
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Données des métriques ─────────────────────────────────────────────────────

  const metrics = [
    {
      key:        'messages_sent',
      label:      'Messages envoyés',
      shortLabel: 'Messages',
      icon:       <IconMessage />,
      color:      'var(--dev-color-brand-primary)',
      value:      stats?.messages_sent ?? 0,
    },
    {
      key:        'calls_made',
      label:      'Appels effectués',
      shortLabel: 'Appels',
      icon:       <IconPhone />,
      color:      'var(--dev-color-brand-secondary)',
      value:      stats?.calls_made ?? 0,
    },
    {
      key:        'active_users',
      label:      'Utilisateurs actifs',
      shortLabel: 'Utilisateurs',
      icon:       <IconUsers />,
      color:      'var(--dev-color-success)',
      value:      stats?.active_users ?? 0,
    },
    {
      key:        'api_calls',
      label:      'Appels API',
      shortLabel: 'API',
      icon:       <IconApi />,
      color:      'var(--dev-color-info)',
      value:      stats?.api_calls ?? 0,
    },
  ];

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const selectedPeriodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  return (
    <section
      aria-label="Statistiques du projet"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--dev-space-6)',
      }}
    >
      {/* ── En-tête + sélecteur de période ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--dev-space-3)',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--dev-font-size-xl)',
              fontWeight: 'var(--dev-font-weight-bold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            Statistiques
          </h2>
          <p
            style={{
              fontSize: 'var(--dev-font-size-sm)',
              color: 'var(--dev-text-secondary)',
              margin: 'var(--dev-space-1) 0 0 0',
            }}
          >
            Données pour la période : <strong>{selectedPeriodLabel}</strong>
          </p>
        </div>

        {/* Sélecteur de période */}
        <fieldset
          style={{
            border: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            gap: 'var(--dev-space-2)',
            flexWrap: 'wrap',
          }}
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
                  padding: 'var(--dev-space-2) var(--dev-space-4)',
                  border: `1px solid ${isActive ? 'var(--dev-color-brand-primary)' : 'var(--dev-border-color)'}`,
                  borderRadius: 'var(--dev-border-radius-full)',
                  background: isActive
                    ? 'var(--dev-color-brand-primary)'
                    : 'var(--dev-bg-surface)',
                  color: isActive
                    ? 'var(--dev-color-white)'
                    : 'var(--dev-text-secondary)',
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: isActive
                    ? 'var(--dev-font-weight-semibold)'
                    : 'var(--dev-font-weight-normal)',
                  cursor: 'pointer',
                  transition: 'background var(--dev-transition-fast), color var(--dev-transition-fast), border-color var(--dev-transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      {/* ── Cartes métriques ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--dev-space-4)',
        }}
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

      {/* ── Graphique en barres ────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--dev-bg-surface)',
          border: '1px solid var(--dev-border-color)',
          borderRadius: 'var(--dev-border-radius-lg)',
          padding: 'var(--dev-space-6)',
          boxShadow: 'var(--dev-shadow-sm)',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--dev-font-size-base)',
            fontWeight: 'var(--dev-font-weight-semibold)',
            color: 'var(--dev-text-primary)',
            margin: '0 0 var(--dev-space-5) 0',
          }}
        >
          Vue d'ensemble - {selectedPeriodLabel}
        </h3>

        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
            }}
          >
            <Spinner size={36} />
          </div>
        ) : (
          <BarChart metrics={metrics} height={160} />
        )}

        {/* Légende */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--dev-space-4)',
            marginTop: 'var(--dev-space-5)',
            paddingTop: 'var(--dev-space-4)',
            borderTop: '1px solid var(--dev-border-color)',
          }}
          aria-label="Légende du graphique"
        >
          {metrics.map((metric) => (
            <div
              key={metric.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dev-space-2)',
                fontSize: 'var(--dev-font-size-xs)',
                color: 'var(--dev-text-secondary)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 'var(--dev-border-radius-sm)',
                  background: metric.color,
                  flexShrink: 0,
                }}
              />
              {metric.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Note : zéros sans message d'erreur (req 12.5) ─────────────────────── */}
      {!loading && stats && metrics.every((m) => m.value === 0) && (
        <p
          style={{
            fontSize: 'var(--dev-font-size-sm)',
            color: 'var(--dev-text-muted)',
            textAlign: 'center',
            margin: 0,
          }}
          aria-live="polite"
        >
          Aucune activité enregistrée pour cette période.
        </p>
      )}
    </section>
  );
}
