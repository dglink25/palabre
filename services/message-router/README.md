# Service Message Router — Palabre

Routeur de messages temps réel. Maintient une connexion WebSocket permanente avec chaque client et achemine les messages chiffrés E2E sans jamais les déchiffrer.

Technologie : **Elixir/Phoenix Channels**.

## Responsabilités

- Connexions WebSocket permanentes (reconnexion auto avec backoff)
- Routage des messages E2E entre utilisateurs (le serveur ne voit que le chiffré)
- Distribution des notifications de présence
- Stockage temporaire des messages hors-ligne (livraison différée)
- Confirmations de livraison et de lecture

## Port

- WebSocket/HTTP : **4020**

## Configuration du .env

Toutes les variables de ce service sont déjà dans `backend/.env`. Ne pas les saisir manuellement — utilisez le script :

```bash
# Depuis la racine du projet
./scripts/setup-env.sh message-router
# ou pour tous les services d'un coup :
./scripts/setup-env.sh
```

Le script génère `services/message-router/.env` automatiquement. Si le fichier existe déjà et n'est pas vide, il crée `.env.new` sans écraser.

### Variables générées automatiquement (copiées de backend/.env)

| Variable | Source dans backend/.env | Description |
|----------|--------------------------|-------------|
| `JWT_ACCESS_SECRET` | `JWT_ACCESS_SECRET` | Vérification des JWT clients WebSocket |
| `DATABASE_URL` | `DATABASE_URL` | Base PostgreSQL |
| `REDIS_URL` | `REDIS_URL` | Pub/Sub et file d'attente hors-ligne |
| `INTERNAL_SERVICES_SECRET` | `INTERNAL_SERVICES_SECRET` | Secret inter-services |
| `RELEASE_COOKIE` | `ERLANG_COOKIE` | Cookie Erlang du cluster BEAM |
| `PHOENIX_SECRET_KEY_BASE` | `PHOENIX_SECRET_KEY_BASE` | Clé secrète Phoenix (min 64 chars) |
| `PUBLIC_HOST` | `PUBLIC_HOST` | Hôte public pour les URLs WebSocket |

### Variables fixes (pas à modifier en dev Docker)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `MESSAGE_ROUTER_PORT` | `4020` | Port WebSocket/HTTP |
| `PRESENCE_SERVICE_URL` | `http://presence:4010` | URL interne du service presence |

## Démarrage

```bash
# Via Docker (inclus dans core — dépend de postgres, redis, presence)
./palabre.sh start core

# Logs en direct
./palabre.sh logs message-router

# Santé
curl http://localhost:4020/health
```

## Connexion WebSocket depuis un client

```
ws://localhost:4020/socket/websocket?token=<JWT_ACCESS_TOKEN>
```

Production :
```
wss://votre-domaine.com:4020/socket/websocket?token=<JWT>
```

La variable `VITE_MESSAGE_ROUTER_URL` dans `docker/.env` configure cette URL pour le build du frontend.
