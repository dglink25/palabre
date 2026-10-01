# Requirements Document

## Introduction

Ce document décrit les exigences fonctionnelles et non-fonctionnelles du système de vidéoconférence intégré à la plateforme Palabre. La fonctionnalité couvre deux modes d'utilisation : la vidéoconférence au niveau du tenant (organisation) et la vidéoconférence publique accessible depuis la page d'accueil. Le moteur sous-jacent est Jitsi, entièrement masqué derrière une interface brandée Palabre (white-label complet). Le système s'intègre dans l'architecture multi-tenant existante (Node.js/Express, React, PostgreSQL, Redis, VPN tenant).

**Glossaire :**

- **VideoConference_Service** : Composant backend Palabre responsable de la création, planification, gestion et terminaison des sessions de vidéoconférence.
- **VideoConference_Gateway** : Couche d'abstraction entre Palabre et Jitsi, masquant tout identifiant ou référence à Jitsi vis-à-vis des clients.
- **Room** : Session de vidéoconférence Palabre identifiée par un identifiant opaque interne (UUID). Correspond à une salle Jitsi côté moteur, sans que ce lien ne soit exposé aux clients.
- **Host** : Utilisateur authentifié qui crée ou programme une vidéoconférence. Dispose de droits de modération complets sur la Room.
- **Participant** : Utilisateur authentifié qui rejoint une Room, selon les droits d'accès définis par le Host.
- **Tenant_Context** : Contexte d'une organisation (tenant) dans lequel la vidéoconférence s'exécute, isolé des autres tenants.
- **Public_VideoConference** : Vidéoconférence créée depuis la page d'accueil publique de Palabre, sans appartenance à un tenant spécifique.
- **Tunnel** : Mécanisme de relais existant dans Palabre permettant aux utilisateurs hors du réseau privé d'un tenant de communiquer via le serveur central.
- **JWT_Token** : Token d'authentification signé utilisé pour autoriser un Participant à rejoindre une Room via la VideoConference_Gateway.
- **Scheduler** : Sous-composant du VideoConference_Service qui gère la planification des vidéoconférences futures.
- **Recording_Service** : Sous-composant qui gère l'enregistrement des sessions de vidéoconférence.
- **Invitation** : Lien ou notification envoyé à un utilisateur pour l'inviter à rejoindre une Room. Une Invitation est considérée valide si elle n'est pas expirée, n'a pas été révoquée, et correspond à l'identifiant de la Room cible.
- **Access_Policy** : Configuration d'une Room définissant si elle est ouverte (tout membre du tenant peut rejoindre) ou fermée (invitation obligatoire).
- **Moderator** : Participant disposant de droits de gestion sur une Room (mute/unmute des participants, exclusion, enregistrement).
- **White_Label** : Interface utilisateur intégralement brandée Palabre, sans aucune mention, logo, URL ou métadonnée révélant Jitsi.
- **Room_Metadata** : Schéma JSON structuré décrivant les métadonnées d'une Room (identifiant, titre, Host, Access_Policy, dates, participants).
- **SFU** : Selective Forwarding Unit — architecture de relais vidéo permettant de gérer plusieurs flux simultanés sans décodage/réencodage côté serveur.

## Requirements

### Requirement 1 : Abstraction complète de Jitsi (White-Label)

**User Story:** En tant qu'utilisateur de Palabre (membre, administrateur ou visiteur), je veux interagir avec une interface de vidéoconférence entièrement brandée Palabre, afin de ne jamais savoir que Jitsi est utilisé en arrière-plan.

#### Acceptance Criteria

1. THE VideoConference_Gateway SHALL générer des identifiants de Room opaques (UUID v4) qui ne contiennent aucune référence au nom de salle Jitsi sous-jacent.
2. THE VideoConference_Gateway SHALL signer chaque JWT_Token d'accès à Jitsi avec un secret interne à Palabre ; le payload JWT retourné au client NE SHALL PAS contenir les champs `room`, `jitsi`, `server`, `domain` ni aucun champ dont la valeur correspond à un nom de domaine ou d'identifiant Jitsi.
3. WHEN un client accède à l'interface de vidéoconférence, THE VideoConference_Gateway SHALL servir l'interface Jitsi IFrame encapsulée dans une frame Palabre qui : (a) supprime toutes les références visuelles, textuelles et de métadonnées à Jitsi (nom, logo, titres de page, attributs HTML) ; (b) masque l'attribut `src` de l'IFrame et tout hostname Jitsi dans les requêtes réseau visibles du client (en-têtes, URL de redirection, CSP).
4. IF la VideoConference_Gateway reçoit une requête dont les paramètres d'URL, les en-têtes ou le corps contiennent l'une des chaînes suivantes : `jitsi`, `8x8.vc`, `meet.jit.si`, ou tout sous-domaine Jitsi connu, THEN THE VideoConference_Gateway SHALL rejeter la requête avec le code HTTP 400 et le corps `{"error": "BAD_REQUEST"}` sans mention de Jitsi dans la réponse.
5. THE VideoConference_Gateway SHALL exposer uniquement des endpoints Palabre (sous `/api/v1/videoconference/`) aux clients, sans rediriger directement vers des URLs Jitsi publiques.

