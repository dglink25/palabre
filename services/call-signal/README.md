# Service Call Signal — Palabre

Serveur de signaling WebRTC pour les appels audio et vidéo (1:1 et groupe). Échange les offres SDP et candidats ICE entre les pairs — ne traite jamais le flux média lui-même.

Technologie : **Elixir/Phoenix Channels** (WebSocket).

## Responsabilités

- Gérer les rooms d'appel (créer, rejoindre, quitter)
- Relayer les offres SDP (Session Description Protocol) entre pairs
- Relayer les candidats ICE (Interactive Connectivity Establishment)
- Notifier les utilisateurs d'un appel entrant
- Coordonner avec le message-router pour les notifications push
- Gérer la fin d'appel et le nettoyage des rooms

## Port

- WebSocket/HTTP : **4040**

## Configuration — variables d'environnement

### Obligatoire — Secret JWT

**Même valeur que dans `backend/.env`.**

```env
JWT_ACCESS_SECRET=<même valeur que backend>
```

### Obligatoire — Secrets Elixir/Erlang

**Mêmes valeurs que message-router, presence et backend.**

```bash
# Si pas encore générés :
openssl rand -hex 32   # → INTERNAL_SERVICES_SECRET
openssl rand -hex 32   # → ERLANG_COOKIE (RELEASE_COOKIE)
openssl rand -hex 64   # → PHOENIX_SECRET_KEY_BASE
```

```env
INTERNAL_SERVICES_SECRET=<valeur partagée>
RELEASE_COOKIE=<erlang_cookie partagé>
PHOENIX_SECRET_KEY_BASE=<valeur partagée min 64 chars>
```

> Ces valeurs doivent être identiques sur tous les services BEAM du cluster (message-router, call-signal, presence). Si elles diffèrent, les noeuds Erlang ne pourront pas se reconnaître.

### Optionnel

```env
CALL_SIGNAL_PORT=4040
PUBLIC_HOST=localhost
MEDIASOUP_URL=http://mediasoup:3478    # Connecté au SFU pour les appels de groupe
MESSAGE_ROUTER_URL=http://message-router:4020
```

## Démarrage

```bash
# Via Docker (dépend de message-router)
./palabre.sh start core

# Logs
./palabre.sh logs call-signal

# Santé
curl http://localhost:4040/health
```

## Flux d'appel WebRTC simplifié

```
Appelant                  call-signal              Appelé
    |                         |                       |
    |-- join_room(roomId) --> |                       |
    |                         |-- notify_incoming --> |
    |                         | <-- join_room --------|
    |-- send_offer(sdp) ----> |                       |
    |                         |-- forward_offer ----> |
    |                         | <-- send_answer -------|
    |<-- forward_answer ------ |                       |
    |-- send_ice -----------> |                       |
    |                         |-- forward_ice -------> |
    | <--- ICE exchange -----  | <--- ICE exchange --- |
    |                         |                       |
    |====== Connexion P2P directe (via Coturn si NAT) ======|
```

Les flux RTP/RTCP (audio/vidéo) passent directement entre les pairs via Coturn si une connexion P2P directe n'est pas possible (NAT symétrique). Le call-signal ne voit que les métadonnées de signaling, jamais le contenu média.
