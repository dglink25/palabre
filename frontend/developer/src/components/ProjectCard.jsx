/**
 * ProjectCard.jsx - Developer Portal
 *
 * Carte affichant le résumé d'un Developer_Project :
 *   - Nom du projet
 *   - Statut (badge coloré : active / inactive)
 *   - Date de création (formatée)
 *   - Lien vers la ProjectPage (/projects/:id)
 *
 * Requirements couverts : 3.1, 3.4
 */

import { Link } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  }).format(new Date(isoString));
}

// ─── Icône projet ─────────────────────────────────────────────────────────────

function IconProject() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ─── Icône flèche ─────────────────────────────────────────────────────────────

function IconArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ─── Badge de statut ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const config = {
    active: {
      label: 'Actif',
      bg: 'var(--dev-color-success-light)',
      color: 'var(--dev-color-success)',
      dot: 'var(--dev-color-success)',
    },
    inactive: {
      label: 'Inactif',
      bg: 'var(--dev-color-warning-light)',
      color: 'var(--dev-color-warning)',
      dot: 'var(--dev-color-warning)',
    },
    deleted: {
      label: 'Supprimé',
      bg: 'var(--dev-color-error-light)',
      color: 'var(--dev-color-error)',
      dot: 'var(--dev-color-error)',
    },
  };

  const cfg = config[status] ?? config.inactive;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
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
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {object} props.project - données du projet (id, name, status, created_at, description)
 */
export default function ProjectCard({ project }) {
  const { id, name, status, created_at, description } = project;

  return (
    <article
      style={{
        background: 'var(--dev-bg-surface)',
        border: '1px solid var(--dev-border-color)',
        borderRadius: 'var(--dev-border-radius-lg)',
        padding: 'var(--dev-space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--dev-space-4)',
        transition: 'box-shadow var(--dev-transition-fast), border-color var(--dev-transition-fast)',
        boxShadow: 'var(--dev-shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--dev-shadow-md)';
        e.currentTarget.style.borderColor = 'var(--dev-color-brand-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--dev-shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--dev-border-color)';
      }}
    >
      {/* En-tête : icône + nom + statut */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--dev-space-3)' }}>
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--dev-border-radius-md)',
            background: 'linear-gradient(135deg, var(--dev-color-brand-primary), var(--dev-color-brand-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
          }}
        >
          <IconProject />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: 'var(--dev-font-size-base)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              color: 'var(--dev-text-primary)',
              margin: '0 0 var(--dev-space-1) 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={name}
          >
            {name}
          </h3>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Description (si présente) */}
      {description && (
        <p
          style={{
            fontSize: 'var(--dev-font-size-sm)',
            color: 'var(--dev-text-secondary)',
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </p>
      )}

      {/* Pied : date + lien */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 'var(--dev-space-3)',
          borderTop: '1px solid var(--dev-border-color)',
        }}
      >
        <time
          dateTime={created_at}
          style={{
            fontSize: 'var(--dev-font-size-xs)',
            color: 'var(--dev-text-muted)',
          }}
        >
          Créé le {formatDate(created_at)}
        </time>

        <Link
          to={`/projects/${id}`}
          aria-label={`Ouvrir le projet ${name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--dev-space-1)',
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-medium)',
            color: 'var(--dev-color-brand-primary)',
            textDecoration: 'none',
          }}
        >
          Ouvrir
          <IconArrow />
        </Link>
      </div>
    </article>
  );
}
