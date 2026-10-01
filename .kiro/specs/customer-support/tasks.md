# Plan d'implémentation : Service Client Palabre

## Vue d'ensemble

Implémentation du service client Palabre en trois couches : backend Node.js/Express (migration SQL, services, routes, gateway WebSocket), frontend web React (widget flottant, panneaux chat/appel, dashboard super-admin), et frontend mobile Flutter (widget FAB, pages dédiées). Tous les échanges transitent exclusivement par le serveur central.

---

## Tâches

- [ ] 1. Migration SQL et structure du module backend
  - [ ] 1.1 Créer la migration `011_customer_support.sql`
    - Créer les tables `support_sessions`, `support_messages`, `support_calls` avec contraintes, index et relations FK vers `users`
    - Respecter la contrainte `UNIQUE (user_id)` sur `support_sessions` (1 session active par utilisateur)
    - _Requirements : 2.1, 2.7, 6.2_

  - [ ] 1.2 Créer la structure de répertoire du module support
    - Créer `backend/src/modules/support/` avec les fichiers vides : `support.routes.js`, `support.service.js`, `support.call.service.js`, `support.queue.service.js`, `support.gateway.js`
    - _Requirements : 1.5, 3.1_

- [ ] 2. Service de sessions et messages (`support.service.js`)
  - [ ] 2.1 Implémenter les fonctions CRUD de sessions
    - `getOrCreateSession(userId)` : créer ou récupérer la session active ; si la session précédente est `resolved`, créer une nouvelle tout en conservant l'historique
    - `resolveSession(sessionId, adminUserId)` : marquer `resolved`, enregistrer `resolved_at`, écrire dans `audit_logs`
    - _Requirements : 2.1, 2.2, 5.5, 6.3_

  - [ ] 2.2 Implémenter les fonctions de messagerie
    - `saveMessage({ sessionId, senderId, senderType, ciphertext, senderKeyId, type, clientTs })` : persister le message chiffré sans jamais déchiffrer côté serveur
    - `getMessages(sessionId, { limit, before })` : pagination par curseur `server_ts DESC`
    - `markMessagesDelivered(sessionId, recipientType)` et `markMessagesRead(sessionId, lastTs)` : mise à jour des statuts
    - _Requirements : 2.3, 2.4, 2.7, 2.9_

  - [ ]* 2.3 Écrire les tests unitaires pour `support.service.js`
    - Tester `getOrCreateSession` : création première fois, récupération session existante, nouvelle session après résolution
    - Tester l'isolation : un userId ne peut pas accéder à la session d'un autre
    - _Requirements : 2.1, 2.2, 6.2_

- [ ] 3. Service de file d'attente Redis (`support.queue.service.js`)
  - [ ] 3.1 Implémenter la gestion Redis de la Call_Queue
    - `enqueue(callId, userId)` : `RPUSH` dans `support:call_queue`, stocker JSON dans `support:call:{callId}`, appeler `notifyQueuePositions()` et `notifySuperAdmin()`
    - `answerNext(adminCallId)` : `LPOP` ou sélection ciblée, mise en hold automatique de l'appel actif via `putOnHold()`
    - `putOnHold(callId)` : `SADD support:admin:hold_calls`, broadcast `support:call:hold`
    - `resumeFromHold(callId)` : `SREM`, mettre l'actif en hold, broadcast `support:call:resumed`
    - `dequeue(callId)` : retirer un appelant qui raccroche avant d'être pris en charge
    - `getQueueStatus()` : retourner `{ available, queueLength, estimatedWaitMinutes }`
    - _Requirements : 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 8.2_

  - [ ]* 3.2 Écrire les tests unitaires pour `support.queue.service.js`
    - Tester `enqueue` / `dequeue` / positions mises à jour
    - Tester `putOnHold` déclenché automatiquement lors de `answerNext`
    - Tester le comportement quand la queue est à `SUPPORT_CALL_QUEUE_MAX`
    - _Requirements : 3.2, 3.5, 8.2_

- [ ] 4. Service WebRTC appels audio (`support.call.service.js`)
  - [ ] 4.1 Implémenter les fonctions d'appel audio
    - `initiateCall(sessionId, userId)` : créer un enregistrement `support_calls` au statut `queued`, appeler `queue.enqueue()`, notifier le super-admin par push FCM/APNs si hors ligne
    - `answerCall(callId, adminUserId)` : appeler `queue.answerNext(callId)`, mettre à jour `support_calls.status = 'active'`, `answered_at`
    - `holdCall(callId)` : appeler `queue.putOnHold(callId)`, mettre à jour `support_calls.status = 'hold'`
    - `resumeCall(callId)` : appeler `queue.resumeFromHold(callId)`, mettre à jour le statut
    - `endCall(callId, reason)` : calculer `duration_seconds`, mettre à jour `status = 'ended'`, `end_reason`, `ended_at`, enregistrer `audit_logs`
    - Gérer le timeout automatique (`SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS`) : envoyer un message système dans le Support_Chat et retirer l'utilisateur de la queue
    - _Requirements : 3.1, 3.4, 3.5, 3.6, 3.7, 3.8, 8.1, 8.4, 8.5_

  - [ ]* 4.2 Écrire les tests unitaires pour `support.call.service.js`
    - Tester `initiateCall` quand super-admin est hors ligne → message d'indisponibilité
    - Tester `endCall` avec calcul de durée correct
    - Tester le timeout de queue après `SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS`
    - _Requirements : 3.1, 8.1, 8.5_

