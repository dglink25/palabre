#!/usr/bin/env bash
# =============================================================================
# palabre.sh - Gestionnaire de démarrage du système central Palabre
#
# Usage :
#   ./palabre.sh start  core               # Système central (sans frontends)
#   ./palabre.sh start  all                # Tout (y compris les deux frontends web)
#   ./palabre.sh start  frontend           # Les deux frontends web
#   ./palabre.sh start  frontend-web       # App principale uniquement (port 3000)
#   ./palabre.sh start  frontend-developer # Portail développeurs (port 3001)
#   ./palabre.sh start  telephony          # Asterisk + Mediasoup
#   ./palabre.sh stop   core               # Arrêter le système central
#   ./palabre.sh stop   all                # Tout arrêter
#   ./palabre.sh restart core              # Redémarrer
#   ./palabre.sh logs   backend            # Suivre les logs d'un service
#   ./palabre.sh logs   ai                 # Logs du service AI
#   ./palabre.sh status                    # État de tous les conteneurs
#   ./palabre.sh migrate                   # Exécuter les migrations SQL
#   ./palabre.sh ps                        # Alias de status
#   ./palabre.sh setup-env                 # Propager les variables partagées
#   ./palabre.sh setup-env ai              # Générer uniquement ai/.env
#   ./palabre.sh mobile android            # Flutter sur émulateur Android
#   ./palabre.sh mobile ios                # Flutter sur simulateur iOS
#   ./palabre.sh mobile build-apk          # Compiler l'APK Android (release)
#
# Profils disponibles :
#   core              → postgres (pgvector), redis, backend, ai, presence,
#                       message-router, file-server, call-signal, coturn
#   frontend          → frontend-web (3000) + frontend-developer (3001)
#   frontend-web      → application principale (port 3000)
#   frontend-developer → portail développeurs (port 3001)
#   telephony         → mediasoup, asterisk
#   realtime          → presence, message-router, file-server, call-signal, coturn
#   all               → tout ce qui précède
#
# Services individuels :
#   postgres | redis | backend | ai
#   frontend-web | frontend-developer
#   presence | message-router | file-server | call-signal
#   coturn | mediasoup | asterisk | wireguard
#
# Mobile Flutter (hors Docker) :
#   ./palabre.sh mobile android     → émulateur Android
#   ./palabre.sh mobile ios         → simulateur iOS
#   ./palabre.sh mobile build-apk   → APK release
#   Voir frontend/mobile/README.md pour les instructions complètes.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker/docker-compose.yml"
COMPOSE="docker compose -f ${COMPOSE_FILE}"

# Augmenter le timeout BuildKit pour les services avec téléchargement réseau long
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# ── Couleurs terminal ─────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

log()  { echo -e "${BLUE}[palabre]${RESET} $*"; }
ok()   { echo -e "${GREEN}[palabre]${RESET} $*"; }
warn() { echo -e "${YELLOW}[palabre]${RESET} $*"; }
err()  { echo -e "${RED}[palabre] ERREUR${RESET} $*"; exit 1; }

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  echo ""
  echo -e "${BOLD}Palabre - Système central${RESET}"
  echo ""
  echo "  ./palabre.sh start  core          Système central (hors frontend)"
  echo "  ./palabre.sh start  all           Tout démarrer"
  echo "  ./palabre.sh start  frontend      Frontend web"
  echo "  ./palabre.sh start  telephony     Mediasoup + Asterisk"
  echo "  ./palabre.sh start  realtime      Services temps réel uniquement"
  echo "  ./palabre.sh stop   core|all      Arrêter"
  echo "  ./palabre.sh restart core         Redémarrer"
  echo "  ./palabre.sh logs   <service>     Logs en direct"
  echo "  ./palabre.sh status               État des conteneurs"
  echo "  ./palabre.sh migrate              Lancer les migrations SQL"
  echo "  ./palabre.sh setup-env            Générer les .env des services depuis backend/.env"
  echo "  ./palabre.sh setup-env presence   Générer uniquement presence/.env"
  echo "  ./palabre.sh shell  backend       Shell dans un conteneur"
  echo ""
  exit 0
}

ACTION="${1:-}"
TARGET="${2:-}"

[ -z "$ACTION" ] && usage

# ── Vérifications préliminaires ───────────────────────────────────────────────
check_docker() {
  if ! command -v docker &>/dev/null; then
    err "Docker n'est pas installé. Voir https://docs.docker.com/engine/install/"
  fi
  if ! docker compose version &>/dev/null 2>&1; then
    err "docker compose (v2) n'est pas disponible. Mettez Docker à jour."
  fi
  if ! docker info &>/dev/null 2>&1; then
    err "Le daemon Docker n'est pas en cours d'exécution. Lancez-le d'abord."
  fi
}

