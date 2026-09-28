import { Link } from 'react-router-dom';
import LegalToc from '../components/LegalToc';

const LAST_UPDATE = '28 septembre 2026';

const IconInfo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const SECTIONS = [
  { id: 's1',  n: '1',  title: 'Définitions' },
  { id: 's2',  n: '2',  title: 'Objet' },
  { id: 's3',  n: '3',  title: 'Accès au service' },
  { id: 's4',  n: '4',  title: 'Utilisation acceptable' },
  { id: 's5',  n: '5',  title: 'Propriété des données' },
  { id: 's6',  n: '6',  title: 'Disponibilité et niveaux de service' },
  { id: 's7',  n: '7',  title: 'Suspension et résiliation' },
  { id: 's8',  n: '8',  title: 'Propriété intellectuelle' },
  { id: 's9',  n: '9',  title: 'Limitation de responsabilité' },
  { id: 's10', n: '10', title: 'Loi applicable et juridiction' },
  { id: 's11', n: '11', title: 'Modifications des CGU' },
  { id: 's12', n: '12', title: 'Contact' },
];

export default function TermsPage() {
  return (
    <>
      {/* Hero */}
      <div className="legal-hero fade-in">
        <div className="legal-hero-inner">
          <h1>Conditions générales d'utilisation</h1>
          <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            Les règles qui régissent votre accès et votre utilisation de la plateforme Palabre.
          </p>
          <div className="legal-hero-meta">
            <span>Dernière mise à jour : <strong style={{ color: '#fff' }}>{LAST_UPDATE}</strong></span>
            <span className="legal-hero-badge">Droit béninois applicable</span>
            <span className="legal-hero-badge">Loi n° 2017-20</span>
          </div>
        </div>
      </div>

      {/* Layout 2 colonnes */}
      <div className="legal-layout">

        {/* Table des matières */}
        <LegalToc sections={SECTIONS} />

        {/* Corps */}
        <article className="legal-body">

          <div className="legal-callout">
            <span className="legal-callout-icon"><IconInfo /></span>
            <p>
              En accédant à la plateforme ou en soumettant une demande d'inscription, vous acceptez sans
              réserve les présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser
              le service.
            </p>
          </div>

          <h2 id="s1">1. Définitions</h2>
          <ul>
            <li><strong>Plateforme :</strong> l'ensemble des services accessibles via Palabre (web, mobile, API).</li>
            <li><strong>Organisation :</strong> toute personne morale dont la demande d'inscription a été validée.</li>
            <li><strong>Administrateur :</strong> la personne physique désignée par l'Organisation pour gérer son espace.</li>
            <li><strong>Utilisateur :</strong> tout membre invité par une Organisation pour accéder aux services.</li>
            <li><strong>Super-administrateur :</strong> l'opérateur de la plateforme Palabre, seul habilité à valider les inscriptions et à intervenir sur l'infrastructure.</li>
            <li><strong>Contenu :</strong> messages, fichiers, enregistrements et toutes données émises par un Utilisateur via la plateforme.</li>
          </ul>

          <h2 id="s2">2. Objet</h2>
          <p>
            Palabre fournit une plateforme de communication unifiée : messagerie instantanée, appels
            audio/vidéo, centre d'appels, destinée aux organisations béninoises et africaines francophones
            souhaitant maîtriser leur infrastructure de communication.
          </p>

          <h2 id="s3">3. Accès au service</h2>
          <h3>3.1 Inscription de l'Organisation</h3>
          <p>
            L'accès est conditionné à la soumission et à la validation d'un dossier d'inscription par le
            super-administrateur. Ce dossier comprend la dénomination, les coordonnées, l'identité du
            dirigeant et des documents justificatifs (RCCM, attestation IFU, pièce d'identité).
          </p>
          <p>
            Palabre se réserve le droit de refuser ou de suspendre toute demande ne satisfaisant pas aux
            critères d'éligibilité, avec un motif communiqué par e-mail.
          </p>
          <h3>3.2 Compte Administrateur</h3>
          <p>
            Lors de la validation, un compte administrateur est créé pour le dirigeant désigné. Un
            identifiant d'organisation et un code d'activation à usage unique lui sont transmis par e-mail
            et WhatsApp. Ce code expire 72 heures après son émission.
          </p>
          <p>
            L'Administrateur est responsable de la sécurité de ses moyens d'authentification et de toutes
            les actions effectuées depuis son compte.
          </p>
          <h3>3.3 Comptes Utilisateurs</h3>
          <p>
            L'Administrateur est seul responsable de l'invitation et de la gestion des Utilisateurs. Il
            s'assure que chaque Utilisateur prend connaissance des présentes CGU.
          </p>

          <h2 id="s4">4. Utilisation acceptable</h2>
          <p>L'Organisation et ses Utilisateurs s'engagent à :</p>
          <ul>
            <li>Utiliser la plateforme conformément aux lois applicables, notamment la loi n°&nbsp;2017-20 portant code du numérique au Bénin.</li>
            <li>Ne pas transmettre de contenu illicite, diffamatoire, menaçant ou portant atteinte aux droits de tiers.</li>
            <li>Ne pas tenter de contourner les mécanismes de sécurité ni d'accéder aux données d'autres Organisations.</li>
            <li>Ne pas utiliser la plateforme à des fins de spam, phishing ou toute activité frauduleuse.</li>
            <li>Signaler toute faille de sécurité constatée à <a href="mailto:security@palabre.app">security@palabre.app</a>.</li>
          </ul>

          <h2 id="s5">5. Propriété des données et confidentialité</h2>
          <p>
            Les données et Contenus créés par une Organisation lui appartiennent. Palabre n'accède pas
            au contenu des messages et appels, chiffrés de bout en bout.
          </p>
          <p>
            Le traitement des données personnelles est régi par la{' '}
            <Link to="/privacy">politique de confidentialité</Link>, dont les dispositions s'incorporent
            par référence aux présentes CGU.
          </p>

          <h2 id="s6">6. Disponibilité et niveaux de service</h2>
          <p>
            Palabre s'engage à maintenir la plateforme accessible avec un objectif de disponibilité de
            <strong> 99,5 %</strong> par mois, hors maintenances planifiées. Les maintenances sont
            notifiées avec un préavis minimum de 48 heures, sauf urgence de sécurité.
          </p>

          <h2 id="s7">7. Suspension et résiliation</h2>
          <h3>7.1 Par Palabre</h3>
          <p>Palabre peut suspendre ou résilier l'accès en cas de :</p>
          <ul>
            <li>Violation des présentes CGU ou de la politique de confidentialité.</li>
            <li>Non-paiement de l'abonnement applicable.</li>
            <li>Activité compromettant la sécurité ou l'intégrité de la plateforme.</li>
            <li>Injonction d'une autorité judiciaire ou administrative compétente.</li>
          </ul>
          <p>
            La suspension prend effet immédiatement au niveau applicatif. L'Organisation concernée en est
            notifiée par e-mail.
          </p>
          <h3>7.2 Par l'Organisation</h3>
          <p>
            La clôture du compte peut être demandée à tout moment à{' '}
            <a href="mailto:support@palabre.app">support@palabre.app</a>. Les données sont supprimées
            conformément à la politique de conservation.
          </p>

          <h2 id="s8">8. Propriété intellectuelle</h2>
          <p>
            La marque Palabre, son logo, ses interfaces et son code source sont la propriété exclusive de
            Palabre SAS. Toute reproduction ou exploitation non autorisée est interdite.
          </p>
          <p>
            Les Contenus créés par une Organisation restent sa propriété. En les téléversant, l'Organisation
            accorde à Palabre une licence technique limitée, non exclusive et non cessible, strictement
            nécessaire au fonctionnement du service.
          </p>

          <h2 id="s9">9. Limitation de responsabilité</h2>
          <p>Dans les limites autorisées par la loi, Palabre ne saurait être tenu responsable :</p>
          <ul>
            <li>Des dommages indirects ou pertes d'exploitation résultant de l'utilisation ou de l'indisponibilité temporaire du service.</li>
            <li>Des Contenus échangés entre Utilisateurs, dont l'Organisation demeure seule responsable.</li>
            <li>Des incidents résultant d'une négligence de l'Administrateur ou d'un Utilisateur (partage de code d'accès, appareil compromis).</li>
          </ul>

          <h2 id="s10">10. Loi applicable et juridiction</h2>
          <p>
            Les présentes CGU sont régies par le <strong>droit béninois</strong>. En cas de litige, les parties
            s'engagent à rechercher une solution amiable avant tout recours judiciaire. A défaut, les
            tribunaux compétents de <strong>Cotonou, République du Bénin</strong> seront seuls compétents.
          </p>

          <h2 id="s11">11. Modifications des CGU</h2>
          <p>
            Toda modification substantielle sera notifiée par e-mail et affichée en page d'accueil avec un
            préavis de <strong>30 jours</strong>. La poursuite de l'utilisation vaut acceptation des
            nouvelles conditions.
          </p>

          <h2 id="s12">12. Contact</h2>
          <div className="legal-contact-card">
            <h3>Questions juridiques</h3>
            <p>
              <a href="mailto:legal@palabre.app">legal@palabre.app</a><br />
              Palabre SAS, Cotonou, République du Bénin
            </p>
          </div>

          <div className="legal-footer-links">
            <Link to="/privacy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Politique de confidentialité
            </Link>
            <Link to="/">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/></svg>
              Accueil
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
