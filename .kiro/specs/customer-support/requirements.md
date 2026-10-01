# Requirements Document — Service Client Palabre

## Introduction

Ce document décrit les exigences du système de service client intégré à la plateforme Palabre. Le service client permet à tout utilisateur authentifié (public ou membre d'une organisation) de contacter le super-administrateur Palabre via messagerie instantanée chiffrée E2E, appels audio, et vidéoconférence, depuis n'importe quel point d'accès : site public, espace tenant, application mobile. Tous les échanges transitent exclusivement par le serveur central, indépendamment de l'origine de l'utilisateur. Le super-administrateur dispose d'une interface centralisée pour gérer simultanément les conversations, les files d'attente d'appels et les basculements entre appels.

---

## Glossaire

- **Support_Session** : Session de communication entre un utilisateur (client) et le super-administrateur Palabre via le service client. Une Support_Session est unique par utilisateur et peut être réouverte après résolution.
- **Support_Chat** : Canal de messagerie instantanée E2E entre un client et le super-administrateur, persisté sur le serveur central.
- **Support_Call** : Appel audio WebRTC établi entre un client et le super-administrateur via le serveur central. Exclusivement audio — aucun flux vidéo n'est transmis par ce canal.
- **Call_Queue** : File d'attente des appels audio entrants vers le service client, gérée par le serveur central. La capacité maximale est configurable via la variable d'environnement `SUPPORT_CALL_QUEUE_MAX`.
- **Hold_State** : État d'un appel actif mis en pause par le super-administrateur. Le client en Hold_State entend une musique d'attente professionnelle.
- **Support_Widget** : Composant flottant affiché sur le site public et dans les espaces tenant, permettant d'accéder au service client en un clic.
- **Central_Server** : Serveur central Palabre qui traite et relaie tous les échanges du service client, même pour les utilisateurs connectés depuis un tenant local.
- **Super_Admin** : Super-administrateur unique de la plateforme Palabre, destinataire exclusif de toutes les demandes du service client.
- **E2E_Key** : Clé privée de chiffrement Signal stockée exclusivement sur l'appareil de l'utilisateur, jamais transmise au Central_Server.
- **Support_VideoConference** : Vidéoconférence initiée exclusivement par le Super_Admin depuis un Support_Chat actif, s'appuyant sur le VideoConference_Service existant. Le client peut uniquement rejoindre une Support_VideoConference, jamais en initier une.
- **Hold_Music** : Flux audio professionnel diffusé en boucle au client lorsqu'un Support_Call est en Hold_State ou en Call_Queue. Accompagné du message vocal « Votre appel est en attente, vous serez pris en charge dans quelques instants. »
- **Tenant_Server** : Serveur d'infrastructure local d'une organisation, distinct du Central_Server.

---

## Requirements

### Requirement 1 : Accès universel au service client

**User Story:** En tant qu'utilisateur de Palabre (public, membre d'organisation ou visiteur), je veux accéder au service client depuis n'importe quelle page de la plateforme ou de l'application mobile, afin de contacter le support sans friction.

#### Acceptance Criteria

1. THE Support_Widget SHALL être affiché en position fixe sur toutes les pages du site public (`palabre.com`), dans tous les espaces tenant (routes `/app/*`), et sur toutes les pages de l'application mobile Flutter, pour tout utilisateur, qu'il soit authentifié ou non.
2. WHEN un utilisateur non authentifié clique sur le Support_Widget, THE Support_Widget SHALL rediriger l'utilisateur vers la page de connexion Palabre avec un paramètre de redirection conservant l'intention d'accès au service client, afin que l'accès reprenne automatiquement après authentification.
3. WHEN un utilisateur authentifié clique sur le Support_Widget, THE Support_Widget SHALL ouvrir l'interface de service client (Support_Chat actif ou formulaire d'initiation) dans un délai maximal de 2 secondes.
4. THE Support_Widget SHALL être visuellement distinct et clairement identifiable sur toutes les pages, avec le libellé « Service client » et une icône standard de support, sans masquer le contenu principal de la page.
5. IF un utilisateur connecté depuis un Tenant_Server local clique sur le Support_Widget, THEN THE Support_Widget SHALL établir la connexion directement vers le Central_Server, sans passer par le Tenant_Server local ; aucune différence d'expérience ne doit être perceptible pour l'utilisateur par rapport à un accès depuis le site public.

---

### Requirement 2 : Messagerie instantanée E2E du service client

