/**
 * KnowledgePage - Administration de la base de connaissance et de la config IVR
 * Route : /admin/knowledge
 * Super-admin uniquement.
 *
 * Onglets :
 *   1. Base de connaissance  - CRUD des entrées Q/R
 *   2. Configuration IVR     - Options du menu vocal et paramètres de l'agent
 *   3. Candidats             - Suggestions issues des feedbacks utilisateurs
 */
import { useState, useEffect, useCallback } from 'react';
import { kbApi, ivrConfigApi, ivrApi } from '../../lib/aiApi';
import { useNotification } from '../../context/NotificationContext';

// ── Constantes ─────────────────────────────────────────────────────────────────

const KB_TYPES = [
  { value: 'general',        label: 'Général' },
  { value: 'technique',      label: 'Technique (Option 1)' },
  { value: 'videoconference',label: 'Vidéoconférence (Option 2)' },
  { value: 'installation',   label: 'Installation / Organisation (Option 3)' },
  { value: 'developer',      label: 'Développeurs (Option 4)' },
  { value: 'facturation',    label: 'Facturation' },
  { value: 'compte',         label: 'Compte utilisateur' },
  { value: 'autre',          label: 'Autre' },
];

const IVR_OPTIONS = [
  { value: '',  label: 'Toutes les catégories' },
  { value: '1', label: 'Option 1 - Technique' },
  { value: '2', label: 'Option 2 - Vidéoconférence' },
  { value: '3', label: 'Option 3 - Installation' },
  { value: '4', label: 'Option 4 - Développeurs' },
];

// ── Styles réutilisables ────────────────────────────────────────────────────────

const S = {
  page: { padding: '24px', maxWidth: 1100, margin: '0 auto' },
  header: { marginBottom: 24 },
  h1: { fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  sub: { fontSize: 14, color: '#5F6368', margin: 0 },
  tabs: { display: 'flex', borderBottom: '2px solid #E0E0E0', marginBottom: 24, gap: 0 },
  tab: (active) => ({
    padding: '10px 22px', border: 'none', background: 'none',
    fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: active ? 700 : 500,
    color: active ? '#1A73E8' : '#5F6368',
    borderBottom: active ? '2px solid #1A73E8' : '2px solid transparent',
    marginBottom: -2, cursor: 'pointer', transition: 'color 0.15s',
  }),
  card: { background: '#fff', border: '1px solid #E0E0E0', padding: 20, marginBottom: 16 },
  row: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  label: { fontSize: 12, fontWeight: 600, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 },
  input: { padding: '8px 10px', border: '1px solid #DADCE0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '8px 10px', border: '1px solid #DADCE0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 80 },
  select: { padding: '8px 10px', border: '1px solid #DADCE0', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' },
  btn: (color = '#1A73E8', outline = false) => ({
    padding: '7px 16px', border: outline ? `1px solid ${color}` : 'none',
    background: outline ? 'transparent' : color, color: outline ? color : '#fff',
    fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'opacity 0.15s', whiteSpace: 'nowrap',
  }),
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 700,
    background: color + '20', color,
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '9px 12px', background: '#F8F9FA', borderBottom: '2px solid #E0E0E0', fontWeight: 600, color: '#5F6368', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.4px' },
  td: { padding: '9px 12px', borderBottom: '1px solid #F1F3F4', verticalAlign: 'top', color: '#202124' },
  empty: { padding: '40px 24px', textAlign: 'center', color: '#9AA0A6', fontSize: 14 },
  err: { padding: '10px 14px', background: '#FDE8E8', border: '1px solid #EA4335', fontSize: 13, color: '#C5221F', marginBottom: 14 },
  success: { padding: '10px 14px', background: '#E6F4EA', border: '1px solid #34A853', fontSize: 13, color: '#137333', marginBottom: 14 },
};

// ── Composant formulaire entrée KB ─────────────────────────────────────────────

function KbEntryForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { question: '', response: '', type: 'general', ivr_option: null });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.response.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ ...S.card, background: '#F8F9FA' }}>
      <div style={S.row}>
        <div style={{ flex: 2, minWidth: 280 }}>
          <label style={S.label}>Question</label>
          <input style={S.input} value={form.question}
            onChange={e => set('question', e.target.value)}
            placeholder="Ex : Comment réinitialiser mon mot de passe ?"
            required />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={S.label}>Catégorie</label>
          <select style={S.select} value={form.type} onChange={e => set('type', e.target.value)}>
            {KB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={S.label}>Option IVR</label>
          <select style={S.select}
            value={form.ivr_option == null ? '' : String(form.ivr_option)}
            onChange={e => set('ivr_option', e.target.value === '' ? null : parseInt(e.target.value, 10))}>
            <option value="">Globale (aucune)</option>
            <option value="1">Option 1 - Technique</option>
            <option value="2">Option 2 - Vidéoconférence</option>
            <option value="3">Option 3 - Installation</option>
            <option value="4">Option 4 - Développeurs</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>Réponse</label>
        <textarea style={S.textarea} value={form.response}
          onChange={e => set('response', e.target.value)}
          placeholder="Réponse complète que l'agent AI utilisera..."
          required />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving} style={S.btn()}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onCancel} style={S.btn('#5F6368', true)}>
          Annuler
        </button>
      </div>
    </form>
  );
}

