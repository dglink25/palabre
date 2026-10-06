/**
 * ProjectCard.jsx - Developer Portal
 *
 * Carte institutionnelle d'un Developer_Project.
 * Fond plat #EAF2FD pour l'icône, pas de gradient.
 * Badge statut : border-radius 4px, fond rgba, texte coloré.
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

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconMonitor() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
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
      bg:    'rgba(52,168,83,.12)',
      color: '#34A853',
    },
    inactive: {
      label: 'Inactif',
      bg:    'rgba(251,188,5,.12)',
      color: '#8a6700',
    },
    deleted: {
      label: 'Supprimé',
      bg:    'rgba(234,67,53,.12)',
      color: '#EA4335',
    },
  };

  const cfg = config[status] ?? config.inactive;

  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        padding:         '2px 8px',
        borderRadius:    4,
        background:      cfg.bg,
        color:           cfg.color,
        fontSize:        12,
        fontWeight:      600,
        letterSpacing:   '0.3px',
        textTransform:   'uppercase',
        whiteSpace:      'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

export default function ProjectCard({ project }) {
  const { id, name, status, created_at, description } = project;

  return (
    <article
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E0E0E0',
        borderRadius: 8,
        padding:      '20px 24px',
        display:      'flex',
        flexDirection: 'column',
        gap:          16,
        transition:   'border-color 150ms ease',
        cursor:       'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1A73E8'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icône projet — fond plat, pas de gradient */}
        <div
          aria-hidden="true"
          style={{
            width:           40,
            height:          40,
            borderRadius:    8,
            backgroundColor: '#EAF2FD',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           '#1A73E8',
            flexShrink:      0,
          }}
        >
          <IconMonitor />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize:     15,
              fontWeight:   600,
              color:        '#202124',
              margin:       '0 0 4px 0',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
            title={name}
          >
            {name}
          </h3>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Description */}
      {description && (
        <p
          style={{
            fontSize:           14,
            color:              '#5F6368',
            margin:             0,
            display:            '-webkit-box',
            WebkitLineClamp:    2,
            WebkitBoxOrient:    'vertical',
            overflow:           'hidden',
            lineHeight:         1.5,
          }}
        >
          {description}
        </p>
      )}

      {/* Pied : date + lien */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginTop:      'auto',
          paddingTop:     12,
          borderTop:      '1px solid #E0E0E0',
        }}
      >
        <time
          dateTime={created_at}
          style={{ fontSize: 12, color: '#9aa0a6' }}
        >
          Créé le {formatDate(created_at)}
        </time>

        <Link
          to={`/projects/${id}`}
          aria-label={`Ouvrir le projet ${name}`}
          style={{
            display:    'inline-flex',
            alignItems: 'center',
            gap:        4,
            fontSize:   13,
            fontWeight: 500,
            color:      '#1A73E8',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Ouvrir
          <IconArrowRight />
        </Link>
      </div>
    </article>
  );
}
