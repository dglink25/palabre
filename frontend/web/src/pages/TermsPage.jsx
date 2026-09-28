export default function TermsPage() {
  return (
    <div className="legal-page fade-in">
      <h1>Conditions d'utilisation</h1>
        <p className="text-secondary">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')} — <strong>modèle à faire valider par un juriste avant publication</strong>, adapté à votre structure juridique et à votre pays d'exploitation.
        </p>

        <h2>1. Objet</h2>
        <p>
          Les présentes conditions régissent l'accès et l'utilisation de la plateforme Palabre, service de
          communication, téléphonie et centre d'appels destiné aux organisations (« l'Organisation ») et à
          leurs utilisateurs.
        </p>

        <h2>2. Compte et inscription</h2>
        <p>
          L'inscription d'une Organisation est soumise à validation par le super-administrateur de la
          plateforme. Chaque utilisateur est responsable de la confidentialité de ses moyens de connexion
          (téléphone, compte fédéré, passkey) et des actions effectuées depuis son compte.
        </p>

        <h2>3. Utilisation autorisée</h2>
        <p>
          L'Organisation et ses utilisateurs s'engagent à utiliser Palabre conformément à la loi, sans
          porter atteinte aux droits de tiers, sans diffuser de contenu illicite, et sans tenter de
          compromettre la sécurité de la plateforme ou d'autres organisations.
        </p>

        <h2>4. Disponibilité et abonnement</h2>
        <p>
          Les formules d'abonnement, leurs limites et leurs tarifs sont précisés lors de la souscription.
          Palabre s'efforce d'assurer la continuité du service sans garantie de disponibilité absolue.
        </p>

        <h2>5. Suspension</h2>
        <p>
          Le super-administrateur peut suspendre une Organisation en cas de manquement aux présentes
          conditions, avec un effet technique immédiat sur l'accès applicatif, conformément au mécanisme
          décrit dans la documentation technique de la plateforme.
        </p>

        <h2>6. Propriété intellectuelle</h2>
        <p>
          La marque, le logo et les éléments visuels de Palabre restent la propriété de son éditeur. Les
          données et contenus créés par une Organisation lui appartiennent.
        </p>

        <h2>7. Responsabilité</h2>
        <p>
          Palabre ne saurait être tenu responsable des dommages indirects résultant de l'utilisation du
          service. L'Organisation demeure responsable du contenu échangé via la plateforme.
        </p>

        <h2>8. Modification des conditions</h2>
        <p>
          Ces conditions peuvent être mises à jour ; les utilisateurs en seront informés par notification
          ou par e-mail avant leur entrée en vigueur.
        </p>

        <h2>9. Contact</h2>
        <p>Pour toute question relative à ces conditions, contactez le support de la plateforme.</p>
    </div>
  );
}
