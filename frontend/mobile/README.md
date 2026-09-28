# Palabre Mobile

Application Flutter multiplateforme (Android + iOS) pour la communication souveraine d'organisations.

## Prérequis

- Flutter 3.22+ (`flutter --version`)
- Dart 3.3+
- Android Studio / Xcode selon la cible
- JDK 17 (Android)
- CocoaPods (iOS) : `sudo gem install cocoapods`

## Démarrage rapide

```bash
# Installer les dépendances
flutter pub get

# Générer les fichiers Drift (base de données locale)
dart run build_runner build --delete-conflicting-outputs

# Lancer sur émulateur Android (développement)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4001/api/v1 \
            --dart-define=MESSAGE_ROUTER_URL=ws://10.0.2.2:4020/socket/websocket \
            --dart-define=CALL_SIGNAL_URL=ws://10.0.2.2:4040/signal/websocket \
            --dart-define=FILE_SERVER_URL=http://10.0.2.2:4030

# Lancer sur simulateur iOS
flutter run -d iPhone --dart-define=API_BASE_URL=http://localhost:4001/api/v1 \
                       --dart-define=MESSAGE_ROUTER_URL=ws://localhost:4020/socket/websocket \
                       --dart-define=CALL_SIGNAL_URL=ws://localhost:4040/signal/websocket \
                       --dart-define=FILE_SERVER_URL=http://localhost:4030
```

## Build APK de production (personnalisé par organisation)

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.palabre.app/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=wss://ws.palabre.app/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=wss://calls.palabre.app/signal/websocket \
  --dart-define=FILE_SERVER_URL=https://files.palabre.app \
  --dart-define=ORG_ID=uuid-de-lorganisation \
  --dart-define=ORG_NAME="Nom Organisation"
```

L'APK généré est préconfiguré pour l'organisation — aucune configuration supplémentaire requise pour les utilisateurs.

## Firebase

1. Créer un projet Firebase sur https://console.firebase.google.com
2. Ajouter les apps Android et iOS
3. Télécharger `google-services.json` → `android/app/`
4. Télécharger `GoogleService-Info.plist` → `ios/Runner/`
5. Mettre à jour `lib/firebase_options.dart` avec vos valeurs

## Architecture

```
lib/
├── main.dart                    # Point d'entrée
├── firebase_options.dart        # Config Firebase
└── core/
│   ├── config/app_config.dart   # URLs (injectées au build)
│   ├── theme/app_theme.dart     # Charte graphique Palabre
│   ├── router/                  # Navigation GoRouter
│   ├── services/
│   │   ├── socket_service.dart  # WebSocket Phoenix (connexion permanente)
│   │   └── notification_service.dart  # FCM + notifications locales
│   ├── storage/
│   │   ├── secure_storage.dart  # Keystore/Keychain (tokens, clés Signal)
│   │   └── local_database.dart  # SQLite via Drift (messages, contacts)
│   ├── crypto/e2e_crypto.dart   # AES-256 médias + Signal Protocol
│   ├── network/api_client.dart  # HTTP Dio + refresh JWT auto
│   └── providers/auth_provider.dart
└── features/
    ├── auth/         # Login OTP, activation organisation, QR scan
    ├── conversations/# Liste conversations + chat E2E + accusés
    ├── calls/        # Historique + écran appel WebRTC (audio/vidéo)
    ├── contacts/     # Annuaire organisation + présence temps réel
    ├── profile/      # Profil utilisateur
    └── settings/     # Paramètres app
```

## Chiffrement E2E

- **Messages** : Signal Protocol (Double Ratchet + X3DH) — `libsignal_protocol_dart`
- **Médias** : AES-256-CBC côté client — le serveur stocke uniquement le blob chiffré
- **Clés** : stockées dans Keystore Android / Keychain iOS via `flutter_secure_storage`
- **Transport** : DTLS-SRTP natif WebRTC pour les appels

## Connexion permanente

Le WebSocket Phoenix reste connecté tant que l'OS le permet :
- Heartbeat automatique toutes les 30 secondes
- Reconnexion avec backoff exponentiel : 1s → 2s → 5s → 10s → 30s
- Messages en attente livrés dès la reconnexion (file Redis côté serveur)
- Notifications FCM/APNs uniquement si l'app est fermée
