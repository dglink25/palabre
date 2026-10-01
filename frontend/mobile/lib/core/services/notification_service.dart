import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});

/// Gestion des notifications push FCM (Android) et APNs (iOS).
///
/// Stratégie :
/// - App en avant-plan : notification locale (flutter_local_notifications)
/// - App en arrière-plan / fermée : notification système via FCM/APNs
/// - Le payload ne contient jamais le contenu du message (E2E)
///   juste { type: "new_message", from: "...", conv_id: "..." }
class NotificationService {
  final _fcm   = FirebaseMessaging.instance;
  final _local = FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    // Permissions
    await _fcm.requestPermission(
      alert: true, badge: true, sound: true, provisional: false,
    );

    // Notifications locales (Android + iOS)
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit     = DarwinInitializationSettings(
      requestAlertPermission: false, // déjà demandé via FCM
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Créer le canal Android
    const channel = AndroidNotificationChannel(
      'palabre_messages',
      'Messages Palabre',
      description: 'Notifications de messages et appels',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // Handlers FCM
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationOpenedApp);
    FirebaseMessaging.onBackgroundMessage(_backgroundHandler);

    // Enregistrer le token FCM (envoyé au backend pour push hors-ligne)
    _fcm.onTokenRefresh.listen(_onTokenRefresh);
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final data = message.data;
    final type = data['type'] ?? 'message';

    switch (type) {
      case 'new_message':
        await _showMessageNotification(
          title:   data['sender_name'] ?? 'Nouveau message',
          body:    '1 nouveau message',   // Corps vide — contenu E2E
          convId:  data['conv_id'] ?? '',
          payload: message.data,
        );
      case 'call:incoming':
        await _showCallNotification(
          callerName: data['caller_name'] ?? 'Appel entrant',
          callId:     data['call_id']     ?? '',
          callType:   data['call_type']   ?? 'audio',
        );
        // Naviguer immédiatement vers l'écran d'appel entrant quand l'app est ouverte
        _navigateToIncomingCall(data);
    }
  }

  void _navigateToIncomingCall(Map<String, dynamic> data) {
    final callId   = data['call_id']     as String? ?? '';
    final peerName = data['caller_name'] as String? ?? 'Appel entrant';
    final callType = data['call_type']   as String? ?? 'audio';
    if (callId.isEmpty) return;

    // Utiliser le navigateur global pour naviguer hors contexte widget
    _navigatorKey?.currentContext?.go('/incoming-call/$callId', extra: {
      'peer_name': peerName,
      'call_type': callType,
    });
  }

  // Clé de navigation globale (injectée depuis main.dart si nécessaire)
  static BuildContext? Function()? _navigatorKey;

  Future<void> _showMessageNotification({
    required String title,
    required String body,
    required String convId,
    required Map<String, dynamic> payload,
  }) async {
    await _local.show(
      convId.hashCode,
      title,
      body,
      NotificationDetails(
        android: const AndroidNotificationDetails(
          'palabre_messages',
          'Messages Palabre',
          channelDescription: 'Notifications de messages',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: convId,
    );
  }

  Future<void> _showCallNotification({
    required String callerName,
    required String callId,
    required String callType,
  }) async {
    await _local.show(
      callId.hashCode,
      callType == 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant',
      callerName,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'palabre_calls',
          'Appels Palabre',
          importance: Importance.max,
          priority:   Priority.max,
          fullScreenIntent: true,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          interruptionLevel: InterruptionLevel.critical,
        ),
      ),
      payload: 'call:$callId',
    );
  }

  void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload ?? '';
    if (payload.startsWith('call:')) {
      // Naviguer vers l'écran d'appel entrant
      final callId = payload.replaceFirst('call:', '');
      _navigatorKey?.call()?.go('/incoming-call/$callId', extra: {'call_type': 'audio'});
    } else if (payload.isNotEmpty) {
      // Naviguer vers la conversation
      _navigatorKey?.call()?.go('/conversations/$payload');
    }
  }

  void _onNotificationOpenedApp(RemoteMessage message) {
    _onForegroundMessage(message);
  }

  void _onTokenRefresh(String token) {
    // Envoyer le nouveau token FCM au backend
    // (géré par le repository auth)
  }

  Future<String?> getFcmToken() => _fcm.getToken();
}

@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  // Traitement minimal en background — pas d'accès au context Flutter
  // FCM affiche la notification système automatiquement
}
