export default function PrivacyPage() {
  return (
    <div className="legal-page fade-in">
      <h1>Politique de confidentialité</h1>
        <p className="text-secondary">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')} - <strong>modèle à faire valider par un juriste</strong> avant publication, au regard du droit applicable dans votre pays d'exploitation.
        </p>

        <h2>1. Données collectées</h2>
        <p>
          Selon la façon dont vous utilisez Palabre, nous traitons : votre numéro de téléphone et/ou
          adresse e-mail, votre nom, votre photo de profil, votre langue et fuseau horaire, les
          informations techniques de connexion (appareil, adresse IP, journal des sessions), et, pour les
          demandes d'inscription d'organisation, les informations et documents fournis dans le formulaire
          (pièce d'identité, attestation IFU, RCCM).
        </p>

        <h2>2. Finalités</h2>
        <p>
          Ces données sont utilisées pour créer et sécuriser votre compte, vous authentifier (y compris
          via passkey ou code envoyé par WhatsApp/e-mail), instruire les demandes d'inscription
          d'organisation, assurer la sécurité de la plateforme (limitation des tentatives, journal
          d'audit), et vous adresser les notifications nécessaires au service.
        </p>

        <h2>3. Base légale</h2>
        <p>
          Le traitement repose sur l'exécution du contrat vous liant à Palabre, votre consentement lorsque
          celui-ci est requis (par exemple pour les cookies non essentiels), et l'intérêt légitime de
          Palabre à assurer la sécurité de ses services.
        </p>

        <h2>4. Partage des données</h2>
        <p>
          Vos données ne sont partagées qu'avec les prestataires strictement nécessaires au fonctionnement
          du service (envoi de messages WhatsApp, envoi d'e-mails, fournisseurs d'authentification fédérée
          que vous choisissez d'utiliser), et ne sont jamais vendues à des tiers.
        </p>

        <h2>5. Conservation</h2>
        <p>
          Les données sont conservées pendant la durée nécessaire aux finalités décrites ci-dessus, puis
          supprimées ou archivées conformément à la politique de rétention de la plateforme.
        </p>

        <h2>6. Vos droits</h2>
        <p>
          Vous pouvez consulter, corriger ou demander la suppression de vos données personnelles depuis
          votre profil, ou en contactant le support. Vous pouvez également gérer vos moyens de connexion et
          révoquer vos sessions actives à tout moment.
        </p>

        <h2>7. Sécurité</h2>
        <p>
          Palabre met en œuvre des mesures techniques (passkeys, double vérification, chiffrement des
          échanges, journal d'audit) pour protéger vos données contre tout accès non autorisé.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Palabre n'utilise que des cookies/stockage local strictement nécessaires au fonctionnement du
          service (maintien de la session, préférence d'appareil). Voir le bandeau affiché lors de votre
          première visite pour plus de détails.
        </p>

        <h2>9. Contact</h2>
        <p>Pour exercer vos droits ou pour toute question, contactez le support de la plateforme.</p>
    </div>
  );
}
