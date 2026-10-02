#!/bin/sh
# Génère la configuration Coturn depuis les variables d'environnement
# et démarre le serveur TURN.

set -e

TURN_REALM="${TURN_REALM:-palabre.app}"
TURN_SECRET="${TURN_SECRET:-change_me_turn_secret}"
EXTERNAL_IP="${TURN_EXTERNAL_IP:-}"
MIN_PORT="${TURN_MIN_PORT:-49152}"
MAX_PORT="${TURN_MAX_PORT:-65535}"
VERBOSE="${TURN_VERBOSE:-0}"

cat > /tmp/turnserver.conf <<EOF
# ── Réseau ──────────────────────────────────────────────────────────────────
listening-port=3478
tls-listening-port=5349
min-port=${MIN_PORT}
max-port=${MAX_PORT}

# IP externe (requise si derrière NAT - identique à l'IP publique du VPS)
$([ -n "$EXTERNAL_IP" ] && echo "external-ip=${EXTERNAL_IP}" || echo "# external-ip=<auto>")

# ── Authentification TURN (REST API / time-limited credentials) ─────────────
# Chaque client reçoit des credentials éphémères générés par le backend.
# Format : username = timestamp:user_id, password = HMAC-SHA1(secret, username)
use-auth-secret
static-auth-secret=${TURN_SECRET}
realm=${TURN_REALM}

# ── Sécurité ─────────────────────────────────────────────────────────────────
# Interdire le relais vers des adresses privées (protection SSRF)
no-loopback-peers
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

# Accepter uniquement les protocoles UDP et TLS (pas de TCP clair)
no-tcp-relay

# Forcer l'utilisation du fingerprint STUN (RFC 5389)
fingerprint

# ── Logs ─────────────────────────────────────────────────────────────────────
$([ "$VERBOSE" = "1" ] && echo "verbose" || echo "# verbose")
log-file=stdout
EOF

echo "[coturn] Démarrage du serveur TURN - realm=${TURN_REALM}, ports ${MIN_PORT}-${MAX_PORT}"
exec turnserver -c /tmp/turnserver.conf
