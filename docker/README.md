# Docker — Orchestration Palabre

Ce dossier contient uniquement l'orchestration Docker Compose. Il ne contient pas de code applicatif.

```
docker/
├── docker-compose.yml    Définition de tous les services
├── .env.example          Template de variables d'environnement
└── README.md             Ce fichier
```

## Utilisation

Toutes les commandes Docker s'exécutent depuis la **racine du projet** via `palabre.sh` :

```bash
./palabre.sh start core        # Système central
./palabre.sh start all         # Tout
./palabre.sh status            # Etat des conteneurs
```

Pour exécuter docker compose directement :

```bash
# Depuis la racine du projet
docker compose -f docker/docker-compose.yml --profile core up -d
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml down
```

## Configuration — docker/.env

Copiez `.env.example` en `.env` dans ce dossier :

```bash
cp docker/.env.example docker/.env
```

### Variables à configurer

#### URL de l'API (pour le build du frontend)

```env
VITE_API_BASE_URL=http://localhost:4001/api/v1
```

En production :
```env
VITE_API_BASE_URL=https://api.votre-domaine.com/api/v1
```

#### Firebase — frontend (action manuelle)

Ces valeurs viennent de la console Firebase → Paramètres du projet → Vos applications web. Elles sont **publiques** (pas des secrets).

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet
VITE_FIREBASE_APP_ID=1:123:web:abc
```

#### Secrets partagés inter-services (générer une seule fois)

Ces valeurs **doivent être identiques** dans `docker/.env` ET `backend/.env`.

```bash
# Générez chaque valeur avec :
openssl rand -hex 32    # pour INTERNAL_SERVICES_SECRET et ERLANG_COOKIE
openssl rand -hex 64    # pour PHOENIX_SECRET_KEY_BASE (min 64 caractères)
openssl rand -hex 32    # pour TURN_SECRET
```

```env
# Secret partagé entre backend, presence, message-router, call-signal
INTERNAL_SERVICES_SECRET=<valeur générée>

# Cookie Erlang — doit être identique sur tous les noeuds BEAM
ERLANG_COOKIE=<valeur générée>

# Clé secrète Phoenix — min 64 caractères
PHOENIX_SECRET_KEY_BASE=<valeur générée>

# Secret TURN partagé avec coturn
TURN_SECRET=<valeur générée>
```

#### IP publique coturn (production uniquement)

```env
# Votre IP publique du VPS — laisser vide en développement local
TURN_EXTERNAL_IP=203.0.113.42
```

Comment trouver votre IP publique :
```bash
curl -4 ifconfig.me
```

#### URLs publiques des services

```env
PUBLIC_HOST=localhost                          # En prod : votre domaine
VITE_MESSAGE_ROUTER_URL=ws://localhost:4020    # En prod : wss://votre-domaine.com:4020
FILE_SERVER_PUBLIC_URL=http://localhost:4030   # En prod : https://files.votre-domaine.com
VITE_CALL_SIGNAL_URL=ws://localhost:4040       # En prod : wss://votre-domaine.com:4040
TURN_REALM=palabre.app                        # En prod : votre domaine
```

## Profils disponibles

| Profil | Services démarrés |
|--------|-------------------|
| `core` | postgres, redis, backend, presence, message-router, file-server, call-signal, coturn |
| `frontend` | frontend-web |
| `telephony` | mediasoup, asterisk |
| `realtime` | presence, message-router, file-server, call-signal, coturn |
| `all` | tout |
| Services individuels | postgres, redis, backend, presence, message-router, file-server, call-signal, coturn, mediasoup, asterisk, ai, wireguard |

## Volumes persistants

| Volume | Contenu |
|--------|---------|
| `palabre_postgres_data` | Données PostgreSQL |
| `palabre_uploads` | Fichiers uploadés (onboarding, photos profil) |
| `palabre_mnesia_data` | Base Mnesia du service presence (Erlang) |
| `palabre_media_storage` | Fichiers médias chiffrés (file-server) |
| `palabre_coturn_data` | Données coturn |

Supprimer un volume (DÉTRUIT les données) :
```bash
docker volume rm palabre_postgres_data
```

## Ports exposés sur l'hôte

| Service | Port hôte | Port conteneur | Protocole |
|---------|-----------|----------------|-----------|
| postgres | 5433 | 5432 | TCP |
| redis | 6380 | 6379 | TCP |
| backend | 4001 | 4000 | HTTP |
| frontend-web | 3000 | 3000 | HTTP |
| presence | 4010 | 4010 | HTTP |
| message-router | 4020 | 4020 | WebSocket/HTTP |
| file-server | 4030 | 4030 | HTTP |
| call-signal | 4040 | 4040 | WebSocket/HTTP |
| coturn | hôte direct | 3478, 5349, 49152-65535 | UDP/TCP |

> Coturn utilise `network_mode: host` — il écoute directement sur les ports de la machine sans mapping. Assurez-vous que ces ports sont ouverts dans votre pare-feu en production.