---

### Requirement 2 : Création et planification d'une vidéoconférence (Tenant)

**User Story:** En tant que membre ou administrateur d'une organisation, je veux créer une vidéoconférence immédiate ou la planifier à une date future, afin d'organiser des réunions au sein de mon tenant.

#### Acceptance Criteria

1. WHEN un utilisateur authentifié membre d'un Tenant_Context soumet une requête de création de vidéoconférence, THE VideoConference_Service SHALL créer une Room associée au Tenant_Context de l'utilisateur et retourner un identifiant de Room opaque (UUID v4) ainsi que le lien d'accès à la Room dans un délai de 3 secondes.
2. WHEN un utilisateur crée une vidéoconférence avec une date de début future, THE Scheduler SHALL enregistrer la vidéoconférence planifiée, retourner la confirmation de planification au créateur incluant l'identifiant de Room, et envoyer une Invitation aux Participants désignés dans un délai de 30 secondes après la validation de la création.
3. WHEN un utilisateur crée une vidéoconférence, THE VideoConference_Service SHALL appliquer l'Access_Policy spécifiée dans la requête (ouverte ou fermée) ; IF aucune Access_Policy n'est spécifiée, THEN THE VideoConference_Service SHALL appliquer l'Access_Policy par défaut `fermée` (invitation obligatoire).
4. WHEN un utilisateur crée une vidéoconférence immédiate, THE VideoConference_Service SHALL rendre la Room disponible pour connexion dans un délai de 5 secondes après la confirmation de création.
5. IF un utilisateur authentifié membre d'un Tenant_Context A tente d'accéder à une Room appartenant à un Tenant_Context B, THEN THE VideoConference_Service SHALL rejeter la requête avec le code d'erreur `CROSS_TENANT_ACCESS_DENIED`, quel que soit le mode de découverte de l'identifiant de Room.
6. IF un utilisateur non authentifié tente de créer une vidéoconférence dans l'espace tenant, THEN THE VideoConference_Service SHALL rejeter la requête avec le code d'erreur `UNAUTHORIZED`.
7. IF un utilisateur soumet une requête de planification avec une date de début inférieure à 5 minutes dans le futur par rapport à l'heure de soumission, THEN THE VideoConference_Service SHALL rejeter la requête avec le code d'erreur `INVALID_SCHEDULE_TIME` et un message indiquant le délai minimum requis.

---

### Requirement 3 : Accès et contrôle des participants (Tenant)

**User Story:** En tant que Host d'une vidéoconférence tenant, je veux contrôler qui peut rejoindre ma session et gérer les participants en temps réel, afin de garantir la confidentialité et le bon déroulement de la réunion.

#### Acceptance Criteria

