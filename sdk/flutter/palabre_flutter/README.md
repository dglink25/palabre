# palabre_flutter

SDK Flutter officiel pour intégrer les fonctionnalités de communication Palabre (messagerie, appels audio/vidéo, vidéoconférence, notifications push) dans vos applications Android et iOS.

---

## Table des matières

- [Installation](#installation)
- [Démarrage rapide](#démarrage-rapide)
- [Gestion hors-ligne](#gestion-hors-ligne)
- [Référence API](#référence-api)
- [Vérification de webhook](#vérification-de-webhook)

---

## Installation

```yaml
# pubspec.yaml
dependencies:
  palabre_flutter: ^0.1.0
```

```bash
flutter pub add palabre_flutter
```

> **Prérequis :** Flutter ≥ 3.10, Dart ≥ 3.0.  
> Obtenez votre **Publishable Key** (`pk_live_…`) depuis le [Developer Portal](https://developer.palabre.app).

---

## Démarrage rapide

```dart
import 'package:palabre_flutter/palabre_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialiser le SDK avec votre Publishable Key
  final sdk = await PalabreSDK.init(
    publishableKey: 'pk_live_VOTRE_CLE_ICI',
  );

  // 2. Enregistrer un token FCM pour les notifications push
  final fcmToken = await FirebaseMessaging.instance.getToken();
  if (fcmToken != null) {
    await sdk.push.register(fcmToken: fcmToken);
  }

  // 3. Écouter les notifications push entrantes
  sdk.push.onNotification = (notification) {
    debugPrint('Notification reçue : ${notification['title']}');
  };

  // 4. Envoyer un message
  await sdk.chat.send(
    userId: 'user_id_destinataire',
    message: 'Bonjour depuis palabre_flutter !',
  );

  // 5. Écouter les messages entrants
  sdk.chat.onMessage = (msg) {
    debugPrint('Message de ${msg['senderId']} : ${msg['content']}');
  };

  runApp(const MyApp());
}
```

### Gestion des erreurs

```dart
try {
  final sdk = await PalabreSDK.init(publishableKey: 'pk_live_cle_invalide');
} on PalabreException catch (e) {
  if (e.code == 'INVALID_KEY') {
    debugPrint('Clé publishable invalide ou expirée : ${e.message}');
  }
}
```

### Exemple de widget complet

```dart
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  PalabreSDK? _sdk;
  bool _ready = false;
  final List<String> _messages = [];

  @override
  void initState() {
    super.initState();
    _initSdk();
  }

  Future<void> _initSdk() async {
    try {
      final sdk = await PalabreSDK.init(
        publishableKey: 'pk_live_VOTRE_CLE_ICI',
      );
      sdk.chat.onMessage = (msg) {
        setState(() => _messages.add(msg['content'] as String? ?? ''));
      };
      setState(() {
        _sdk = sdk;
        _ready = true;
      });
    } on PalabreException catch (e) {
      debugPrint('Erreur SDK : ${e.message}');
    }
  }

  Future<void> _sendMessage(String text) async {
    await _sdk?.chat.send(userId: 'user_456', message: text);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              itemCount: _messages.length,
              itemBuilder: (_, i) => ListTile(title: Text(_messages[i])),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: ElevatedButton(
              onPressed: _ready ? () => _sendMessage('Bonjour !') : null,
              child: const Text('Envoyer'),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## Gestion hors-ligne

Le module `chat` gère automatiquement les situations sans connexion réseau.

**Comportement :**

- Quand un message ne peut pas être envoyé à cause d'une erreur réseau, il est ajouté à une **queue persistante** (stockée dans `shared_preferences` sous la clé `palabre_message_queue`).
- Un timer de fond vérifie toutes les **5 secondes** si la connexion est rétablie.
- Au rétablissement, les messages sont envoyés automatiquement dans l'ordre FIFO.
- Chaque message envoyé avec succès est supprimé de la queue immédiatement.

```dart
// Vérifier si des messages sont en attente
if (sdk.chat.hasQueuedMessages) {
  final pending = sdk.chat.pendingMessages;
  debugPrint('${pending.length} message(s) en attente d\'envoi');
}

// Libérer les ressources à la fermeture de l'app
await sdk.chat.dispose();
```

**Format d'un message en queue :**

```json
{
  "userId": "user_id_destinataire",
  "message": "Contenu du message",
  "queuedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## Référence API

### `PalabreSDK`

| Méthode / Propriété | Signature | Description |
|---|---|---|
| `PalabreSDK.init` | `static Future<PalabreSDK> init({required String publishableKey, String baseUrl})` | Initialise le SDK. Valide la clé, récupère la config white-label, initialise les modules. Lève `PalabreException { code: 'INVALID_KEY' }` si la clé est invalide. |
| `sdk.request` | `Future<dynamic> request(String method, String path, {Map<String, dynamic>? body})` | Wrapper HTTP authentifié. Injecte `X-Palabre-Key`. |
| `sdk.verifyWebhookSignature` | `bool verifyWebhookSignature({required String body, required String signature, required String secretKey})` | Vérifie la signature HMAC-SHA256 d'un webhook. |
| `sdk.publishableKey` | `String` | La Publishable Key utilisée (lecture seule). |
| `sdk.whiteLabelConfig` | `WhiteLabelConfig` | Config white-label du projet. |
| `sdk.chat` | `ChatModule` | Module de messagerie. |
| `sdk.call` | `CallModule` | Module d'appels audio/vidéo. |
| `sdk.video` | `VideoModule` | Module de vidéoconférence. |
| `sdk.push` | `PushModule` | Module de notifications push. |

### `ChatModule` - `sdk.chat`

| Méthode / Propriété | Signature | Description |
|---|---|---|
| `chat.send` | `Future<Map<String, dynamic>> send({required String userId, required String message})` | Envoie un message. Si réseau indisponible, met en queue et retourne `{}`. |
| `chat.onMessage` | `void Function(Map<String, dynamic>)?` | Callback déclenché à la réception d'un message. |
| `chat.hasQueuedMessages` | `bool` | `true` s'il y a des messages en attente. |
| `chat.pendingMessages` | `List<Map<String, dynamic>>` | Vue lecture seule de la queue. |
| `chat.init` | `Future<void>` | Charge la queue persistée et démarre le timer. Appelé par `PalabreSDK.init()`. |
| `chat.dispose` | `Future<void>` | Annule le timer et persiste la queue. À appeler à la fermeture. |

### `CallModule` - `sdk.call`

| Méthode | Signature | Description |
|---|---|---|
| `call.start` | `Future<dynamic> start({required String userId})` | Initie un appel WebRTC. Retourne les credentials TURN. |
| `call.accept` | `Future<dynamic> accept({required String callId})` | Accepte un appel entrant. |
| `call.reject` | `Future<dynamic> reject({required String callId})` | Rejette un appel entrant. |
| `call.end` | `Future<dynamic> end({required String callId})` | Termine un appel en cours. |

### `VideoModule` - `sdk.video`

| Méthode | Signature | Description |
|---|---|---|
| `video.join` | `Future<String> join({required String roomId})` | Rejoint une room Jitsi. Retourne le token de session. |

### `PushModule` - `sdk.push`

| Méthode / Propriété | Signature | Description |
|---|---|---|
| `push.register` | `Future<void> register({required String fcmToken})` | Enregistre un token FCM pour recevoir des notifications. |
| `push.unregister` | `Future<void> unregister({required String fcmToken})` | Désenregistre un token FCM. |
| `push.onNotification` | `void Function(Map<String, dynamic>)?` | Callback déclenché à la réception d'une notification. |

### `verifyWebhookSignature` (fonction utilitaire)

```dart
import 'package:palabre_flutter/palabre_flutter.dart';

bool verifyWebhookSignature({
  required String body,
  required String signature,
  required String secretKey,
})
```

### Types

```dart
class PalabreException implements Exception {
  final String code;    // ex. 'INVALID_KEY', 'NETWORK_ERROR', 'API_ERROR'
  final String message;
}

class WhiteLabelConfig {
  final String? logoUrl;
  final String? colorPrimary;
  final String? colorSecondary;
  final String? displayName;
}
```

---

## Vérification de webhook

Cuando Palabre envoie un événement à votre serveur, il inclut un en-tête `X-Palabre-Signature` avec une signature HMAC-SHA256. Vérifiez-la avant de traiter l'événement.

### Exemple (serveur Dart / shelf)

```dart
import 'package:palabre_flutter/palabre_flutter.dart';

Response webhookHandler(Request request) async {
  final rawBody = await request.readAsString();
  final signature = request.headers['x-palabre-signature'] ?? '';
  const webhookSecret = 'votre_secret_webhook';

  final isValid = verifyWebhookSignature(
    body: rawBody,
    signature: signature,
    secretKey: webhookSecret,
  );

  if (!isValid) {
    return Response.forbidden('Signature invalide');
  }

  final payload = json.decode(rawBody) as Map<String, dynamic>;
  final eventType = request.headers['x-palabre-event'];

  switch (eventType) {
    case 'message.received':
      // traiter le message
      break;
    case 'call.started':
    case 'call.ended':
    case 'call.missed':
      // traiter l'appel
      break;
    case 'user.online':
    case 'user.offline':
      // mettre à jour la présence
      break;
    case 'notification.sent':
      // log de notification
      break;
  }

  return Response.ok('OK');
}
```

### Format de la signature

```
X-Palabre-Signature: sha256=<hmac_sha256_hex>
```

> **Important :** Utilisez toujours le corps **brut** (non parsé) de la requête pour la vérification - parser le JSON puis le re-sérialiser peut modifier l'ordre des clés et invalider la signature.

---

## Licence

MIT - voir [LICENSE](../../../LICENSE).