// ── Onglet 1 : Base de connaissance ───────────────────────────────────────────

function KbTab() {
  const { notify } = useNotification();
  const [entries, setEntries]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [filters, setFilters]   = useState({ type: '', ivr_option: '', search: '', active: true });
  const [offset, setOffset]     = useState(0);
  const LIMIT = 20;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        active: filters.active,
        limit: LIMIT,
        offset,
      };
      if (filters.type)       params.type       = filters.type;
      if (filters.ivr_option) params.ivrOption  = parseInt(filters.ivr_option, 10);
      if (filters.search)     params.search     = filters.search;
      const data = await kbApi.list(params);
      setEntries(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, offset, notify]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    kbApi.stats().then(setStats).catch(() => {});
  }, []);

  const handleSave = async (form) => {
    try {
      if (editing) {
        await kbApi.update(editing.id, {
          question:   form.question,
          response:   form.response,
          type:       form.type,
          ivr_option: form.ivr_option,
        });
        notify.success('Entrée mise à jour.');
      } else {
        await kbApi.create(form);
        notify.success('Entrée créée.');
      }
      setShowForm(false);
      setEditing(null);
      loadEntries();
      kbApi.stats().then(setStats).catch(() => {});
    } catch (e) {
      notify.error(e.message);
      throw e;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette entrée définitivement ?')) return;
    try {
      await kbApi.delete(id);
      notify.success('Entrée supprimée.');
      loadEntries();
    } catch (e) {
      notify.error(e.message);
    }
  };

  const handleToggle = async (entry) => {
    try {
      await kbApi.toggle(entry.id, !entry.active);
      notify.success(entry.active ? 'Entrée désactivée.' : 'Entrée activée.');
      loadEntries();
    } catch (e) {
      notify.error(e.message);
    }
  };

  const handleSync = async () => {
    try {
      const r = await kbApi.sync();
      notify.success(`Re-indexation : ${r.indexed} entrées indexées.`);
    } catch (e) {
      notify.error(e.message);
    }
  };

  const typeLabel = (t) => KB_TYPES.find(x => x.value === t)?.label || t;
  const typeColor = { technique: '#1A73E8', videoconference: '#9334E6', installation: '#34A853', developer: '#FF6D00', general: '#5F6368', facturation: '#FBBC05', compte: '#00BCD4', autre: '#9AA0A6' };

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Entrées actives',    value: stats.total_active_entries },
            { label: 'Entrées indexées',   value: stats.indexed_embeddings },
            { label: 'Candidats en attente', value: stats.pending_candidates },
          ].map(s => (
            <div key={s.label} style={{ background: '#F8F9FA', border: '1px solid #E0E0E0', padding: '12px 18px', minWidth: 160 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#202124' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Barre d'outils */}
      <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...S.input, width: 200 }} placeholder="Rechercher..."
            value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setOffset(0); }} />
          <select style={S.select} value={filters.type}
            onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setOffset(0); }}>
            <option value="">Toutes les catégories</option>
            {KB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select style={S.select} value={filters.ivr_option}
            onChange={e => { setFilters(f => ({ ...f, ivr_option: e.target.value })); setOffset(0); }}>
            {IVR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5F6368', cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.active}
              onChange={e => { setFilters(f => ({ ...f, active: e.target.checked })); setOffset(0); }} />
            Actives uniquement
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSync} style={S.btn('#5F6368', true)}>
            Re-indexer
          </button>
          <button onClick={() => { setEditing(null); setShowForm(v => !v); }} style={S.btn()}>
            {showForm ? 'Fermer' : 'Nouvelle entrée'}
          </button>
        </div>
      </div>

      {/* Formulaire */}
      {(showForm || editing) && (
        <KbEntryForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Table */}
      {loading ? (
        <div style={S.empty}>Chargement…</div>
      ) : entries.length === 0 ? (
        <div style={S.empty}>Aucune entrée trouvée.</div>
      ) : (
        <>
          <table style={S.table}>
            <thead>
              <tr>
                {['Question', 'Catégorie', 'IVR', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td style={{ ...S.td, maxWidth: 340 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{entry.question}</div>
                    <div style={{ fontSize: 12, color: '#5F6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                      {entry.response}
                    </div>
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(typeColor[entry.type] || '#5F6368')}>
                      {typeLabel(entry.type)}
                    </span>
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    {entry.ivr_option ? (
                      <span style={S.badge('#1A73E8')}>Option {entry.ivr_option}</span>
                    ) : (
                      <span style={{ color: '#9AA0A6', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(entry.active ? '#34A853' : '#9AA0A6')}>
                      {entry.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => { setEditing(entry); setShowForm(false); }}
                      style={{ ...S.btn('#1A73E8', true), marginRight: 6, padding: '4px 10px' }}>
                      Modifier
                    </button>
                    <button onClick={() => handleToggle(entry)}
                      style={{ ...S.btn(entry.active ? '#FF6D00' : '#34A853', true), marginRight: 6, padding: '4px 10px' }}>
                      {entry.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => handleDelete(entry.id)}
                      style={{ ...S.btn('#EA4335', true), padding: '4px 10px' }}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13, color: '#5F6368' }}>
            <span>{total} entrée{total !== 1 ? 's' : ''} au total</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                style={{ ...S.btn('#5F6368', true), padding: '5px 12px', opacity: offset === 0 ? 0.4 : 1 }}>
                Précédent
              </button>
              <button disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}
                style={{ ...S.btn('#5F6368', true), padding: '5px 12px', opacity: offset + LIMIT >= total ? 0.4 : 1 }}>
                Suivant
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Onglet 2 : Configuration IVR ──────────────────────────────────────────────

function IvrConfigTab() {
  const { notify } = useNotification();
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [agentForm, setAgentForm] = useState(null);
  const [ivrOptions, setIvrOptions] = useState(null);

  useEffect(() => {
    ivrApi.getConfig().then(data => {
      setConfig(data);
      setAgentForm({
        agent_name:       data.agent?.agent_name || '',
        welcome_message:  data.agent?.welcome_message || '',
        fallback_message: data.agent?.fallback_message || '',
        avatar_url:       data.agent?.avatar_url || '',
        voice_enabled:    data.agent?.voice_enabled || false,
      });
      setIvrOptions(data.ivr?.options || []);
    }).catch(e => notify.error(e.message))
      .finally(() => setLoading(false));
  }, [notify]);

  const saveAgent = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ivrConfigApi.updateAgent(agentForm);
      notify.success('Paramètres de l\'agent enregistrés.');
    } catch (e) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveIvr = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ivrConfigApi.updateConfig(ivrOptions);
      notify.success('Configuration IVR enregistrée.');
    } catch (e) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateOption = (idx, field, value) => {
    setIvrOptions(opts => opts.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  };

  if (loading) return <div style={S.empty}>Chargement…</div>;

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

      {/* Paramètres de l'agent */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 16px' }}>
          Paramètres de l'agent
        </h3>
        {agentForm && (
          <form onSubmit={saveAgent} style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Nom de l'agent</label>
              <input style={S.input} value={agentForm.agent_name}
                onChange={e => setAgentForm(f => ({ ...f, agent_name: e.target.value }))}
                placeholder="Ex : Assistant Palabre" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Message d'accueil</label>
              <textarea style={{ ...S.textarea, minHeight: 120 }} value={agentForm.welcome_message}
                onChange={e => setAgentForm(f => ({ ...f, welcome_message: e.target.value }))}
                placeholder="Message lu à l'utilisateur à l'ouverture du service client..." />
              <p style={{ fontSize: 11, color: '#9AA0A6', margin: '4px 0 0' }}>
                Inclure les instructions de navigation (tapez 1, tapez 2, etc.)
              </p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Message de transfert (fallback)</label>
              <textarea style={S.textarea} value={agentForm.fallback_message}
                onChange={e => setAgentForm(f => ({ ...f, fallback_message: e.target.value }))}
                placeholder="Message affiché quand l'agent ne trouve pas de réponse..." />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>URL de l'avatar</label>
              <input style={S.input} value={agentForm.avatar_url}
                onChange={e => setAgentForm(f => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://..." />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#5F6368', cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={agentForm.voice_enabled}
                onChange={e => setAgentForm(f => ({ ...f, voice_enabled: e.target.checked }))} />
              Activer la voix (TTS/STT)
            </label>
            <button type="submit" disabled={saving} style={S.btn()}>
              {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
            </button>
          </form>
        )}
      </div>

      {/* Options du menu IVR */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#202124', margin: '0 0 16px' }}>
          Options du menu IVR
        </h3>
        {ivrOptions && (
          <form onSubmit={saveIvr} style={S.card}>
            {ivrOptions.map((opt, idx) => (
              <div key={idx} style={{ padding: '10px 0', borderBottom: idx < ivrOptions.length - 1 ? '1px solid #F1F3F4' : 'none' }}>
                <div style={S.row}>
                  <div style={{ width: 50 }}>
                    <label style={S.label}>Touche</label>
                    <input style={{ ...S.input, textAlign: 'center', fontWeight: 700 }}
                      value={opt.key} readOnly
                      title="La touche ne peut pas être modifiée ici" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Libellé</label>
                    <input style={S.input} value={opt.label}
                      onChange={e => updateOption(idx, 'label', e.target.value)}
                      placeholder="Libellé de l'option" />
                  </div>
                </div>
                <div>
                  <label style={S.label}>Message de confirmation</label>
                  <input style={S.input} value={opt.prompt || ''}
                    onChange={e => updateOption(idx, 'prompt', e.target.value)}
                    placeholder="Message affiché après sélection de cette option..." />
                </div>
              </div>
            ))}
            <button type="submit" disabled={saving} style={{ ...S.btn(), marginTop: 14 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer la configuration IVR'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Onglet 3 : Candidats ──────────────────────────────────────────────────────

function CandidatesTab() {
  const { notify } = useNotification();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [status, setStatus]         = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await kbApi.candidates(status);
      setCandidates(Array.isArray(data) ? data : []);
    } catch (e) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, notify]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      await kbApi.approveCandidate(id);
      notify.success('Candidat approuvé et ajouté à la base de connaissance.');
      load();
    } catch (e) { notify.error(e.message); }
  };

  const reject = async (id) => {
    try {
      await kbApi.rejectCandidate(id);
      notify.success('Candidat rejeté.');
      load();
    } catch (e) { notify.error(e.message); }
  };

  const statusColor = { pending: '#FBBC05', approved: '#34A853', rejected: '#EA4335' };

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        {['pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            style={S.btn(statusColor[s], status !== s)}>
            {s === 'pending' ? 'En attente' : s === 'approved' ? 'Approuvés' : 'Rejetés'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={S.empty}>Chargement…</div>
      ) : candidates.length === 0 ? (
        <div style={S.empty}>Aucun candidat {status === 'pending' ? 'en attente' : status === 'approved' ? 'approuvé' : 'rejeté'}.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['Question', 'Réponse proposée', 'Votes', 'Statut', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id}>
                <td style={{ ...S.td, maxWidth: 260 }}>
                  <div style={{ fontWeight: 500 }}>{c.question}</div>
                </td>
                <td style={{ ...S.td, maxWidth: 300, fontSize: 12, color: '#5F6368' }}>
                  {c.response}
                </td>
                <td style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>{c.votes}</td>
                <td style={S.td}>
                  <span style={S.badge(statusColor[c.status] || '#9AA0A6')}>
                    {c.status === 'pending' ? 'En attente' : c.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                  </span>
                </td>
                <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                  {c.status === 'pending' && (
                    <>
                      <button onClick={() => approve(c.id)}
                        style={{ ...S.btn('#34A853'), marginRight: 6, padding: '4px 10px' }}>
                        Approuver
                      </button>
                      <button onClick={() => reject(c.id)}
                        style={{ ...S.btn('#EA4335', true), padding: '4px 10px' }}>
                        Rejeter
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'kb',         label: 'Base de connaissance' },
  { id: 'ivr',        label: 'Configuration IVR' },
  { id: 'candidates', label: 'Candidats' },
];

export default function KnowledgePage() {
  const [tab, setTab] = useState('kb');

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>Base de connaissance et IVR</h1>
        <p style={S.sub}>
          Configurez les réponses de l'agent AI, le menu vocal interactif et validez les suggestions d'amélioration.
        </p>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kb'         && <KbTab />}
      {tab === 'ivr'        && <IvrConfigTab />}
      {tab === 'candidates' && <CandidatesTab />}
    </div>
  );
}
