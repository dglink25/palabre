import { Link } from 'react-router-dom';

/**
 * Pied de page structuré comme celui d'insti.edu.bj (référence donnée) :
 * une colonne marque + contact, des colonnes de liens utiles, une barre de
 * copyright. C'est ici, et uniquement ici, que vivent les liens légaux.
 */
export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-grid">
        <div className="public-footer-brand">
          <div className="brand-inline">
            <img src="/logo.png" alt="Palabre" />
            <span>PALABRE</span>
          </div>
          <p className="text-secondary">
            Plateforme de communication, téléphonie et centre d'appels pour les organisations du Bénin et
            d'Afrique francophone.
          </p>
        </div>

        <div className="public-footer-col">
          <h4>Liens utiles</h4>
          <ul>
            <li><Link to="/">Accueil</Link></li>
            <li><Link to="/login">Se connecter</Link></li>
            <li><Link to="/onboarding/new">Inscrire mon organisation</Link></li>
            <li><Link to="/recovery">Récupérer mon compte</Link></li>
          </ul>
        </div>

        <div className="public-footer-col">
          <h4>Légal</h4>
          <ul>
            <li><Link to="/terms">Conditions d'utilisation</Link></li>
            <li><Link to="/privacy">Politique de confidentialité</Link></li>
          </ul>
        </div>

        <div className="public-footer-col">
          <h4>Contact</h4>
          <ul>
            <li className="text-secondary">Cotonou, Bénin</li>
            <li><a href="mailto:contact@palabre.app">contact@palabre.app</a></li>
          </ul>
        </div>
      </div>

      <div className="public-footer-bottom">
        © {new Date().getFullYear()} Palabre. Tous droits réservés.
      </div>
    </footer>
  );
}