**User Story:** En tant qu'utilisateur authentifié, je veux envoyer des messages texte et des médias au service client en temps réel, afin d'obtenir de l'aide de façon asynchrone et sécurisée.

#### Acceptance Criteria

1. WHEN un utilisateur authentifié ouvre le service client pour la première fois, THE Central_Server SHALL créer une Support_Session unique et persistante identifiée par l'identifiant utilisateur, dans un délai maximal de 3 secondes.
2. WHEN un utilisateur rouvre le service client après résolution d'une Support_Session précédente, THE Central_Server SHALL créer une nouvelle Support_Session pour cet utilisateur, tout en conservant l'historique de la session précédente accessible en lecture seule.
3. THE Support_Chat SHALL fournir une messagerie instantanée en temps réel avec une latence de livraison n'excédant pas 500 ms, accessible sur le web et sur l'application mobile avec un comportement fonctionnellement identique.
4. THE Support_Chat SHALL chiffrer tous les messages et médias de bout en bout selon le protocole Signal ; les E2E_Keys ne SHALL jamais être transmises au Central_Server.
5. THE Support_Chat SHALL permettre l'envoi de médias (images, fichiers, messages audio) avec chiffrement E2E des médias avant envoi et déchiffrement côté destinataire uniquement.
6. IF le Super_Admin n'est pas connecté au moment de l'envoi d'un message, THEN THE Central_Server SHALL persister le message chiffré et le livrer au Super_Admin dès sa prochaine connexion, avec une notification push.
7. THE Support_Chat SHALL conserver l'historique complet de chaque Support_Session de façon persistante sur le Central_Server, accessible à l'utilisateur concerné et au Super_Admin à chaque reconnexion.
8. THE Support_Chat SHALL permettre uniquement à l'utilisateur d'initier un nouveau message ou une nouvelle Support_Session ; le Super_Admin ne peut que répondre à une session initiée par un utilisateur.
9. WHEN un utilisateur envoie un message, THE Support_Chat SHALL afficher un indicateur de statut de livraison (envoyé, livré, lu) mis à jour dans un délai maximal de 2 secondes.

---

### Requirement 3 : Appels audio du service client et file d'attente

**User Story:** En tant qu'utilisateur authentifié, je veux appeler le service client par audio et être géré en file d'attente si le super-administrateur est occupé, afin d'obtenir de l'aide vocale sans perdre ma place.

#### Acceptance Criteria

1. WHEN un utilisateur initie un Support_Call depuis le service client, THE Central_Server SHALL établir une connexion audio WebRTC via les serveurs STUN/TURN du Central_Server et notifier le Super_Admin d'un appel entrant dans un délai maximal de 3 secondes.
2. IF le Super_Admin a un Support_Call actif au moment où un nouvel utilisateur initie un appel et que la Call_Queue n'a pas atteint sa capacité maximale configurée, THEN THE Call_Queue SHALL placer le nouvel appelant en file d'attente, lui diffuser la Hold_Music, et lui afficher sa position numérique dans la file.
3. WHEN un utilisateur est en Call_Queue, THE Central_Server SHALL mettre à jour et afficher sa position dans la file en temps réel, dans un délai maximal de 2 secondes après chaque changement de position.
4. THE Central_Server SHALL notifier le Super_Admin de chaque nouvel appel entrant en Call_Queue via un indicateur temps réel dans son interface de gestion, sans interrompre le Support_Call actif en cours.
5. WHEN le Super_Admin décide de prendre un appel depuis la Call_Queue, THE Central_Server SHALL automatiquement placer le Support_Call actif en Hold_State — déclenchant la diffusion de la Hold_Music au client correspondant — puis établir la connexion audio avec le nouvel appelant dans un délai maximal de 3 secondes.
6. WHEN un Support_Call passe en Hold_State, THE Central_Server SHALL maintenir la session WebRTC active et diffuser la Hold_Music au client en hold dans un délai maximal de 2 secondes après le basculement.
7. WHEN le Super_Admin reprend un Support_Call en Hold_State, THE Central_Server SHALL placer le Support_Call actif en Hold_State et rétablir la connexion audio avec l'appel repris dans un délai maximal de 3 secondes.
8. IF un utilisateur en Call_Queue ou en Hold_State met fin à l'appel avant d'être pris en charge, THEN THE Central_Server SHALL retirer cet utilisateur de la Call_Queue ou clore la Hold_State, et notifier le Super_Admin dans un délai maximal de 5 secondes.
9. THE Support_Call SHALL être exclusivement audio entre l'utilisateur et le Central_Server ; aucun flux vidéo n'est transmis via le canal Support_Call.
10. IF un utilisateur connecté depuis un Tenant_Server local initie un Support_Call, THEN THE Central_Server SHALL relayer l'appel via le serveur central indépendamment du Tenant_Server, sans interférer avec les appels actifs sur ce Tenant_Server.
11. WHILE un Support_Call est géré par le Central_Server (file, hold, ou actif), THE Central_Server SHALL maintenir simultanément le fonctionnement normal des appels sur les Tenant_Servers sans dégradation des appels tenant en cours.

