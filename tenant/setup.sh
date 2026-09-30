#!/usr/bin/env bash

set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()    { echo -e "${BLUE}[palabre]${RESET} $*"; }
ok()     { echo -e "${GREEN}[palabre]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[palabre]${RESET} $*"; }
err()    { echo -e "${RED}[palabre] ERREUR${RESET} $*"; exit 1; }
title()  { echo -e "\n${BOLD}${CYAN}$*${RESET}\n"; }
prompt() { echo -en "${BOLD}  → $1 : ${RESET}"; }

HEADLESS="${1:-}"
ENV_FILE=".env"

# ── Vérifications pré-installation ───────────────────────────────────────────

check_requirements() {
  title "Vérification des prérequis"

  command -v docker &>/dev/null    || err "Docker n'est pas installé. Lancez : curl -fsSL https://get.docker.com | sh"
  docker compose version &>/dev/null 2>&1 || err "docker compose (v2) n'est pas disponible. Mettez Docker à jour."
  docker info &>/dev/null 2>&1     || err "Le daemon Docker n'est pas en cours d'exécution."

  ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') — OK"
  ok "docker compose $(docker compose version --short) — OK"
}

# ── Collecte des informations ─────────────────────────────────────────────────

collect_config() {
  title "Configuration de votre tenant Palabre"

  echo "  Vous allez installer le serveur tenant de votre organisation."
  echo "  Munissez-vous du QR code ou du payload JSON reçu par e-mail lors de l'approbation."
  echo ""

  if [ "$HEADLESS" != "--headless" ]; then
    prompt "Identifiant de votre organisation (ORG_ID)"
    read -r ORG_ID

    prompt "Token de contrôle (CONTROL_TOKEN, reçu dans le QR code)"
    read -rs CONTROL_TOKEN
    echo ""

    prompt "Clé privée VPN WireGuard (VPN_PRIVATE_KEY, dans le QR code)"
    read -rs VPN_PRIVATE_KEY
    echo ""

    prompt "Clé publique VPN WireGuard (VPN_PUBLIC_KEY, dans le QR code)"
    read -r VPN_PUBLIC_KEY

    prompt "URL du serveur central Palabre [https://api.palabre.app]"
    read -r CENTRAL_API_URL
    CENTRAL_API_URL="${CENTRAL_API_URL:-https://api.palabre.app}"

    prompt "URL WebSocket du serveur central [wss://ws.palabre.app]"
    read -r CENTRAL_WS_URL
    CENTRAL_WS_URL="${CENTRAL_WS_URL:-wss://ws.palabre.app}"

    prompt "Nom de votre organisation (affiché dans les logs)"
    read -r ORG_NAME

    prompt "URL publique de cet agent pour le routage inter-organisations [laisser vide si inconnu]"
    read -r AGENT_PUBLIC_URL
    AGENT_PUBLIC_URL="${AGENT_PUBLIC_URL:-}"

    prompt "Mot de passe PostgreSQL local [généré automatiquement]"
    read -rs DB_PASSWORD
    echo ""
    DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 16)}"

  else
    # Mode headless : lire depuis les variables d'environnement
    ORG_ID="${ORG_ID:?'Variable ORG_ID manquante'}"
    CONTROL_TOKEN="${CONTROL_TOKEN:?'Variable CONTROL_TOKEN manquante'}"
    VPN_PRIVATE_KEY="${VPN_PRIVATE_KEY:?'Variable VPN_PRIVATE_KEY manquante'}"
    VPN_PUBLIC_KEY="${VPN_PUBLIC_KEY:?'Variable VPN_PUBLIC_KEY manquante'}"
    CENTRAL_API_URL="${CENTRAL_API_URL:-https://api.palabre.app}"
    CENTRAL_WS_URL="${CENTRAL_WS_URL:-wss://ws.palabre.app}"
    ORG_NAME="${ORG_NAME:-Palabre Tenant}"
    DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 16)}"
    AGENT_PUBLIC_URL="${AGENT_PUBLIC_URL:-}"
  fi

  # Valider les champs obligatoires
  [ -z "$ORG_ID" ]           && err "L'identifiant organisation est obligatoire."
  [ -z "$CONTROL_TOKEN" ]    && err "Le token de contrôle est obligatoire."
  [ -z "$VPN_PRIVATE_KEY" ]  && err "La clé privée VPN est obligatoire."
  [ -z "$VPN_PUBLIC_KEY" ]   && err "La clé publique VPN est obligatoire."
}

# ── Génération des secrets locaux ─────────────────────────────────────────────

generate_secrets() {
  title "Génération des secrets locaux"

  INTERNAL_SERVICES_SECRET=$(openssl rand -hex 32)
  ERLANG_COOKIE=$(openssl rand -hex 32)
  PHOENIX_SECRET_KEY_BASE=$(openssl rand -hex 64)
  COTURN_SECRET=$(openssl rand -hex 32)
  JWT_ACCESS_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)

  ok "Secrets générés — ils seront écrits dans $ENV_FILE"
}

# ── Écriture du .env ──────────────────────────────────────────────────────────

