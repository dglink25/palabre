#!/usr/bin/env bash
# =============================================================================
# setup-env.sh - Initialise les .env de tous les services à partir de backend/.env
#
# Usage :
#   ./scripts/setup-env.sh          # configure tous les services
#   ./scripts/setup-env.sh presence # configure un seul service
#
# Ce script :
#   1. Lit les variables partagées depuis backend/.env
#   2. Génère un .env complet pour chaque service (presence, message-router,
#      file-server, call-signal)
#   3. N'écrase jamais un .env existant - ajoute le suffixe .new si déjà présent
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="${ROOT}/backend/.env"

# ── Couleurs ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RESET='\033[0m'
log()  { echo -e "${BLUE}[setup-env]${RESET} $*"; }
ok()   { echo -e "${GREEN}[setup-env]${RESET} $*"; }
warn() { echo -e "${YELLOW}[setup-env]${RESET} $*"; }

# ── Vérification backend/.env ─────────────────────────────────────────────────
if [ ! -f "$BACKEND_ENV" ]; then
  echo ""
  echo "  ERREUR : backend/.env introuvable."
  echo "  Copiez d'abord le template : cp backend/.env.example backend/.env"
  echo "  Puis configurez les valeurs obligatoires."
  exit 1
fi

# ── Lecture d'une variable depuis backend/.env ────────────────────────────────
get_var() {
  local key="$1"
  local default="${2:-}"
  local val
  val=$(grep -E "^${key}=" "$BACKEND_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r')
  echo "${val:-$default}"
}

# ── Ecriture d'un .env (sans écraser l'existant) ─────────────────────────────
write_env() {
  local dest="$1"
  local content="$2"
  local service
  service=$(basename "$(dirname "$dest")")

  if [ -f "$dest" ] && [ -s "$dest" ]; then
    warn "${service}/.env existe déjà et n'est pas vide → écrit dans ${service}/.env.new"
    dest="${dest}.new"
  fi

  printf '%s\n' "$content" > "$dest"
  ok "${service}/.env généré"
}

# ── Extraction des variables partagées depuis backend/.env ───────────────────
log "Lecture de backend/.env ..."

JWT_ACCESS_SECRET=$(get_var JWT_ACCESS_SECRET "change_me_access_secret")
INTERNAL_SERVICES_SECRET=$(get_var INTERNAL_SERVICES_SECRET "change_me_internal_secret")
ERLANG_COOKIE=$(get_var ERLANG_COOKIE "change_me_erlang_cookie")
PHOENIX_SECRET_KEY_BASE=$(get_var PHOENIX_SECRET_KEY_BASE "change_me_phoenix_secret_key_base_must_be_at_least_64_characters_long")
DATABASE_URL=$(get_var DATABASE_URL "postgres://palabre:palabre@localhost:5433/palabre")
REDIS_URL=$(get_var REDIS_URL "redis://localhost:6380")
PUBLIC_HOST=$(get_var PUBLIC_HOST "localhost")
FILE_SERVER_PUBLIC_URL=$(get_var FILE_SERVER_PUBLIC_URL "http://localhost:4030")
AI_API_KEY=$(get_var AI_API_KEY "change_me_ai_api_key")
LLM_BASE_URL=$(get_var LLM_BASE_URL "https://api.groq.com/openai/v1")
LLM_API_KEY=$(get_var LLM_API_KEY "")
LLM_MODEL=$(get_var LLM_MODEL "llama-3.3-70b-versatile")

TARGET="${1:-all}"

# ── presence ──────────────────────────────────────────────────────────────────
setup_presence() {
  write_env "${ROOT}/services/presence/.env" "# Service Presence - généré par scripts/setup-env.sh depuis backend/.env
# Variables copiées depuis backend/.env - ne pas modifier ici, modifier backend/.env
# puis relancer : ./scripts/setup-env.sh presence

# Port d'écoute HTTP interne (inter-services uniquement)
PRESENCE_HTTP_PORT=4010

# Copié depuis backend/.env (INTERNAL_SERVICES_SECRET)
INTERNAL_SERVICES_SECRET=${INTERNAL_SERVICES_SECRET}

# Cookie Erlang - doit être identique sur tous les noeuds BEAM
# Copié depuis backend/.env (ERLANG_COOKIE)
RELEASE_COOKIE=${ERLANG_COOKIE}
"
}

# ── message-router ────────────────────────────────────────────────────────────
setup_message_router() {
  write_env "${ROOT}/services/message-router/.env" "# Service Message Router - généré par scripts/setup-env.sh depuis backend/.env
# Variables copiées depuis backend/.env - ne pas modifier ici, modifier backend/.env
# puis relancer : ./scripts/setup-env.sh message-router

# Port WebSocket/HTTP
MESSAGE_ROUTER_PORT=4020

# Copié depuis backend/.env
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
INTERNAL_SERVICES_SECRET=${INTERNAL_SERVICES_SECRET}
RELEASE_COOKIE=${ERLANG_COOKIE}
PHOENIX_SECRET_KEY_BASE=${PHOENIX_SECRET_KEY_BASE}

# Hôte public (pour les URLs WebSocket communiquées aux clients)
# Copié depuis backend/.env (PUBLIC_HOST)
PUBLIC_HOST=${PUBLIC_HOST}

# URL du service presence (interne Docker - ne pas changer en dev Docker)
PRESENCE_SERVICE_URL=http://presence:4010
"
}

# ── file-server ───────────────────────────────────────────────────────────────
setup_file_server() {
  write_env "${ROOT}/services/file-server/.env" "# Service File Server - généré par scripts/setup-env.sh depuis backend/.env
# Variables copiées depuis backend/.env - ne pas modifier ici, modifier backend/.env
# puis relancer : ./scripts/setup-env.sh file-server

# Port HTTP
FILE_SERVER_PORT=4030

# Copié depuis backend/.env
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}

# URL publique du file server (communiquée aux clients dans les messages médias)
# Copié depuis backend/.env (FILE_SERVER_PUBLIC_URL)
FILE_SERVER_PUBLIC_URL=${FILE_SERVER_PUBLIC_URL}

# Origines autorisées pour les uploads CORS (séparées par virgule)
# A CONFIGURER MANUELLEMENT - remplacez par l'URL exacte de votre frontend
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4020
"
}