- [ ] 5. Endpoints REST (`support.routes.js`)
  - [ ] 5.1 Implémenter les routes utilisateur
    - `POST /api/v1/support/sessions` → `support.service.getOrCreateSession`
    - `GET /api/v1/support/sessions/me` → session + messages récents
    - `GET /api/v1/support/sessions/me/messages` → messages paginés
    - `POST /api/v1/support/sessions/me/calls` → `support.call.service.initiateCall`
    - `POST /api/v1/support/sessions/me/calls/:callId/hangup` → `endCall`
    - `GET /api/v1/support/status` → `queue.getQueueStatus()`
    - Appliquer `requireAuth` sur toutes les routes ; retourner 401 si token absent/invalide
    - Rejeter les requêtes cross-tenant avec `CROSS_TENANT_ACCESS_DENIED`
    - _Requirements : 1.2, 1.3, 6.4, 6.6, 8.1, 8.2, 8.3_

  - [ ] 5.2 Implémenter les routes super-admin
    - `GET /api/v1/support/admin/sessions` → toutes les sessions actives
    - `GET /api/v1/support/admin/sessions/:id` → détail + messages
    - `POST /api/v1/support/admin/sessions/:id/calls/:callId/answer` → `answerCall`
    - `POST /api/v1/support/admin/sessions/:id/calls/:callId/hold` → `holdCall`
    - `POST /api/v1/support/admin/sessions/:id/calls/:callId/resume` → `resumeCall`
    - `POST /api/v1/support/admin/sessions/:id/calls/:callId/hangup` → `endCall`
    - `POST /api/v1/support/admin/sessions/:id/videoconference` → créer room via `vcService.createRoom`, insérer message `video_invite`
    - `POST /api/v1/support/admin/sessions/:id/resolve` → `resolveSession`
    - `GET /api/v1/support/admin/sessions/history` → recherche par userId, plage de dates, canal
    - Appliquer `requireAuth` + `requireSuperAdmin` sur toutes ces routes
    - _Requirements : 4.1, 4.2, 5.1, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 5.3 Écrire les tests d'intégration pour les routes support
    - Tester 401 sur requête sans token
    - Tester 403 sur route admin sans rôle super-admin
    - Tester le rejet cross-tenant
    - Tester `GET /api/v1/support/status` retourne `{ available, queueLength, estimatedWaitMinutes }`
    - _Requirements : 6.4, 6.6, 8.3_

- [ ] 6. Point de contrôle — Backend REST
  - Vérifier que tous les tests passent, demander si des questions se posent.

- [ ] 7. Gateway WebSocket (`support.gateway.js`)
  - [ ] 7.1 Implémenter la gateway WebSocket `/support/socket`
    - Attacher au serveur HTTP existant (`attachSupportGateway(server)`)
    - Authentifier chaque connexion WebSocket via JWT (rejeter si absent/invalide)
    - Gérer les events entrants : `support:message`, `support:call:signal`, `support:read_ack`
    - Pour `support:message` : appeler `support.service.saveMessage()`, broadcaster `support:message:new` au destinataire et mettre à jour le statut via `support:message:status`
    - Pour `support:call:signal` : relayer `offer/answer/ice/hangup` entre l'utilisateur et le super-admin (signaling WebRTC)
    - Pour `support:read_ack` : appeler `markMessagesRead()`
    - Broadcaster les events sortants : `support:call:incoming`, `support:call:answered`, `support:call:hold`, `support:call:ended`, `support:queue:update`, `support:video:invite`, `support:admin:online`
    - Gérer la reconnexion automatique (10 secondes) sur déconnexion pendant un appel actif
    - _Requirements : 2.3, 2.6, 2.9, 3.1, 3.3, 3.5, 3.6, 8.4_

  - [ ]* 7.2 Écrire les tests unitaires pour `support.gateway.js`
    - Tester que les connexions sans JWT valide sont rejetées
    - Tester le broadcast de `support:queue:update` après chaque changement de position
    - _Requirements : 6.6, 3.3_

