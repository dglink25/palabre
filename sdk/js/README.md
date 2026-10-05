# palabre-sdk

SDK JavaScript/TypeScript officiel pour intégrer les fonctionnalités de communication Palabre (messagerie E2E, appels WebRTC, vidéoconférence, notifications push) dans vos applications.

---

## Table des matières

- [Installation](#installation)
- [Démarrage rapide](#démarrage-rapide)
- [Intégration React](#intégration-react)
- [Intégration Node.js](#intégration-nodejs)
- [Référence API](#référence-api)
- [Vérification de webhook](#vérification-de-webhook)

---

## Installation

```bash
npm install palabre-sdk
```

Ou avec Yarn :

```bash
yarn add palabre-sdk
```

Ou avec pnpm :

```bash
pnpm add palabre-sdk
```

> **Prérequis :** Node.js ≥ 16 ou tout navigateur moderne.  
> Obtenez votre **Publishable Key** (`pk_live_…`) depuis le [Developer Portal](https://developer.palabre.app).

---

## Démarrage rapide

```typescript
import { PalabreSDK } from 'palabre-sdk';

async function main() {
  // 1. Initialiser le SDK avec votre Publishable Key
  const palabre = await PalabreSDK.init('pk_live_VOTRE_CLE_ICI');

  // 2. Écouter les événements entrants
  palabre.on('message', (msg) => {
    console.log('Nouveau message reçu :', msg);
  });

  palabre.on('call', (callInfo) => {
    console.log('Appel entrant :', callInfo);
  });

  palabre.on('notification', (notif) => {
    console.log('Notification :', notif);
  });

  // 3. Envoyer un message
  await palabre.chat.send('user_id_destinataire', 'Bonjour depuis palabre-sdk !');

  // 4. Initier un appel audio/vidéo
  const callSession = await palabre.call.start('user_id_destinataire');
  console.log('Appel initié :', callSession);

  // 5. Rejoindre une vidéoconférence
  const videoSession = await palabre.video.join('room_id_123');
  console.log('Token Jitsi :', videoSession);
}

main().catch(console.error);
```

### Gestion des erreurs

Si la clé fournie est invalide ou expirée, le SDK rejette la promesse avec un `PalabreError` dont le code est `INVALID_KEY` :

```typescript
import { PalabreSDK, PalabreError } from 'palabre-sdk';

try {
  const palabre = await PalabreSDK.init('pk_live_cle_invalide');
} catch (err) {
  if (err instanceof PalabreError && err.code === 'INVALID_KEY') {
    console.error('Clé publishable invalide ou expirée.');
  }
}
```

---

## Intégration React

### Hook `usePalabre`

Créez ce hook personnalisé pour partager l'instance SDK dans toute votre application :

```tsx
// hooks/usePalabre.ts
import { useState, useEffect, useCallback } from 'react';
import { PalabreSDK, PalabreError } from 'palabre-sdk';

interface UsePalabreResult {
  sdk: PalabreSDK | null;
  loading: boolean;
  error: PalabreError | null;
}

export function usePalabre(publishableKey: string): UsePalabreResult {
  const [sdk, setSdk] = useState<PalabreSDK | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PalabreError | null>(null);

  useEffect(() => {
    let cancelled = false;

    PalabreSDK.init(publishableKey)
      .then((instance) => {
        if (!cancelled) setSdk(instance);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof PalabreError ? err : new PalabreError(String(err), 'INIT_FAILED'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publishableKey]);

  return { sdk, loading, error };
}
```

### Utilisation dans un composant

```tsx
// components/Chat.tsx
import React, { useState, useEffect } from 'react';
import { usePalabre } from '../hooks/usePalabre';

export function Chat() {
  const { sdk, loading, error } = usePalabre(import.meta.env.VITE_PALABRE_KEY);
  const [messages, setMessages] = useState<unknown[]>([]);

  useEffect(() => {
    if (!sdk) return;

    sdk.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
  }, [sdk]);

  const handleSend = async () => {
    if (!sdk) return;
    await sdk.chat.send('user_id_destinataire', 'Bonjour !');
  };

  if (loading) return <p>Connexion en cours…</p>;
  if (error) return <p>Erreur : {error.message}</p>;

  return (
    <div>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{JSON.stringify(msg)}</li>
        ))}
      </ul>
      <button onClick={handleSend}>Envoyer un message</button>
    </div>
  );
}
```

### Variables d'environnement Vite

Ajoutez dans votre `.env` :

```env
VITE_PALABRE_KEY=pk_live_VOTRE_CLE_ICI
```

---

## Intégration Node.js

Le SDK fonctionne aussi côté serveur pour des opérations déclenchées en backend (envoi de notifications, orchestration d'appels, etc.).

```typescript
// server.ts
import { PalabreSDK, verifyWebhookSignature } from 'palabre-sdk';
import express from 'express';

const app = express();
app.use(express.json());

let palabreSDK: PalabreSDK;

async function bootstrap() {
  // Initialiser le SDK avec la Publishable Key
  palabreSDK = await PalabreSDK.init(process.env.PALABRE_PUBLISHABLE_KEY!);

  // Écouter les événements SDK
  palabreSDK.on('message', (msg) => {
    console.log('[Palabre] Message reçu :', msg);
  });

  app.listen(3000, () => {
    console.log('Serveur démarré sur le port 3000');
  });
}

// Envoyer un message depuis une route Express
app.post('/notify-user', async (req, res) => {
  const { userId, text } = req.body;

  try {
    const result = await palabreSDK.chat.send(userId, text);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Enregistrer un token push depuis une route Express
app.post('/register-push', async (req, res) => {
  const { fcmToken } = req.body;

  try {
    await palabreSDK.push.register(fcmToken);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

bootstrap().catch(console.error);
```

> **Note :** La Publishable Key est sûre à utiliser côté serveur. Pour des opérations administratives (rotation de clés, lecture des statistiques), utilisez la Secret Key (`sk_live_…`) directement via l'API REST.

---

## Référence API

### `PalabreSDK`

| Méthode / Propriété | Signature | Description |
|---|---|---|
| `PalabreSDK.init` | `static init(publishableKey: string, options?: PalabreSDKOptions): Promise<PalabreSDK>` | Initialise le SDK. Valide la clé, récupère la config white-label et retourne une instance prête. Lève `PalabreError { code: 'INVALID_KEY' }` si la clé est invalide. |
| `palabre.on` | `on(event: 'message' \| 'call' \| 'notification', handler: (data: unknown) => void): void` | Enregistre un listener pour un événement entrant. Peut être appelé plusieurs fois pour le même événement. |
| `palabre.publishableKey` | `get publishableKey(): string` | Retourne la Publishable Key utilisée pour cette instance (lecture seule). |
| `palabre.baseUrl` | `get baseUrl(): string` | Retourne l'URL de base de l'API Gateway (lecture seule). |
| `palabre.whiteLabelConfig` | `get whiteLabelConfig(): WhiteLabelConfig` | Retourne la configuration white-label du projet (logo, couleurs, nom). |

### `palabre.chat` - ChatModule

| Méthode | Signature | Description |
|---|---|---|
| `chat.send` | `send(userId: string, message: string): Promise<unknown>` | Chiffre et envoie un message à l'utilisateur identifié par `userId` via l'infrastructure E2E de Palabre. Émet aussi un événement `'message'` sur le SDK. |

### `palabre.call` - CallModule

| Méthode | Signature | Description |
|---|---|---|
| `call.start` | `start(userId: string): Promise<unknown>` | Initie un appel WebRTC vers `userId`. Retourne les credentials TURN et les informations de signalisation. |
| `call.accept` | `accept(callId: string): Promise<unknown>` | Accepte un appel entrant identifié par `callId`. |
| `call.reject` | `reject(callId: string): Promise<unknown>` | Rejette un appel entrant identifié par `callId`. |
| `call.end` | `end(callId: string): Promise<unknown>` | Termine un appel en cours identifié par `callId`. |

### `palabre.video` - VideoModule

| Méthode | Signature | Description |
|---|---|---|
| `video.join` | `join(roomId: string): Promise<unknown>` | Rejoint une room de vidéoconférence Jitsi. Retourne le token de session et les informations de la room. |

### `palabre.push` - PushModule

| Méthode | Signature | Description |
|---|---|---|
| `push.register` | `register(fcmToken: string): Promise<unknown>` | Enregistre un token FCM auprès de l'infrastructure Firebase de Palabre pour recevoir des notifications push. |
| `push.unregister` | `unregister(fcmToken: string): Promise<unknown>` | Désenregistre un token FCM pour arrêter la réception des notifications push. |

### `verifyWebhookSignature`

| Fonction | Signature | Description |
|---|---|---|
| `verifyWebhookSignature` | `verifyWebhookSignature(body: string, signature: string, secretKey: string): boolean` | Vérifie la signature HMAC-SHA256 d'un payload webhook. Retourne `true` si la signature est valide. |

### Types

```typescript
/** Options d'initialisation du SDK */
interface PalabreSDKOptions {
  /** URL de l'API Gateway pour les déploiements custom ou les tests */
  baseUrl?: string;
}

/** Configuration white-label d'un projet */
interface WhiteLabelConfig {
  logoUrl?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  displayName?: string;
}

/** Erreur levée par le SDK */
class PalabreError extends Error {
  code: string;    // ex. 'INVALID_KEY', 'REQUEST_FAILED', 'CONFIG_FETCH_FAILED'
  status?: number; // code HTTP associé si applicable
}
```

---

## Vérification de webhook

Cuando Palabre envoie un événement à votre endpoint, il inclut un en-tête `X-Palabre-Signature` avec une signature HMAC-SHA256. Vérifiez toujours cette signature avant de traiter l'événement.

### Format de la signature

```
X-Palabre-Signature: sha256=<hmac_hex>
```

### Exemple Express

```typescript
import express from 'express';
import { verifyWebhookSignature } from 'palabre-sdk';

const app = express();

// IMPORTANT : utiliser express.raw() pour conserver le corps brut
app.post('/webhook/palabre', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signature = req.headers['x-palabre-signature'] as string;
  const secretKey = process.env.PALABRE_SECRET_KEY!;

  if (!verifyWebhookSignature(rawBody, signature, secretKey)) {
    console.warn('Signature webhook invalide - requête rejetée.');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody);
  console.log('Événement reçu :', event.type, event);

  // Traiter l'événement selon son type
  switch (event.type) {
    case 'message.received':
      // traiter le message entrant
      break;
    case 'call.started':
      // traiter le début d'un appel
      break;
    case 'call.ended':
      // traiter la fin d'un appel
      break;
    case 'call.missed':
      // traiter un appel manqué
      break;
    case 'user.online':
    case 'user.offline':
      // mettre à jour le statut de présence
      break;
    default:
      console.log('Type d\'événement non géré :', event.type);
  }

  res.sendStatus(200);
});
```

### Événements disponibles

| Type d'événement | Description |
|---|---|
| `message.received` | Un message a été reçu par un utilisateur de votre projet |
| `call.started` | Un appel a démarré |
| `call.ended` | Un appel s'est terminé |
| `call.missed` | Un appel n'a pas été décroché |
| `user.online` | Un utilisateur est passé en ligne |
| `user.offline` | Un utilisateur est passé hors ligne |
| `notification.sent` | Une notification push a été envoyée |

> **Sécurité :** Ne traitez jamais un événement webhook sans avoir vérifié sa signature. Utilisez toujours le corps **brut** (non parsé) de la requête pour la vérification - parser le JSON puis le re-sérialiser peut modifier l'ordre des clés et invalider la signature.

---

## Licence

MIT - voir [LICENSE](../../LICENSE).
