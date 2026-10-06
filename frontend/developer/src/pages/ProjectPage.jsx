/**
 * ProjectPage.jsx - Developer Portal
 *
 * Page de détail d'un projet - design institutionnel Stripe/Twilio/AWS.
 * En-tête sans gradient, icône fond #EAF2FD/#1A73E8.
 * Onglets de navigation standard avec border-bottom actif.
 * Breadcrumb sobre.
 *
 * Requirements couverts : 3.2, 3.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import developerApi from '../api/developerApi';

// ─── Composants de chaque onglet (lazy) ──────────────────────────────────────

const ApiKeyDisplay      = React.lazy(() => import('../components/ApiKeyDisplay.jsx'));
const WhiteLabelConfig   = React.lazy(() => import('../components/WhiteLabelConfig.jsx'));
const StatsChart         = React.lazy(() => import('../components/StatsChart.jsx'));
const WebhooksPageTab    = React.lazy(() => import('./WebhooksPage.jsx'));
const DocumentationPageTab = React.lazy(() => import('./DocumentationPage.jsx'));

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'api-keys',  label: 'Clés API'      },
  { key: 'config',    label: 'Configuration' },
  { key: 'webhooks',  label: 'Webhooks'      },
  { key: 'stats',     label: 'Statistiques'  },
  { key: 'docs',      label: 'Documentation' },
];

const DEFAULT_TAB = 'api-keys';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  }).format(new Date(isoString));
}

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconChevronRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

// ─── Badge statut ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const config = {
    active:   { label: 'Actif',    bg: 'rgba(52,168,83,.12)',  color: '#34A853' },
    inactive: { label: 'Inactif',  bg: 'rgba(251,188,5,.12)',  color: '#8a6700' },
    deleted:  { label: 'Supprimé', bg: 'rgba(234,67,53,.12)',  color: '#EA4335' },
  };
  const cfg = config[status] ?? config.inactive;
  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        padding:       '2px 8px',
        borderRadius:  4,
        background:    cfg.bg,
        color:         cfg.color,
        fontSize:      12,
        fontWeight:    600,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        whiteSpace:    'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Contenu onglet ───────────────────────────────────────────────────────────

function TabContent({ tab, projectId, project }) {
  switch (tab) {
    case 'api-keys': return <ApiKeyDisplay projectId={projectId} project={project} />;
    case 'config':   return <WhiteLabelConfig projectId={projectId} project={project} />;
    case 'webhooks': return <WebhooksPageTab />;
    case 'stats':    return <StatsChart projectId={projectId} />;
    case 'docs':     return <DocumentationPageTab projectId={projectId} project={project} />;
    default:         return <ApiKeyDisplay projectId={projectId} project={project} />;
  }
}

// ─── ProjectPage ──────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { id }                          = useParams();
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const rawTab    = searchParams.get('tab') ?? DEFAULT_TAB;
  const activeTab = TABS.some((t) => t.key === rawTab) ? rawTab : DEFAULT_TAB;

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await developerApi.get(`/projects/${id}`);
      const projectData = data?.project ?? data;
      setProject(projectData);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) { navigate('/dashboard', { replace: true }); return; }
      if (status === 404) { setError('Ce projet est introuvable ou a été supprimé.'); }
      else {
        setError(
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Impossible de charger le projet. Veuillez réessayer.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  function handleTabChange(tabKey) {
    setSearchParams({ tab: tabKey }, { replace: true });
  }

  // ── Chargement ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="dev-page-loader"
        aria-label="Chargement du projet…"
        style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  // ── Erreur ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: '40px 0' }}>
        <div
          role="alert"
          style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           14,
            padding:       '40px 32px',
            background:    '#FFFFFF',
            border:        '1px solid #EA4335',
            borderRadius:  8,
            textAlign:     'center',
            maxWidth:      440,
            margin:        '0 auto',
          }}
        >
          <span style={{ color: '#EA4335' }}><IconAlertCircle /></span>
          <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>{error}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={fetchProject}
              style={{
                height:       36,
                padding:      '0 16px',
                background:   '#1A73E8',
                color:        '#FFFFFF',
                border:       'none',
                borderRadius: 8,
                fontSize:     14,
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'inherit',
              }}
            >
              Réessayer
            </button>
            <Link
              to="/dashboard"
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                height:       36,
                padding:      '0 16px',
                background:   '#FFFFFF',
                color:        '#5F6368',
                border:       '1px solid #E0E0E0',
                borderRadius: 8,
                fontSize:     14,
                fontWeight:   500,
                textDecoration: 'none',
              }}
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Rendu principal ──────────────────────────────────────────────────────────
  const projectName = project?.name ?? `Projet ${id}`;

  return (
    <div style={{ background: '#F8F9FA', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        6,
          marginBottom: 20,
          fontSize:   13,
          color:      '#9aa0a6',
        }}
      >
        <Link
          to="/dashboard"
          style={{ color: '#1A73E8', textDecoration: 'none', fontWeight: 500 }}
        >
          Tableau de bord
        </Link>
        <span aria-hidden="true"><IconChevronRight /></span>
        <span
          style={{
            color:        '#202124',
            fontWeight:   500,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            maxWidth:     260,
          }}
          aria-current="page"
        >
          {projectName}
        </span>
      </nav>

      {/* En-tête du projet */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          {/* Icône - fond plat */}
          <div
            aria-hidden="true"
            style={{
              width:           48,
              height:          48,
              borderRadius:    8,
              backgroundColor: '#EAF2FD',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              color:           '#1A73E8',
              flexShrink:      0,
              overflow:        'hidden',
            }}
          >
            {project?.logo_url ? (
              <img
                src={project.logo_url}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }}
              />
            ) : (
              <IconMonitor />
            )}
          </div>

          {/* Titre + méta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        10,
              flexWrap:   'wrap',
              marginBottom: 4,
            }}>
              <h1
                style={{
                  fontSize:     22,
                  fontWeight:   700,
                  color:        '#202124',
                  margin:       0,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  maxWidth:     480,
                }}
                title={projectName}
              >
                {projectName}
              </h1>
              <StatusBadge status={project?.status} />
            </div>

            <p style={{ fontSize: 13, color: '#5F6368', margin: 0 }}>
              {project?.description
                ? project.description
                : `Créé le ${formatDate(project?.created_at)}`}
            </p>
            {project?.description && (
              <p style={{ fontSize: 12, color: '#9aa0a6', margin: '2px 0 0' }}>
                Créé le {formatDate(project?.created_at)}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Navigation onglets */}
      <nav
        role="tablist"
        aria-label="Sections du projet"
        style={{
          display:      'flex',
          gap:          0,
          borderBottom: '1px solid #E0E0E0',
          marginBottom: 24,
          overflowX:    'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              style={{
                padding:       '10px 16px',
                background:    'none',
                border:        'none',
                borderBottom:  isActive ? '2px solid #1A73E8' : '2px solid transparent',
                marginBottom:  -1,
                fontSize:      14,
                fontWeight:    isActive ? 600 : 500,
                color:         isActive ? '#1A73E8' : '#5F6368',
                cursor:        'pointer',
                whiteSpace:    'nowrap',
                fontFamily:    'inherit',
                transition:    'color 150ms ease, border-color 150ms ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Contenu de l'onglet */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        <React.Suspense
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <Spinner size={24} />
            </div>
          }
        >
          <TabContent tab={activeTab} projectId={id} project={project} />
        </React.Suspense>
      </div>
    </div>
  );
}