- [ ] 8. Enregistrement dans `app.js` et `server.js`
  - [ ] 8.1 Monter les routes et la gateway dans le serveur
    - Ajouter `const supportRoutes = require('./modules/support/support.routes'); app.use('/api/v1/support', supportRoutes);` dans `app.js`
    - Ajouter `attachSupportGateway(server)` dans `server.js` après la création du serveur HTTP
    - Ajouter les variables d'environnement `SUPPORT_CALL_QUEUE_MAX`, `SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS`, `SUPPORT_HOLD_MUSIC_PATH` dans `.env.example`
    - _Requirements : 1.5, 3.2, 8.2, 8.5_

- [ ] 9. Point de contrôle — Backend complet
  - Vérifier que le serveur démarre sans erreur, que les routes répondent, demander si des questions se posent.

- [ ] 10. Frontend Web — API client et widget flottant
  - [ ] 10.1 Créer `frontend/web/src/lib/supportApi.js`
    - Wrappers pour tous les endpoints REST support (sessions, messages, calls, status, admin)
    - Classe `SupportWebSocket` : connexion au WebSocket `/support/socket`, reconnexion automatique, dispatch des events entrants
    - _Requirements : 1.3, 2.3, 8.3_

  - [ ] 10.2 Créer `frontend/web/src/components/SupportWidget.jsx`
    - Bouton fixe en bas à droite (`position: fixed, bottom: 24, right: 24, zIndex: 500`)
    - Polling statut toutes les 30 secondes via `supportApi.getStatus()`
    - Dot de statut (vert = disponible, rouge = occupé)
    - Libellé « Service client » avec icône headset (lucide-react)
    - Rediriger utilisateur non authentifié vers `/login?redirect=/support`
    - Ouvrir `SupportPage` en slide-over pour utilisateur authentifié dans un délai ≤ 2 s
    - Injecter le widget dans `PublicLayout.jsx` et `Layout.jsx`
    - _Requirements : 1.1, 1.2, 1.3, 1.4, 1.5, 7.1_

- [ ] 11. Frontend Web — Panneaux chat et appel
  - [ ] 11.1 Créer `frontend/web/src/pages/support/SupportChatPanel.jsx`
    - Afficher l'historique paginé des messages (chiffrés E2E, déchiffrés localement)
    - Indicateurs de statut de livraison (envoyé / livré / lu) mis à jour en ≤ 2 s
    - Bouton « Rejoindre la vidéoconférence » affiché à la réception d'un message `video_invite`
    - Bloquer l'initiation de vidéoconférence côté client avec le message d'erreur requis
    - _Requirements : 2.3, 2.5, 2.8, 2.9, 4.3, 4.4, 4.5, 4.6_

  - [ ] 11.2 Créer `frontend/web/src/pages/support/SupportCallPanel.jsx`
    - Initier / raccrocher un appel audio WebRTC via `supportApi`
    - Afficher la position dans la file en temps réel
    - Lecture de la musique d'attente en boucle (`/audio/hold-music.mp3`) quand `status === 'queued' || 'hold'`
    - Arrêter la musique dès la connexion de l'appel
    - _Requirements : 3.1, 3.2, 3.3, 3.6, 8.1_

  - [ ] 11.3 Créer `frontend/web/src/pages/support/SupportPage.jsx`
    - Page principale du service client (`/support`)
    - Onglets : Messagerie | Appel audio
    - Charger la session existante au montage, créer si absente
    - _Requirements : 1.3, 2.1, 7.1_

- [ ] 12. Frontend Web — Dashboard super-admin
  - [ ] 12.1 Créer `frontend/web/src/pages/admin/AdminSupportPage.jsx`
    - Route `/admin/support` protégée par `SuperAdminRoute`
    - Panneau gauche : liste des sessions actives, Call_Queue, appels en hold
    - Panneau droit : chat actif + contrôles appel (Décrocher, Hold, Reprendre, Terminer, Lancer vidéo)
    - Mise à jour temps réel via WebSocket (events `support:call:incoming`, `support:queue:update`, `support:message:new`, `support:admin:online`)
    - Afficher pour chaque session : identifiant utilisateur, canal, statut, durée, position en queue
    - Barre de recherche historique : par userId, plage de dates, canal
    - Ajouter la route dans `App.jsx` sous `SuperAdminRoute`
    - _Requirements : 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 12.2 Écrire les tests unitaires pour `AdminSupportPage.jsx`
    - Tester que la page n'est pas accessible sans rôle super-admin
    - Tester le rendu des sessions actives et de la Call_Queue
    - _Requirements : 5.1, 6.2_

- [ ] 13. Point de contrôle — Frontend Web
  - Vérifier que le widget s'affiche correctement, que le chat envoie et reçoit, demander si des questions se posent.

