import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { title: 'Messagerie instantanée', text: "Conversations individuelles et de groupe, en temps réel.", color: 'var(--color-primary-blue)' },
  { title: 'Appels audio & vidéo', text: "Communiquez en temps réel, où que soient vos équipes.", color: 'var(--color-success-green)' },
  { title: "Centre d'appels", text: "File d'attente, IVR et assistant IA pour votre support.", color: 'var(--color-warning-amber)' },
  { title: 'Sécurité renforcée', text: "Passkeys, double vérification, données sous votre contrôle.", color: 'var(--color-alert-red)' },
];

const STEPS = [
  { n: '1', title: "Inscrivez votre organisation", text: "Remplissez le formulaire en 4 étapes, reprenable à tout moment." },
  { n: '2', title: "Validation par un super-administrateur", text: "Votre dossier est instruit, avec un retour clair en cas de complément à apporter." },
  { n: '3', title: "Activez votre compte administrateur", text: "Recevez votre code d'activation par e-mail et WhatsApp." },
  { n: '4', title: "Invitez votre équipe", text: "Vos utilisateurs rejoignent l'organisation et commencent à communiquer." },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      <section className="hero fade-in">
        <img src="/logo.png" alt="Palabre" />
        <h1>La plateforme de communication souveraine pour votre organisation</h1>
        <p>
          Messagerie, téléphonie et centre d'appels réunis dans un seul système, hébergé et contrôlé par
          vous — pensé pour le Bénin et l'Afrique francophone.
        </p>
        <div className="cta-row">
          {user ? (
            <Link to="/profile" className="btn">Aller à mon compte</Link>
          ) : (
            <Link to="/login" className="btn">Se connecter</Link>
          )}
          <Link to="/onboarding/new" className="btn btn-secondary">Inscrire mon organisation</Link>
        </div>
      </section>

      <section className="feature-grid">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title} style={{ '--feature-color': f.color }}>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <section className="steps-section">
        <h2 className="section-title">Comment ça marche</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <div className="step-number">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Prêt à centraliser la communication de votre organisation ?</h2>
        <p>La demande d'inscription prend quelques minutes et peut être reprise à tout moment.</p>
        <Link to="/onboarding/new" className="btn btn-block-inline">Inscrire mon organisation</Link>
      </section>
    </div>
  );
}