1. WHEN un Participant tente de rejoindre une Room dont l'Access_Policy est fermée sans Invitation valide, THE VideoConference_Service SHALL : (a) placer le Participant dans une salle d'attente et lui afficher un message indiquant qu'il attend l'admission ; (b) notifier le Host de la présence du Participant en attente dans un délai de 5 secondes ; IF le Host n'est pas connecté à la Room au moment de la tentative, THEN THE VideoConference_Service SHALL conserver la demande d'admission en attente et notifier le Host dès sa connexion.
2. WHEN un Participant authentifié membre du même Tenant_Context tente de rejoindre une Room dont l'Access_Policy est ouverte et dont le nombre de Participants actifs est inférieur à 300, THE VideoConference_Service SHALL accorder l'accès à la Room.
3. IF un Participant non membre du Tenant_Context tente de rejoindre une Room ouverte, THEN THE VideoConference_Service SHALL rejeter la requête avec le code d'erreur `UNAUTHORIZED_TENANT`.
4. IF le nombre de Participants actifs d'une Room ouverte atteint 300 au moment où un Participant tente de rejoindre, THEN THE VideoConference_Service SHALL refuser la connexion avec le code d'erreur `ROOM_FULL`.
5. WHEN un Host admet un Participant depuis la salle d'attente, THE VideoConference_Service SHALL accorder l'accès à la Room au Participant dans un délai de 2 secondes.
6. WHILE une session de Room est active, THE VideoConference_Service SHALL permettre au Moderator de couper le microphone (mute) d'un Participant, l'effet devenant perceptible par tous les Participants dans un délai de 2 secondes.
7. WHILE une session de Room est active, THE VideoConference_Service SHALL permettre au Moderator d'exclure un Participant ; WHEN un Participant est exclu, THE VideoConference_Service SHALL immédiatement terminer sa connexion à la Room.
8. IF un Participant exclu tente de rejoindre à nouveau la même Room, THEN THE VideoConference_Service SHALL rejeter la tentative avec le code d'erreur `PARTICIPANT_EXCLUDED` jusqu'à ce que le Host lève explicitement l'exclusion.
9. IF le nombre de Participants actifs d'une Room atteint 300, THEN THE VideoConference_Service SHALL refuser toute nouvelle connexion à cette Room et retourner le code d'erreur `ROOM_FULL` aux tentatives suivantes.

---

### Requirement 4 : Participation depuis un réseau externe (hors réseau privé tenant)

**User Story:** En tant que membre d'une organisation dont le tenant est sur un réseau privé/intranet, je veux pouvoir participer à une vidéoconférence même depuis l'extérieur du réseau privé, afin de ne pas être exclu des réunions en déplacement ou en télétravail.

#### Acceptance Criteria

1. WHEN un Participant se connecte à une Room depuis un réseau externe au réseau privé du tenant, THE Tunnel SHALL relayer les flux suivants via le serveur central Palabre pour atteindre le tenant : audio, vidéo, partage d'écran et messages de chat, avec une latence de relai supplémentaire n'excédant pas 3 secondes par rapport à une connexion directe dans des conditions réseau normales.
2. WHEN un Participant externe soumet un JWT_Token pour rejoindre une Room, THE VideoConference_Service SHALL valider que le token est signé par le serveur central, non expiré, et que l'identifiant de Participant correspond à un membre du Tenant_Context de la Room ; IF l'une de ces conditions n'est pas satisfaite, THEN THE VideoConference_Service SHALL rejeter la connexion avec le code d'erreur `TOKEN_INVALID`.
3. WHILE un Participant est connecté via le Tunnel, THE VideoConference_Service SHALL maintenir sa session avec accès aux fonctionnalités suivantes, identiques à celles d'un Participant interne : chat en temps réel, partage d'écran, contrôle de son microphone et de sa caméra, et réception des droits de modération si le Participant est Moderator.
4. IF la connexion Tunnel d'un Participant externe est interrompue, THEN THE VideoConference_Service SHALL tenter jusqu'à 3 reconnexions automatiques espacées de 3 secondes chacune ; IF l'une des tentatives réussit, THEN THE VideoConference_Service SHALL maintenir le Participant dans la Room avec son état précédent ; IF les 3 tentatives échouent, THEN THE VideoConference_Service SHALL retirer le Participant de la Room et envoyer une notification au Host indiquant la déconnexion.
5. IF le serveur Tunnel central est indisponible au moment de la tentative de connexion d'un Participant externe, THEN THE VideoConference_Service SHALL retourner immédiatement une erreur au Participant indiquant l'indisponibilité du service, sans le placer en salle d'attente.

---

### Requirement 5 : Fonctionnalités complètes de session

**User Story:** En tant que Participant à une vidéoconférence Palabre, je veux accéder à toutes les fonctionnalités d'une vidéoconférence professionnelle (chat, partage d'écran, enregistrement, etc.), afin de disposer d'un outil complet pour mes réunions.

#### Acceptance Criteria