write_env() {
  title "Écriture de la configuration"

  cat > "$ENV_FILE" <<EOF
# =============================================================================
# PALABRE TENANT — Configuration générée par setup.sh le $(date)
# NE PAS COMMITER CE FICHIER DANS GIT
# =============================================================================

# ── Identité de l'organisation ────────────────────────────────────────────────
ORG_ID=${ORG_ID}
ORG_NAME=${ORG_NAME}

# ── Connexion au serveur central ──────────────────────────────────────────────
CONTROL_TOKEN=${CONTROL_TOKEN}
CENTRAL_API_URL=${CENTRAL_API_URL}
CENTRAL_WS_URL=${CENTRAL_WS_URL}

# ── WireGuard VPN ─────────────────────────────────────────────────────────────
# Clé privée locale (ne jamais partager)
WG_PRIVATE_KEY=${VPN_PRIVATE_KEY}
# Clé publique (déjà enregistrée sur le serveur central)
WG_PUBLIC_KEY=${VPN_PUBLIC_KEY}

# ── Base de données locale ────────────────────────────────────────────────────
POSTGRES_USER=palabre
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=palabre_tenant
DATABASE_URL=postgres://palabre:${DB_PASSWORD}@postgres:5432/palabre_tenant

# ── Redis local ───────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT (doit correspondre au serveur central si les tokens sont partagés) ────
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# ── Secrets inter-services ────────────────────────────────────────────────────
INTERNAL_SERVICES_SECRET=${INTERNAL_SERVICES_SECRET}
ERLANG_COOKIE=${ERLANG_COOKIE}
PHOENIX_SECRET_KEY_BASE=${PHOENIX_SECRET_KEY_BASE}

# ── Coturn STUN/TURN local ────────────────────────────────────────────────────
TURN_SECRET=${COTURN_SECRET}
TURN_REALM=local.palabre.app

# ── Agent tenant ──────────────────────────────────────────────────────────────
AGENT_PORT=8080
HEARTBEAT_INTERVAL_MS=30000
# URL publique de cet agent (pour le routage inter-organisations)
# Exemple : https://tenant.monentreprise.com:8080
AGENT_PUBLIC_URL=${AGENT_PUBLIC_URL:-}

# ── URLs publiques des services ───────────────────────────────────────────────
PUBLIC_HOST=$(hostname -f 2>/dev/null || echo 'localhost')
FILE_SERVER_PUBLIC_URL=http://$(hostname -f 2>/dev/null || echo 'localhost'):4030
MESSAGE_ROUTER_PUBLIC_URL=ws://$(hostname -f 2>/dev/null || echo 'localhost'):4020

# ── URLs internes (ne pas modifier) ───────────────────────────────────────────
LOCAL_MESSAGE_ROUTER_URL=http://message-router:4020
LOCAL_CALL_SIGNAL_URL=http://call-signal:4040
PRESENCE_SERVICE_URL=http://presence:4010
EOF

  ok "$ENV_FILE créé avec succès"
  warn "Ce fichier contient des secrets — ne le partagez JAMAIS et ne le committez PAS dans git."
}

# ── Configuration WireGuard ───────────────────────────────────────────────────

configure_wireguard() {
  title "Configuration WireGuard"

  if ! command -v wg &>/dev/null; then
    warn "WireGuard non trouvé — installation..."
    if command -v apt-get &>/dev/null; then
      sudo apt-get install -y wireguard-tools iproute2 || warn "Installation WireGuard échouée — continuez sans VPN tunnel"
    elif command -v apk &>/dev/null; then
      sudo apk add --no-cache wireguard-tools iproute2 || warn "Installation WireGuard échouée"
    fi
  fi

  if command -v wg &>/dev/null; then
    ok "WireGuard disponible — $(wg --version)"
  else
    warn "WireGuard indisponible — le tunnel VPN sera géré par l'agent via Docker"
  fi
}

# ── Démarrage des services ────────────────────────────────────────────────────

start_services() {
  title "Démarrage des services"

  log "Construction et démarrage de tous les services..."
  docker compose --env-file "$ENV_FILE" -f docker-compose.yml up -d --build

  echo ""
  ok "Services démarrés !"
  echo ""
  docker compose ps
  echo ""

  title "Vérification de l'agent"
  log "Attente du démarrage de l'agent (15s)..."
  sleep 15

  if docker logs palabre-tenant-agent 2>&1 | grep -q "Agent tenant demarre"; then
    ok "Agent tenant opérationnel"
  else
    warn "L'agent tarde à démarrer — vérifiez les logs : docker logs palabre-tenant-agent"
  fi
}

# ── Résumé final ──────────────────────────────────────────────────────────────

print_summary() {
  title "Installation terminée"

  echo -e "${BOLD}  Votre tenant Palabre est opérationnel.${RESET}"
  echo ""
  echo "  Organisation  : ${ORG_NAME}"
  echo "  ID            : ${ORG_ID}"
  echo "  Serveur central : ${CENTRAL_API_URL}"
  echo ""
  echo "  Services locaux :"
  echo "    Message Router : ws://$(hostname -f 2>/dev/null || echo 'localhost'):4020"
  echo "    File Server    : http://$(hostname -f 2>/dev/null || echo 'localhost'):4030"
  echo "    Call Signal    : ws://$(hostname -f 2>/dev/null || echo 'localhost'):4040"
  echo "    Agent tenant   : http://localhost:8080/health"
  echo ""
  echo "  Commandes utiles :"
  echo "    Logs en direct   : docker compose logs -f"
  echo "    Statut agent     : curl http://localhost:8080/health"
  echo "    Arrêter          : docker compose down"
  echo "    Redémarrer       : docker compose up -d"
  echo ""
  warn "Vérifiez le statut du tunnel dans votre tableau de bord Palabre (Tunnel VPN)."
}

# ── Point d'entrée ────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}║        PALABRE — Installation du tenant          ║${RESET}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${RESET}"
  echo ""

  check_requirements
  collect_config
  generate_secrets
  write_env
  configure_wireguard
  start_services
  print_summary
}

main
