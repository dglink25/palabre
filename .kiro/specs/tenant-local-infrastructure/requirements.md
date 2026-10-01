# Requirements Document

## Introduction

Ce document décrit les exigences fonctionnelles et non-fonctionnelles de l'infrastructure locale tenant de la plateforme Palabre. Cette fonctionnalité permet à chaque organisation cliente de déployer l'intégralité du service Palabre sur un serveur local hébergé dans ses propres locaux, via un script d'installation unique. Le service tenant local couvre : la messagerie instantanée chiffrée de bout en bout (E2E), les appels audio/vidéo P2P (WebRTC + Coturn), la vidéoconférence multi-participants (Jitsi white-label), les notifications push et le service de présence. Un mécanisme de basculement transparent permet aux clients (web et mobile React Native) de passer automatiquement de la connexion directe au serveur local vers un relais via le serveur central Palabre lorsque l'appareil quitte le réseau de l'organisation.

## Glossaire

- **Tenant_Server** : Serveur physique ou virtuel hébergé dans les locaux de l'organisation cliente, sur lequel est déployée l'instance locale du service Palabre.
- **Central_Server** : Serveur central Palabre hébergé et opéré par l'équipe Palabre, utilisé comme relais (Tunnel) pour les appareils hors réseau local.
- **Install_Script** : Script shell unique fourni par Palabre, exécuté sur le Tenant_Server pour déployer automatiquement l'intégralité du service tenant sans intervention manuelle supplémentaire.
- **Tenant_Subdomain** : Sous-domaine DNS unique attribué automatiquement à chaque tenant sous la forme `{nom_organisation}.palabre.com`, résolvant vers l'adresse IP publique du Tenant_Server.
- **TLS_Certificate** : Certificat TLS/SSL associé au Tenant_Subdomain, généré automatiquement via Let's Encrypt et renouvelé automatiquement avant expiration.
- **DNS_Registry** : Composant du Central_Server responsable de l'enregistrement et de la mise à jour des entrées DNS pour chaque Tenant_Subdomain.
- **Tunnel** : Canal sécurisé chiffré TLS établi entre le Tenant_Server et le Central_Server, permettant de relayer les communications des appareils hors réseau local vers le tenant.
- **Network_Detector** : Composant client (web et mobile) responsable de tester la connectivité vers le Tenant_Server et de déclencher le basculement vers le Tunnel si nécessaire.
- **E2E_Key** : Clé privée de chiffrement de bout en bout d'un utilisateur, générée et stockée exclusivement sur son appareil ; elle ne transite jamais vers le Tenant_Server ni le Central_Server.
- **Session_Key** : Clé de session symétrique dérivée lors d'un échange de clés (ex. : Signal Protocol / X3DH), stockée temporairement sur le Tenant_Server pour permettre le déchiffrement des messages entrants destinés aux utilisateurs hors ligne.
- **Push_Service** : Composant du Tenant_Server responsable de l'envoi des notifications push vers les appareils mobiles via FCM (Firebase Cloud Messaging) ou APNs.
- **Presence_Service** : Composant du Tenant_Server responsable du suivi et de la diffusion du statut de présence en ligne des utilisateurs.
- **TURN_Service** : Serveur Coturn déployé sur le Tenant_Server, utilisé comme relais TURN pour les appels WebRTC lorsque la connexion directe P2P est impossible.
- **VideoConference_Service** : Instance Jitsi déployée sur le Tenant_Server, exposée en mode white-label sans aucune référence à Jitsi dans l'interface client.
- **Org_Admin** : Administrateur de l'organisation, responsable de l'exécution du script d'installation et de la distribution de l'URL tenant aux employés.
- **Tenant_Client** : Application web (React) ou mobile (React Native) utilisée par les membres de l'organisation pour accéder aux services du Tenant_Server.
- **Heartbeat** : Signal périodique envoyé par le Tenant_Server au Central_Server pour signaler sa disponibilité et mettre à jour son statut.
- **Connectivity_Probe** : Requête HTTP légère émise par le Network_Detector vers le Tenant_Server pour vérifier la joignabilité locale avant chaque connexion ou à intervalle régulier.
- **Relay_Mode** : Mode de fonctionnement du Tenant_Client dans lequel toutes les communications transitent via le Tunnel plutôt que directement vers le Tenant_Server.
- **Direct_Mode** : Mode de fonctionnement du Tenant_Client dans lequel les communications sont établies directement avec le Tenant_Server sur le réseau local.