1. THE VideoConference_Service SHALL fournir un chat textuel au sein de chaque Room, accessible à tous les Participants actifs, avec une latence de livraison des messages n'excédant pas 500 ms et une limite de 4 000 caractères par message.
2. WHEN un Participant active le partage d'écran, THE VideoConference_Service SHALL diffuser le flux de l'écran partagé à tous les Participants actifs de la Room dans un délai de 3 secondes ; IF un autre Participant tente d'activer le partage d'écran pendant qu'un partage est déjà actif, THEN THE VideoConference_Service SHALL rejeter la seconde demande avec le code d'erreur `SCREEN_SHARE_ALREADY_ACTIVE` et notifier le demandeur.
3. WHILE une session de Room est active, THE VideoConference_Service SHALL permettre à chaque Participant de couper ou d'activer son propre microphone et sa propre caméra.
4. WHEN le Host ou un Moderator démarre l'enregistrement d'une Room, THE Recording_Service SHALL vérifier que l'audio, la vidéo et le chat sont tous disponibles pour capture ; IF l'une des trois composantes est indisponible, THEN THE Recording_Service SHALL annuler le démarrage de l'enregistrement et notifier le Host avec un message d'erreur indiquant la composante indisponible.
5. WHEN l'enregistrement d'une session est terminé, THE Recording_Service SHALL stocker le fichier d'enregistrement dans l'espace de stockage du Tenant_Context et notifier le Host dans un délai de 60 secondes après la fin de la session.
6. WHILE une session de Room est active, THE VideoConference_Service SHALL maintenir et afficher la liste des Participants actifs avec leur statut audio (microphone activé/coupé) et vidéo (caméra activée/désactivée), toute mise à jour de statut étant propagée à tous les Participants dans un délai de 2 secondes.
7. WHERE l'option de fond virtuel est activée par l'administrateur du tenant, THE VideoConference_Service SHALL permettre à chaque Participant d'appliquer un fond virtuel ou un flou d'arrière-plan à sa caméra.
8. IF une composante de capture (audio, vidéo ou chat) devient indisponible pendant qu'un enregistrement est en cours, THEN THE Recording_Service SHALL arrêter immédiatement l'enregistrement, persister la portion déjà enregistrée, et notifier le Host avec un message indiquant la composante défaillante et la durée enregistrée.

---

### Requirement 6 : Vidéoconférence publique (depuis la page d'accueil)

**User Story:** En tant qu'utilisateur authentifié sur Palabre, sans nécessairement appartenir à un tenant, je veux pouvoir créer ou programmer une vidéoconférence depuis la page d'accueil et inviter des participants instantanément, afin d'organiser des réunions ad hoc.

#### Acceptance Criteria

1. WHEN un visiteur non authentifié tente de créer une Public_VideoConference depuis la page d'accueil, THE VideoConference_Service SHALL rediriger l'utilisateur vers la page de connexion Palabre en conservant l'intention de création comme paramètre de redirection, afin que la création reprenne automatiquement après authentification.
2. WHEN un utilisateur authentifié soumet une requête de création de Public_VideoConference, THE VideoConference_Service SHALL créer la Room sans Tenant_Context, l'associer à l'identifiant de l'utilisateur créateur comme Host, et retourner un lien d'invitation partageable dans un délai de 3 secondes.
3. WHEN un Host d'une Public_VideoConference soumet une invitation par nom d'utilisateur ou adresse e-mail valide, THE VideoConference_Service SHALL envoyer une Invitation à l'utilisateur cible dans un délai de 30 secondes ; IF le nom d'utilisateur ou l'adresse e-mail ne correspond à aucun compte Palabre, THEN THE VideoConference_Service SHALL retourner le code d'erreur `INVITEE_NOT_FOUND` sans créer d'invitation.
4. THE VideoConference_Service SHALL appliquer les mêmes configurations d'Access_Policy et les mêmes fonctionnalités complètes aux Public_VideoConferences qu'aux vidéoconférences tenant (critères des Requirements 3, 5, 8, 9 et 10 inclus).
5. WHEN une Public_VideoConference est créée ou termine sa session, THE VideoConference_Service SHALL enregistrer un événement dans `audit_logs` contenant : l'identifiant de l'utilisateur créateur (Host), l'identifiant de Room, le type d'événement, et l'horodatage UTC.
6. IF un utilisateur tente de rejoindre une Public_VideoConference via un lien d'Invitation sans être authentifié sur Palabre, THEN THE VideoConference_Service SHALL rediriger l'utilisateur vers la page de connexion Palabre en conservant le lien d'Invitation comme paramètre de redirection, de sorte que l'accès à la Room reprenne automatiquement après authentification.

---

### Requirement 7 : Intégration dans la navigation du tenant

**User Story:** En tant que membre d'une organisation, je veux accéder à la vidéoconférence directement depuis l'espace communication de mon tenant (aux côtés de la messagerie et des appels), afin que la vidéoconférence soit un outil natif de ma plateforme.

#### Acceptance Criteria