---

### Requirement 4 : Vidéoconférence initiée par le super-admin depuis le chat

**User Story:** En tant que Super_Admin, je veux pouvoir lancer une vidéoconférence avec un client directement depuis notre conversation, afin de traiter des cas complexes nécessitant une interaction visuelle.

#### Acceptance Criteria

1. WHEN le Super_Admin est dans un Support_Chat actif avec un utilisateur, THE Support_Chat SHALL afficher une option « Lancer une vidéoconférence » accessible en un seul clic depuis l'interface de ce chat.
2. WHEN le Super_Admin lance une Support_VideoConference depuis un Support_Chat, THE Central_Server SHALL créer une room de vidéoconférence via le VideoConference_Service existant, insérer un message système de type `video_invite` dans le Support_Chat, et notifier le client dans un délai maximal de 5 secondes.
3. WHEN un client reçoit un message `video_invite` dans son Support_Chat, THE Support_Chat SHALL afficher un bouton « Rejoindre la vidéoconférence » permettant de rejoindre la room en une seule action utilisateur.
4. THE Support_VideoConference SHALL utiliser exclusivement le VideoConference_Service existant (moteur Jitsi white-label) ; aucune référence à Jitsi ne SHALL être visible dans l'interface client.
5. IF un utilisateur tente d'initier une Support_VideoConference depuis son interface client, THEN THE Support_Chat SHALL rejeter l'action et afficher le message « La vidéoconférence doit être initiée par le service client. »
6. WHILE une Support_VideoConference est active, THE Support_Chat SHALL rester accessible et fonctionnel en parallèle pour l'échange de messages texte.

---

### Requirement 5 : Interface de gestion du super-admin

**User Story:** En tant que Super_Admin, je veux une interface centralisée pour gérer toutes les conversations et appels du service client simultanément, afin de traiter efficacement plusieurs demandes en parallèle.

#### Acceptance Criteria

1. THE Central_Server SHALL exposer une page dédiée de gestion du service client accessible uniquement au Super_Admin à la route `/admin/support`, affichant en temps réel toutes les Support_Sessions actives, la Call_Queue, les Support_Calls en Hold_State, et l'historique des sessions.
2. WHEN une nouvelle Support_Session ou un nouveau Support_Call est initié par un utilisateur, THE Central_Server SHALL notifier le Super_Admin par notification push et indicateur temps réel dans l'interface dans un délai maximal de 3 secondes.
3. THE Super_Admin interface SHALL afficher pour chaque Support_Session : l'identifiant de l'utilisateur, le canal utilisé (chat, appel ou vidéo), le statut (actif, en attente, hold), la durée depuis l'initiation, et la position dans la Call_Queue le cas échéant.
4. THE Super_Admin SHALL pouvoir basculer entre plusieurs Support_Calls simultanés — mettre en hold, reprendre, terminer — depuis l'interface `/admin/support`, sans naviguer entre différentes pages.
5. WHEN le Super_Admin termine une Support_Session (chat ou appel), THE Central_Server SHALL enregistrer la session dans l'historique avec l'horodatage, la durée, le canal utilisé et l'identifiant utilisateur, et SHALL marquer la session comme résolue dans un délai maximal de 5 secondes.
6. THE Super_Admin SHALL pouvoir rechercher dans l'historique des Support_Sessions par identifiant utilisateur, par plage de dates, ou par canal de communication (chat, appel, vidéo).

---

### Requirement 6 : Sécurité et isolation des échanges

**User Story:** En tant qu'utilisateur, je veux que mes échanges avec le service client soient chiffrés de bout en bout et isolés des autres tenants, afin de garantir la confidentialité de mes demandes.

#### Acceptance Criteria

