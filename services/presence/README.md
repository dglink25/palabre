# Service Presence — Palabre

Service de présence temps réel. Répond à la question : "Cet utilisateur est-il en ligne en ce moment ?".

Technologie : **Erlang/OTP** avec stockage en mémoire ETS (lecture microseconde) et persistance légère Mnesia.

## Responsabilités

- Enregistrer les connexions et déconnexions des utilisateurs/appareils
- Répondre aux requêtes de présence en temps réel (utilisé par message-router et call-signal)
- Notifier les abonnés lors d'un changement de statut (online / offline / away)
- Maintenir la liste des instances backend actives (multi-instance)

## Port

- HTTP interne : **4010** (non exposé à l'extérieur, uniquement inter-services)

## Configuration — variables d'environnement

### Toutes obligatoires

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `PRESENCE_HTTP_PORT` | Port d'écoute HTTP | `4010` |
| `INTERNAL_SERVICES_SECRET` | Secret partagé pour authentifier les appels inter-services | — |
| `RELEASE_COOKIE` | Cookie Erlang (même valeur sur tous les noeuds BEAM du cluster) | — |

### Génération des secrets

```bash
# INTERNAL_SERVICES_SECRET — même valeur que dans backend/.env et docker/.env
openssl rand -hex 32

# RELEASE_COOKIE (ERLANG_COOKIE dans les autres services)
openssl rand -hex 32
```

Ces variables sont lues depuis `docker/.env` via le docker-compose. Aucune configuration manuelle séparée n'est nécessaire si vous avez configuré `docker/.env`.

## Démarrage

```bash
# Via Docker (recommandé)
./palabre.sh start core

# Logs en direct
./palabre.sh logs presence

# Vérification santé
curl http://localhost:4010/health
```

## Endpoints internes

| Route | Description |
|-------|-------------|
| `GET /health` | Statut du service |
| `POST /presence/online` | Marquer un appareil en ligne |
| `POST /presence/offline` | Marquer un appareil hors ligne |
| `GET /presence/:userId` | Statut de présence d'un utilisateur |
| `GET /presence/bulk` | Statut de plusieurs utilisateurs à la fois |
