/// Palabre Flutter SDK
///
/// A Flutter package for integrating Palabre communication features
/// (messaging, calls, video conferencing, push notifications) into
/// mobile applications.
///
/// ## Quick start
///
/// ```dart
/// import 'package:palabre_flutter/palabre_flutter.dart';
///
/// final sdk = await PalabreSDK.init(publishableKey: 'pk_live_...');
/// await sdk.chat.send(userId: 'user_123', message: 'Hello!');
/// ```
library palabre_flutter;

export 'src/palabre_sdk.dart';
