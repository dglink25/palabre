# Palabre Tenant

Serveur local autonome pour une organisation Palabre.

## Architecture

Le tenant est une stack Docker complète qui :
- Fait tourner ses propres services (messagerie, présence, appels, fichiers)
- Maintient un tunnel WireGuard permanent vers le serveur central
- Fonctionne en mode dégradé si le tunnel est coupé (messagerie intra-réseau)
- Se resynchronise automatiquement à la reconnexion

```
[Utilisateur local] ─── WebSocket ──→ [message-router local]
                                              │
                                    [presence local] [file-server local]
                                              │
                                        [agent tenant]
                                              │
                                    ── WireGuard ──→ [Serveur Central Palabre]
                                              │
                                        [coturn local]
```

## Installation

```bash
# Cloner le depot Palabre (uniquement le dossier tenant + services)
git clone --filter=blob:none --sparse git@github.com:dglink25/palabre.git palabre-tenant
cd palabre-tenant
git sparse-checkout set tenant services coturn
cd tenant

# Lancer l'installation interactive
chmod +x setup.sh
./setup.sh
```

Le script demande :
- L'identifiant de l'organisation (reçu par e-mail lors de l'approbation)
- Le token de contrôle (du QR code)
- Les clés WireGuard (du QR code)

## Mode hors-ligne

Quand le tunnel WireGuard est coupé :
- Les membres **dans le réseau local** continuent à s'envoyer des messages
- Les messages vers des utilisateurs **externes** sont mis en file
- À la reconnexion, la file est synchronisée automatiquement vers le central

## Commandes

```bash
# Démarrer
docker compose up -d

# Voir les logs
docker compose logs -f

# Statut de l'agent
curl http://localhost:8080/health

# Arrêter
docker compose down
```
