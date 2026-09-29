import { useState } from 'react';
import { api } from '../../lib/apiClient';
import { Alert, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { friendlyMessage } from '../../lib/errorMessages';

export default function OrgApkPage() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('');
  const [error,  setError]  = useState('');
  const [apkUrl, setApkUrl] = useState('');

  async function generate() {
    setError(''); setNotice(''); setGenerating(true);
    try {
      const result = await api.post(`/org/${user?.orgId}/apk/generate`);
      setApkUrl(result.downloadUrl);
      setNotice('APK genere avec succes. Telechargez-le et partagez-le a vos utilisateurs.');
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1>Application mobile</h1>
      <p className="text-secondary">
        Etape 10 : Generez l'APK personnalise de votre organisation en un clic.
      </p>

      {error  && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="card" style={{ borderTop: '4px solid var(--color-warning-amber)' }}>
        <h2>Generer l'APK</h2>
        <p className="text-secondary">
          L'application sera preconfiguree avec l'identite visuelle et les parametres de votre
          organisation. La compilation prend entre 2 et 5 minutes.
        </p>
        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-success"
            onClick={generate}
            disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {generating && <Spinner />}
            {generating ? 'Compilation en cours...' : 'Generer l\'APK maintenant'}
          </button>
          {apkUrl && (
            <a href={apkUrl} download className="btn btn-secondary">
              Telecharger l'APK
            </a>
          )}
        </div>
        {generating && (
          <div style={{ padding: '12px 16px', background: 'var(--color-offwhite)', border: '1px solid var(--color-border)', fontSize: 14 }}>
            Compilation en cours... Vous serez notifie par e-mail a la fin.
          </div>
        )}
      </div>

      <div className="card">
        <h2>Distribution</h2>
        <p className="text-secondary">Une fois l'APK telecharge :</p>
        <ol style={{ lineHeight: 2, paddingLeft: 20, fontSize: 15 }}>
          <li>Partagez l'APK a vos utilisateurs par e-mail, WhatsApp, ou serveur interne.</li>
          <li>Les utilisateurs l'installent en activant "Sources inconnues" sur Android.</li>
          <li>A l'ouverture, l'app est deja configuree pour votre organisation — pas de saisie de serveur.</li>
          <li>Chaque utilisateur cree son compte ou se connecte avec son numero de telephone.</li>
        </ol>
      </div>
    </div>
  );
}
