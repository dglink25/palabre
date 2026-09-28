// Fichier généré par FlutterFire CLI.
// Remplacer les valeurs par celles de votre projet Firebase.
// Commande : flutterfire configure --project=<votre-projet-firebase>

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) throw UnsupportedError('Web non supporté dans cette app mobile.');
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Plateforme non supportée: $defaultTargetPlatform');
    }
  }

  // ── Android ───────────────────────────────────────────────────────────────
  // Remplacer par les valeurs du fichier google-services.json
  static const FirebaseOptions android = FirebaseOptions(
    apiKey:             'REPLACE_WITH_ANDROID_API_KEY',
    appId:              'REPLACE_WITH_ANDROID_APP_ID',
    messagingSenderId:  'REPLACE_WITH_SENDER_ID',
    projectId:          'REPLACE_WITH_PROJECT_ID',
    storageBucket:      'REPLACE_WITH_STORAGE_BUCKET',
  );

  // ── iOS ───────────────────────────────────────────────────────────────────
  // Remplacer par les valeurs du fichier GoogleService-Info.plist
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey:             'REPLACE_WITH_IOS_API_KEY',
    appId:              'REPLACE_WITH_IOS_APP_ID',
    messagingSenderId:  'REPLACE_WITH_SENDER_ID',
    projectId:          'REPLACE_WITH_PROJECT_ID',
    storageBucket:      'REPLACE_WITH_STORAGE_BUCKET',
    iosBundleId:        'app.palabre.mobile',
  );
}