- [ ] 14. Frontend Mobile Flutter — API client et widget
  - [ ] 14.1 Créer `lib/features/support/data/support_api.dart`
    - Wrappers Dart pour tous les endpoints REST support
    - Classe `SupportWebSocketClient` : connexion, reconnexion automatique, stream d'events
    - _Requirements : 7.1, 7.2_

  - [ ] 14.2 Créer `lib/features/support/presentation/widgets/support_widget.dart`
    - FAB flottant dans `ShellPage` avec icône headset et dot de statut coloré
    - Polling statut toutes les 30 secondes
    - Rediriger utilisateur non authentifié vers la page de connexion
    - Ouvrir `SupportPage` via GoRouter dans un délai ≤ 2 s
    - Intégrer le widget dans `ShellPage` via `floatingActionButton`
    - _Requirements : 1.1, 1.2, 1.3, 1.4, 7.1_

- [ ] 15. Frontend Mobile Flutter — Pages chat et appel
  - [ ] 15.1 Créer `lib/features/support/presentation/pages/support_chat_page.dart`
    - Liste des messages paginée avec synchronisation WebSocket
    - Persistance locale avec Drift (SQLite) pour accès hors ligne
    - Synchronisation automatique au retour de la connexion réseau
    - Indicateurs de statut de livraison
    - Afficher le bouton « Rejoindre la vidéoconférence » sur réception `video_invite`
    - _Requirements : 2.3, 2.4, 2.7, 2.9, 4.3, 7.4_

  - [ ] 15.2 Créer `lib/features/support/presentation/widgets/support_call_panel.dart`
    - Appel audio WebRTC, indicateur de position en file d'attente
    - Musique d'attente via `just_audio` en boucle sur `status == 'queued' || 'hold'`
    - Adaptation de la qualité audio à la bande passante (min 32 kbps)
    - _Requirements : 3.1, 3.2, 3.6, 7.5_

  - [ ] 15.3 Créer `lib/features/support/presentation/widgets/support_queue_indicator.dart`
    - Widget affichant la position et l'estimation d'attente en temps réel
    - _Requirements : 3.2, 3.3_

  - [ ] 15.4 Créer `lib/features/support/presentation/pages/support_page.dart`
    - Page principale mobile du service client
    - Tabs : Messagerie | Appel audio
    - Ajouter la route `/support` dans `app_router.dart`
    - _Requirements : 1.3, 7.1_

- [ ] 16. Frontend Mobile Flutter — Notifications push et appels entrants
  - [ ] 16.1 Implémenter les notifications push et CallKit/ConnectionService
    - Configurer la réception de notifications FCM (Android) / APNs (iOS) pour les messages reçus en arrière-plan (ouverture directe de la Support_Session)
    - Déclencher une notification d'appel système (CallKit sur iOS, ConnectionService sur Android) à la réception d'un Support_Call entrant en arrière-plan
    - _Requirements : 7.2, 7.3_

- [ ] 17. Frontend Mobile Flutter — Dashboard super-admin mobile
  - [ ] 17.1 Créer `lib/features/support/presentation/pages/admin_support_page.dart`
    - Interface mobile du dashboard super-admin
    - Liste sessions + Call_Queue + contrôles appel (Décrocher, Hold, Reprendre, Terminer)
    - Mise à jour temps réel via WebSocket
    - Route `/admin/support` hors shell dans `app_router.dart`
    - _Requirements : 5.1, 5.2, 5.3, 5.4_

- [ ] 18. Point de contrôle final — Intégration complète
  - Vérifier que tous les tests passent sur les trois couches (backend, web, mobile), que le flux complet (chat → appel → vidéo → résolution) fonctionne de bout en bout via tests automatisés, demander si des questions se posent.

---

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être sautées pour un MVP rapide.
- Chaque tâche référence les exigences spécifiques pour la traçabilité.
- Les checkpoints aux étapes 6, 9, 13 et 18 permettent une validation incrémentale.
- Le chiffrement E2E Signal est opaque côté serveur : le serveur persiste et relaie uniquement les `ciphertext`, sans jamais les déchiffrer.
- Les variables d'environnement `SUPPORT_CALL_QUEUE_MAX` et `SUPPORT_CALL_QUEUE_TIMEOUT_SECONDS` doivent être définies avant le démarrage du serveur.
- La musique d'attente (`hold-music.mp3`) doit être placée dans `backend/public/audio/` (web) et `assets/audio/` (mobile).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["5.3", "7.1", "8.1"] },
    { "id": 7, "tasks": ["7.2", "10.1"] },
    { "id": 8, "tasks": ["10.2"] },
    { "id": 9, "tasks": ["11.1", "11.2", "14.1"] },
    { "id": 10, "tasks": ["11.3", "12.1", "14.2"] },
    { "id": 11, "tasks": ["12.2", "15.1", "15.2", "15.3"] },
    { "id": 12, "tasks": ["15.4", "16.1"] },
    { "id": 13, "tasks": ["17.1"] }
  ]
}
```
