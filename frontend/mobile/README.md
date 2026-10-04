# Palabre Mobile — Flutter

Application Flutter multiplateforme (Android + iOS). Communication chiffrée E2E pour les membres d'une organisation.

---

## Prérequis

| Outil | Version min. |
|-------|-------------|
| Flutter | 3.22+ |
| Dart | 3.3+ |
| Android Studio | Hedgehog+ |
| Xcode | 15+ (iOS uniquement, Mac) |
| JDK | 17 |

```bash
flutter doctor
```

---

## Démarrage rapide

```bash
cd frontend/mobile

# 1. Dépendances
flutter pub get

# 2. Générer les fichiers Drift (base de données SQLite locale)
dart run build_runner build --delete-conflicting-outputs
```

### Émulateur Android (développement)

```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:4001/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=ws://10.0.2.2:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=ws://10.0.2.2:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=http://10.0.2.2:4030
```

> `10.0.2.2` = `localhost` vu depuis l'émulateur Android.

### Simulateur iOS

```bash
flutter run -d iPhone \
  --dart-define=API_BASE_URL=http://localhost:4001/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=ws://localhost:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=ws://localhost:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=http://localhost:4030
```

### Appareil physique (même réseau WiFi)

```bash
flutter run \
  --dart-define=API_BASE_URL=http://192.168.1.X:4001/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=ws://192.168.1.X:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=ws://192.168.1.X:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=http://192.168.1.X:4030
```

---

## Configuration manuelle obligatoire

### 1. Firebase (notifications push + authentification)

**Android :**

1. Console Firebase → Votre projet → Ajouter une application → **Android**
2. Nom du package : `com.palabre.app`
3. Téléchargez `google-services.json`
4. **Placez-le dans** : `frontend/mobile/android/app/google-services.json`

**iOS :**

1. Console Firebase → Votre projet → Ajouter une application → **iOS**
2. Bundle ID : `com.palabre.app`
3. Téléchargez `GoogleService-Info.plist`
4. **Placez-le dans** : `frontend/mobile/ios/Runner/GoogleService-Info.plist`
5. Dans Xcode → Runner → Build Phases → Copy Bundle Resources → vérifiez que le fichier est présent

**Notifications iOS (APNs) — obligatoire pour iOS :**

6. Apple Developer Portal → Certificates, Identifiers & Profiles → Keys → **+**
7. Cochez **Apple Push Notifications service (APNs)** → créez la clé
8. Téléchargez le fichier `.p8`
9. Console Firebase → Paramètres du projet → Cloud Messaging → **APNs Authentication Key**
10. Importez le fichier `.p8` + renseignez le Key ID et Team ID

> Sans cette étape, les notifications push ne fonctionnent pas sur iOS.

**Mettre à jour firebase_options.dart :**

```bash
dart pub global activate flutterfire_cli
flutterfire configure
# ou éditez manuellement lib/firebase_options.dart
```

---

### 2. Sonneries d'appel

L'app utilise deux fichiers audio locaux pour les sonneries :

**Sonnerie appel entrant :**  
Fichier attendu : `frontend/mobile/assets/audio/ringtone.mp3`  
Format : MP3, 5–15 secondes, boucle propre.

**Son appel rejeté / raccroché :**  
Fichier attendu : `frontend/mobile/assets/audio/call_end.mp3`

Téléchargements libres :
- https://mixkit.co/free-sound-effects/ring/
- https://freesound.org

Déclarez les assets dans `pubspec.yaml` si ce n'est pas encore fait :
```yaml
flutter:
  assets:
    - assets/audio/
```

---

### 3. Clés E2E Signal — aucune configuration manuelle

Les clés E2E sont générées **automatiquement** au premier login :
- Clé d'identité ECDH P-256 → stockée dans Keystore (Android) / Keychain (iOS)
- 100 one-time prekeys + 1 signed prekey → clés publiques uploadées vers le backend
- Sessions ECDH → dérivées localement, jamais transmises

Vérifiez que le backend a bien exécuté la migration `013_e2e_key_infrastructure.sql` (`./palabre.sh migrate`).

---

## Build de production

### APK Android

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api/v1 \
  --dart-define=MESSAGE_ROUTER_URL=wss://votre-domaine.com:4020/socket/websocket \
  --dart-define=CALL_SIGNAL_URL=wss://votre-domaine.com:4040/signal/websocket \
  --dart-define=FILE_SERVER_URL=https://files.votre-domaine.com
```

Sortie : `build/app/outputs/flutter-apk/app-release.apk`

### App Bundle (Play Store)

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api/v1 \
  # mêmes --dart-define
```

### iOS (App Store)

```bash
flutter build ios --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api/v1 \
  # mêmes --dart-define
# Puis archiver via Xcode → Product → Archive
```

---

## Architecture

```
lib/
├── main.dart
├── firebase_options.dart          ← à configurer (voir ci-dessus)
└── core/
    ├── config/app_config.dart     URLs injectées par --dart-define
    ├── crypto/
    │   ├── e2e_crypto.dart        AES-256-GCM médias + génération clés Signal
    │   └── signal_key_manager.dart  ECDH + HKDF + AES-GCM + upload prékeys
    ├── network/
    │   ├── api_client.dart        HTTP Dio + refresh JWT automatique
    │   └── network_detector.dart  Basculement LAN direct / relais central
    ├── services/
    │   ├── socket_service.dart    WebSocket Phoenix permanent
    │   └── notification_service.dart  FCM + APNs
    ├── storage/
    │   ├── secure_storage.dart    Keystore/Keychain (tokens, clés Signal)
    │   └── local_database.dart    SQLite Drift (messages hors-ligne)
    └── providers/auth_provider.dart  Riverpod (init clés E2E au login)
```

---

## Chiffrement E2E

| Couche | Algorithme | Stockage clés |
|--------|------------|---------------|
| Messages | ECDH P-256 + HKDF + AES-256-GCM | Keystore/Keychain |
| Médias | AES-256-GCM (clé aléatoire par fichier) | Mémoire + message |
| Appels WebRTC | DTLS-SRTP (natif WebRTC) | Ephémère |
| Clés privées | flutter_secure_storage | Keystore Android / Keychain iOS |

**Flux d'initialisation (automatique au login) :**

1. L'app génère une clé d'identité ECDH P-256 (stockée en Keystore/Keychain)
2. Génère 100 one-time prekeys + 1 signed prekey
3. Uploade **uniquement les clés publiques** vers `POST /api/v1/messaging/signal/prekeys`
4. Pour chaque conversation, dérive un secret ECDH avec la clé publique du pair
5. Les messages sont chiffrés AES-256-GCM avant envoi

**Fallback transparent :** si le pair n'a pas encore uploadé ses clés, le message passe en clair sans erreur — l'app ne crashe pas.

---

## WebSocket — connexion permanente

- Heartbeat toutes les 30 secondes
- Reconnexion automatique : 1s → 2s → 5s → 10s → 30s (backoff exponentiel)
- Messages livrés dès reconnexion
- FCM uniquement si l'app est fermée ou en arrière-plan

---

## Liaison organisation — premier lancement

### Admin d'organisation

1. App → "Lier mon organisation" → scanner le QR code du dashboard web
2. La liaison s'établit automatiquement

### Membre standard

1. App → "Rejoindre mon organisation"
2. Scanner le QR d'invitation, ou saisir identifiant org + code
3. Confirmé → accès complet aux communications
