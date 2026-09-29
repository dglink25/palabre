# Service Call Signal — Palabre

Serveur de signaling WebRTC pour les appels audio et vidéo (1:1 et groupe). Échange les offres SDP et candidats ICE entre les pairs — ne traite jamais le flux média.

Technologie : **Elixir/Phoenix Channels**.

## Responsabilités

- Gérer les rooms d'appel (créer, rejoindre, quitter)
- Relayer les offres SDP (Session Description Protocol) entre pairs
- Relayer les candidats ICE pour la traversée NAT
- Notifier les utilisateurs d'un appel entrant
- Coordonner la fin d'appel et le nettoyage des rooms

## Port

- WebSocket/HTTP : **4040**

## Configuration du .env

Toutes les variables de ce service sont déjà dans `backend/.env`. Utilisez le script :

```bash
# Depuis la racine du projet
./scripts/setup-env.sh call-signal
# ou pour tous les services d'un coup :
./scripts/setup-env.sh
```

Le script génère `services/call-signal/.env` automatiquement. Si le fichier existe déjà et n'est pas vide, il crée `.env.new` sans écraser.

### Variables générées automatiquement (copiées de backend/.env)

| Variable | Source dans backend/.env | Description |
|----------|--------------------------|-------------|
| `JWT_ACCESS_SECRET` | `JWT_ACCESS_SECRET` | Vérification des JWT WebSocket |
| `INTERNAL_SERVICES_SECRET` | `INTERNAL_SERVICES_SECRET` | Secret inter-services |
| `RELEASE_COOKIE` | `ERLANG_COOKIE` | Cookie Erlang du cluster BEAM |
| `PHOENIX_SECRET_KEY_BASE` | `PHOENIX_SECRET_KEY_BASE` | Clé secrète Phoenix (min 64 chars) |
| `PUBLIC_HOST` | `PUBLIC_HOST` | Hôte public pour les URLs WebSocket |

### Variables fixes (pas à modifier en dev Docker)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `CALL_SIGNAL_PORT` | `4040` | Port WebSocket/HTTP |
| `MESSAGE_ROUTER_URL` | `http://message-router:4020` | URL interne du message-router |
| `MEDIASOUP_URL` | `http://mediasoup:3478` | URL interne du SFU (appels groupe) |

## Démarrage

```bash
# Via Docker (inclus dans core — dépend de message-router)
./palabre.sh start core

# Logs
./palabre.sh logs call-signal

# Santé
curl http://localhost:4040/health
```

## Flux d'appel WebRTC simplifié

```
Appelant              call-signal             Appelé
    |                     |                     |
    |-- join_room() ----> |                     |
    |                     |-- notify_ring ----> |
    |                     | <-- join_room ----- |
    |-- send_offer() ---> |                     |
    |                     |-- forward_offer --> |
    |                     | <-- send_answer --- |
    | <-- forward_answer  |                     |
    |  ← ICE exchange →   |   ← ICE exchange → |
    |                     |                     |
    |======= Connexion P2P directe (via Coturn si NAT) =======|
```

Le call-signal ne voit que les métadonnées de signaling, jamais le contenu audio/vidéo. Les flux RTP passent directement entre les pairs (ou via Coturn si NAT symétrique).
