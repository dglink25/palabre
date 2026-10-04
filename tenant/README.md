# Palabre Tenant — Serveur local autonome

Stack Docker complète pour une organisation Palabre. Fonctionne **100% en LAN sans connexion internet** pour les utilisateurs sur le réseau interne. Les utilisateurs externes rejoignent via le tunnel sécurisé WireGuard.

---

## Architecture

```
[Utilisateur interne] ─── WebSocket ──→ [message-router local]
                                               │
                              [presence] [file-server] [call-signal]
                                               │
                                         [agent tenant]
                                               │
                                    ── WireGuard ──→ [Serveur Central Palabre]
                                               │
                                          [coturn local]
                                    (STUN/TURN pour appels WebRTC)
```

**Mode hors-ligne (tunnel WireGuard coupé) :**
- Messagerie intra-réseau : ✅ fonctionne
- Appels P2P intra-réseau : ✅ fonctionne (Coturn local)
- Vidéoconférence locale : ✅ fonctionne (Jitsi local)
- Messages vers externes : ⏳ mis en file persistante (sync à la reconnexion)
- Appels vers externes : ❌ nécessite le tunnel

---

## Installation

```bash
# Depuis la racine du projet Palabre
cd tenant

chmod +x setup.sh
./setup.sh
```

Le script interactif demande :
- L'identifiant de l'organisation (`ORG_ID`) — reçu par email lors de l'approbation
- Le token de contrôle (`CONTROL_TOKEN`) — du QR code
- Les clés WireGuard (`WG_PRIVATE_KEY`, `WG_PUBLIC_KEY`) — du QR code

Le script génère un `.env` complet avec tous les secrets.

---

## Configuration manuelle après setup.sh

### 1. TURN_EXTERNAL_IP (si le serveur est derrière NAT)

Si votre serveur tenant est derrière un routeur NAT (cas courant) :

```env
TURN_EXTERNAL_IP=203.0.113.42    # IP publique de votre serveur
```

Laissez vide si vous êtes en LAN pur sans appels vers l'extérieur.

**Comment trouver votre IP publique :**
```bash
curl ifconfig.me
```

---

### 2. Vidéoconférence — Jitsi local (recommandé)

Pour que la vidéoconférence fonctionne sans internet :

1. Installez Jitsi Meet sur un serveur de votre réseau :  
   https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart

2. Dans `tenant/.env` :
```env
JITSI_DOMAIN=meet.lan.votre-org   # nom DNS ou IP du serveur Jitsi local
JITSI_JWT_SECRET=<openssl rand -hex 32>
```

> Le backend ne charge le SDK Jitsi que depuis `JITSI_DOMAIN`. Si ce domaine est local, zéro trafic internet pour la vidéo.

---

### 3. Sonnerie / Musique d'attente (service client)

Placez un fichier MP3 accessible dans le conteneur :

```env
SUPPORT_HOLD_MUSIC_PATH=/audio/hold-music.mp3
```

Montez-le dans `docker-compose.yml` :
```yaml
services:
  backend:
    volumes:
      - ./audio:/audio:ro
```

---

### 4. AGENT_DATA_DIR — persistance de la file hors-ligne

L'agent persist sa file de messages hors-ligne sur disque pour survivre aux redémarrages :

```env
AGENT_DATA_DIR=/data/agent
```

Ce dossier est monté comme volume Docker dans `docker-compose.yml` (`tenant_agent_data`). **Ne le supprimez pas** — vous perdriez les messages non encore synchronisés.

---

### 5. AGENT_PUBLIC_URL (si routage inter-organisations)

Si des utilisateurs d'autres organisations doivent vous joindre directement :

```env
AGENT_PUBLIC_URL=https://agent.votre-org.com:8080
```

Doit être accessible depuis le serveur central Palabre.

---

## Démarrage

```bash
# Première fois
./setup.sh            # Génère .env + démarre les services
docker compose up -d  # Si .env déjà configuré

# Vérifier l'état
docker compose ps
curl http://localhost:8080/health
```

Réponse `/health` attendue :
```json
{
  "status": "ok",
  "tunnel": "up",
  "orgStatus": "active",
  "pending": 0,
  "mode": "full"
}
```

---

## Commandes utiles

```bash
# Logs de l'agent (tunnel, heartbeat, sync)
docker compose logs -f agent

# Logs du message-router
docker compose logs -f message-router

# Statut du tunnel WireGuard
docker exec palabre-tenant-agent wg show

# Nombre de messages en file hors-ligne
curl http://localhost:8080/health | jq .pending

# Arrêt complet
docker compose down

# Arrêt avec suppression volumes (⚠ supprime tous les messages locaux)
docker compose down -v
```

---

## Modes réseau

| Situation | Mode | Messagerie interne | Messages externes |
|-----------|------|--------------------|-------------------|
| Tunnel WireGuard actif | `full` | ✅ | ✅ |
| Tunnel coupé | `degraded` | ✅ | ⏳ file persistante |
| Pas de réseau du tout | `unavailable` | ❌ | ❌ |

La file hors-ligne est persistée dans `AGENT_DATA_DIR/pending_queue.json`. Elle est synchronisée automatiquement à la reconnexion du tunnel.

---

## Clés E2E Signal — aucune configuration requise

Le chiffrement E2E est entièrement géré par les clients (web + mobile) :
- Chaque appareil génère ses clés au premier login
- Les clés publiques sont stockées dans la base PostgreSQL locale
- Le serveur ne voit jamais les clés privées ni les messages déchiffrés

Assurez-vous que la migration `013_e2e_key_infrastructure.sql` a été exécutée (incluse dans le `setup.sh`).

---

## Variables d'environnement (tenant/.env)

| Variable | Obligatoire | Source |
|----------|-------------|--------|
| `ORG_ID` | Oui | QR code d'approbation |
| `CONTROL_TOKEN` | Oui | QR code d'approbation |
| `WG_PRIVATE_KEY` | Oui | QR code d'approbation |
| `WG_PUBLIC_KEY` | Oui | QR code d'approbation |
| `POSTGRES_PASSWORD` | Oui | Généré par setup.sh |
| `JWT_ACCESS_SECRET` | Oui | Généré par setup.sh |
| `JWT_REFRESH_SECRET` | Oui | Généré par setup.sh |
| `INTERNAL_SERVICES_SECRET` | Oui | Généré par setup.sh |
| `ERLANG_COOKIE` | Oui | Généré par setup.sh |
| `PHOENIX_SECRET_KEY_BASE` | Oui | Généré par setup.sh |
| `TURN_SECRET` | Oui | Même valeur que serveur central |
| `TURN_REALM` | Oui | `local.palabre.app` par défaut |
| `AGENT_DATA_DIR` | Oui | `/data/agent` |
| `TURN_EXTERNAL_IP` | Si NAT | IP publique du serveur |
| `JITSI_DOMAIN` | Pour vidéo locale | DNS/IP du serveur Jitsi |
| `JITSI_JWT_SECRET` | Pour vidéo locale | `openssl rand -hex 32` |
| `AGENT_PUBLIC_URL` | Pour routage inter-org | URL publique de l'agent |
