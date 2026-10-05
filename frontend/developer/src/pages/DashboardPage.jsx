/**
 * DashboardPage.jsx - Developer Portal
 *
 * Tableau de bord principal du Developer Portal.
 *
 * Fonctionnalités :
 *   1. Liste les Developer_Projects du compte connecté (GET /projects)
 *   2. Affiche un compteur "X projets / limite" (req 3.8)
 *   3. Bouton "Nouveau projet" → modale avec formulaire (nom obligatoire,
 *      description optionnelle) → POST /projects → rafraîchissement +
 *      affichage one-shot de la Secret_Key (req 3.1, 3.7)
 *   4. Stats globales condensées (total messages, appels, API calls) (req 3.4)
 *
 * Requirements couverts : 3.1, 3.4, 3.7, 3.8
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import developerApi from '../api/developerApi';
import { useAuth } from '../context/AuthContext';
import ProjectCard from '../components/ProjectCard';

// ─── Constante limite de projets ──────────────────────────────────────────────

const PROJECT_LIMIT = 10; // Limite par défaut par compte

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

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

function IconApi() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
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

// ─── Carte statistique ────────────────────────────────────────────────────────

function StatCard({ icon, label, value, loading }) {
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
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--dev-border-radius-md)',
          background: 'var(--dev-color-neutral-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--dev-color-brand-primary)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            fontSize: 'var(--dev-font-size-xs)',
            color: 'var(--dev-text-muted)',
            margin: '0 0 var(--dev-space-1) 0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 'var(--dev-font-weight-medium)',
          }}
        >
          {label}
        </p>
        {loading ? (
          <Spinner size={20} />
        ) : (
          <p
            style={{
              fontSize: 'var(--dev-font-size-xl)',
              fontWeight: 'var(--dev-font-weight-bold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Modale création de projet ────────────────────────────────────────────────

/**
 * NewProjectModal
 *
 * Modale contenant le formulaire de création d'un projet.
 * Après création réussie, affiche la Secret_Key en one-shot.
 */