1. THE VideoConference_Service SHALL exposer les routes React `/app/videoconference` et `/app/videoconference/:roomId` dans l'espace communication du tenant, protégées par la garde `OrgMemberOrAdminRoute` ; IF un utilisateur non membre ou non administrateur du tenant tente d'accéder à ces routes, THEN THE VideoConference_Service SHALL le rediriger vers la page d'accès refusé sans exposer de contenu de la Room.
2. WHEN un utilisateur authentifié accède à la route `/videoconference` depuis la page d'accueil, THE VideoConference_Service SHALL afficher le formulaire de création de Public_VideoConference ; IF un utilisateur non authentifié accède à cette route, THEN THE VideoConference_Service SHALL le rediriger vers la page de connexion Palabre en conservant la route `/videoconference` comme paramètre de redirection.
3. WHEN un utilisateur reçoit une Invitation à une vidéoconférence tenant, THE VideoConference_Service SHALL créer une notification persistante en base de données, affichée dans l'interface Palabre lors de la prochaine session active de l'utilisateur, permettant de rejoindre la Room en une seule action utilisateur ; cette notification SHALL rester active pendant 30 jours maximum ou jusqu'à ce que l'utilisateur la lise ou rejoigne la Room.
4. IF une session de vidéoconférence d'un tenant se termine, THEN THE VideoConference_Service SHALL persister les métadonnées de la session dans l'historique du tenant (titre, Host, date de création, durée effective, nombre de Participants) ; cet historique SHALL être accessible uniquement à l'administrateur du tenant depuis `/app/videoconference`, limité aux 1 000 entrées les plus récentes dans une fenêtre glissante de 12 mois.

---

### Requirement 8 : Planification et notifications

**User Story:** En tant que Host, je veux programmer des vidéoconférences à l'avance et m'assurer que les Participants sont notifiés en temps utile, afin d'améliorer la ponctualité et l'organisation des réunions.

#### Acceptance Criteria