1. THE Support_Chat SHALL chiffrer tous les messages et médias de bout en bout selon le protocole Signal ; les E2E_Keys ne SHALL jamais être transmises au Central_Server ni à aucun Tenant_Server.
2. THE Central_Server SHALL isoler strictement chaque Support_Session : un utilisateur authentifié ne peut accéder qu'à sa propre Support_Session, jamais à celle d'un autre utilisateur.
3. THE Central_Server SHALL enregistrer dans `audit_logs` chaque événement significatif d'une Support_Session : création de session, appel initié, appel terminé, vidéoconférence lancée. Les horodatages sont enregistrés en UTC ; le contenu chiffré des messages n'est jamais enregistré dans les audit_logs.
4. IF un Tenant_Server tente d'accéder aux données d'une Support_Session, THEN THE Central_Server SHALL rejeter la requête avec le code d'erreur `CROSS_TENANT_ACCESS_DENIED`.
5. THE Support_Call SHALL être chiffré via SRTP/DTLS sur la connexion WebRTC ; le Central_Server ne SHALL pas déchiffrer le flux audio.
6. THE Central_Server SHALL authentifier chaque requête vers les endpoints `/api/v1/support/*` avec un token JWT valide ; IF le token est absent ou invalide, THEN THE Central_Server SHALL rejeter la requête avec le code HTTP 401.

---

### Requirement 7 : Parité fonctionnelle web et mobile

**User Story:** En tant qu'utilisateur, je veux accéder à toutes les fonctionnalités du service client indifféremment depuis le navigateur web ou l'application mobile Flutter, avec le même comportement.

#### Acceptance Criteria

1. THE Support_Widget SHALL être implémenté sur les deux plateformes (web React et mobile Flutter) avec un comportement fonctionnellement identique : initiation d'un Support_Chat, initiation d'un Support_Call, et réception d'une invitation Support_VideoConference.
2. WHEN un utilisateur reçoit un message de service client alors que l'application mobile est en arrière-plan, THE Central_Server SHALL délivrer une notification push via FCM (Android) ou APNs (iOS) permettant à l'utilisateur d'ouvrir directement la Support_Session concernée.
3. WHEN un Support_Call entrant est reçu sur l'application mobile en arrière-plan, THE Central_Server SHALL déclencher une notification d'appel système (CallKit sur iOS, ConnectionService sur Android) permettant de répondre sans ouvrir l'application.
4. THE Support_Chat sur mobile SHALL persister les messages localement via SQLite (Drift) pour un accès en lecture hors ligne à l'historique, avec synchronisation automatique au retour de la connexion réseau.
5. THE Support_Call SHALL adapter automatiquement la qualité audio en fonction de la bande passante disponible sur les deux plateformes, avec une qualité audio minimale garantie de 32 kbps (qualité téléphonique standard).

---

### Requirement 8 : Gestion des cas limites et disponibilité

**User Story:** En tant qu'utilisateur, je veux que le service client reste opérationnel et m'informe clairement de son statut, afin de ne pas perdre de temps en cas d'indisponibilité.

#### Acceptance Criteria

1. IF le Super_Admin est hors ligne au moment où un utilisateur tente d'initier un Support_Call, THEN THE Central_Server SHALL informer l'utilisateur que le service vocal est temporairement indisponible et lui proposer d'envoyer un message via le Support_Chat.
2. IF la Call_Queue atteint la capacité maximale configurée (`SUPPORT_CALL_QUEUE_MAX`), THEN THE Central_Server SHALL refuser tout nouvel appel entrant avec le message « Toutes les lignes sont occupées. Veuillez utiliser la messagerie ou réessayer dans quelques minutes. »
3. THE Central_Server SHALL exposer un endpoint `GET /api/v1/support/status` retournant un objet JSON contenant au minimum les champs : `available` (booléen), `queueLength` (entier), et `estimatedWaitMinutes` (entier), utilisé par le Support_Widget pour afficher l'état du service en temps réel.
4. IF la connexion réseau d'un utilisateur est interrompue pendant un Support_Call actif, THEN THE Central_Server SHALL tenter une reconnexion automatique dans un délai maximal de 10 secondes avant de clore la session et d'en notifier le Super_Admin.
5. IF un utilisateur en Call_Queue attend plus de la durée maximale configurée (`SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS`) sans être pris en charge, THEN THE Central_Server SHALL envoyer automatiquement un message dans le Support_Chat de l'utilisateur lui proposant de laisser un message, et SHALL retirer l'utilisateur de la Call_Queue.
6. THE Central_Server SHALL maintenir un fonctionnement du service client (Support_Chat, Support_Call, Support_VideoConference) avec une disponibilité de 99 % mesurée sur une période glissante de 30 jours.
