/**
 * DashboardPage.jsx - Developer Portal
 *
 * Tableau de bord institutionnel — style Stripe / Twilio / AWS Console.
 * En-tête sobre sans gradient, icônes fond #EAF2FD/#1A73E8.
 * État vide avec icône neutre et texte descriptif.
 *
 * Requirements couverts : 3.1, 3.4, 3.7, 3.8
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import developerApi from '../api/developerApi';
import { useAuth } from '../context/AuthContext';
import ProjectCard from '../components/ProjectCard';

const PROJECT_LIMIT = 10;

// ─── Icônes SVG Lucide stroke-only ───────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconMessageSquare() {
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

function IconCode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

// ─── Carte statistique ────────────────────────────────────────────────────────

function StatCard({ icon, label, value, loading }) {
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
          color:           '#1A73E8',
          flexShrink:      0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{
          fontSize:      12,
          color:         '#5F6368',
          margin:        '0 0 3px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          fontWeight:    600,
        }}>
          {label}
        </p>
        {loading
          ? <Spinner size={18} />
          : (
            <p style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: 0 }}>
              {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
            </p>
          )
        }
      </div>
    </div>
  );
}

// ─── Modale création de projet ────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreated }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');
  const [secretKey,   setSecretKey]   = useState(null);
  const [copied,      setCopied]      = useState(false);
  const nameInputRef                  = useRef(null);

  useEffect(() => { nameInputRef.current?.focus(); }, []);

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
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
    } catch { /* silencieux */ }
  }

  const nameValid = name.trim().length >= 2;

  const inputStyle = {
    width:        '100%',
    padding:      '9px 12px',
    border:       '1px solid #E0E0E0',
    borderRadius: 8,
    fontFamily:   'inherit',
    fontSize:     14,
    color:        '#202124',
    background:   '#FFFFFF',
    outline:      'none',
    boxSizing:    'border-box',
    transition:   'border-color 150ms ease',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'rgba(32,33,36,.5)',
        padding:         16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background:   '#FFFFFF',
          borderRadius: 12,
          boxShadow:    '0 8px 32px rgba(32,33,36,.14)',
          width:        '100%',
          maxWidth:     480,
          maxHeight:    '90vh',
          overflowY:    'auto',
          padding:      '28px 32px',
        }}
      >
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 id="modal-title" style={{ fontSize: 18, fontWeight: 700, color: '#202124', margin: 0 }}>
            {secretKey ? 'Projet créé' : 'Nouveau projet'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#5F6368', padding: 4, display: 'flex',
              borderRadius: 6,
            }}
          >
            <IconX />
          </button>
        </div>

        {/* Étape 2 : secret key one-shot */}
        {secretKey ? (
          <div>
            <div
              role="alert"
              style={{
                display:      'flex',
                gap:          12,
                padding:      '12px 14px',
                background:   'rgba(251,188,5,.08)',
                border:       '1px solid #FBBC05',
                borderLeft:   '3px solid #FBBC05',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <span style={{ color: '#8a6700', flexShrink: 0, marginTop: 1 }}><IconAlertTriangle /></span>
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: 600, color: '#8a6700', fontSize: 14 }}>
                  Copiez votre Secret Key maintenant
                </p>
                <p style={{ margin: 0, color: '#5F6368', fontSize: 13 }}>
                  Elle ne sera plus affichée. Conservez-la en lieu sûr.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, fontWeight: 500, color: '#202124', margin: '0 0 8px' }}>
              Secret Key
            </p>
            <div
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                padding:      '10px 14px',
                background:   '#202124',
                borderRadius: 8,
                marginBottom: 20,
                flexWrap:     'wrap',
              }}
            >
              <code
                style={{
                  flex:       1,
                  fontSize:   12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  color:      '#86efac',
                  overflowWrap: 'break-word',
                  wordBreak:  'break-all',
                  background: 'none',
                  padding:    0,
                  border:     'none',
                  lineHeight: 1.6,
                }}
              >
                {secretKey}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copier la Secret Key"
                style={{
                  background:   copied ? '#34A853' : '#3c4043',
                  border:       'none',
                  borderRadius: 6,
                  color:        '#fff',
                  cursor:       'pointer',
                  padding:      '6px 8px',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          4,
                  fontSize:     12,
                  fontFamily:   'inherit',
                  fontWeight:   500,
                  flexShrink:   0,
                  transition:   'background 150ms ease',
                }}
              >
                {copied ? <IconCheck /> : <IconCopy />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width:        '100%',
                height:       40,
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
              J'ai copié ma clé — fermer
            </button>
          </div>
        ) : (
          /* Étape 1 : formulaire */
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  padding:      '10px 14px',
                  background:   'rgba(234,67,53,.06)',
                  border:       '1px solid #EA4335',
                  borderLeft:   '3px solid #EA4335',
                  borderRadius: 8,
                  color:        '#EA4335',
                  fontSize:     14,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="project-name"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#202124', marginBottom: 6 }}
              >
                Nom du projet <span aria-hidden="true" style={{ color: '#EA4335' }}>*</span>
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
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#1A73E8'; }}
                onBlur={(e)  => { e.target.style.borderColor = '#E0E0E0'; }}
              />
              <p style={{ fontSize: 12, color: '#5F6368', marginTop: 4 }}>
                2 à 100 caractères. Identifie votre projet dans le portail.
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="project-description"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#202124', marginBottom: 6 }}
              >
                Description{' '}
                <span style={{ fontSize: 12, color: '#5F6368', fontWeight: 400 }}>(optionnelle)</span>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'usage de ce projet…"
                rows={3}
                maxLength={500}
                style={{
                  ...inputStyle,
                  resize:     'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
                onFocus={(e) => { e.target.style.borderColor = '#1A73E8'; }}
                onBlur={(e)  => { e.target.style.borderColor = '#E0E0E0'; }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex:         1,
                  height:       40,
                  background:   '#FFFFFF',
                  color:        '#5F6368',
                  border:       '1px solid #E0E0E0',
                  borderRadius: 8,
                  fontSize:     14,
                  fontWeight:   500,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={busy || !nameValid}
                style={{
                  flex:         2,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  gap:          6,
                  height:       40,
                  background:   busy || !nameValid ? '#dadce0' : '#1A73E8',
                  color:        busy || !nameValid ? '#5F6368' : '#FFFFFF',
                  border:       'none',
                  borderRadius: 8,
                  fontSize:     14,
                  fontWeight:   600,
                  cursor:       busy || !nameValid ? 'not-allowed' : 'pointer',
                  fontFamily:   'inherit',
                }}
              >
                {busy ? <Spinner size={16} /> : <IconPlus />}
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

  const [projects,        setProjects]        = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError,   setProjectsError]   = useState('');

  const [globalStats,   setGlobalStats]   = useState(null);
  const [loadingStats,  setLoadingStats]  = useState(true);

  const [showModal, setShowModal] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectsError('');
    try {
      const { data } = await developerApi.get('/projects');
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

  const fetchGlobalStats = useCallback(async (projectList) => {
    if (!projectList || projectList.length === 0) {
      setGlobalStats({ messages: 0, calls: 0, api_calls: 0 });
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    try {
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
      setGlobalStats({ messages: 0, calls: 0, api_calls: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (!loadingProjects) fetchGlobalStats(projects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingProjects]);

  function handleProjectCreated(newProject) {
    setProjects((prev) => [newProject, ...prev]);
  }

  function handleModalClose() {
    setShowModal(false);
    fetchProjects();
  }

  const activeProjects = projects.filter((p) => p.status !== 'deleted');
  const displayName =
    account?.name ||
    account?.user?.name ||
    account?.user?.display_name ||
    'Développeur';

  return (
    <div style={{ background: '#F8F9FA', minHeight: '100vh' }}>
      {/* ─── En-tête ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            16,
          flexWrap:       'wrap',
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>
              Tableau de bord
            </h1>
            <p style={{ fontSize: 14, color: '#5F6368', margin: 0 }}>
              Bienvenue, {displayName}
            </p>
          </div>

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
              display:      'inline-flex',
              alignItems:   'center',
              gap:          6,
              height:       40,
              padding:      '0 18px',
              background:   activeProjects.length >= PROJECT_LIMIT ? '#dadce0' : '#1A73E8',
              color:        activeProjects.length >= PROJECT_LIMIT ? '#5F6368' : '#FFFFFF',
              border:       'none',
              borderRadius: 8,
              fontSize:     14,
              fontWeight:   600,
              cursor:       activeProjects.length >= PROJECT_LIMIT ? 'not-allowed' : 'pointer',
              fontFamily:   'inherit',
              flexShrink:   0,
            }}
          >
            <IconPlus />
            Nouveau projet
          </button>
        </div>
      </div>

      {/* ─── Stats globales 30 jours ─────────────────────────────────────────── */}
      <section aria-label="Statistiques globales — 30 derniers jours" style={{ marginBottom: 28 }}>
        <p style={{
          fontSize:      12,
          fontWeight:    600,
          color:         '#5F6368',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          margin:        '0 0 12px',
        }}>
          Activité globale — 30 derniers jours
        </p>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap:                 12,
        }}>
          <StatCard icon={<IconMessageSquare />} label="Messages envoyés" value={globalStats?.messages  ?? 0} loading={loadingStats} />
          <StatCard icon={<IconPhone />}         label="Appels effectués" value={globalStats?.calls     ?? 0} loading={loadingStats} />
          <StatCard icon={<IconCode />}          label="Appels API"       value={globalStats?.api_calls ?? 0} loading={loadingStats} />
        </div>
      </section>

      {/* ─── Liste projets ───────────────────────────────────────────────────── */}
      <section aria-label="Mes projets">
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   14,
          gap:            12,
          flexWrap:       'wrap',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: 0 }}>
            Mes projets
          </h2>

          {/* Compteur req 3.8 */}
          {!loadingProjects && (
            <div
              aria-label={`${activeProjects.length} projet(s) sur ${PROJECT_LIMIT} maximum`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <div
                aria-hidden="true"
                style={{
                  width:        72,
                  height:       5,
                  background:   '#E0E0E0',
                  borderRadius: 999,
                  overflow:     'hidden',
                }}
              >
                <div
                  style={{
                    width:        `${Math.min(100, (activeProjects.length / PROJECT_LIMIT) * 100)}%`,
                    height:       '100%',
                    background:   activeProjects.length >= PROJECT_LIMIT ? '#EA4335' : '#1A73E8',
                    borderRadius: 'inherit',
                    transition:   'width 200ms ease',
                  }}
                />
              </div>
              <span style={{
                fontSize:   13,
                fontWeight: 500,
                color:      activeProjects.length >= PROJECT_LIMIT ? '#EA4335' : '#5F6368',
              }}>
                {activeProjects.length} / {PROJECT_LIMIT}
              </span>
            </div>
          )}
        </div>

        {/* Chargement */}
        {loadingProjects && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
            <Spinner size={28} />
          </div>
        )}

        {/* Erreur */}
        {!loadingProjects && projectsError && (
          <div
            role="alert"
            style={{
              padding:      '10px 14px',
              background:   'rgba(234,67,53,.06)',
              border:       '1px solid #EA4335',
              borderLeft:   '3px solid #EA4335',
              borderRadius: 8,
              color:        '#EA4335',
              fontSize:     14,
              marginBottom: 16,
              display:      'flex',
              alignItems:   'center',
              gap:          10,
            }}
          >
            <span style={{ flex: 1 }}>{projectsError}</span>
            <button
              type="button"
              onClick={fetchProjects}
              style={{
                background:     'none',
                border:         'none',
                color:          '#EA4335',
                cursor:         'pointer',
                textDecoration: 'underline',
                fontSize:       13,
                fontFamily:     'inherit',
                padding:        0,
                flexShrink:     0,
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Contenu */}
        {!loadingProjects && !projectsError && (
          activeProjects.length === 0 ? (
            /* État vide institutionnel */
            <div
              style={{
                textAlign:    'center',
                padding:      '56px 32px',
                background:   '#FFFFFF',
                border:       '1px solid #E0E0E0',
                borderRadius: 8,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width:           48,
                  height:          48,
                  borderRadius:    8,
                  backgroundColor: '#F1F3F4',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  margin:          '0 auto 14px',
                  color:           '#9aa0a6',
                }}
              >
                <IconMonitor />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#202124', margin: '0 0 6px' }}>
                Aucun projet pour l'instant
              </h3>
              <p style={{ fontSize: 14, color: '#5F6368', margin: '0 0 20px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
                Créez votre premier projet pour obtenir vos clés API et commencer l'intégration Palabre.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:          6,
                  height:       40,
                  padding:      '0 18px',
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
                <IconPlus />
                Créer mon premier projet
              </button>
            </div>
          ) : (
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap:                 16,
            }}>
              {activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )
        )}
      </section>

      {/* Modale */}
      {showModal && (
        <NewProjectModal
          onClose={handleModalClose}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