---

## Requirements

### Requirement 1 : Déploiement automatisé du service tenant via script d'installation

**User Story:** En tant qu'Org_Admin d'une organisation cliente, je veux exécuter un script d'installation unique sur le serveur de mon organisation, afin que l'intégralité du service Palabre tenant soit déployée sans aucune configuration manuelle supplémentaire.

#### Acceptance Criteria

1. WHEN un Org_Admin exécute l'Install_Script sur un Tenant_Server satisfaisant les prérequis définis au Requirement 9, THE Install_Script SHALL déployer automatiquement et rendre opérationnels les composants suivants dans un délai de 30 minutes : service de messagerie E2E, TURN_Service (Coturn), VideoConference_Service (Jitsi white-label), Push_Service, Presence_Service et le connecteur Tunnel. Un composant est considéré « opérationnel » lorsque son endpoint `/health` retourne le statut `healthy` dans un délai de 60 secondes après son démarrage.
2. WHEN l'Install_Script termine son exécution avec succès, THE Install_Script SHALL afficher dans la sortie standard le Tenant_Subdomain attribué, l'URL d'accès HTTPS, et le statut de chacun des composants déployés (`healthy` / `unhealthy`).
3. IF l'Install_Script détecte qu'un prérequis système est absent (CPU < 4 cœurs, RAM < 8 Go, espace disque < 50 Go, Docker absent, port requis déjà occupé parmi 443/TCP, 80/TCP, 10000-20000/UDP, 3478/UDP, 5349/TCP), THEN THE Install_Script SHALL interrompre l'installation avant toute modification du système, afficher un message d'erreur précisant le prérequis manquant et la valeur attendue, et quitter avec le code de retour 1.
4. IF l'Install_Script est exécuté une seconde fois sur un Tenant_Server déjà configuré (présence de `/etc/palabre/tenant.conf`), THEN THE Install_Script SHALL détecter l'installation existante, proposer à l'Org_Admin les options « mettre à jour » ou « annuler » via une invite interactive, et n'exécuter aucune modification sans confirmation explicite de l'Org_Admin.
5. WHEN l'Install_Script tente de vérifier la connectivité vers le Central_Server, THE Install_Script SHALL émettre une requête HTTPS GET vers `https://central.palabre.com/health` avec un délai d'attente de 10 secondes ; IF aucune réponse HTTP 200 n'est reçue dans ce délai, THEN THE Install_Script SHALL interrompre l'installation avec le message d'erreur `CENTRAL_SERVER_UNREACHABLE` et quitter avec le code de retour 2.
6. WHEN l'Install_Script déploie les composants, THE Install_Script SHALL générer un fichier de configuration local `/etc/palabre/tenant.conf` contenant le Tenant_Subdomain, les paramètres de connexion au Central_Server, et les clés internes de service ; ce fichier SHALL avoir les permissions `600` (lecture/écriture pour le propriétaire uniquement).
7. WHEN l'Install_Script termine son exécution avec succès, THE Install_Script SHALL envoyer une requête d'enregistrement POST au Central_Server contenant l'identifiant de l'organisation, l'adresse IP publique du Tenant_Server, la version des composants déployés, et le Tenant_Subdomain demandé.
8. IF la requête d'enregistrement au Central_Server échoue (code HTTP non-2xx ou timeout), THEN THE Install_Script SHALL réessayer l'enregistrement jusqu'à 3 fois avec un intervalle de 30 secondes entre chaque tentative ; IF les 3 tentatives échouent, THEN THE Install_Script SHALL afficher le message d'erreur `REGISTRATION_FAILED`, conserver la configuration locale déjà générée, et indiquer à l'Org_Admin la commande manuelle de re-tentative d'enregistrement.

---

### Requirement 2 : Attribution automatique de sous-domaine et certificat TLS

**User Story:** En tant qu'Org_Admin, je veux que mon organisation reçoive automatiquement un sous-domaine unique et un certificat TLS valide, afin que mes employés puissent accéder au service via une URL HTTPS fiable sans configuration DNS ni certificat manuelle.

