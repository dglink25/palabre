/// Push notifications module for the Palabre Flutter SDK.
library;

import '../palabre_sdk.dart';

/// Handles push notifications via the Palabre FCM infrastructure.
///
/// Obtain an instance from [PalabreSDK.push].
///
/// ```dart
/// sdk.push.onNotification = (n) => print('Notification: ${n['title']}');
/// await sdk.push.register(fcmToken: '<your-fcm-token>');
/// ```
class PushModule {
  /// The SDK instance used to make authenticated HTTP requests.
  ///
  /// Set by [PalabreSDK] immediately after instantiation to avoid circular
  /// imports (since [PalabreSDK] imports this module).
  late PalabreSDK sdk;

  /// Callback invoked when a push notification is received.
  ///
  /// The [Map] passed to the callback contains at least:
  /// - `title`   - notification title
  /// - `body`    - notification body text
  /// - `data`    - optional key/value payload map
  ///
  /// ```dart
  /// sdk.push.onNotification = (n) {
  ///   showLocalNotification(title: n['title'], body: n['body']);
  /// };
  /// ```
  void Function(Map<String, dynamic> notification)? onNotification;

  /// Registers [fcmToken] with the Palabre gateway so the project can send
  /// push notifications to this device.
  ///
  /// Sends `POST /proxy/push` with `action: 'register'` and the provided
  /// [fcmToken].
  ///
  /// Throws a [PalabreException] if the request fails.
  ///
  /// ```dart
  /// final token = await FirebaseMessaging.instance.getToken();
  /// await sdk.push.register(fcmToken: token!);
  /// ```
  Future<void> register({required String fcmToken}) async {
    await sdk.request(
      'POST',
      '/proxy/push',
      body: {
        'action': 'register',
        'fcmToken': fcmToken,
      },
    );
  }

  /// Unregisters [fcmToken] from the Palabre gateway.
  ///
  /// After this call the device will no longer receive push notifications
  /// from this project.
  ///
  /// Sends `POST /proxy/push` with `action: 'unregister'` and the provided
  /// [fcmToken].
  ///
  /// Throws a [PalabreException] if the request fails.
  ///
  /// ```dart
  /// await sdk.push.unregister(fcmToken: token);
  /// ```
  Future<void> unregister({required String fcmToken}) async {
    await sdk.request(
      'POST',
      '/proxy/push',
      body: {
        'action': 'unregister',
        'fcmToken': fcmToken,
      },
    );
  }

  /// Triggers the [onNotification] callback with [notification].
  ///
  /// Used internally to surface incoming push notifications delivered via
  /// Firebase or other push channels.
  void handleIncomingNotification(Map<String, dynamic> notification) {
    onNotification?.call(notification);
  }
}