function NewProjectModal({ onClose, onCreated }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState('');
  const [secretKey, setSecretKey]     = useState(null); // one-shot après création
  const [copied, setCopied]           = useState(false);
  const nameInputRef                  = useRef(null);

  // Focus initial sur le champ nom
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Fermer la modale avec Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const { data } = await developerApi.post('/projects', {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // La secret key est retournée en one-shot à la création (req 3.1, 3.7)
      const sk = data?.secretKey ?? data?.secret_key ?? data?.keys?.secret ?? null;
      setSecretKey(sk);
      onCreated(data?.project ?? data);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Une erreur est survenue lors de la création du projet.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencieux
    }
  }

  const nameValid = name.trim().length >= 2;

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--dev-bg-overlay)',
        padding: 'var(--dev-space-4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Boîte de dialogue */}
      <div
        style={{
          background: 'var(--dev-bg-surface)',
          borderRadius: 'var(--dev-border-radius-xl)',
          boxShadow: 'var(--dev-shadow-xl)',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--dev-space-8)',
        }}
      >
        {/* En-tête */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--dev-space-6)',
          }}
        >
          <h2
            id="modal-title"
            style={{
              fontSize: 'var(--dev-font-size-xl)',
              fontWeight: 'var(--dev-font-weight-bold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            {secretKey ? 'Projet créé !' : 'Nouveau projet'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la modale"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--dev-text-muted)',
              padding: 'var(--dev-space-1)',
              borderRadius: 'var(--dev-border-radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconClose />
          </button>
        </div>

        {/* ─── Étape 2 : affichage one-shot de la secret key ─── */}
        {secretKey ? (
          <div>
            {/* Alerte */}
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: 'var(--dev-space-3)',
                padding: 'var(--dev-space-4)',
                background: 'var(--dev-color-warning-light)',
                border: '1px solid var(--dev-color-warning)',
                borderRadius: 'var(--dev-border-radius-md)',
                marginBottom: 'var(--dev-space-6)',
              }}
            >
              <span style={{ color: 'var(--dev-color-warning)', flexShrink: 0, marginTop: 1 }}>
                <IconWarning />
              </span>
              <div>
                <p
                  style={{
                    margin: '0 0 var(--dev-space-1) 0',
                    fontWeight: 'var(--dev-font-weight-semibold)',
                    color: 'var(--dev-color-warning)',
                    fontSize: 'var(--dev-font-size-sm)',
                  }}
                >
                  Copiez votre Secret Key maintenant
                </p>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--dev-text-secondary)',
                    fontSize: 'var(--dev-font-size-sm)',
                  }}
                >
                  Elle ne sera plus jamais affichée en clair. Conservez-la en lieu sûr.
                </p>
              </div>
            </div>

            {/* Affichage de la clé */}
            <div style={{ marginBottom: 'var(--dev-space-6)' }}>
              <p
                style={{
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                  color: 'var(--dev-text-primary)',
                  margin: '0 0 var(--dev-space-2) 0',
                }}
              >
                Secret Key
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--dev-space-2)',
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  background: 'var(--dev-color-neutral-900)',
                  borderRadius: 'var(--dev-border-radius-md)',
                  border: '1px solid var(--dev-color-neutral-700)',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: 'var(--dev-font-size-xs)',
                    fontFamily: 'var(--dev-font-family-mono)',
                    color: '#86efac', /* vert clair sur fond sombre */
                    overflowWrap: 'break-word',
                    wordBreak: 'break-all',
                    background: 'none',
                    padding: 0,
                  }}
                >
                  {secretKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copier la Secret Key"
                  title={copied ? 'Copié !' : 'Copier'}
                  style={{
                    background: copied ? 'var(--dev-color-success)' : 'var(--dev-color-neutral-700)',
                    border: 'none',
                    borderRadius: 'var(--dev-border-radius-sm)',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 'var(--dev-space-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background var(--dev-transition-fast)',
                  }}
                >
                  <IconCopy />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: 'var(--dev-space-3) var(--dev-space-4)',
                background: 'var(--dev-color-brand-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--dev-border-radius-md)',
                fontSize: 'var(--dev-font-size-base)',
                fontWeight: 'var(--dev-font-weight-semibold)',
                cursor: 'pointer',
              }}
            >
              J'ai copié ma clé, fermer
            </button>
          </div>
        ) : (
          /* ─── Étape 1 : formulaire de création ─── */
          <form onSubmit={handleSubmit} noValidate>
            {/* Erreur */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--dev-space-2)',
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  background: 'var(--dev-color-error-light)',
                  border: '1px solid var(--dev-color-error)',
                  borderRadius: 'var(--dev-border-radius-md)',
                  color: 'var(--dev-color-error)',
                  fontSize: 'var(--dev-font-size-sm)',
                  marginBottom: 'var(--dev-space-4)',
                }}
              >
                {error}
              </div>
            )}

            {/* Champ : nom (obligatoire) */}
            <div style={{ marginBottom: 'var(--dev-space-5)' }}>
              <label
                htmlFor="project-name"
                style={{
                  display: 'block',
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                  color: 'var(--dev-text-primary)',
                  marginBottom: 'var(--dev-space-2)',
                }}
              >
                Nom du projet <span aria-hidden="true" style={{ color: 'var(--dev-color-error)' }}>*</span>
              </label>
              <input
                ref={nameInputRef}
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mon Application"
                required
                minLength={2}
                maxLength={100}
                autoComplete="off"
                aria-describedby="project-name-hint"
                style={{
                  width: '100%',
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  border: '1px solid var(--dev-border-color)',
                  borderRadius: 'var(--dev-border-radius-md)',
                  fontSize: 'var(--dev-font-size-base)',
                  color: 'var(--dev-text-primary)',
                  background: 'var(--dev-bg-surface)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color var(--dev-transition-fast)',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--dev-border-color-focus)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--dev-border-color)'; }}
              />
              <p
                id="project-name-hint"
                style={{
                  fontSize: 'var(--dev-font-size-xs)',
                  color: 'var(--dev-text-muted)',
                  marginTop: 'var(--dev-space-1)',
                  marginBottom: 0,
                }}
              >
                2 à 100 caractères. Ce nom identifie votre projet dans le portail.
              </p>
            </div>

            {/* Champ : description (optionnelle) */}
            <div style={{ marginBottom: 'var(--dev-space-6)' }}>
              <label
                htmlFor="project-description"
                style={{
                  display: 'block',
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                  color: 'var(--dev-text-primary)',
                  marginBottom: 'var(--dev-space-2)',
                }}
              >
                Description{' '}
                <span
                  style={{
                    fontSize: 'var(--dev-font-size-xs)',
                    color: 'var(--dev-text-muted)',
                    fontWeight: 'var(--dev-font-weight-normal)',
                  }}
                >
                  (optionnelle)
                </span>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'usage de ce projet…"
                rows={3}
                maxLength={500}
                style={{
                  width: '100%',
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  border: '1px solid var(--dev-border-color)',
                  borderRadius: 'var(--dev-border-radius-md)',
                  fontSize: 'var(--dev-font-size-base)',
                  color: 'var(--dev-text-primary)',
                  background: 'var(--dev-bg-surface)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'var(--dev-font-family-sans)',
                  transition: 'border-color var(--dev-transition-fast)',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--dev-border-color-focus)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--dev-border-color)'; }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--dev-space-3)' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  background: 'var(--dev-bg-surface)',
                  color: 'var(--dev-text-secondary)',
                  border: '1px solid var(--dev-border-color)',
                  borderRadius: 'var(--dev-border-radius-md)',
                  fontSize: 'var(--dev-font-size-base)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={busy || !nameValid}
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--dev-space-2)',
                  padding: 'var(--dev-space-3) var(--dev-space-4)',
                  background:
                    busy || !nameValid
                      ? 'var(--dev-color-neutral-300)'
                      : 'var(--dev-color-brand-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--dev-border-radius-md)',
                  fontSize: 'var(--dev-font-size-base)',
                  fontWeight: 'var(--dev-font-weight-semibold)',
                  cursor: busy || !nameValid ? 'not-allowed' : 'pointer',
                  transition: 'background var(--dev-transition-fast)',
                }}
              >
                {busy ? <Spinner size={18} /> : <IconPlus />}
                {busy ? 'Création…' : 'Créer le projet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { account } = useAuth();
  const navigate    = useNavigate();

  const [projects, setProjects]         = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError]     = useState('');

  const [globalStats, setGlobalStats]   = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [showModal, setShowModal]       = useState(false);

  // ── Chargement des projets ───────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectsError('');
    try {
      const { data } = await developerApi.get('/projects');
      // L'API peut retourner { projects: [...] } ou directement un tableau
      const list = Array.isArray(data) ? data : (data?.projects ?? []);
      setProjects(list);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Impossible de charger vos projets. Veuillez réessayer.';
      setProjectsError(msg);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // ── Chargement des stats globales ────────────────────────────────────────────

  const fetchGlobalStats = useCallback(async (projectList) => {
    if (!projectList || projectList.length === 0) {
      setGlobalStats({ messages: 0, calls: 0, api_calls: 0 });
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);
    try {
      // Agréger les stats de tous les projets actifs (période 30j)
      const promises = projectList
        .filter((p) => p.status === 'active')
        .map((p) =>
          developerApi
            .get(`/projects/${p.id}/stats`, { params: { period: '30d' } })
            .then((r) => r.data)
            .catch(() => null)
        );

      const results = await Promise.all(promises);

      const totals = results.reduce(
        (acc, r) => {
          if (!r) return acc;
          // L'API peut retourner différentes formes de réponse
          const stats = r?.stats ?? r;
          return {
            messages:  acc.messages  + (stats?.messages_sent  ?? stats?.messages  ?? 0),
            calls:     acc.calls     + (stats?.calls_made     ?? stats?.calls     ?? 0),
            api_calls: acc.api_calls + (stats?.api_calls      ?? 0),
          };
        },
        { messages: 0, calls: 0, api_calls: 0 }
      );

      setGlobalStats(totals);
    } catch {
      // Silencieux : on affiche 0 si les stats échouent (req 12.5)
      setGlobalStats({ messages: 0, calls: 0, api_calls: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Montage initial ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Charger les stats une fois les projets récupérés
  useEffect(() => {
    if (!loadingProjects) {
      fetchGlobalStats(projects);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingProjects]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleProjectCreated(newProject) {
    // Rafraîchissement de la liste (req 3.1)
    setProjects((prev) => [newProject, ...prev]);
  }

  function handleModalClose() {
    setShowModal(false);
    // Rafraîchir la liste pour être sûr d'être à jour
    fetchProjects();
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const activeProjects = projects.filter((p) => p.status !== 'deleted');
  const displayName =
    account?.name ||
    account?.user?.name ||
    account?.user?.display_name ||
    'Développeur';

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
      {/* ─── En-tête ─────────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 'var(--dev-space-8)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--dev-space-4)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            {/* Logo + titre */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--dev-space-3)',
                marginBottom: 'var(--dev-space-2)',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--dev-border-radius-lg)',
                  background: 'linear-gradient(135deg, var(--dev-color-brand-primary), var(--dev-color-brand-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconProject />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: 'var(--dev-font-size-3xl)',
                    fontWeight: 'var(--dev-font-weight-bold)',
                    color: 'var(--dev-text-primary)',
                    margin: 0,
                    lineHeight: 'var(--dev-line-height-tight)',
                  }}
                >
                  Tableau de bord
                </h1>
                <p
                  style={{
                    fontSize: 'var(--dev-font-size-sm)',
                    color: 'var(--dev-text-secondary)',
                    margin: 0,
                  }}
                >
                  Bienvenue, {displayName}
                </p>
              </div>
            </div>
          </div>

          {/* Bouton "Nouveau projet" */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={activeProjects.length >= PROJECT_LIMIT}
            aria-label="Créer un nouveau projet"
            title={
              activeProjects.length >= PROJECT_LIMIT
                ? `Limite de ${PROJECT_LIMIT} projets atteinte`
                : 'Créer un nouveau projet'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dev-space-2)',
              padding: 'var(--dev-space-3) var(--dev-space-5)',
              background:
                activeProjects.length >= PROJECT_LIMIT
                  ? 'var(--dev-color-neutral-300)'
                  : 'var(--dev-color-brand-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--dev-border-radius-md)',
              fontSize: 'var(--dev-font-size-base)',
              fontWeight: 'var(--dev-font-weight-semibold)',
              cursor:
                activeProjects.length >= PROJECT_LIMIT ? 'not-allowed' : 'pointer',
              transition: 'background var(--dev-transition-fast)',
              flexShrink: 0,
            }}
          >
            <IconPlus />
            Nouveau projet
          </button>
        </div>
      </header>

      {/* ─── Stats globales condensées ────────────────────────────────────────── */}
      <section
        aria-label="Statistiques globales (30 derniers jours)"
        style={{ marginBottom: 'var(--dev-space-8)' }}
      >
        <h2
          style={{
            fontSize: 'var(--dev-font-size-sm)',
            fontWeight: 'var(--dev-font-weight-semibold)',
            color: 'var(--dev-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '0 0 var(--dev-space-4) 0',
          }}
        >
          Activité globale - 30 derniers jours
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--dev-space-4)',
          }}
        >
          <StatCard
            icon={<IconMessage />}
            label="Messages envoyés"
            value={globalStats?.messages ?? 0}
            loading={loadingStats}
          />
          <StatCard
            icon={<IconPhone />}
            label="Appels effectués"
            value={globalStats?.calls ?? 0}
            loading={loadingStats}
          />
          <StatCard
            icon={<IconApi />}
            label="Appels API"
            value={globalStats?.api_calls ?? 0}
            loading={loadingStats}
          />
        </div>
      </section>

      {/* ─── Liste des projets ────────────────────────────────────────────────── */}
      <section aria-label="Mes projets">
        {/* Titre + compteur */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--dev-space-4)',
            gap: 'var(--dev-space-4)',
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--dev-font-size-xl)',
              fontWeight: 'var(--dev-font-weight-bold)',
              color: 'var(--dev-text-primary)',
              margin: 0,
            }}
          >
            Mes projets
          </h2>

          {/* Compteur "X projets / limite" - req 3.8 */}
          {!loadingProjects && (
            <div
              aria-label={`${activeProjects.length} projet(s) sur ${PROJECT_LIMIT} maximum`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--dev-space-2)',
              }}
            >
              {/* Barre de progression */}
              <div
                aria-hidden="true"
                style={{
                  width: 80,
                  height: 6,
                  background: 'var(--dev-color-neutral-200)',
                  borderRadius: 'var(--dev-border-radius-full)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (activeProjects.length / PROJECT_LIMIT) * 100)}%`,
                    height: '100%',
                    background:
                      activeProjects.length >= PROJECT_LIMIT
                        ? 'var(--dev-color-error)'
                        : 'var(--dev-color-brand-primary)',
                    borderRadius: 'inherit',
                    transition: 'width var(--dev-transition-normal)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 'var(--dev-font-size-sm)',
                  fontWeight: 'var(--dev-font-weight-medium)',
                  color:
                    activeProjects.length >= PROJECT_LIMIT
                      ? 'var(--dev-color-error)'
                      : 'var(--dev-text-secondary)',
                }}
              >
                {activeProjects.length} / {PROJECT_LIMIT} projet{activeProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* État de chargement */}
        {loadingProjects && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--dev-space-16)',
            }}
          >
            <Spinner size={32} />
          </div>
        )}

        {/* Erreur */}
        {!loadingProjects && projectsError && (
          <div
            role="alert"
            style={{
              padding: 'var(--dev-space-4)',
              background: 'var(--dev-color-error-light)',
              border: '1px solid var(--dev-color-error)',
              borderRadius: 'var(--dev-border-radius-md)',
              color: 'var(--dev-color-error)',
              fontSize: 'var(--dev-font-size-sm)',
              marginBottom: 'var(--dev-space-4)',
            }}
          >
            {projectsError}
            <button
              type="button"
              onClick={fetchProjects}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginLeft: 'var(--dev-space-2)',
                fontSize: 'inherit',
                padding: 0,
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Liste des cartes */}
        {!loadingProjects && !projectsError && (
          <>
            {activeProjects.length === 0 ? (
              /* État vide */
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--dev-space-16) var(--dev-space-8)',
                  background: 'var(--dev-bg-surface)',
                  border: '2px dashed var(--dev-border-color)',
                  borderRadius: 'var(--dev-border-radius-xl)',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--dev-border-radius-xl)',
                    background: 'var(--dev-color-neutral-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--dev-space-4) auto',
                    color: 'var(--dev-text-muted)',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <h3
                  style={{
                    fontSize: 'var(--dev-font-size-lg)',
                    fontWeight: 'var(--dev-font-weight-semibold)',
                    color: 'var(--dev-text-primary)',
                    margin: '0 0 var(--dev-space-2) 0',
                  }}
                >
                  Aucun projet pour l'instant
                </h3>
                <p
                  style={{
                    fontSize: 'var(--dev-font-size-sm)',
                    color: 'var(--dev-text-secondary)',
                    margin: '0 0 var(--dev-space-6) 0',
                  }}
                >
                  Créez votre premier projet pour obtenir vos clés API et commencer l'intégration.
                </p>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--dev-space-2)',
                    padding: 'var(--dev-space-3) var(--dev-space-5)',
                    background: 'var(--dev-color-brand-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--dev-border-radius-md)',
                    fontSize: 'var(--dev-font-size-base)',
                    fontWeight: 'var(--dev-font-weight-semibold)',
                    cursor: 'pointer',
                  }}
                >
                  <IconPlus />
                  Créer mon premier projet
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 'var(--dev-space-4)',
                }}
              >
                {activeProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ─── Modale de création de projet ────────────────────────────────────── */}
      {showModal && (
        <NewProjectModal
          onClose={handleModalClose}
          onCreated={handleProjectCreated}
        />
      )}
    </main>
  );
}
