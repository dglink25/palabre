# Service Presence - Palabre

Service de présence temps réel. Répond à la question : "Cet utilisateur est-il en ligne en ce moment ?".

Technologie : **Erlang/OTP** - stockage en mémoire ETS (lecture microseconde) + persistance Mnesia.

## Responsabilités

- Enregistrer les connexions et déconnexions des utilisateurs/appareils
- Répondre aux requêtes de présence (utilisé par message-router et call-signal)
- Notifier les abonnés lors d'un changement de statut (online / offline / away)

## Port

- HTTP interne : **4010** (non exposé à l'extérieur - uniquement inter-services)

## Configuration du .env

Toutes les variables de ce service sont déjà dans `backend/.env`. Ne pas les saisir manuellement - utilisez le script :

```bash
# Depuis la racine du projet
./scripts/setup-env.sh presence
# ou pour tous les services d'un coup :
./scripts/setup-env.sh
```

Le script génère `services/presence/.env` automatiquement. Si le fichier existe déjà et n'est pas vide, il crée `.env.new` sans écraser.

### Variables générées automatiquement (copiées de backend/.env)

| Variable | Source dans backend/.env | Description |
|----------|--------------------------|-------------|
| `INTERNAL_SERVICES_SECRET` | `INTERNAL_SERVICES_SECRET` | Secret partagé inter-services |
| `RELEASE_COOKIE` | `ERLANG_COOKIE` | Cookie Erlang du cluster BEAM |

### Variables fixes (pas à modifier)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `PRESENCE_HTTP_PORT` | `4010` | Port HTTP interne |

## Démarrage

```bash
# Via Docker (inclus dans le profil core - recommandé)
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