#### Acceptance Criteria

1. WHEN le Central_Server reçoit une requête d'enregistrement valide d'un Tenant_Server, THE DNS_Registry SHALL créer une entrée DNS de type A associant `{nom_organisation}.palabre.com` à l'adresse IP publique du Tenant_Server dans un délai de 5 minutes.
2. WHEN l'entrée DNS est créée, THE Install_Script SHALL déclencher automatiquement la génération d'un certificat TLS via le protocole ACME (Let's Encrypt ou équivalent) pour le domaine `{nom_organisation}.palabre.com` ; le certificat SHALL être installé et actif sur le Tenant_Server dans un délai de 15 minutes après la propagation DNS.
3. THE Tenant_Server SHALL renouveler automatiquement le certificat TLS au plus tard 30 jours avant sa date d'expiration, en garantissant à tout moment (y compris hors fenêtre de renouvellement) l'absence d'interruption de service et l'absence d'intervention de l'Org_Admin ; cette garantie constitue un invariant permanent de la gestion des certificats du Tenant_Server.
4. IF la génération ou le renouvellement du certificat TLS échoue, THEN THE Tenant_Server SHALL réessayer la procédure toutes les 6 heures pendant 48 heures ; IF l'échec persiste après 48 heures, THEN THE Tenant_Server SHALL envoyer une alerte par e-mail à l'Org_Admin et au Central_Server indiquant l'expiration imminente et la date limite.
5. IF deux organisations soumettent le même nom d'organisation lors de l'enregistrement, THEN THE DNS_Registry SHALL rejeter la seconde demande avec le code d'erreur `SUBDOMAIN_ALREADY_TAKEN` et suggérer un Tenant_Subdomain alternatif disponible.
6. WHEN le Tenant_Subdomain est attribué, THE Central_Server SHALL persister l'association `(organization_id, tenant_subdomain, ip_address, registered_at)` dans sa base de données et la rendre disponible pour la résolution de routage Tunnel dans un délai de 60 secondes.
7. THE Tenant_Server SHALL exposer tous ses services exclusivement sur HTTPS (port 443) ; IF une requête HTTP (port 80) est reçue après l'installation, THEN THE Tenant_Server SHALL la rediriger vers HTTPS avec le code HTTP 301.

---

### Requirement 3 : Basculement réseau transparent (Direct_Mode / Relay_Mode)

**User Story:** En tant que membre de l'organisation, je veux que mon application détecte automatiquement si je suis sur le réseau local ou à l'extérieur, afin de communiquer toujours avec le service tenant de façon transparente sans action manuelle.

#### Acceptance Criteria

1. WHEN un Tenant_Client démarre ou revient au premier plan après ≥ 30 secondes d'arrière-plan, THE Network_Detector SHALL émettre une Connectivity_Probe (requête HTTP GET vers `https://{org}.palabre.com/health`) dans un délai de 2 secondes ; IF la Connectivity_Probe reçoit une réponse HTTP 200 du Tenant_Server dans un délai de 3 secondes, THEN THE Network_Detector SHALL établir la connexion en Direct_Mode sans action de l'utilisateur.
2. IF la Connectivity_Probe ne reçoit pas de réponse HTTP 200 dans un délai de 3 secondes — que ce soit en raison d'une erreur TCP, d'un timeout DNS, d'un code HTTP 4xx/5xx, ou d'une erreur TLS — THEN THE Network_Detector SHALL basculer le Tenant_Client en Relay_Mode via le Tunnel du Central_Server dans un délai de 5 secondes supplémentaires, sans afficher de message de déconnexion à l'utilisateur et sans requérir d'action de sa part.
3. WHILE le Tenant_Client est en Relay_Mode, THE Network_Detector SHALL émettre une Connectivity_Probe vers le Tenant_Server toutes les 30 secondes ; WHEN une Connectivity_Probe réussit (réponse HTTP 200 dans un délai de 3 secondes) en Relay_Mode, THE Network_Detector SHALL rétablir le Direct_Mode dans un délai de 5 secondes, sans que l'utilisateur ait besoin de se ré-authentifier et sans que les sessions de messagerie ou de Room actives soient interrompues.
4. WHEN un basculement entre Direct_Mode et Relay_Mode se produit, THE Tenant_Client SHALL maintenir la continuité des connexions audio, vidéo, chat et partage d'écran actives avec une interruption maximale de 5 secondes.
5. WHEN un changement de mode (Direct_Mode ↔ Relay_Mode) se produit, THE Network_Detector SHALL mettre à jour un indicateur visuel dans l'interface affichant explicitement le libellé du mode actif (« Réseau local » ou « Via serveur central ») dans un délai de 3 secondes.
6. IF le Central_Server (Tunnel) est indisponible au moment du basculement, THEN THE Network_Detector SHALL tenter 3 connexions consécutives vers le Central_Server avec un intervalle de 5 secondes entre chaque tentative ; IF les 3 tentatives échouent, THEN THE Tenant_Client SHALL afficher un message d'erreur explicite indiquant l'indisponibilité du service et cessera toute tentative automatique jusqu'à ce que l'utilisateur déclenche manuellement une nouvelle tentative.
7. WHILE un appel audio ou vidéo actif est en cours et qu'un basculement Direct_Mode → Relay_Mode se produit, THE Network_Detector SHALL migrer la session d'appel vers le Tunnel en maintenant la continuité audio/vidéo avec une interruption maximale de 5 secondes.
8. IF la migration de la session d'appel vers le Tunnel excède 5 secondes sans rétablissement, THEN THE Tenant_Client SHALL terminer l'appel proprement, notifier l'utilisateur de l'interruption par un message explicite, et conserver la possibilité de rappeler depuis l'historique.

---

### Requirement 4 : Sécurité E2E et isolation des clés privées

**User Story:** En tant qu'utilisateur de Palabre, je veux que mes clés privées de chiffrement restent exclusivement sur mon appareil, afin que ni le serveur tenant ni le serveur central ne puissent lire le contenu de mes messages, même en mode relais.

#### Acceptance Criteria

1. WHEN un utilisateur provisionne son compte sur un Tenant_Client pour la première fois, THE Tenant_Client SHALL générer la paire de clés E2E localement sur l'appareil ; la E2E_Key privée SHALL être stockée exclusivement dans le stockage sécurisé de l'appareil (iOS Keychain / Android Keystore / Web Crypto API `extractable: false`) ; IF le stockage sécurisé est indisponible sur l'appareil, THEN THE Tenant_Client SHALL interrompre le provisionnement et afficher un message d'erreur indiquant l'impossibilité d'assurer la sécurité E2E ; la E2E_Key privée ne SHALL jamais être transmise au Tenant_Server ni au Central_Server.
2. WHILE un message est transmis via le Tunnel en Relay_Mode, THE Tunnel SHALL transporter uniquement le chiffré E2E du message ; le Central_Server ne SHALL jamais recevoir, stocker ni traiter le contenu en clair d'un message.
3. THE Tenant_Server SHALL stocker les Session_Keys pour permettre la livraison différée des messages aux destinataires hors ligne ; ces Session_Keys SHALL être chiffrées au repos avec une clé maître dérivée de la configuration tenant et ne SHALL jamais être transmises au Central_Server.
4. WHEN un Tenant_Client en Relay_Mode envoie un message, THE Tunnel SHALL établir le chiffrement TLS sur le segment Tenant_Client → Central_Server ET sur le segment Central_Server → Tenant_Server ; IF le chiffrement TLS ne peut pas être établi sur l'un ou l'autre des deux segments, THEN THE Tunnel SHALL rejeter la transmission du message avec le code d'erreur `TUNNEL_TLS_FAILED` sans livrer le message, quel que soit l'état de l'autre segment.
5. WHEN une API non autorisée tente d'accéder à la zone mémoire ou au stockage contenant la E2E_Key privée d'un utilisateur, THE Tenant_Client SHALL rejeter la tentative d'accès, invalider la session courante de l'utilisateur concerné, et enregistrer un événement de sécurité local contenant l'horodatage UTC et le type d'accès tenté.
6. WHEN l'Install_Script génère les clés du Tenant_Server lors de l'installation, THE Install_Script SHALL créer une paire de clés asymétriques unique pour ce Tenant_Server, utilisée pour son authentification auprès du Central_Server et la signature des messages du Tunnel ; la clé privée du Tenant_Server SHALL être stockée avec des permissions restrictives réservées au propriétaire du processus Palabre, et ne SHALL jamais être transmise au Central_Server.

---

### Requirement 5 : Parité fonctionnelle web et mobile (React Native)

**User Story:** En tant que membre de l'organisation, je veux accéder à toutes les fonctionnalités de communication (messagerie, appels, vidéoconférence, notifications, présence) indifféremment depuis l'application web ou l'application mobile React Native, avec le même comportement de basculement réseau.

#### Acceptance Criteria

1. THE Tenant_Client SHALL exposer les six fonctionnalités suivantes sur les deux plateformes (web React et mobile React Native) avec un comportement fonctionnellement équivalent, défini comme : mêmes données accessibles, mêmes actions disponibles, mêmes seuils de délai, même logique de basculement réseau : (a) messagerie instantanée E2E, (b) appels audio P2P via WebRTC, (c) appels vidéo P2P via WebRTC, (d) vidéoconférence multi-participants via VideoConference_Service, (e) notifications push, (f) suivi de présence en ligne.
2. THE Network_Detector SHALL être implémenté sur la plateforme web (JavaScript) et sur la plateforme mobile React Native (iOS et Android) avec les mêmes seuils de délai (probe ≤ 2 s, timeout ≤ 3 s, basculement ≤ 5 s, re-probe en Relay_Mode toutes les 30 s) et le même comportement de basculement documenté au Requirement 3.
3. WHEN un Tenant_Client mobile reçoit une notification push alors que l'application est en arrière-plan ou fermée, THE Push_Service SHALL délivrer la notification via FCM (Android) ou APNs (iOS).
4. WHEN l'utilisateur appuie sur une notification push reçue, THE Tenant_Client mobile SHALL naviguer directement vers la conversation, l'appel ou la vidéoconférence concerné dans un délai de 3 secondes.
5. WHEN un appel audio ou vidéo entrant est reçu sur le Tenant_Client mobile alors que l'application est en arrière-plan, THE Tenant_Client SHALL afficher une notification d'appel entrant système (CallKit sur iOS, ConnectionService sur Android) permettant de répondre ou rejeter l'appel sans ouvrir l'application.
6. WHILE le Tenant_Client mobile est en arrière-plan, THE Network_Detector SHALL suspendre les Connectivity_Probes périodiques et SHALL les reprendre dans un délai de 5 secondes après que l'application revient au premier plan.
7. WHEN un changement de bande passante disponible est détecté, THE Tenant_Client SHALL adapter la résolution et le débit vidéo dans un délai de 3 secondes, avec une qualité minimale de 180p à 150 kbps et une qualité maximale de 1080p à 4 Mbps.
8. WHERE les notifications push sont désactivées par l'utilisateur au niveau du système d'exploitation, THE Push_Service SHALL tenter de délivrer les notifications via la connexion WebSocket active du Tenant_Client ; IF la connexion WebSocket est également indisponible, THEN THE Push_Service SHALL mettre la notification en file d'attente et la délivrer dès le prochain rétablissement de la connexion WebSocket, sans dégradation des autres fonctionnalités.

---

### Requirement 6 : Communication sécurisée entre Tenant_Server et Central_Server (Tunnel)

**User Story:** En tant qu'administrateur de la plateforme Palabre, je veux que toutes les communications entre les Tenant_Servers et le Central_Server soient sécurisées et authentifiées, afin de prévenir tout accès non autorisé au réseau de relais.

#### Acceptance Criteria

1. THE Tunnel SHALL chiffrer toutes les communications entre le Tenant_Server et le Central_Server avec TLS 1.2 minimum (TLS 1.3 recommandé) ; IF une connexion sans TLS valide est tentée, THEN THE Central_Server SHALL rejeter la connexion immédiatement.
2. WHEN un Tenant_Server initie une connexion Tunnel, THE Central_Server SHALL authentifier le Tenant_Server via son certificat TLS client (mutual TLS) ou sa clé RSA de tenant ; IF l'authentification échoue, THEN THE Central_Server SHALL rejeter la connexion avec le code d'erreur `TENANT_AUTH_FAILED` et enregistrer la tentative dans ses journaux d'audit.
3. THE Tenant_Server SHALL envoyer un Heartbeat au Central_Server toutes les 60 secondes ; IF le Central_Server ne reçoit pas de Heartbeat d'un Tenant_Server pendant 180 secondes consécutives, THEN THE Central_Server SHALL marquer le Tenant_Server comme `indisponible` et mettre à jour l'entrée DNS_Registry correspondante pour permettre aux Tenant_Clients de recevoir une réponse d'erreur appropriée.
4. WHILE le Tunnel est actif, THE Central_Server SHALL router les messages relayés exclusivement vers le Tenant_Server destinataire identifié par le Tenant_Subdomain présent dans le contexte du message ; THE Central_Server ne SHALL pas inspecter ni modifier le contenu chiffré E2E des messages.
5. IF le Tunnel entre un Tenant_Server et le Central_Server est interrompu, THEN le Central_Server SHALL tenter de rétablir la connexion Tunnel toutes les 30 secondes pendant 10 minutes ; IF la connexion n'est pas rétablie après 10 minutes, THEN THE Central_Server SHALL notifier l'Org_Admin par e-mail de l'interruption persistante du Tunnel.
6. THE Central_Server SHALL maintenir un journal d'audit de toutes les connexions et déconnexions Tunnel, incluant : horodatage UTC, identifiant de l'organisation, adresse IP du Tenant_Server, durée de la session, et volume de données relayées (en octets), sans enregistrer le contenu des messages.

---

### Requirement 7 : Mise à jour du service tenant

**User Story:** En tant qu'Org_Admin, je veux pouvoir mettre à jour le service tenant vers une nouvelle version de Palabre, afin de bénéficier des corrections de sécurité et des nouvelles fonctionnalités.

#### Acceptance Criteria

1. THE Central_Server SHALL notifier les Tenant_Servers de la disponibilité d'une nouvelle version dans un délai de 24 heures suivant la publication de cette version, via une mise à jour du canal de signalement de version accessible au Tenant_Server.
2. WHEN un Org_Admin déclenche une mise à jour du Tenant_Server, THE Install_Script SHALL télécharger les nouveaux composants depuis le Central_Server, appliquer la mise à jour composant par composant avec une fenêtre d'indisponibilité par composant n'excédant pas 60 secondes, et vérifier le bon fonctionnement de chaque composant après mise à jour avant de passer au suivant.
3. IF un composant mis à jour échoue à sa vérification de santé post-mise à jour, THEN THE Install_Script SHALL revenir automatiquement à la version précédente du composant défaillant (rollback) ; IF le rollback échoue lui-même, THEN THE Install_Script SHALL bloquer toute progression de la mise à jour vers les composants suivants jusqu'à résolution manuelle, notifier l'Org_Admin de l'échec du rollback et de l'état bloquant, et conserver les journaux d'erreur dans `/var/log/palabre/update.log`.
4. WHEN une mise à jour est disponible et n'a pas été appliquée dans un délai de 30 jours, THE Central_Server SHALL envoyer une alerte par e-mail à l'Org_Admin rappelant la mise à jour en attente et la date de fin de support de la version courante.
5. THE Install_Script SHALL créer un snapshot de la configuration et des données du Tenant_Server avant toute mise à jour ; ce snapshot SHALL être conservé pendant 7 jours et permettre un rollback complet en cas d'échec critique.

---

### Requirement 8 : Monitoring et santé du service tenant

**User Story:** En tant qu'Org_Admin et en tant qu'équipe Palabre, nous voulons surveiller l'état de santé du service tenant en temps réel, afin de détecter et résoudre rapidement les défaillances.

#### Acceptance Criteria

1. THE Tenant_Server SHALL exposer un endpoint HTTP `/health` retournant un objet JSON indiquant le statut de chacun des composants déployés (messagerie, TURN_Service, VideoConference_Service, Push_Service, Presence_Service, Tunnel) ; chaque statut SHALL être l'une des valeurs : `healthy`, `degraded`, `unhealthy`.
2. WHEN un composant du Tenant_Server passe en état `unhealthy`, THE Tenant_Server SHALL enregistrer un événement dans les journaux locaux avec l'horodatage UTC, le nom du composant et le message d'erreur associé, et SHALL envoyer une notification au Central_Server via le Tunnel dans un délai de 60 secondes.
3. THE Central_Server SHALL agréger les statuts de tous les Tenant_Servers actifs et les exposer dans un tableau de bord accessible aux super-administrateurs de Palabre.
4. IF le composant VideoConference_Service devient `unhealthy`, THEN THE Tenant_Server SHALL basculer automatiquement les nouvelles demandes de vidéoconférence vers le Central_Server comme solution de secours, si ce dernier dispose d'une instance VideoConference_Service opérationnelle, et SHALL notifier l'Org_Admin de ce basculement.
5. THE Tenant_Server SHALL conserver les journaux des 30 derniers jours dans `/var/log/palabre/` avec une rotation automatique des fichiers journaux ; les journaux antérieurs à 30 jours SHALL être archivés et compressés, et les journaux antérieurs à 90 jours SHALL être supprimés automatiquement.

---

### Requirement 9 : Prérequis et compatibilité du Tenant_Server

**User Story:** En tant qu'Org_Admin, je veux connaître précisément les prérequis matériels et logiciels du Tenant_Server, afin de pouvoir préparer l'infrastructure nécessaire avant l'installation.

#### Acceptance Criteria

1. THE Install_Script SHALL vérifier que le Tenant_Server satisfait les prérequis minimaux suivants avant de démarrer le déploiement : CPU avec au moins 4 cœurs, 8 Go de RAM minimum, 50 Go d'espace disque disponible, système d'exploitation Ubuntu 20.04 LTS ou supérieur (ou Debian 11 ou supérieur), Docker Engine version 24 ou supérieure, accès Internet sortant vers le Central_Server sur le port 443.
2. IF le Tenant_Server présente des caractéristiques supérieures aux prérequis minimaux, THE Install_Script SHALL adapter automatiquement la configuration des composants (nombre de workers, allocation mémoire, résolution vidéo maximale) pour utiliser les ressources disponibles.
3. THE Install_Script SHALL être compatible avec les architectures processeur x86_64 et ARM64 ; IF une architecture non supportée est détectée, THEN THE Install_Script SHALL afficher le message `UNSUPPORTED_ARCHITECTURE` et quitter avec le code de retour 3.
4. THE Install_Script SHALL valider que les ports requis (443/TCP, 80/TCP, 10000-20000/UDP pour WebRTC, 3478/UDP et 5349/TCP pour TURN) sont disponibles sur le Tenant_Server ; IF l'un de ces ports est occupé, THEN THE Install_Script SHALL lister les ports bloquants et quitter avec le code de retour 4.

---

### Requirement 10 : Sérialisation fiable de la configuration tenant (Round-Trip)

**User Story:** En tant que développeur Palabre, je veux que la configuration du Tenant_Server soit sérialisée et désérialisée de façon fiable, afin d'éviter toute corruption lors des échanges entre le serveur tenant et le serveur central.

#### Acceptance Criteria

1. WHEN le Tenant_Server sérialise sa configuration en JSON pour la transmettre au Central_Server (enregistrement, Heartbeat, mise à jour), THE Tenant_Server SHALL produire un objet JSON valide conforme au schéma de configuration tenant défini, avec les clés triées lexicographiquement, les dates en format ISO 8601 UTC avec suffixe `Z`, et sans espaces superflus.
2. WHEN le Central_Server reçoit et désérialise un objet de configuration tenant valide, THE Central_Server SHALL reconstruire un objet dont chaque champ — identifiant d'organisation, Tenant_Subdomain, adresse IP, version des composants, horodatage — est structurellement et sémantiquement identique au champ correspondant de l'objet original.
3. THE Tenant_Server SHALL garantir que pour tout objet de configuration valide, la séquence sérialisation → transmission → désérialisation → re-sérialisation produit une chaîne JSON byte-for-byte identique à la première sérialisation.
4. IF le Central_Server reçoit un objet de configuration tenant invalide ou incomplet, THEN THE Central_Server SHALL retourner le code d'erreur `INVALID_TENANT_CONFIG` avec un message précisant le champ manquant ou invalide, sans modifier l'état de sa base de données ; le service SHALL être isolé de sorte qu'une entrée invalide ne puisse jamais provoquer un crash du service, même en cas d'erreur interne imprévue lors de la validation, garantissant ainsi la continuité du traitement des requêtes suivantes.

