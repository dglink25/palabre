/**
 * ProjectPage.jsx - Developer Portal
 *
 * Page de détail d'un Developer_Project avec navigation par onglets.
 *
 * Fonctionnalités :
 *   1. Charge les données du projet via GET /projects/:id (req 3.2)
 *   2. Redirige vers /dashboard si l'API retourne 403 (projet appartenant
 *      à un autre compte) (req 3.5)
 *   3. Propose 5 onglets accessibles via le paramètre URL ?tab=... :
 *        - api-keys     → <ApiKeyDisplay>    (tâche 20)
 *        - config       → <WhiteLabelConfig> (tâche 21)
 *        - webhooks     → <WebhooksPage>     (tâche 23)
 *        - stats        → <StatsChart>       (tâche 22)
 *        - docs         → <DocumentationPage>(tâche 24)
 *   4. Affiche un breadcrumb Dashboard → nom du projet
 *   5. Affiche le statut et la date de création du projet
 *
 * Requirements couverts : 3.2, 3.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import developerApi from '../api/developerApi';

// ─── Composants de chaque onglet ──────────────────────────────────────────────
// Les composants de fonctionnalité complets seront implémentés dans les tâches
// 20-24. En attendant, les stubs sont chargés en lazy pour respecter l'architecture.

const ApiKeyDisplay   = React.lazy(() => import('../components/ApiKeyDisplay.jsx'));
const WhiteLabelConfig = React.lazy(() => import('../components/WhiteLabelConfig.jsx'));
const StatsChart      = React.lazy(() => import('../components/StatsChart.jsx'));
const WebhooksPageTab = React.lazy(() => import('./WebhooksPage.jsx'));
const DocumentationPageTab = React.lazy(() => import('./DocumentationPage.jsx'));

// ─── Définition des onglets ───────────────────────────────────────────────────

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

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconProject() {
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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

// ─── Badge de statut ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const config = {
    active: {
      label: 'Actif',
      bg:    'var(--dev-color-success-light)',
      color: 'var(--dev-color-success)',
    },
    inactive: {
      label: 'Inactif',
      bg:    'var(--dev-color-warning-light)',
      color: 'var(--dev-color-warning)',
    },
    deleted: {
      label: 'Supprimé',
      bg:    'var(--dev-color-error-light)',
      color: 'var(--dev-color-error)',
    },
  };
  const cfg = config[status] ?? config.inactive;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 'var(--dev-border-radius-full)',
        background: cfg.bg,
        color: cfg.color,
        fontSize: 'var(--dev-font-size-xs)',
        fontWeight: 'var(--dev-font-weight-semibold)',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Contenu de l'onglet actif ────────────────────────────────────────────────

/**
 * TabContent
 *
 * Délègue au composant associé à l'onglet courant.
 * Les stubs (tâches 20-24) seront remplacés par les vraies implémentations.
 */
function TabContent({ tab, projectId, project }) {
  switch (tab) {
    case 'api-keys':
      return <ApiKeyDisplay projectId={projectId} project={project} />;

    case 'config':
      return <WhiteLabelConfig projectId={projectId} project={project} />;

    case 'webhooks':
      return <WebhooksPageTab />;

    case 'stats':
      return <StatsChart projectId={projectId} />;

    case 'docs':
      return <DocumentationPageTab projectId={projectId} project={project} />;

    default:
      return <ApiKeyDisplay projectId={projectId} project={project} />;
  }
}

