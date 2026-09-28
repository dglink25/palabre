import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { Alert, Badge, Spinner } from '../../components/ui';
import { friendlyMessage } from '../../lib/errorMessages';
import AuthLayout from '../../components/AuthLayout';

const STATUS_VARIANT = { draft: 'neutral', submitted: 'primary', rejected: 'warning', approved: 'success' };
const STATUS_LABEL = { draft: 'Brouillon', submitted: 'Soumise - en instruction', rejected: 'À corriger', approved: 'Approuvée' };

export default function OnboardingStatusPage() {
  const [params] = useSearchParams();
  const requestId = params.get('id');

  // Le jeton peut arriver directement dans le lien envoyé par e-mail/WhatsApp
  // (?token=...) - dans ce cas il fait foi et est aussitôt mémorisé pour cet
  // appareil ; à défaut, on retombe sur celui déjà enregistré localement.
  const urlToken = params.get('token');
  if (requestId && urlToken) {
    localStorage.setItem('palabre_onboarding_draft_' + requestId, urlToken);
  }
  const draftToken = requestId ? (urlToken || localStorage.getItem('palabre_onboarding_draft_' + requestId)) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [request, setRequest] = useState(null);
  const [corrections, setCorrections] = useState({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/onboarding/requests/${requestId}`, { auth: false, headers: { 'X-Draft-Token': draftToken } });
      setRequest(data);
    } catch (e) { setError(friendlyMessage(e)); } finally { setLoading(false); }
  }

  useEffect(() => { if (requestId && draftToken) load(); }, [requestId, draftToken]);

  function setFieldCorrection(fullPath, value) {
    const [column, field] = fullPath.split('.');
    const stepKey = { step1_organization: 'step1', step2_leader: 'step2', step3_documents: 'step3', step4_certification: 'step4' }[column];
    setCorrections((prev) => ({
      ...prev,
      [stepKey]: { ...(prev[stepKey] || {}), [field]: value },
    }));
  }

  async function submitCorrection() {
    setError(''); setNotice('');
    try {
      await api.patch(`/onboarding/requests/${requestId}/correct`, corrections, { auth: false, headers: { 'X-Draft-Token': draftToken } });
      setNotice('Corrections envoyées, demande re-soumise.');
      setCorrections({});
      load();
    } catch (e) { setError(friendlyMessage(e)); }
  }

  if (!requestId || !draftToken) {
    return (
      <AuthLayout>
        <h1>Suivi de demande</h1>
        <Alert variant="warning">
          Lien invalide, ou le jeton d'accès n'est pas enregistré sur cet appareil. Utilisez le lien reçu
          par e-mail ou WhatsApp lors de la soumission de votre demande.
        </Alert>
        <div className="spacer" />
        <p className="text-secondary">
          Pas encore de demande ? <Link to="/onboarding/new">En créer une</Link>.
        </p>
        <p className="text-secondary">
          Déjà un compte ? <Link to="/login">Se connecter</Link>.
        </p>
      </AuthLayout>
    );
  }
  if (loading) return <AuthLayout><Spinner /></AuthLayout>;
  if (!request) return <AuthLayout><Alert variant="danger">{error}</Alert></AuthLayout>;

  return (
    <AuthLayout cardWidth={560}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/" className="text-secondary">Accueil</Link>
        <Link to="/login" className="text-secondary">Se connecter</Link>
      </div>
      <h1>Suivi de votre demande</h1>
      <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      <div className="spacer" />
      <Alert variant="danger">{error}</Alert>
      <Alert variant="success">{notice}</Alert>

      {request.status === 'rejected' && (
        <div>
          <Alert variant="warning"><strong>Motif :</strong> {request.rejection_reason}</Alert>
          <p className="text-secondary">Corrigez uniquement les éléments ci-dessous :</p>
          {(request.flagged_fields || []).map((fieldPath) => (
            <div className="field" key={fieldPath}>
              <label>{fieldPath}</label>
              <input onChange={(e) => setFieldCorrection(fieldPath, e.target.value)} />
            </div>
          ))}
          <button className="btn btn-block" onClick={submitCorrection}>Envoyer les corrections</button>
        </div>
      )}

      {request.status === 'approved' && (
        <Alert variant="success">
          Votre organisation a été approuvée. L'administrateur désigné a reçu son code d'activation par e-mail et WhatsApp.
          <div className="spacer" />
          <Link to="/activate">Activer le compte administrateur</Link>
        </Alert>
      )}

      {request.status === 'submitted' && (
        <p className="text-secondary">Votre demande est en cours d'instruction par le super-administrateur.</p>
      )}
    </AuthLayout>
  );
}
