# Service Message Router — Palabre

Routeur de messages temps réel. Maintient une connexion WebSocket permanente avec chaque client (web et mobile) et achemine les messages chiffrés de bout en bout sans jamais les déchiffrer.

Technologie : **Elixir/Phoenix Channels** (WebSocket) avec Phoenix PubSub pour la distribution inter-noeuds.

## Responsabilités

- Maintenir les connexions WebSocket permanentes (reconnexion automatique avec backoff)
- Router les messages E2E entre utilisateurs (le serveur ne voit que le chiffré)
- Distribuer les notifications de présence aux abonnés
- Stocker temporairement les messages hors-ligne (dans PostgreSQL) pour livraison différée
- Gérer les confirmations de livraison et de lecture

## Port

- WebSocket/HTTP : **4020**

## Configuration — variables d'environnement

### Obligatoire — Secret JWT

**Même valeur que dans `backend/.env`.**

```env
JWT_ACCESS_SECRET=<même valeur que backend>
```

> Le message-router vérifie les JWT des clients pour authentifier les connexions WebSocket. Il doit utiliser le même secret que le backend.

Pas de génération séparée — copiez la valeur depuis `backend/.env`.

### Obligatoire — Base de données et Redis

```env
DATABASE_URL=postgres://palabre:palabre@postgres:5432/palabre
REDIS_URL=redis://redis:6379
```

Ces valeurs sont automatiquement injectées par docker-compose. En développement local sans Docker :
```bash
# PostgreSQL local
DATABASE_URL=postgres://palabre:palabre@localhost:5433/palabre
# Redis local
REDIS_URL=redis://localhost:6380
```

### Obligatoire — Secrets inter-services

**Générez une seule fois et partagez entre tous les services.**

```bash
openssl rand -hex 32   # → INTERNAL_SERVICES_SECRET
openssl rand -hex 32   # → ERLANG_COOKIE (RELEASE_COOKIE)
openssl rand -hex 64   # → PHOENIX_SECRET_KEY_BASE (min 64 chars)
```

```env
INTERNAL_SERVICES_SECRET=<valeur>
RELEASE_COOKIE=<valeur erlang_cookie>
PHOENIX_SECRET_KEY_BASE=<valeur min 64 chars>
```

> Ces mêmes valeurs doivent être identiques dans `backend/.env`, `docker/.env`, et tous les services Elixir/Erlang (message-router, call-signal, presence).

### Optionnel

```env
MESSAGE_ROUTER_PORT=4020
PUBLIC_HOST=localhost           # En production : votre domaine
PRESENCE_SERVICE_URL=http://presence:4010
```

## Démarrage

```bash
# Via Docker (recommandé — dépend de postgres, redis et presence)
./palabre.sh start core

# Logs
./palabre.sh logs message-router

# Santé
curl http://localhost:4020/health
```

## Connexion WebSocket (client)

Le frontend web et l'application mobile se connectent via :
```
ws://localhost:4020/socket/websocket?token=<JWT_ACCESS_TOKEN>
```

En production :
```
wss://votre-domaine.com:4020/socket/websocket?token=<JWT>
```

La variable `VITE_MESSAGE_ROUTER_URL` dans `docker/.env` configure cette URL pour le build du frontend.