check_env() {
  local envfile="${SCRIPT_DIR}/backend/.env"
  if [ ! -f "$envfile" ]; then
    warn "Fichier ${envfile} introuvable - copie de l'exemple..."
    if [ -f "${SCRIPT_DIR}/backend/.env.example" ]; then
      cp "${SCRIPT_DIR}/backend/.env.example" "$envfile"
      warn "Editez ${envfile} avec vos valeurs avant de relancer."
    else
      err "Aucun fichier .env ni .env.example dans backend/."
    fi
  fi
}

# ── Commandes ─────────────────────────────────────────────────────────────────
cmd_start() {
  local target="$1"
  log "Démarrage du profil : ${BOLD}${target}${RESET}"

  # Services du profil core listés explicitement pour confirmation à l'écran
  if [ "$target" = "core" ]; then
    echo ""
    echo "  Services démarrés :"
    echo "    postgres        → :5433  (pgvector/pgvector:pg16)"
    echo "    redis           → :6380"
    echo "    backend         → :4001"
    echo "    ai              → :8000  (agent IA, IVR, RAG, rapports)"
    echo "    presence        → :4010"
    echo "    message-router  → :4020"
    echo "    file-server     → :4030"
    echo "    call-signal     → :4040"
    echo "    coturn          → :3478 (STUN/TURN, network_mode: host)"
    echo ""
  fi

  if [ "$target" = "voice" ]; then
    echo ""
    echo "  Services démarrés :"
    echo "    voice-server    → :7860  (STT Whisper + TTS Chatterbox)"
    echo ""
  fi

  $COMPOSE --profile "$target" up -d --build
  echo ""
  ok "Profil ${BOLD}${target}${RESET} démarré."
  echo ""
  $COMPOSE ps
}

cmd_stop() {
  local target="$1"
  if [ "$target" = "all" ]; then
    log "Arrêt de tous les services..."
    $COMPOSE down
    ok "Tous les services arrêtés."
  else
    log "Arrêt du profil : ${target}"
    $COMPOSE --profile "$target" stop
    ok "Profil ${target} arrêté."
  fi
}

cmd_restart() {
  local target="$1"
  log "Redémarrage du profil : ${target}"
  $COMPOSE --profile "$target" up -d --build --force-recreate
  ok "Profil ${target} redémarré."
}

cmd_logs() {
  local svc="$1"
  log "Logs en direct - service : ${svc}  (Ctrl+C pour quitter)"
  # Le nom du conteneur suit la convention palabre-<service>
  $COMPOSE logs -f "palabre-${svc}" 2>/dev/null || $COMPOSE logs -f "${svc}"
}

cmd_status() {
  echo ""
  $COMPOSE ps
  echo ""
}

cmd_migrate() {
  log "Lancement des migrations SQL..."
  # Le backend doit être démarré (profil core ou backend seul)
  if ! docker ps --format '{{.Names}}' | grep -q 'palabre-backend'; then
    err "Le conteneur palabre-backend n'est pas en cours d'exécution. Lancez d'abord : ./palabre.sh start core"
  fi
  docker exec palabre-backend node src/db/migrate.js
  ok "Migrations terminées."
}

cmd_shell() {
  local svc="${1:-backend}"
  log "Ouverture d'un shell dans palabre-${svc}..."
  docker exec -it "palabre-${svc}" sh
}

# ── Dispatcher ────────────────────────────────────────────────────────────────
check_docker

case "$ACTION" in
  start)
    [ -z "$TARGET" ] && usage
    check_env
    cmd_start "$TARGET"
    ;;
  stop)
    [ -z "$TARGET" ] && usage
    cmd_stop "$TARGET"
    ;;
  restart)
    [ -z "$TARGET" ] && usage
    check_env
    cmd_restart "$TARGET"
    ;;
  logs)
    [ -z "$TARGET" ] && { warn "Précisez le service : ./palabre.sh logs backend"; exit 1; }
    cmd_logs "$TARGET"
    ;;
  status|ps)
    cmd_status
    ;;
  migrate)
    cmd_migrate
    ;;
  shell)
    cmd_shell "$TARGET"
    ;;
  setup-env)
    check_env
    log "Configuration des .env des services depuis backend/.env..."
    bash "${SCRIPT_DIR}/scripts/setup-env.sh" "${TARGET:-all}"
    ;;  help|--help|-h)
    usage
    ;;
  *)
    err "Action inconnue : ${ACTION}. Lancez ./palabre.sh help pour l'aide."
    ;;
esac
