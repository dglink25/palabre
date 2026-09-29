# Palabre Mobile

Application Flutter multiplateforme (Android + iOS). Communication sécurisée E2E pour les membres d'une organisation.

L'app est **universelle** — un seul APK/IPA pour tous. L'utilisateur lie son organisation au premier lancement (QR code ou identifiant + code d'invitation).

## Prérequis

| Outil | Version | Vérification |
|-------|---------|--------------|
| Flutter | 3.22+ | `flutter --version` |
| Dart | 3.3+ | inclus dans Flutter |
| Android Studio | Hedgehog+ | pour Android |
| Xcode | 15+ | pour iOS (Mac uniquement) |
| JDK | 17 | pour Android |
| CocoaPods | quelconque | iOS : `sudo gem install cocoapods` |

Vérification de l'environnement :
```bash
flutter doctor
```

## Démarrage rapide

```bash
cd frontend/mobile

# 1. Installer les dépendances
flutter pub get

# 2. Générer les fichiers Drift (base de données locale SQLite)
dart run build_runner build --delete-conflicting-outputs
```

### Lancer sur émulateur Android

```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:4001/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=ws://10.0.2.2:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=ws://10.0.2.2:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=http://10.0.2.2:4030
```

> `10.0.2.2` est l'adresse de la machine hôte vue depuis l'émulateur Android (équivalent de `localhost`).

### Lancer sur simulateur iOS

```bash
flutter run -d iPhone \
  --dart-define=API_BASE_URL=http://localhost:4001/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=ws://localhost:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=ws://localhost:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=http://localhost:4030
```

### Lancer sur appareil physique Android (même réseau WiFi)

```bash
# Remplacez 192.168.1.x par l'IP de votre machine sur le réseau local
flutter run \
  --dart-define=API_BASE_URL=http://192.168.1.x:4001/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=ws://192.168.1.x:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=ws://192.168.1.x:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=http://192.168.1.x:4030
```

## Configuration manuelle requise — Firebase

**Action manuelle obligatoire** avant le premier build.

### Android

1. Allez sur https://console.firebase.google.com
2. Sélectionnez votre projet → Ajouter une application → Android
3. Nom du package : `com.palabre.app` (ou votre package configuré dans `android/app/build.gradle`)
4. Téléchargez `google-services.json`
5. **Placez-le dans** `android/app/google-services.json`

### iOS

1. Même projet Firebase → Ajouter une application → iOS
2. Bundle ID : `com.palabre.app` (ou votre bundle dans Xcode)
3. Téléchargez `GoogleService-Info.plist`
4. **Placez-le dans** `ios/Runner/GoogleService-Info.plist`
5. Dans Xcode, vérifiez que le fichier est bien inclus dans la cible `Runner`

### Mettre à jour firebase_options.dart

```bash
# Si vous avez flutterfire_cli installé
dart pub global activate flutterfire_cli
flutterfire configure

# Sinon, éditez manuellement lib/firebase_options.dart
# avec les valeurs de la console Firebase (Paramètres → Vos applications)
```

## Build de production

### APK Android universel

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=wss://votre-domaine.com:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=wss://votre-domaine.com:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=https://files.votre-domaine.com
```

L'APK se trouve dans `build/app/outputs/flutter-apk/app-release.apk`.

### App Bundle Android (Play Store)

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api/v1 \
  # ... mêmes --dart-define que ci-dessus
```

### iOS (App Store / TestFlight)

```bash
flutter build ios --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api/v1 \
  # ... mêmes --dart-define
# Puis archiver depuis Xcode → Product → Archive
```

## Architecture

```
lib/
├── main.dart                         Point d'entrée
├── firebase_options.dart             Config Firebase (à configurer — voir ci-dessus)
└── core/
│   ├── config/app_config.dart        URLs injectées au build via --dart-define
│   ├── theme/app_theme.dart          Charte graphique (couleurs Palabre)
│   ├── router/                       Navigation GoRouter (5 onglets)
│   ├── services/
│   │   ├── socket_service.dart       WebSocket Phoenix (connexion permanente)
│   │   └── notification_service.dart FCM (Android) + APNs (iOS)
│   ├── storage/
│   │   ├── secure_storage.dart       Keystore/Keychain (tokens JWT, clés Signal)
│   │   └── local_database.dart       SQLite via Drift (messages hors-ligne)
│   ├── crypto/e2e_crypto.dart        AES-256-GCM médias + Signal Protocol
│   ├── network/api_client.dart       HTTP Dio + refresh JWT automatique
│   └── providers/auth_provider.dart  State management Riverpod
└── features/
    ├── auth/                         Connexion OTP, activation, scan QR org
    ├── org/                          Liaison organisation (admin + membre)
    ├── conversations/                Liste + chat E2E + accusés de réception
    ├── calls/                        Historique + appel audio/vidéo WebRTC
    ├── contacts/                     Annuaire org + présence temps réel
    ├── profile/                      Profil utilisateur
    └── settings/                     Paramètres application
```

## Navigation — 5 onglets

| Onglet | Route | Description |
|--------|-------|-------------|
| Accueil | `/` | Dashboard selon le rôle |
| Discussions | `/conversations` | Conversations E2E |
| + | `/conversations/new` | Nouvelle conversation |
| Appels | `/calls` | Historique + appel WebRTC |
| Profil | `/profile` | Profil et paramètres |

## Chiffrement E2E

| Couche | Algorithme | Bibliothèque |
|--------|------------|--------------|
| Messages | Signal Protocol (Double Ratchet + X3DH) | `libsignal_protocol_dart` |
| Médias | AES-256-GCM (chiffrement client avant upload) | `pointycastle` |
| Clés locales | Keystore Android / Keychain iOS | `flutter_secure_storage` |
| Appels | DTLS-SRTP (natif WebRTC) | WebRTC natif |

## Connexion WebSocket permanente

- Heartbeat automatique toutes les 30 secondes
- Reconnexion avec backoff exponentiel : 1s → 2s → 5s → 10s → 30s (max)
- Messages en attente livrés automatiquement à la reconnexion
- Notifications FCM/APNs uniquement quand l'app est fermée ou en arrière-plan

## Liaison organisation — premier lancement

### Pour un administrateur d'organisation

1. Ouvrir l'app → "Lier mon organisation"
2. Scanner le QR code affiché sur le dashboard web de l'organisation
3. La liaison s'établit automatiquement

### Pour un membre standard

1. Ouvrir l'app → "Rejoindre mon organisation"
2. Soit scanner le QR code d'invitation fourni par l'admin
3. Soit saisir l'identifiant org + code d'invitation
4. Confirmé → accès aux communications

## Notifications push — configuration

### Android (FCM)

Le fichier `google-services.json` suffit. Firebase Messaging est configuré automatiquement.

### iOS (APNs)

**Action manuelle requise** :

1. Apple Developer Portal → Certificates, Identifiers & Profiles
2. Créez un certificat APNs pour votre App ID
3. Dans la console Firebase → Paramètres du projet → Cloud Messaging
4. Importez le certificat `.p8` ou `.p12` APNs

Sans cette configuration, les notifications ne fonctionnent pas sur iOS.
