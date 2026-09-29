# Coturn — Serveur STUN/TURN Palabre

Serveur STUN/TURN basé sur [coturn](https://github.com/coturn/coturn). Permet aux appels WebRTC de traverser les NAT et pare-feux lorsqu'une connexion pair-à-pair directe n'est pas possible.

- **STUN** : découverte de l'adresse IP publique d'un client
- **TURN** : relais des flux RTP/RTCP quand la connexion directe échoue (NAT symétrique, pare-feu strict)

## Port

Coturn utilise `network_mode: host` — il écoute directement sur les ports de la machine hôte :

| Port | Protocole | Usage |
|------|-----------|-------|
| 3478 | UDP + TCP | STUN et TURN |
| 5349 | TCP + TLS | TURN over TLS |
| 49152–65535 | UDP | Plage de ports relais (media) |

> Avec `network_mode: host`, ces ports ne sont pas "mappés" — coturn accède directement à la pile réseau de l'hôte. Assurez-vous qu'ils sont ouverts dans votre pare-feu.

## Configuration — variables d'environnement

### Obligatoire en production — IP publique

**Action manuelle requise sur un VPS.**

```env
TURN_EXTERNAL_IP=203.0.113.42   # Remplacez par votre IP publique
```

Comment trouver votre IP publique :
```bash
curl -4 ifconfig.me
# ou
curl -4 icanhazip.com
```

> En développement local, laissez `TURN_EXTERNAL_IP` vide. Coturn utilisera l'interface réseau par défaut.

### Obligatoire — Secret partagé avec le backend

**Même valeur que `TURN_SECRET` dans `backend/.env`.**

```env
TURN_SECRET=<même valeur que backend TURN_SECRET>
```

```bash
# Génération si pas encore fait
openssl rand -hex 32
```

Le backend génère des credentials TURN temporaires (REST API auth) signés avec ce secret. Les clients les utilisent pour s'authentifier auprès de Coturn.

### Optionnel

```env
TURN_REALM=palabre.app          # Domaine realm (peut être votre domaine de production)
TURN_MIN_PORT=49152             # Début de la plage de ports relais
TURN_MAX_PORT=65535             # Fin de la plage
TURN_VERBOSE=0                  # Logs verbeux (1 = activé, utile pour debug)
```

## Démarrage

```bash
# Via Docker (inclus dans le profil core)
./palabre.sh start core

# Logs
./palabre.sh logs coturn

# Test STUN depuis un autre terminal
# (nécessite turnutils_stunclient, paquet coturn-utils)
turnutils_stunclient -p 3478 localhost
```

## Ouverture du pare-feu (production)

Sur Ubuntu/Debian avec ufw :
```bash
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp
sudo ufw reload
```

Sur un VPS avec iptables :
```bash
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 5349 -j ACCEPT
iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
```

Sur un pare-feu cloud (AWS Security Groups, GCP Firewall, DigitalOcean) :
- Ouvrez les ports 3478 (UDP+TCP), 5349 (TCP), et la plage 49152-65535 (UDP)

## Vérification

Le backend expose les credentials TURN via `/api/v1/calls/turn-credentials`. Le frontend les utilise automatiquement dans la configuration `RTCPeerConnection` :

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:votre-domaine.com:3478' },
    {
      urls: 'turn:votre-domaine.com:3478',
      username: credentials.username,
      credential: credentials.credential,
    }
  ]
});
```
