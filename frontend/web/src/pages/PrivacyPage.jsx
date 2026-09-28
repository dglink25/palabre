import { Link } from 'react-router-dom';
import LegalToc from '../components/LegalToc';

const LAST_UPDATE = '28 septembre 2026';

const IconInfo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
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
  { id: 's8',  n: '8',  title: 'Cookies et stockage local' },
  { id: 's9',  n: '9',  title: 'Mineurs' },
  { id: 's10', n: '10', title: 'Modifications' },
  { id: 's11', n: '11', title: 'Contact' },
];

export default function PrivacyPage() {
  return (
    <>
      {/* Hero */}
      <div className="legal-hero fade-in">
        <div className="legal-hero-inner">
          <h1>Politique de confidentialité</h1>
          <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            Comment Palabre collecte, utilise et protège vos données personnelles.
          </p>
          <div className="legal-hero-meta">
            <span>Dernière mise à jour : <strong style={{ color: '#fff' }}>{LAST_UPDATE}</strong></span>
            <span className="legal-hero-badge">Loi n° 2017-20 - Code du numérique Bénin</span>
            <span className="legal-hero-badge">RGPD</span>
            <span className="legal-hero-badge">APDP</span>
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
              Le traitement de vos données est conforme à la <strong>loi n°&nbsp;2017-20 portant code du
              numérique au Bénin</strong>, aux décisions de l'<strong>APDP</strong> (Autorité de Protection
              des Données à caractère Personnel) et aux principes du <strong>RGPD</strong> européen.
            </p>
          </div>

          <h2 id="s1">1. Responsable du traitement</h2>
          <p>
            <strong>Palabre SAS</strong>, dont le siège social est situé à Cotonou, République du Bénin.<br />
            Délégué à la protection des données (DPO) : <a href="mailto:privacy@palabre.app">privacy@palabre.app</a>
          </p>

          <h2 id="s2">2. Données collectées</h2>
          <p>Selon votre usage de la plateforme, nous traitons les catégories suivantes :</p>
          <ul>
            <li><strong>Identité et contact :</strong> nom complet, adresse e-mail, numéro de téléphone international, photo de profil.</li>
            <li><strong>Données d'organisation :</strong> dénomination, siège, pays, ville, adresse, secteur, numéro IFU, documents d'inscription (RCCM, attestation IFU, pièce d'identité du dirigeant, logo).</li>
            <li><strong>Données de connexion :</strong> empreinte d'appareil, plateforme, adresse IP, agent utilisateur, horodatage des sessions.</li>
            <li><strong>Préférences :</strong> langue, fuseau horaire, paramètres de notification.</li>
            <li><strong>Authentification :</strong> hachages de codes OTP, identifiants de passkeys. La clé privée reste sur votre appareil et n'est jamais transmise.</li>
            <li><strong>Journal d'audit :</strong> actions sensibles sur votre compte (connexion, modification, révocation de session).</li>
          </ul>
          <div className="legal-callout">
            <span className="legal-callout-icon"><IconInfo /></span>
            <p>
              Palabre ne collecte <strong>jamais</strong> le contenu de vos messages ou appels.
              Ceux-ci sont chiffrés de bout en bout et techniquement inaccessibles à nos équipes.
            </p>
          </div>

          <h2 id="s3">3. Finalités et bases légales</h2>
          <table>
            <thead>
              <tr><th>Finalité</th><th>Base légale</th></tr>
            </thead>
            <tbody>
              <tr><td>Création et gestion de votre compte</td><td>Exécution du contrat</td></tr>
              <tr><td>Authentification et sécurisation des accès</td><td>Exécution du contrat</td></tr>
              <tr><td>Instruction des dossiers d'inscription</td><td>Exécution du contrat</td></tr>
              <tr><td>Notifications de service (OTP, alertes)</td><td>Exécution du contrat</td></tr>
              <tr><td>Prévention de la fraude et des abus</td><td>Intérêt légitime</td></tr>
              <tr><td>Journal d'audit et traçabilité</td><td>Obligation légale / Intérêt légitime</td></tr>
              <tr><td>Amélioration de la plateforme</td><td>Intérêt légitime / Consentement</td></tr>
            </tbody>
          </table>

          <h2 id="s4">4. Hébergement et transferts de données</h2>
          <p>
            L'infrastructure Palabre est hébergée <strong>sur le territoire béninois</strong>, conformément aux
            exigences de souveraineté numérique. Aucune donnée personnelle n'est transférée hors du territoire
            national sans garanties appropriées au sens de la loi n°&nbsp;2017-20.
          </p>
          <p>
            Les prestataires tiers (Convessa pour les messages WhatsApp, Firebase pour l'authentification
            fédérée) sont encadrés par des contrats de sous-traitance. Ils ne sont pas autorisés à utiliser
            vos données à leurs propres fins commerciales.
          </p>

          <h2 id="s5">5. Durée de conservation</h2>
          <ul>
            <li><strong>Données de compte actif :</strong> toute la durée de la relation contractuelle.</li>
            <li><strong>Sessions et tokens :</strong> 30 jours maximum, révocables à tout moment.</li>
            <li><strong>Codes OTP :</strong> supprimés après consommation ou expiration (3 à 15 minutes).</li>
            <li><strong>Dossiers d'organisation :</strong> durée de vie de l'organisation, puis archivage 5 ans.</li>
            <li><strong>Journal d'audit :</strong> 12 mois glissants.</li>
            <li><strong>Compte supprimé :</strong> anonymisation sous 30 jours, sauf obligation légale.</li>
          </ul>

          <h2 id="s6">6. Vos droits</h2>
          <p>Conformément à la loi n°&nbsp;2017-20 et au RGPD, vous disposez des droits suivants :</p>
          <ul>
            <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles traitées.</li>
            <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes.</li>
            <li><strong>Droit à l'effacement :</strong> demander la suppression de votre compte et de vos données, sous réserve des obligations légales.</li>
            <li><strong>Droit à la limitation :</strong> suspendre l'utilisation de vos données dans certains cas.</li>
            <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré et lisible par machine.</li>
            <li><strong>Droit d'opposition :</strong> vous opposer aux traitements fondés sur l'intérêt légitime.</li>
            <li><strong>Droits relatifs aux décisions automatisées :</strong> ne pas faire l'objet d'une décision exclusivement automatisée produisant des effets juridiques significatifs.</li>
          </ul>
          <p>
            Pour exercer vos droits, contactez <a href="mailto:privacy@palabre.app">privacy@palabre.app</a>.
            Réponse sous 30 jours maximum. Vous pouvez également saisir l'<strong>APDP</strong> ou
            l'autorité de contrôle de votre pays de résidence.
          </p>

          <h2 id="s7">7. Sécurité des données</h2>
          <p>Mesures techniques et organisationnelles mises en oeuvre :</p>
          <ul>
            <li>Chiffrement de bout en bout des messages et appels.</li>
            <li>Passkeys biométriques, OTP à usage unique, double vérification pour les actions sensibles.</li>
            <li>Réseau VPN dédié par organisation pour l'isolation du trafic.</li>
            <li>Hachage des tokens (SHA-256 / bcrypt). Aucun secret stocké en clair.</li>
            <li>Rotation automatique des tokens de session et détection de réutilisation.</li>
            <li>Limitation des tentatives de connexion et blocage temporaire automatique.</li>
            <li>Authentification super-administrateur à 3 facteurs indépendants.</li>
            <li>Journal d'audit horodaté et immuable de toutes les actions sensibles.</li>
          </ul>

          <h2 id="s8">8. Cookies et stockage local</h2>
          <p>Palabre n'utilise que le stockage strictement nécessaire au service :</p>
          <ul>
            <li>Token de session en mémoire (non persisté en cookie) pour maintenir la connexion.</li>
            <li>Token de brouillon en <code>localStorage</code> pour la reprise de demande d'inscription.</li>
            <li>Préférence d'acceptation du bandeau cookies.</li>
          </ul>
          <p>Aucun cookie publicitaire, aucun tracker tiers, aucune régie publicitaire sur la plateforme.</p>

          <h2 id="s9">9. Mineurs</h2>
          <p>
            Palabre est destiné aux organisations et à leurs membres adultes. Nous ne collectons pas
            sciemment de données concernant des personnes de moins de 18 ans. Signalez toute situation
            contraire à <a href="mailto:privacy@palabre.app">privacy@palabre.app</a>.
          </p>

          <h2 id="s10">10. Modifications</h2>
          <p>
            Toute modification substantielle sera notifiée par e-mail et affichée en page d'accueil avec
            30 jours de préavis. La version en vigueur est toujours consultable à cette adresse.
          </p>

          <h2 id="s11">11. Contact</h2>
          <div className="legal-contact-card">
            <h3>Nous contacter</h3>
            <p><strong>Délégué à la protection des données (DPO)</strong></p>
            <p>
              <a href="mailto:privacy@palabre.app">privacy@palabre.app</a><br />
              Palabre SAS, Cotonou, République du Bénin
            </p>
            <p style={{ marginTop: 12 }}>
              Pour toute réclamation auprès de l'autorité de contrôle :<br />
              <strong>APDP</strong> : Autorité de Protection des Données à caractère Personnel du Bénin
            </p>
          </div>

          <div className="legal-footer-links">
            <Link to="/terms">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Conditions d'utilisation
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