// ─── ProjectPage ──────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { id }                        = useParams();
  const navigate                      = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error,   setError]           = useState('');

  // Onglet courant - lu depuis ?tab=, sinon valeur par défaut
  const rawTab   = searchParams.get('tab') ?? DEFAULT_TAB;
  const activeTab = TABS.some((t) => t.key === rawTab) ? rawTab : DEFAULT_TAB;

  // ── Chargement du projet ─────────────────────────────────────────────────────

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await developerApi.get(`/projects/${id}`);
      // L'API peut retourner { project: {...} } ou directement l'objet
      const projectData = data?.project ?? data;
      setProject(projectData);
    } catch (err) {
      const status = err.response?.status;

      if (status === 403) {
        // Le projet n'appartient pas au compte connecté (req 3.5)
        navigate('/dashboard', { replace: true });
        return;
      }

      if (status === 404) {
        setError('Ce projet est introuvable ou a été supprimé.');
      } else {
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

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // ── Changement d'onglet ──────────────────────────────────────────────────────

  function handleTabChange(tabKey) {
    setSearchParams({ tab: tabKey }, { replace: true });
  }

  // ── Rendu : état de chargement ───────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="dev-page-loader"
        aria-label="Chargement du projet…"
        style={{ minHeight: '60vh' }}
      >
        <Spinner size={36} />
      </div>
    );
  }

  // ── Rendu : état d'erreur ────────────────────────────────────────────────────

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'var(--dev-bg-page)',
          padding: 'var(--dev-space-8) var(--dev-content-padding-x)',
          maxWidth: 'var(--dev-content-max-width)',
          margin: '0 auto',
        }}
      >
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--dev-space-4)',
            padding: 'var(--dev-space-12)',
            background: 'var(--dev-bg-surface)',
            border: '1px solid var(--dev-color-error)',
            borderRadius: 'var(--dev-border-radius-xl)',
            textAlign: 'center',
            maxWidth: 480,
            margin: '0 auto',
            marginTop: 'var(--dev-space-16)',
          }}
        >
          <span style={{ color: 'var(--dev-color-error)' }}>
            <IconAlertCircle />
          </span>
          <p
            style={{
              fontSize: 'var(--dev-font-size-base)',
              color: 'var(--dev-text-secondary)',
              margin: 0,
            }}
          >
            {error}
          </p>
          <div style={{ display: 'flex', gap: 'var(--dev-space-3)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={fetchProject}
              style={{
                padding: 'var(--dev-space-2) var(--dev-space-5)',
                background: 'var(--dev-color-brand-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--dev-border-radius-md)',
                fontSize: 'var(--dev-font-size-sm)',
                fontWeight: 'var(--dev-font-weight-semibold)',
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--dev-space-2) var(--dev-space-5)',
                background: 'var(--dev-bg-surface)',
                color: 'var(--dev-text-secondary)',
                border: '1px solid var(--dev-border-color)',
                borderRadius: 'var(--dev-border-radius-md)',
                fontSize: 'var(--dev-font-size-sm)',
                fontWeight: 'var(--dev-font-weight-medium)',
                textDecoration: 'none',
              }}
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Rendu principal ──────────────────────────────────────────────────────────

  const projectName = project?.name ?? `Projet ${id}`;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--dev-bg-page)',
        padding: 'var(--dev-space-8) var(--dev-content-padding-x)',
        maxWidth: 'var(--dev-content-max-width)',
        margin: '0 auto',
      }}
    >
      {/* ─── Breadcrumb ──────────────────────────────────────────────────────── */}
      <nav
        aria-label="Fil d'Ariane"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--dev-space-2)',
          marginBottom: 'var(--dev-space-6)',
          fontSize: 'var(--dev-font-size-sm)',
          color: 'var(--dev-text-muted)',
        }}
      >
        <Link
          to="/dashboard"
          style={{
            color: 'var(--dev-text-link)',
            textDecoration: 'none',
            fontWeight: 'var(--dev-font-weight-medium)',
          }}
        >
          Tableau de bord
        </Link>
        <span aria-hidden="true">
          <IconChevronRight />
        </span>
        <span
          style={{
            color: 'var(--dev-text-primary)',
            fontWeight: 'var(--dev-font-weight-medium)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '260px',
          }}
          aria-current="page"
        >
          {projectName}
        </span>
      </nav>

      {/* ─── En-tête du projet ───────────────────────────────────────────────── */}
      <header style={{ marginBottom: 'var(--dev-space-8)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--dev-space-4)',
            flexWrap: 'wrap',
          }}
        >
          {/* Icône du projet */}
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--dev-border-radius-lg)',
              background: 'linear-gradient(135deg, var(--dev-color-brand-primary), var(--dev-color-brand-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0,
            }}
          >
            {project?.logo_url ? (
              <img
                src={project.logo_url}
                alt=""
                style={{ width: 36, height: 36, borderRadius: 'var(--dev-border-radius-sm)', objectFit: 'cover' }}
              />
            ) : (
              <IconProject />
            )}
          </div>

          {/* Titre + méta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dev-space-3)',
                flexWrap: 'wrap',
                marginBottom: 'var(--dev-space-1)',
              }}
            >
              <h1
                style={{
                  fontSize: 'var(--dev-font-size-2xl)',
                  fontWeight: 'var(--dev-font-weight-bold)',
                  color: 'var(--dev-text-primary)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '480px',
                }}
                title={projectName}
              >
                {projectName}
              </h1>
              <StatusBadge status={project?.status} />
            </div>

            <p
              style={{
                fontSize: 'var(--dev-font-size-sm)',
                color: 'var(--dev-text-muted)',
                margin: 0,
              }}
            >
              {project?.description
                ? project.description
                : `Créé le ${formatDate(project?.created_at)}`}
            </p>
            {project?.description && (
              <p
                style={{
                  fontSize: 'var(--dev-font-size-xs)',
                  color: 'var(--dev-text-muted)',
                  margin: 'var(--dev-space-1) 0 0 0',
                }}
              >
                Créé le {formatDate(project?.created_at)}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ─── Navigation par onglets ──────────────────────────────────────────── */}
      <nav
        role="tablist"
        aria-label="Sections du projet"
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--dev-border-color)',
          marginBottom: 'var(--dev-space-8)',
          overflowX: 'auto',
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
                padding: 'var(--dev-space-3) var(--dev-space-5)',
                background: 'none',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--dev-color-brand-primary)'
                  : '2px solid transparent',
                marginBottom: -2, /* compense le border-bottom du nav */
                fontSize: 'var(--dev-font-size-sm)',
                fontWeight: isActive
                  ? 'var(--dev-font-weight-semibold)'
                  : 'var(--dev-font-weight-medium)',
                color: isActive
                  ? 'var(--dev-color-brand-primary)'
                  : 'var(--dev-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition:
                  'color var(--dev-transition-fast), border-color var(--dev-transition-fast)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ─── Contenu de l'onglet actif ───────────────────────────────────────── */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        <React.Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
              }}
            >
              <Spinner size={28} />
            </div>
          }
        >
          <TabContent
            tab={activeTab}
            projectId={id}
            project={project}
          />
        </React.Suspense>
      </div>
    </main>
  );
}