# ── call-signal ───────────────────────────────────────────────────────────────
setup_call_signal() {
  write_env "${ROOT}/services/call-signal/.env" "# Service Call Signal - généré par scripts/setup-env.sh depuis backend/.env
# Variables copiées depuis backend/.env - ne pas modifier ici, modifier backend/.env
# puis relancer : ./scripts/setup-env.sh call-signal

# Port WebSocket/HTTP
CALL_SIGNAL_PORT=4040

# Copié depuis backend/.env
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
INTERNAL_SERVICES_SECRET=${INTERNAL_SERVICES_SECRET}
RELEASE_COOKIE=${ERLANG_COOKIE}
PHOENIX_SECRET_KEY_BASE=${PHOENIX_SECRET_KEY_BASE}
PUBLIC_HOST=${PUBLIC_HOST}

# URLs internes Docker (ne pas changer en dev Docker)
MESSAGE_ROUTER_URL=http://message-router:4020
MEDIASOUP_URL=http://mediasoup:3478
"
}

# ── ai ────────────────────────────────────────────────────────────────────────
setup_ai() {
  # DATABASE_URL adapté pour Docker (postgres interne) vs. hôte local
  # En Docker le service s'appelle "postgres", en hôte local c'est localhost:5433
  local db_url_docker
  db_url_docker=$(echo "$DATABASE_URL" | sed 's|@localhost:|@postgres:|g' | sed 's|@127\.0\.0\.1:|@postgres:|g')

  write_env "${ROOT}/ai/.env" "# Service AI Palabre - généré par scripts/setup-env.sh depuis backend/.env
# Variables copiées depuis backend/.env - ne pas modifier ici, modifier backend/.env
# puis relancer : ./scripts/setup-env.sh ai

# Base de données (pgvector requis - image pgvector/pgvector:pg16)
# Copié depuis backend/.env (DATABASE_URL) avec adaptation pour Docker
DATABASE_URL=${db_url_docker}

# Clé API partagée avec le backend (doit correspondre à AI_API_KEY dans backend/.env)
# Copié depuis backend/.env (AI_API_KEY)
API_KEY=${AI_API_KEY}

# LLM - API compatible OpenAI (Groq, OpenRouter, Mistral...)
# Copié depuis backend/.env
LLM_BASE_URL=${LLM_BASE_URL}
LLM_API_KEY=${LLM_API_KEY}
LLM_MODEL=${LLM_MODEL}

# Embeddings vectoriels (dimension 1024 pour bge-m3)
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIM=1024

# Service voix (STT + TTS) - laisser vide pour mode texte uniquement
VOICE_SERVICE_URL=
VOICE_SERVICE_KEY=

# Table et colonnes de la base de connaissance
KB_TABLE=connaissance_base
KB_ID_COL=id
KB_QUESTION_COL=question
KB_ANSWER_COL=response
KB_TYPE_COL=type

# Paramètres RAG
TOP_K=4
MIN_SIMILARITY=0.40
HISTORY_TURNS=8
KB_SYNC_SECONDS=60
AUTO_APPROVE_VOTES=0

# Chemins de données
DATA_DIR=/data
RECORDINGS_DIR=/recordings
"
}

# ── Dispatcher ────────────────────────────────────────────────────────────────
echo ""
log "Configuration des .env des services..."
echo ""

case "$TARGET" in
  presence)       setup_presence ;;
  message-router) setup_message_router ;;
  file-server)    setup_file_server ;;
  call-signal)    setup_call_signal ;;
  ai)             setup_ai ;;
  all)
    setup_presence
    setup_message_router
    setup_file_server
    setup_call_signal
    setup_ai
    ;;
  *)
    echo "  Usage : $0 [presence|message-router|file-server|call-signal|ai|all]"
    exit 1
    ;;
esac

echo ""
ok "Terminé. Les .env sont dans services/<service>/.env et ai/.env"
echo ""
echo "  Variables copiées automatiquement depuis backend/.env :"
echo "    JWT_ACCESS_SECRET, INTERNAL_SERVICES_SECRET, ERLANG_COOKIE,"
echo "    PHOENIX_SECRET_KEY_BASE, DATABASE_URL, REDIS_URL, PUBLIC_HOST,"
echo "    AI_API_KEY, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL"
echo ""
echo "  Variables à configurer manuellement si nécessaire :"
echo "    file-server : ALLOWED_ORIGINS (URL exacte du frontend)"
echo "    call-signal : MEDIASOUP_URL   (si vous changez de port)"
echo "    ai          : VOICE_SERVICE_URL (si vous activez STT/TTS)"
echo ""
