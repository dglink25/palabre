/**
 * TermsPage.jsx - Palabre for Developers
 * Conditions générales d'utilisation du portail développeur.
 * Structure identique à Palabre web : héro bleu + TOC + corps légal.
 */

import { Link } from 'react-router-dom';
import LegalLayout from '../components/LegalLayout.jsx';

const LAST_UPDATE = '6 octobre 2025';

const IconInfo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const SECTIONS = [
  { id: 's1',  n: '1',  title: 'Définitions' },
  { id: 's2',  n: '2',  title: 'Objet' },
  { id: 's3',  n: '3',  title: 'Accès au portail' },
  { id: 's4',  n: '4',  title: 'Utilisation des clés API' },
  { id: 's5',  n: '5',  title: 'Utilisation acceptable' },
  { id: 's6',  n: '6',  title: 'Propriété des données' },
  { id: 's7',  n: '7',  title: 'Disponibilité et SLA' },
  { id: 's8',  n: '8',  title: 'Suspension et résiliation' },
  { id: 's9',  n: '9',  title: 'Propriété intellectuelle' },
  { id: 's10', n: '10', title: 'Limitation de responsabilité' },
  { id: 's11', n: '11', title: 'Loi applicable' },
  { id: 's12', n: '12', title: 'Modifications' },
  { id: 's13', n: '13', title: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Conditions générales d'utilisation"
      subtitle="Les règles qui régissent votre accès et votre utilisation du portail développeur Palabre et de ses APIs."
      badges={['Portail Développeur', 'Droit béninois applicable', `Mise à jour : ${LAST_UPDATE}`]}
      sections={SECTIONS}
    >
      <div className="legal-callout">
        <span className="legal-callout-icon"><IconInfo /></span>
        <p>
          En créant un compte développeur ou en utilisant les APIs Palabre, vous acceptez sans réserve
          les présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service.
        </p>
      </div>

      <h2 id="s1">1. Définitions</h2>
      <ul>
        <li><strong>Portail Développeur :</strong> l'interface accessible à <code>developer.palabre.app</code> permettant la création et la gestion de projets d'intégration.</li>
        <li><strong>Developer_Account :</strong> compte développeur créé automatiquement lors du premier accès via SSO Palabre.</li>
        <li><strong>Developer_Project :</strong> unité de configuration regroupant clés API, webhooks et statistiques.</li>
        <li><strong>Publishable Key :</strong> clé API publique utilisable côté client (préfixe <code>pk_live_</code>).</li>
        <li><strong>Secret Key :</strong> clé API privée à usage serveur uniquement (préfixe <code>sk_live_</code>).</li>
        <li><strong>API Gateway :</strong> ensemble des routes backend Palabre accessibles sous <code>/api/v1/developer/*</code>.</li>
        <li><strong>Application Tierce :</strong> application développée et exploitée par le Développeur en utilisant les APIs Palabre.</li>
        <li><strong>Utilisateur Final :</strong> personne utilisant l'Application Tierce du Développeur.</li>
      </ul>

      <h2 id="s2">2. Objet</h2>
      <p>
        Palabre for Developers est une plateforme CPaaS (Communication Platform as a Service) permettant
        aux développeurs d'intégrer des fonctionnalités de communication (messagerie chiffrée E2E,
        appels WebRTC, vidéoconférence, notifications push) dans leurs applications, sans dupliquer
        l'infrastructure de communication.
      </p>
      <p>
        Les présentes CGU régissent l'accès et l'utilisation du Portail Développeur, de l'API Gateway,
        des SDKs (JavaScript et Flutter) et de tout outil mis à disposition par Palabre dans ce cadre.
      </p>

      <h2 id="s3">3. Accès au portail</h2>
      <h3>3.1 Éligibilité</h3>
      <p>
        L'accès au Portail Développeur est ouvert à toute personne physique majeure ou morale disposant
        d'un compte Palabre valide. L'authentification s'effectue par SSO (Google, GitHub ou OTP WhatsApp)
        via le compte Palabre existant.
      </p>
      <h3>3.2 Création du compte développeur</h3>
      <p>
        Un Developer_Account est créé automatiquement lors du premier accès. Aucune inscription
        distincte n'est requise. Le Développeur est responsable de la sécurité de ses moyens
        d'authentification et de toutes les actions effectuées depuis son compte.
      </p>
      <h3>3.3 Projets</h3>
      <p>
        Chaque Developer_Project génère automatiquement une paire de clés API (Publishable Key +
        Secret Key). La Secret Key est affichée une seule fois à la création. Le Développeur est
        seul responsable de sa conservation sécurisée.
      </p>

      <h2 id="s4">4. Utilisation des clés API</h2>
      <p>Le Développeur s'engage à :</p>
      <ul>
        <li>Utiliser la Publishable Key uniquement côté client ; la Secret Key exclusivement côté serveur.</li>
        <li>Ne jamais exposer la Secret Key dans un dépôt de code public, une application mobile ou tout environnement accessible aux utilisateurs finaux.</li>
        <li>Mettre en place une rotation des clés au minimum tous les 12 mois, ou immédiatement en cas de compromission suspectée.</li>
        <li>Ne pas partager les clés entre des projets distincts.</li>
        <li>Respecter la limite de débit de <strong>1 000 requêtes par minute</strong> par projet.</li>
      </ul>
      <p>
        En cas de dépassement répété ou d'utilisation abusive, Palabre se réserve le droit de révoquer
        les clés sans préavis.
      </p>

      <h2 id="s5">5. Utilisation acceptable</h2>
      <p>Le Développeur s'engage à ne pas utiliser les APIs Palabre pour :</p>
      <ul>
        <li>Transmettre du contenu illicite, diffamatoire, menaçant, haineux ou portant atteinte aux droits de tiers.</li>
        <li>Spammer, hameçonner ou mener toute activité frauduleuse auprès des Utilisateurs Finaux.</li>
        <li>Contourner les mécanismes de sécurité ou tenter d'accéder aux données d'autres projets ou organisations.</li>
        <li>Reproduire ou redistribuer les APIs Palabre comme service concurrent.</li>
        <li>Violer les droits à la vie privée des Utilisateurs Finaux.</li>
        <li>Développer des applications destinées à des activités illégales au regard du droit béninois ou international.</li>
      </ul>
      <p>
        Toute faille de sécurité constatée doit être signalée à{' '}
        <a href="mailto:security@palabre.app">security@palabre.app</a>.
      </p>

      <h2 id="s6">6. Propriété des données</h2>
      <p>
        Les données de configuration (projets, webhooks) et les statistiques d'usage appartiennent
        au Développeur. Palabre les héberge et les traite uniquement pour fournir le service.
      </p>
      <p>
        Les données des Utilisateurs Finaux transitant via l'API Gateway appartiennent à ces
        utilisateurs. Le Développeur est responsable d'obtenir leur consentement conformément au
        droit applicable et d'informer Palabre de toute exigence de traitement particulière.
      </p>
      <p>
        Le traitement des données personnelles est régi par la{' '}
        <Link to="/privacy">Politique de confidentialité</Link> du Portail Développeur.
      </p>

      <h2 id="s7">7. Disponibilité et niveaux de service</h2>
      <p>
        Palabre s'engage à maintenir l'API Gateway avec un objectif de disponibilité de{' '}
        <strong>99,5 % par mois</strong>, hors maintenances planifiées. Les maintenances sont notifiées
        par e-mail avec un préavis minimum de 48 heures, sauf urgence de sécurité.
      </p>
      <p>
        Les statistiques d'usage sont mises à jour avec un délai maximal de 60 secondes.
        Les données historiques sont conservées 90 jours, y compris après suppression d'un projet.
      </p>

      <h2 id="s8">8. Suspension et résiliation</h2>
      <h3>8.1 Par Palabre</h3>
      <p>Palabre peut suspendre ou résilier l'accès en cas de :</p>
      <ul>
        <li>Violation des présentes CGU ou de la Politique de confidentialité.</li>
        <li>Utilisation abusive des ressources (dépassements répétés, attaques).</li>
        <li>Activité compromettant la sécurité ou l'intégrité de la plateforme.</li>
        <li>Injonction d'une autorité judiciaire ou administrative compétente.</li>
      </ul>
      <h3>8.2 Par le Développeur</h3>
      <p>
        La clôture du compte développeur peut être demandée à tout moment. Les projets et leurs
        données sont supprimés selon la politique de conservation (90 jours pour les statistiques).
      </p>

      <h2 id="s9">9. Propriété intellectuelle</h2>
      <p>
        La marque Palabre, son logo, ses interfaces et son code source sont la propriété exclusive de
        Palabre. Toute reproduction ou exploitation non autorisée est interdite.
      </p>
      <p>
        Les SDKs (palabre-sdk, palabre_flutter) sont mis à disposition sous licence MIT.
        Le Développeur conserve la propriété de son code d'intégration et de ses Applications Tierces.
      </p>

      <h2 id="s10">10. Limitation de responsabilité</h2>
      <p>Dans les limites autorisées par la loi, Palabre ne saurait être tenu responsable :</p>
      <ul>
        <li>Des dommages résultant d'une utilisation non conforme aux présentes CGU ou à la documentation technique.</li>
        <li>Des incidents résultant de la compromission des clés API par négligence du Développeur.</li>
        <li>Du contenu échangé entre Utilisateurs Finaux via les Applications Tierces.</li>
        <li>Des pertes d'exploitation résultant de dépassements de limite de débit ou de maintenances planifiées.</li>
      </ul>

      <h2 id="s11">11. Loi applicable et juridiction</h2>
      <p>
        Les présentes CGU sont régies par le <strong>droit béninois</strong>, notamment la loi n°&nbsp;2017-20
        portant code du numérique au Bénin. En cas de litige, les parties s'engagent à rechercher une
        solution amiable. À défaut, les tribunaux compétents de{' '}
        <strong>Cotonou, République du Bénin</strong> seront seuls compétents.
      </p>

      <h2 id="s12">12. Modifications des CGU</h2>
      <p>
        Toute modification substantielle sera notifiée par e-mail au moins <strong>30 jours</strong> à
        l'avance. La poursuite de l'utilisation du Portail Développeur vaut acceptation des nouvelles conditions.
        La version en vigueur est toujours accessible à cette adresse.
      </p>

      <h2 id="s13">13. Contact</h2>
      <div className="legal-contact-card">
        <h3>Questions juridiques - Portail Développeur</h3>
        <p>
          <a href="mailto:developers@palabre.app">developers@palabre.app</a><br />
          Palabre, Cotonou, République du Bénin
        </p>
      </div>

      <div className="legal-footer-links">
        <Link to="/privacy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Politique de confidentialité
        </Link>
        <Link to="/">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
          </svg>
          Accueil
        </Link>
      </div>
    </LegalLayout>
  );
}
