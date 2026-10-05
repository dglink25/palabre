/**
 * Service Worker Firebase Cloud Messaging - Palabre
 *
 * Ce fichier DOIT être à la racine du domaine (/firebase-messaging-sw.js)
 * pour que Firebase Messaging puisse l'enregistrer automatiquement.
 * Il reçoit les notifications push quand l'onglet est fermé ou en arrière-plan.
 *
 * Les valeurs de configuration sont injectées par le script d'initialisation
 * via postMessage ou par les variables d'environnement au build.
 */

// ── Import du SDK Firebase Messaging compat (requis dans les SW) ─────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Configuration Firebase - à synchroniser avec VITE_FIREBASE_* dans .env
// Ces valeurs sont publiques (clé d'API web publique, pas la clé de service).
const firebaseConfig = {
  apiKey:            'AIzaSyAeolDPaTkInYUuRILFXObWmXOcKu5WZj8',
  authDomain:        'palable-320b4.firebaseapp.com',
  projectId:         'palable-320b4',
  messagingSenderId: '926157935845',
  appId:             '1:926157935845:web:2bf2eeca0cd9cec990700c',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Réception des notifications en arrière-plan ───────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Message reçu en arrière-plan:', payload);

  const { title, body, icon, data } = payload.notification || {};
  const notifTitle = title || 'Palabre';
  const notifOptions = {
    body:  body  || 'Vous avez un nouveau message.',
    icon:  icon  || '/logo.png',
    badge: '/logo.png',
    data:  data  || {},
    tag:   data?.conversationId || 'palabre-notif',
    // Regrouper les notifications par conversation
    renotify: true,
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' },
    ],
  };

  self.registration.showNotification(notifTitle, notifOptions);
});

// ── Clic sur une notification ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const url  = data.url || data.conversationId
    ? `/app/conversations/${data.conversationId}`
    : '/app/conversations';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si un onglet Palabre est déjà ouvert, le mettre au premier plan
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // Sinon ouvrir un nouvel onglet
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
