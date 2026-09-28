#!/usr/bin/env bash
#
# palabre.sh - commande unique, à la racine du projet, pour démarrer,
# arrêter ou reconstruire précisément un module de la plateforme (ou
# l'ensemble). Le fichier d'orchestration vit dans docker/, à côté des
# dossiers backend/, frontend/, ai/, asterisk/, mediasoup/, wireguard/.
#
# Usage :
#   ./palabre.sh start   <module|all>
#   ./palabre.sh stop    <module|all>
#   ./palabre.sh restart <module|all>
#   ./palabre.sh logs    <module>
#   ./palabre.sh status
#
# Modules disponibles : postgres, redis, backend, frontend-web, mediasoup,
#                        asterisk, ai, wireguard
# Groupes disponibles : core (postgres+redis+backend), telephony (mediasoup+asterisk), all
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f ${SCRIPT_DIR}/docker/docker-compose.yml"
ACTION="${1:-}"
TARGET="${2:-}"

usage() {
  echo "Usage : $0 {start|stop|restart|logs|status} <module|core|telephony|all>"
  echo "Modules : postgres, redis, backend, frontend-web, mediasoup, asterisk, ai, wireguard"
  exit 1
}

[ -z "$ACTION" ] && usage

case "$ACTION" in
  start)
    [ -z "$TARGET" ] && usage
    echo "[palabre] démarrage du module : $TARGET"
    $COMPOSE --profile "$TARGET" up -d --build
    ;;
  stop)
    [ -z "$TARGET" ] && usage
    if [ "$TARGET" = "all" ]; then
      echo "[palabre] arrêt de tous les modules"
      $COMPOSE down
    else
      echo "[palabre] arrêt du module : $TARGET"
      $COMPOSE --profile "$TARGET" stop
    fi
    ;;
  restart)
    [ -z "$TARGET" ] && usage
    echo "[palabre] redémarrage du module : $TARGET"
    $COMPOSE --profile "$TARGET" up -d --build --force-recreate
    ;;
  logs)
    [ -z "$TARGET" ] && usage
    $COMPOSE logs -f "palabre-$TARGET"
    ;;
  status)
    $COMPOSE ps
    ;;
  *)
    usage
    ;;
esac