1. WHEN un Host planifie une vidéoconférence, THE Scheduler SHALL valider que la date de début est strictement dans le futur et que la durée estimée est comprise entre 1 et 480 minutes, puis enregistrer les métadonnées de la Room (titre, date de début, durée estimée, Access_Policy, liste des Participants invités) dans la base de données Palabre.
2. WHEN l'heure de début d'une vidéoconférence planifiée est atteinte, THE Scheduler SHALL activer la Room automatiquement et envoyer une notification à chaque Participant invité dans un délai de 30 secondes.
3. WHEN l'heure de début d'une vidéoconférence planifiée est à 15 minutes, THE Scheduler SHALL envoyer un rappel à chaque Participant invité dans un délai de 30 secondes.
4. IF un Host annule une vidéoconférence planifiée, THEN THE Scheduler SHALL marquer la Room comme annulée (sans suppression physique des données, pour conservation de l'audit) et notifier tous les Participants invités de l'annulation dans un délai de 30 secondes.
5. WHILE une vidéoconférence planifiée n'a pas encore débuté, THE VideoConference_Service SHALL permettre au Host de modifier le titre, la date de début, la durée estimée et l'Access_Policy de la Room planifiée.
6. WHEN un Participant est retiré de la liste des invités lors d'une modification, THE VideoConference_Service SHALL notifier ce Participant de son retrait dans un délai de 30 secondes et révoquer son Invitation, lui interdisant l'accès à la Room planifiée.
7. WHEN un Participant est ajouté à la liste des invités lors d'une modification d'une vidéoconférence planifiée, THE VideoConference_Service SHALL envoyer une Invitation au Participant nouvellement ajouté dans un délai de 30 secondes.

---

### Requirement 9 : Sécurité et isolation multi-tenant

**User Story:** En tant qu'administrateur de la plateforme Palabre, je veux que chaque vidéoconférence soit strictement isolée entre tenants et que les accès soient contrôlés par des mécanismes cryptographiques, afin de garantir la confidentialité des communications.

#### Acceptance Criteria

1. WHEN un Participant soumet une requête pour rejoindre une Room, THE VideoConference_Gateway SHALL générer un JWT_Token unique à durée de vie limitée (maximum 24 heures), signé avec une clé HMAC ou RSA propre au Tenant_Context de la Room (une clé distincte par Tenant_Context).
2. IF un JWT_Token présente une signature invalide ou est expiré, THEN THE VideoConference_Gateway SHALL rejeter la connexion et retourner le code d'erreur `TOKEN_INVALID`.
3. WHEN un événement significatif se produit dans une Room (création, début de session, admission d'un Participant, exclusion d'un Participant, début d'enregistrement, fin d'enregistrement, fin de session), THE VideoConference_Service SHALL enregistrer une entrée dans `audit_logs` contenant au minimum : horodatage UTC, type d'événement, identifiant de Room, identifiant du Tenant_Context, et identifiant du Participant concerné (si applicable).
4. IF un utilisateur tente d'accéder à une Room d'un Tenant_Context différent du sien, THEN THE VideoConference_Service SHALL rejeter la requête avec le code d'erreur `CROSS_TENANT_ACCESS_DENIED`, quel que soit le mode de découverte de l'identifiant de Room.
5. WHILE une Room est active, THE VideoConference_Service SHALL valider la validité du JWT_Token de chaque Participant à intervalles réguliers n'excédant pas 60 secondes ; IF le JWT_Token d'un Participant est invalide ou expiré lors d'une validation périodique, THEN THE VideoConference_Service SHALL déconnecter ce Participant de la Room immédiatement et lui interdire toute reconnexion sans un nouveau JWT_Token valide.

---

### Requirement 10 : Performance et disponibilité

**User Story:** En tant qu'utilisateur de Palabre, je veux que les vidéoconférences démarrent rapidement et restent stables même avec un grand nombre de Participants, afin de pouvoir mener des réunions professionnelles sans interruption.

#### Acceptance Criteria

1. THE VideoConference_Service SHALL maintenir un fonctionnement complet (création de Room, admission des Participants, diffusion audio/vidéo, chat) avec jusqu'à 300 Participants simultanés dans une même Room.
2. WHEN un Participant rejoint une Room active dans des conditions réseau normales (latence inférieure à 100 ms, perte de paquets inférieure à 1 %), THE VideoConference_Service SHALL établir la connexion audio et vidéo dans un délai de 5 secondes.
3. THE VideoConference_Service SHALL maintenir une disponibilité de 99,5 % mesurée sur une période glissante de 30 jours, où la disponibilité est définie comme la proportion de minutes pendant lesquelles les opérations de création de Room et d'accès Participant réussissent.
4. IF la connexion d'un Participant est interrompue pendant une session active, THEN THE VideoConference_Service SHALL tenter une reconnexion automatique dans un délai de 10 secondes.
5. IF la reconnexion automatique réussit dans le délai de 10 secondes, THEN THE VideoConference_Service SHALL maintenir le Participant dans la Room et rétablir son flux audio et vidéo.
6. IF le délai de 10 secondes est dépassé sans reconnexion réussie, THEN THE VideoConference_Service SHALL retirer le Participant de la Room et notifier le Host de sa déconnexion.
7. THE VideoConference_Service SHALL adapter automatiquement la qualité vidéo de chaque flux dans un délai de 3 secondes suivant un changement de bande passante disponible, avec une qualité minimale de 180p à 150 kbps et une qualité maximale de 1080p à 4 Mbps, sans intervention manuelle.

---

### Requirement 11 : Sérialisation fiable des métadonnées de Room (Round-Trip)

**User Story:** En tant que développeur Palabre, je veux que les métadonnées des Rooms soient sérialisées et désérialisées de façon fiable et réversible, afin d'éviter toute perte ou corruption de données lors des échanges entre services.

#### Acceptance Criteria

1. WHEN le VideoConference_Service sérialise les métadonnées d'une Room en JSON, THE VideoConference_Service SHALL produire un objet JSON valide conforme au schéma Room_Metadata.
2. WHEN le VideoConference_Service désérialise un objet JSON Room_Metadata valide, THE VideoConference_Service SHALL reconstruire un objet dont chaque champ — identifiant, titre, Access_Policy, dates, identifiant du Host, liste des identifiants Participant — est structurellement et sémantiquement identique au champ correspondant de l'objet original.
3. THE VideoConference_Service SHALL sérialiser les objets Room_Metadata en JSON canonique défini comme suit : clés triées lexicographiquement, aucun espace superflu, dates au format ISO 8601 UTC avec suffixe `Z`.
4. THE VideoConference_Service SHALL garantir que pour tout objet Room_Metadata valide, la séquence sérialisation → désérialisation → re-sérialisation produit une chaîne JSON byte-for-byte identique à la première sérialisation.
5. IF le VideoConference_Service reçoit un objet JSON Room_Metadata invalide ou incomplet, THEN THE VideoConference_Service SHALL retourner une erreur descriptive indiquant le champ manquant ou invalide, sans crash du service, et continuer à traiter les requêtes suivantes normalement.
