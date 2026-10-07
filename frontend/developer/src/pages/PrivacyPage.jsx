/**
 * PrivacyPage.jsx - Palabre for Developers
 * Politique de confidentialité du portail développeur.
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
  { id: 's1',  n: '1',  title: 'Responsable du traitement' },
  { id: 's2',  n: '2',  title: 'Données collectées' },
  { id: 's3',  n: '3',  title: 'Finalités et bases légales' },
  { id: 's4',  n: '4',  title: 'Hébergement et transferts' },
  { id: 's5',  n: '5',  title: 'Durée de conservation' },
  { id: 's6',  n: '6',  title: 'Vos droits' },
  { id: 's7',  n: '7',  title: 'Sécurité des données' },
  { id: 's8',  n: '8',  title: 'Stockage local et cookies' },
  { id: 's9',  n: '9',  title: 'Données des utilisateurs finaux' },
  { id: 's10', n: '10', title: 'Modifications' },
  { id: 's11', n: '11', title: 'Contact' },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      subtitle="Comment Palabre for Developers collecte, utilise et protège les données des développeurs et de leurs applications."
      badges={['Portail Développeur', 'Loi n° 2017-20 - Code du numérique Bénin', 'RGPD', 'APDP', `Mise à jour : ${LAST_UPDATE}`]}
      sections={SECTIONS}
    >
      <div className="legal-callout">
        <span className="legal-callout-icon"><IconInfo /></span>
        <p>
          Le traitement de vos données est conforme à la <strong>loi n°&nbsp;2017-20 portant code du
          numérique au Bénin</strong>, aux décisions de l'<strong>APDP</strong> et aux principes
          du <strong>RGPD</strong> européen.
        </p>
      </div>

      <h2 id="s1">1. Responsable du traitement</h2>
      <p>
        <strong>Palabre</strong>, dont le siège social est situé à Cotonou, République du Bénin.<br />
        Délégué à la protection des données (DPO) :{' '}
        <a href="mailto:privacy@palabre.app">privacy@palabre.app</a>
      </p>

      <h2 id="s2">2. Données collectées</h2>
      <p>Dans le cadre du Portail Développeur, nous collectons et traitons :</p>
      <ul>
        <li>
          <strong>Identité et contact :</strong> nom, adresse e-mail et informations de profil
          récupérées via SSO (Google, GitHub) ou OTP WhatsApp au moment de la connexion.
        </li>
        <li>
          <strong>Données de configuration :</strong> noms de projets, descriptions, URLs de webhook,
          configuration white-label (logo, couleurs, nom d'affichage).
        </li>
        <li>
          <strong>Clés API :</strong> la Publishable Key est stockée en clair ; la Secret Key est
          stockée uniquement sous forme de hash SHA-256 (valeur brute jamais conservée).
        </li>
        <li>
          <strong>Statistiques d'usage :</strong> compteurs agrégés de messages, appels, utilisateurs
          actifs et appels API, par projet et par période.
        </li>
        <li>
          <strong>Logs de webhooks :</strong> historique des tentatives de livraison (URL, code HTTP,
          horodatage), conservé 90 jours.
        </li>
        <li>
          <strong>Données de connexion :</strong> adresse IP, agent utilisateur, horodatage des
          sessions, pour la sécurité et la détection d'abus.
        </li>
      </ul>

      <div className="legal-callout">
        <span className="legal-callout-icon"><IconInfo /></span>
        <p>
          Palabre ne collecte <strong>jamais</strong> le contenu des messages ou des appels transitant
          via l'API Gateway. Ces données sont chiffrées de bout en bout et techniquement inaccessibles.
        </p>
      </div>

      <h2 id="s3">3. Finalités et bases légales</h2>
      <table>
        <thead>
          <tr><th>Finalité</th><th>Base légale</th></tr>
        </thead>
        <tbody>
          <tr><td>Création et gestion du compte développeur</td><td>Exécution du contrat</td></tr>
          <tr><td>Authentification SSO et sécurisation des accès</td><td>Exécution du contrat</td></tr>
          <tr><td>Fourniture des APIs et de l'infrastructure</td><td>Exécution du contrat</td></tr>
          <tr><td>Calcul et affichage des statistiques d'usage</td><td>Exécution du contrat</td></tr>
          <tr><td>Envoi de webhooks et gestion des livraisons</td><td>Exécution du contrat</td></tr>
          <tr><td>Détection d'abus et rate limiting</td><td>Intérêt légitime</td></tr>
          <tr><td>Notifications de maintenance et de sécurité</td><td>Intérêt légitime</td></tr>
          <tr><td>Amélioration du portail et des APIs</td><td>Intérêt légitime / Consentement</td></tr>
        </tbody>
      </table>

      <h2 id="s4">4. Hébergement et transferts de données</h2>
      <p>
        L'infrastructure Palabre est hébergée <strong>sur le territoire béninois</strong>, conformément
        aux exigences de souveraineté numérique de la loi n°&nbsp;2017-20. Aucune donnée personnelle
        n'est transférée hors du territoire sans garanties appropriées.
      </p>
      <p>
        Les services tiers utilisés (Firebase pour l'authentification fédérée) sont encadrés par des
        contrats de sous-traitance. Ils ne sont pas autorisés à utiliser vos données à leurs propres
        fins commerciales.
      </p>

      <h2 id="s5">5. Durée de conservation</h2>
      <ul>
        <li><strong>Données de compte actif :</strong> toute la durée de la relation contractuelle.</li>
        <li><strong>Statistiques d'usage :</strong> 90 jours glissants, y compris après suppression d'un projet.</li>
        <li><strong>Logs de webhooks :</strong> 100 dernières entrées par projet, ou 90 jours maximum.</li>
        <li><strong>Sessions et tokens :</strong> révocables à tout moment depuis le compte.</li>
        <li><strong>Compte supprimé :</strong> anonymisation sous 30 jours, sauf obligation légale.</li>
      </ul>

      <h2 id="s6">6. Vos droits</h2>
      <p>Conformément à la loi n°&nbsp;2017-20 et au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles.</li>
        <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes.</li>
        <li><strong>Droit à l'effacement :</strong> demander la suppression de votre compte et de vos données.</li>
        <li><strong>Droit à la limitation :</strong> suspendre l'utilisation de vos données dans certains cas.</li>
        <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré.</li>
        <li><strong>Droit d'opposition :</strong> vous opposer aux traitements fondés sur l'intérêt légitime.</li>
      </ul>
      <p>
        Pour exercer vos droits, contactez{' '}
        <a href="mailto:privacy@palabre.app">privacy@palabre.app</a>.
        Réponse sous 30 jours. Vous pouvez également saisir l'<strong>APDP</strong> ou l'autorité
        de contrôle de votre pays de résidence.
      </p>

      <h2 id="s7">7. Sécurité des données</h2>
      <p>Mesures techniques et organisationnelles en place :</p>
      <ul>
        <li>Secret Keys stockées uniquement sous forme de hash SHA-256 - jamais en clair.</li>
        <li>Période de grâce de 60 secondes lors de la rotation des clés pour éviter les interruptions.</li>
        <li>Rate limiting par projet (1 000 requêtes/minute) via Redis pour prévenir les abus.</li>
        <li>Webhooks signés HMAC-SHA256 pour garantir l'authenticité des événements.</li>
        <li>Authentification SSO sans stockage de mot de passe sur Palabre.</li>
        <li>Rotation automatique des tokens de session et détection de réutilisation.</li>
        <li>Isolation des données par projet : impossible d'accéder aux données d'un autre projet.</li>
        <li>Journal d'audit des actions sensibles (rotation de clés, suppressions de projets).</li>
      </ul>

      <h2 id="s8">8. Stockage local et cookies</h2>
      <p>Le Portail Développeur utilise uniquement le stockage strictement nécessaire :</p>
      <ul>
        <li>
          <code>palabre_access_token</code> en <code>localStorage</code> : token JWT de session
          pour maintenir la connexion au portail.
        </li>
        <li>
          Préférences de navigation (section active dans la documentation) en mémoire de session.
        </li>
      </ul>
      <p>
        Aucun cookie publicitaire, aucun tracker tiers, aucune régie publicitaire sur le Portail Développeur.
      </p>

      <h2 id="s9">9. Données des utilisateurs finaux</h2>
      <p>
        Lorsque vous intégrez les APIs Palabre dans votre Application Tierce, vous devenez
        responsable du traitement des données de vos Utilisateurs Finaux. À ce titre, vous devez :
      </p>
      <ul>
        <li>Informer vos utilisateurs de l'utilisation des APIs Palabre et des données transmises.</li>
        <li>Obtenir les consentements nécessaires conformément au droit applicable dans votre pays.</li>
        <li>Ne pas transmettre à Palabre de données de santé, données biométriques ou données sensibles sans accord préalable.</li>
        <li>Mettre en place votre propre politique de confidentialité décrivant vos pratiques de traitement.</li>
      </ul>
      <p>
        Les données transitant via l'API Gateway (contenu des messages, appels) sont chiffrées de bout
        en bout et ne sont ni lues ni stockées par Palabre.
      </p>

      <h2 id="s10">10. Modifications</h2>
      <p>
        Toute modification substantielle sera notifiée par e-mail au moins <strong>30 jours</strong> à
        l'avance. La version en vigueur est toujours consultable à cette adresse.
      </p>

      <h2 id="s11">11. Contact</h2>
      <div className="legal-contact-card">
        <h3>Protection des données - Portail Développeur</h3>
        <p><strong>Délégué à la protection des données (DPO)</strong></p>
        <p>
          <a href="mailto:privacy@palabre.app">privacy@palabre.app</a><br />
          Palabre, Cotonou, République du Bénin
        </p>
        <p style={{ marginTop: 12 }}>
          Pour toute réclamation auprès de l'autorité de contrôle :<br />
          <strong>APDP</strong> - Autorité de Protection des Données à caractère Personnel du Bénin
        </p>
      </div>

      <div className="legal-footer-links">
        <Link to="/terms">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Conditions d'utilisation
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
