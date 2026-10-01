
set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; RESET='\033[0m'

log()   { echo -e "${BLUE}[palabre]${RESET} $*"; }
ok()    { echo -e "${GREEN}[ OK ]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET} $*"; }
fail()  { echo -e "${RED}[ERREUR]${RESET} $*" >&2; }
title() { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Codes de sortie ───────────────────────────────────────────────────────────
EXIT_PREREQ_FAILED=1
EXIT_CENTRAL_UNREACHABLE=2
EXIT_UNSUPPORTED_ARCH=3
EXIT_PORTS_BLOCKED=4
EXIT_REGISTRATION_FAILED=5

# ── Valeurs par défaut ────────────────────────────────────────────────────────
CENTRAL_API_URL="${CENTRAL_URL:-https://api.palabre.app}"
PALABRE_DIR="/opt/palabre"
CONF_DIR="/etc/palabre"
KEYS_DIR="${CONF_DIR}/keys"
CONF_FILE="${CONF_DIR}/tenant.conf"
LOG_DIR="/var/log/palabre"
HEADLESS=false
UPDATE_MODE=false
ORG_ID=""
ORG_SLUG=""
CONTROL_TOKEN=""
LOCAL_IP=""    # IP sur le réseau local (192.168.x.x) — pour le DNS local
PUBLIC_IP=""   # IP publique Internet — pour l'enregistrement central
COMPONENTS_VERSION="1.0.0"
BASE_DOMAIN="palabre.com"

# ── Parsing des arguments ─────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --org-id=*)       ORG_ID="${arg#*=}" ;;
    --org-slug=*)     ORG_SLUG="${arg#*=}" ;;
    --control-token=*)CONTROL_TOKEN="${arg#*=}" ;;
    --central-url=*)  CENTRAL_API_URL="${arg#*=}" ;;
    --local-ip=*)     LOCAL_IP="${arg#*=}" ;;
    --public-ip=*)    PUBLIC_IP="${arg#*=}" ;;
    --headless)       HEADLESS=true ;;
    --update)         UPDATE_MODE=true ;;
    *)                warn "Argument inconnu ignoré : $arg" ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 1 — Vérification des prérequis
# ─────────────────────────────────────────────────────────────────────────────
check_prerequisites() {
  title "Vérification des prérequis"

  # Architecture
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64|aarch64|arm64) ok "Architecture : $ARCH" ;;
    *)
      fail "Architecture non supportée : $ARCH. Supportées : x86_64, aarch64/arm64"
      exit $EXIT_UNSUPPORTED_ARCH
      ;;
  esac

  # OS
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    log "Système : $PRETTY_NAME"
    case "$ID" in
      ubuntu|debian) ok "OS supporté : $ID $VERSION_ID" ;;
      *) warn "OS non testé : $ID — continuez à vos risques." ;;
    esac
  fi

  # CPU
  CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0)
  if [ "$CPU_CORES" -lt 4 ]; then
    fail "CPU insuffisant : $CPU_CORES cœur(s) détecté(s), minimum 4 requis."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "CPU : $CPU_CORES cœurs"

  # RAM
  if command -v free &>/dev/null; then
    RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [ "${RAM_GB:-0}" -lt 8 ]; then
      fail "RAM insuffisante : ${RAM_GB:-?} Go détecté(s), minimum 8 Go requis."
      exit $EXIT_PREREQ_FAILED
    fi
    ok "RAM : ${RAM_GB} Go"
  fi

  # Espace disque
  DISK_GB=$(df -BG / | awk 'NR==2{gsub("G",""); print $4}')
  if [ "${DISK_GB:-0}" -lt 50 ]; then
    fail "Espace disque insuffisant : ${DISK_GB:-?} Go disponibles, minimum 50 Go requis."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "Disque : ${DISK_GB} Go disponibles"

  # Docker
  if ! command -v docker &>/dev/null; then
    fail "Docker n'est pas installé. Installez-le avec : curl -fsSL https://get.docker.com | sh"
    exit $EXIT_PREREQ_FAILED
  fi
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  DOCKER_MAJOR=$(echo "$DOCKER_VERSION" | cut -d. -f1)
  if [ "${DOCKER_MAJOR:-0}" -lt 24 ]; then
    fail "Docker $DOCKER_VERSION trop ancien, version ≥ 24 requise."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "Docker : $DOCKER_VERSION"

  if ! docker compose version &>/dev/null 2>&1; then
    fail "docker compose (v2) n'est pas disponible."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "Docker Compose : $(docker compose version --short)"

  check_ports
}

check_ports() {
  local blocked=()
  for port in 443 80; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      blocked+=("${port}/TCP")
    fi
  done
  if ss -ulnp 2>/dev/null | grep -q ":3478 "; then
    blocked+=("3478/UDP")
  fi
  if [ "${#blocked[@]}" -gt 0 ]; then
    fail "Ports déjà utilisés : ${blocked[*]}. Libérez ces ports avant de continuer."
    exit $EXIT_PORTS_BLOCKED
  fi
  ok "Ports requis disponibles (443/TCP, 80/TCP, 3478/UDP)"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 2 — Connectivité vers le serveur central
# ─────────────────────────────────────────────────────────────────────────────
check_central_connectivity() {
  title "Vérification de la connectivité Internet"
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
    "${CENTRAL_API_URL}/health" 2>/dev/null || echo "000")
  if [ "$status" != "200" ]; then
    fail "Serveur central inaccessible (HTTP $status) — $CENTRAL_API_URL"
    exit $EXIT_CENTRAL_UNREACHABLE
  fi
  ok "Serveur central joignable"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 3 — Collecte des informations
# ─────────────────────────────────────────────────────────────────────────────
collect_config() {
  title "Configuration"

  if [ "$HEADLESS" = false ]; then
    if [ -z "$ORG_ID" ]; then
      read -rp "  Identifiant de l'organisation (ORG_ID) : " ORG_ID
    fi
    if [ -z "$CONTROL_TOKEN" ]; then
      read -rsp "  Token de contrôle (CONTROL_TOKEN) : " CONTROL_TOKEN
      echo
    fi
    if [ -z "$ORG_SLUG" ]; then
      read -rp "  Sous-domaine souhaité, ex: acme (→ acme.palabre.com) : " ORG_SLUG
    fi
  fi

  [ -z "$ORG_ID" ]        && { fail "ORG_ID obligatoire.";        exit $EXIT_PREREQ_FAILED; }
  [ -z "$CONTROL_TOKEN" ] && { fail "CONTROL_TOKEN obligatoire."; exit $EXIT_PREREQ_FAILED; }
  [ -z "$ORG_SLUG" ]      && { fail "Le sous-domaine (org-slug) est obligatoire."; exit $EXIT_PREREQ_FAILED; }

  # ── Détecter l'IP LOCALE du serveur sur le réseau interne ─────────────────
  # C'est cette IP que le DNS local annoncera aux appareils du réseau.
  if [ -z "$LOCAL_IP" ]; then
    # Prendre la première IP non-loopback sur une interface LAN
    LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1 || \
               hostname -I | awk '{print $1}')
    log "IP locale détectée automatiquement : $LOCAL_IP"
    if [ "$HEADLESS" = false ]; then
      read -rp "  IP locale du serveur sur le réseau interne [${LOCAL_IP}] : " input_ip
      LOCAL_IP="${input_ip:-$LOCAL_IP}"
    fi
  fi

  # ── Détecter l'IP PUBLIQUE (pour le relais central) ───────────────────────
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -sS --max-time 5 https://api.ipify.org 2>/dev/null || \
                curl -sS --max-time 5 https://ifconfig.me 2>/dev/null || \
                echo "$LOCAL_IP")
    log "IP publique détectée : $PUBLIC_IP"
  fi

  TENANT_FQDN="${ORG_SLUG}.${BASE_DOMAIN}"
  ok "Sous-domaine     : $TENANT_FQDN"
  ok "IP locale (LAN)  : $LOCAL_IP  ← annoncée par le DNS local"
  ok "IP publique      : $PUBLIC_IP ← enregistrée sur le serveur central"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 4 — Génération des clés tenant
# ─────────────────────────────────────────────────────────────────────────────
generate_keys() {
  title "Génération des clés tenant"
  sudo mkdir -p "$KEYS_DIR"
  sudo chmod 700 "$CONF_DIR"

  if [ ! -f "${KEYS_DIR}/tenant.key" ]; then
    openssl genpkey -algorithm ed25519 -out "${KEYS_DIR}/tenant.key" 2>/dev/null || \
    openssl genrsa -out "${KEYS_DIR}/tenant.key" 2048 2>/dev/null
    sudo chmod 600 "${KEYS_DIR}/tenant.key"
    openssl pkey -in "${KEYS_DIR}/tenant.key" -pubout -out "${KEYS_DIR}/tenant.pub" 2>/dev/null || \
    openssl rsa  -in "${KEYS_DIR}/tenant.key" -pubout -out "${KEYS_DIR}/tenant.pub" 2>/dev/null
    ok "Paire de clés générée dans ${KEYS_DIR}/"
  else
    ok "Clés existantes conservées"
  fi
  PUBLIC_KEY=$(cat "${KEYS_DIR}/tenant.pub")
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 5 — Enregistrement auprès du serveur central
# Le Central_Server enregistre le sous-domaine dans son DNS public
# et connaît l'IP publique pour le routage du tunnel.
# ─────────────────────────────────────────────────────────────────────────────
register_with_central() {
  title "Enregistrement auprès du serveur central"
  log "Le serveur central va enregistrer $TENANT_FQDN pour le tunnel de relais."

  local payload
  payload=$(printf '{"orgId":"%s","orgSlug":"%s","publicKey":"%s","ipAddress":"%s","localIp":"%s","componentsVersion":"%s","controlToken":"%s"}' \
    "$ORG_ID" "$ORG_SLUG" \
    "$(echo "$PUBLIC_KEY" | tr -d '\n')" \
    "$PUBLIC_IP" "$LOCAL_IP" \
    "$COMPONENTS_VERSION" "$CONTROL_TOKEN")

  local attempt=1 max_attempts=3 http_code response_body

  while [ $attempt -le $max_attempts ]; do
    log "Tentative $attempt/$max_attempts..."
    local response
    response=$(curl -sS -w "\n%{http_code}" -X POST \
      -H "Content-Type: application/json" -d "$payload" \
      --max-time 30 "${CENTRAL_API_URL}/api/v1/tenants/register" 2>/dev/null || echo -e "\n000")

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      TENANT_SUBDOMAIN=$(echo "$response_body" | grep -o '"tenantSubdomain":"[^"]*"' | cut -d'"' -f4 || echo "$TENANT_FQDN")
      REGISTRATION_TOKEN=$(echo "$response_body" | grep -o '"registrationToken":"[^"]*"' | cut -d'"' -f4 || echo "")
      ok "Tenant enregistré sur le serveur central : $TENANT_SUBDOMAIN"
      return 0
    fi

    warn "Tentative $attempt échouée (HTTP $http_code). Nouvelle tentative dans 30s..."
    attempt=$((attempt + 1))
    [ $attempt -le $max_attempts ] && sleep 30
  done

  fail "Enregistrement central échoué après $max_attempts tentatives."
  write_conf_file_partial
  exit $EXIT_REGISTRATION_FAILED
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 6 — Configuration DNS LOCAL avec dnsmasq
#
# dnsmasq est un serveur DNS léger installé sur le Tenant_Server.
# Il résout {org}.palabre.com → IP LOCALE du serveur.
# Les appareils du réseau local doivent pointer leur DNS vers ce serveur
# (ou l'administrateur réseau configure le DHCP pour distribuer cette IP DNS).
#
# Pourquoi DNS local et non public ?
#   Le Tenant_Server est sur un réseau interne. Son IP locale (192.168.x.x)
#   n'est pas accessible depuis Internet. Le DNS local permet aux appareils
#   du réseau interne d'atteindre le serveur par son nom sans taper d'IP.
#   Le DNS public (sur le Central_Server) pointe vers l'IP publique pour
#   permettre au tunnel de relais de fonctionner.
# ─────────────────────────────────────────────────────────────────────────────
configure_local_dns() {
  title "Configuration du DNS local (dnsmasq)"

  log "Installation de dnsmasq..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y dnsmasq 2>&1 | tail -3
  elif command -v yum &>/dev/null; then
    sudo yum install -y dnsmasq 2>&1 | tail -3
  elif command -v apk &>/dev/null; then
    sudo apk add --no-cache dnsmasq 2>&1 | tail -3
  else
    warn "Gestionnaire de paquets non reconnu — dnsmasq non installé automatiquement."
    warn "Installez manuellement dnsmasq et ajoutez la ligne :"
    warn "  address=/${TENANT_FQDN}/${LOCAL_IP}"
    return
  fi

  # Créer la configuration dnsmasq pour Palabre
  local DNSMASQ_CONF="/etc/dnsmasq.d/palabre.conf"
  sudo tee "$DNSMASQ_CONF" > /dev/null <<EOF
# Palabre — DNS local
# Résout ${TENANT_FQDN} → ${LOCAL_IP} (IP locale du Tenant_Server)
# Généré automatiquement par install.sh le $(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# Les appareils du réseau local doivent utiliser l'IP ${LOCAL_IP} comme
# serveur DNS pour bénéficier de cette résolution automatique.
# Communiquez cette information à votre administrateur réseau ou configurez
# le DHCP pour distribuer ${LOCAL_IP} comme serveur DNS primaire.

# Résolution directe du sous-domaine vers l'IP locale
address=/${TENANT_FQDN}/${LOCAL_IP}

# Wildcard : tous les sous-sous-domaines pointent aussi vers le serveur
address=/.${TENANT_FQDN}/${LOCAL_IP}

# Serveur DNS upstream pour les autres noms (utilise les DNS publics)
server=8.8.8.8
server=1.1.1.1

# Interfaces d'écoute
listen-address=127.0.0.1,${LOCAL_IP}
bind-interfaces

# Pas de résolution via /etc/hosts pour ce nom
no-hosts
EOF

  # Désactiver systemd-resolved si nécessaire (conflit sur le port 53)
  if systemctl is-active --quiet systemd-resolved 2>/dev/null; then
    log "Désactivation de systemd-resolved (conflit port 53)..."
    sudo systemctl stop systemd-resolved
    sudo systemctl disable systemd-resolved
    # Remplacer /etc/resolv.conf par une version statique
    sudo tee /etc/resolv.conf > /dev/null <<EOF
nameserver 127.0.0.1
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF
  fi

  # Activer et démarrer dnsmasq
  sudo systemctl enable dnsmasq 2>/dev/null || true
  sudo systemctl restart dnsmasq 2>/dev/null || sudo service dnsmasq restart 2>/dev/null || true

  # Vérifier que dnsmasq résout correctement
  sleep 2
  if command -v dig &>/dev/null; then
    RESOLVED=$(dig +short "@${LOCAL_IP}" "${TENANT_FQDN}" 2>/dev/null || echo "")
    if [ "$RESOLVED" = "$LOCAL_IP" ]; then
      ok "DNS local opérationnel : ${TENANT_FQDN} → ${LOCAL_IP}"
    else
      warn "DNS local démarré mais résolution non vérifiée (dig retourne: '${RESOLVED}')"
      warn "Testez manuellement : dig @${LOCAL_IP} ${TENANT_FQDN}"
    fi
  elif command -v nslookup &>/dev/null; then
    RESOLVED=$(nslookup "${TENANT_FQDN}" "${LOCAL_IP}" 2>/dev/null | grep 'Address:' | tail -1 | awk '{print $2}' || echo "")
    [ "$RESOLVED" = "$LOCAL_IP" ] && ok "DNS local opérationnel : ${TENANT_FQDN} → ${LOCAL_IP}" || \
      warn "DNS local démarré — vérifiez manuellement la résolution."
  else
    ok "dnsmasq configuré. Vérifiez : nslookup ${TENANT_FQDN} ${LOCAL_IP}"
  fi

  echo ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "  ACTION REQUISE pour l'administrateur réseau :"
  log ""
  log "  Configurez le serveur DHCP de votre réseau pour distribuer"
  log "  l'adresse ${LOCAL_IP} comme serveur DNS primaire."
  log ""
  log "  Ou demandez à vos utilisateurs de configurer manuellement :"
  log "    DNS primaire : ${LOCAL_IP}"
  log ""
  log "  Une fois fait, tous les appareils du réseau résoudront"
  log "  automatiquement ${TENANT_FQDN} → ${LOCAL_IP}"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 7 — Écriture de la configuration
# ─────────────────────────────────────────────────────────────────────────────
write_conf_file() {
  title "Écriture de la configuration"
  sudo mkdir -p "$CONF_DIR"
  sudo tee "$CONF_FILE" > /dev/null <<EOF
# /etc/palabre/tenant.conf — NE PAS MODIFIER MANUELLEMENT
# Généré le $(date -u +"%Y-%m-%dT%H:%M:%SZ")
TENANT_SUBDOMAIN=${TENANT_FQDN}
TENANT_ORG_ID=${ORG_ID}
TENANT_LOCAL_IP=${LOCAL_IP}
TENANT_PUBLIC_IP=${PUBLIC_IP}
CENTRAL_SERVER_URL=${CENTRAL_API_URL}
CENTRAL_TUNNEL_URL=${CENTRAL_API_URL/https:/wss:}/tunnel/socket
TENANT_PUBLIC_KEY_PATH=${KEYS_DIR}/tenant.pub
TENANT_PRIVATE_KEY_PATH=${KEYS_DIR}/tenant.key
REGISTRATION_TOKEN=${REGISTRATION_TOKEN:-}
COMPONENTS_VERSION=${COMPONENTS_VERSION}
INSTALLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
  sudo chmod 600 "$CONF_FILE"
  ok "Configuration écrite dans $CONF_FILE"
}

write_conf_file_partial() {
  sudo mkdir -p "$CONF_DIR"
  sudo tee "$CONF_FILE" > /dev/null <<EOF
# /etc/palabre/tenant.conf — Enregistrement partiel
TENANT_ORG_ID=${ORG_ID}
TENANT_LOCAL_IP=${LOCAL_IP:-}
CENTRAL_SERVER_URL=${CENTRAL_API_URL}
COMPONENTS_VERSION=${COMPONENTS_VERSION}
INSTALLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
  sudo chmod 600 "$CONF_FILE"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 8 — Déploiement des services Docker
# ─────────────────────────────────────────────────────────────────────────────
deploy_services() {
  title "Déploiement des services"
  sudo mkdir -p "$PALABRE_DIR" "$LOG_DIR"

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
  if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
    sudo cp "${SCRIPT_DIR}/docker-compose.yml" "${PALABRE_DIR}/docker-compose.yml"
  else
    log "Téléchargement du docker-compose..."
    sudo curl -sSL "${CENTRAL_API_URL}/tenant/docker-compose.yml" \
      -o "${PALABRE_DIR}/docker-compose.yml"
  fi

  generate_env_file

  log "Démarrage des services (cela peut prendre quelques minutes)..."
  sudo docker compose --env-file "${PALABRE_DIR}/.env" \
    -f "${PALABRE_DIR}/docker-compose.yml" up -d --pull always 2>&1 | \
    while IFS= read -r line; do log "$line"; done

  ok "Services démarrés"
}

generate_env_file() {
  local DB_PASS; DB_PASS=$(openssl rand -hex 16)
  local INT_SEC; INT_SEC=$(openssl rand -hex 32)
  local ERLANG;  ERLANG=$(openssl rand -hex 32)
  local PHOENIX; PHOENIX=$(openssl rand -hex 64)
  local TURN_S;  TURN_S=$(openssl rand -hex 32)
  local JWT_A;   JWT_A=$(openssl rand -hex 32)
  local JWT_R;   JWT_R=$(openssl rand -hex 32)

  sudo tee "${PALABRE_DIR}/.env" > /dev/null <<EOF
# Généré automatiquement — ne pas modifier manuellement
ORG_ID=${ORG_ID}
ORG_NAME=${ORG_SLUG}
CONTROL_TOKEN=${CONTROL_TOKEN}
TENANT_SUBDOMAIN=${TENANT_FQDN}
# IP locale : utilisée par le DNS local et les services internes
TENANT_LOCAL_IP=${LOCAL_IP}
# IP publique : utilisée uniquement par le tunnel de relais
TENANT_PUBLIC_IP=${PUBLIC_IP}
CENTRAL_API_URL=${CENTRAL_API_URL}
CENTRAL_WS_URL=${CENTRAL_API_URL/https:/wss:}
POSTGRES_USER=palabre
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=palabre_tenant
DATABASE_URL=postgres://palabre:${DB_PASS}@postgres:5432/palabre_tenant
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=${JWT_A}
JWT_REFRESH_SECRET=${JWT_R}
INTERNAL_SERVICES_SECRET=${INT_SEC}
ERLANG_COOKIE=${ERLANG}
PHOENIX_SECRET_KEY_BASE=${PHOENIX}
TURN_SECRET=${TURN_S}
TURN_REALM=${TENANT_FQDN}
TURN_EXTERNAL_IP=${LOCAL_IP}
AGENT_PORT=8080
HEARTBEAT_INTERVAL_MS=30000
# L'URL publique de l'agent utilise le FQDN local — accessible via DNS local
AGENT_PUBLIC_URL=https://${TENANT_FQDN}
PUBLIC_HOST=${TENANT_FQDN}
FILE_SERVER_PUBLIC_URL=https://${TENANT_FQDN}/files
MESSAGE_ROUTER_PUBLIC_URL=wss://${TENANT_FQDN}/ws
LOCAL_MESSAGE_ROUTER_URL=http://message-router:4020
LOCAL_CALL_SIGNAL_URL=http://call-signal:4040
PRESENCE_SERVICE_URL=http://presence:4010
EOF
  sudo chmod 600 "${PALABRE_DIR}/.env"
  ok ".env généré"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 9 — Vérification de santé
# ─────────────────────────────────────────────────────────────────────────────
verify_health() {
  title "Vérification de la santé des composants"
  log "Attente du démarrage des services (60s max)..."

  local elapsed=0
  while [ $elapsed -lt 60 ]; do
    sleep 5; elapsed=$((elapsed + 5))
    if curl -sS --max-time 3 "http://localhost:8080/health" &>/dev/null; then
      ok "Agent opérationnel (${elapsed}s)"
      curl -sS "http://localhost:8080/health" | python3 -m json.tool 2>/dev/null || true
      return
    fi
    log "Attente... (${elapsed}s)"
  done
  warn "L'agent n'a pas démarré dans les 60s. Vérifiez : docker logs palabre-tenant-agent"
}

# ─────────────────────────────────────────────────────────────────────────────
# RÉSUMÉ FINAL
# ─────────────────────────────────────────────────────────────────────────────
print_summary() {
  title "Installation terminée"

  echo -e "${BOLD}  Votre service tenant Palabre est opérationnel.${RESET}"
  echo ""
  echo "  Organisation    : ${ORG_ID}"
  echo "  Sous-domaine    : ${TENANT_FQDN}"
  echo "  IP locale (LAN) : ${LOCAL_IP}"
  echo "  IP publique     : ${PUBLIC_IP}"
  echo ""
  echo -e "${BOLD}${CYAN}  ┌─────────────────────────────────────────────────────┐${RESET}"
  echo -e "${BOLD}${CYAN}  │  URL à partager avec vos collaborateurs :           │${RESET}"
  echo -e "${BOLD}${CYAN}  │  https://${TENANT_FQDN}$(printf '%*s' $((49 - ${#TENANT_FQDN})) '')│${RESET}"
  echo -e "${BOLD}${CYAN}  └─────────────────────────────────────────────────────┘${RESET}"
  echo ""
  echo "  DNS local configuré sur ce serveur :"
  echo "    ${TENANT_FQDN} → ${LOCAL_IP} (réseau local)"
  echo ""
  echo "  Pour que vos appareils résolvent automatiquement ce nom :"
  echo "    Configurez votre DHCP/routeur pour distribuer ${LOCAL_IP}"
  echo "    comme serveur DNS primaire sur votre réseau."
  echo ""
  echo "  Commandes utiles :"
  echo "    Statut  : curl http://localhost:8080/health"
  echo "    Logs    : sudo docker compose -f ${PALABRE_DIR}/docker-compose.yml logs -f"
  echo "    DNS     : dig @${LOCAL_IP} ${TENANT_FQDN}"
  echo ""
  if [ -n "${REGISTRATION_TOKEN:-}" ]; then
    warn "Token d'enregistrement (conserver en lieu sûr, affiché une seule fois) :"
    echo -e "${BOLD}  REGISTRATION_TOKEN=${REGISTRATION_TOKEN}${RESET}"
    echo ""
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# POINT D'ENTRÉE
# ─────────────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}║     PALABRE — Installation du service tenant local   ║${RESET}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════╝${RESET}"
  echo ""

  if [ -f "$CONF_FILE" ] && [ "$UPDATE_MODE" = false ]; then
    warn "Une installation existe déjà ($CONF_FILE)."
    if [ "$HEADLESS" = false ]; then
      read -rp "  Voulez-vous mettre à jour ? [o/N] : " answer
      [[ "$answer" =~ ^[oOyY]$ ]] || { log "Installation annulée."; exit 0; }
    fi
    UPDATE_MODE=true
  fi

  check_prerequisites
  check_central_connectivity
  collect_config
  generate_keys
  register_with_central     # Enregistre l'IP publique sur le serveur central (pour le tunnel)
  configure_local_dns       # Configure dnsmasq : {org}.palabre.com → IP locale
  write_conf_file
  deploy_services
  verify_health
  print_summary
}

main "$@"
# =============================================================================
# PALABRE — Script d'installation du service tenant local
# =============================================================================
# Usage :
#   curl -sSL https://install.palabre.com | bash -s -- \
#       --org-id=UUID --control-token=TOKEN --org-slug=monorg
#
# Options :
#   --org-id=UUID          Identifiant UUID de l'organisation (obligatoire)
#   --org-slug=SLUG        Slug souhaité pour le sous-domaine (optionnel)
#   --control-token=TOKEN  Token de contrôle fourni lors de l'approbation (obligatoire)
#   --central-url=URL      URL du serveur central [https://api.palabre.app]
#   --public-ip=IP         IP publique de ce serveur (auto-détectée si absent)
#   --headless             Mode non-interactif (variables depuis env)
#   --update               Mettre à jour une installation existante
# =============================================================================

set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; RESET='\033[0m'

log()   { echo -e "${BLUE}[palabre]${RESET} $*"; }
ok()    { echo -e "${GREEN}[ OK ]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET} $*"; }
fail()  { echo -e "${RED}[ERREUR]${RESET} $*" >&2; }
title() { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Codes de sortie ───────────────────────────────────────────────────────────
EXIT_PREREQ_FAILED=1
EXIT_CENTRAL_UNREACHABLE=2
EXIT_UNSUPPORTED_ARCH=3
EXIT_PORTS_BLOCKED=4
EXIT_REGISTRATION_FAILED=5

# ── Valeurs par défaut ────────────────────────────────────────────────────────
CENTRAL_API_URL="${CENTRAL_URL:-https://api.palabre.app}"
PALABRE_DIR="/opt/palabre"
CONF_DIR="/etc/palabre"
KEYS_DIR="${CONF_DIR}/keys"
CONF_FILE="${CONF_DIR}/tenant.conf"
LOG_DIR="/var/log/palabre"
HEADLESS=false
UPDATE_MODE=false
ORG_ID=""
ORG_SLUG=""
CONTROL_TOKEN=""
PUBLIC_IP=""
COMPONENTS_VERSION="1.0.0"

# ── Parsing des arguments ─────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --org-id=*)       ORG_ID="${arg#*=}" ;;
    --org-slug=*)     ORG_SLUG="${arg#*=}" ;;
    --control-token=*)CONTROL_TOKEN="${arg#*=}" ;;
    --central-url=*)  CENTRAL_API_URL="${arg#*=}" ;;
    --public-ip=*)    PUBLIC_IP="${arg#*=}" ;;
    --headless)       HEADLESS=true ;;
    --update)         UPDATE_MODE=true ;;
    *)                warn "Argument inconnu ignoré : $arg" ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 1 — Vérification des prérequis
# ─────────────────────────────────────────────────────────────────────────────
check_prerequisites() {
  title "Vérification des prérequis"

  # Architecture
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64|aarch64|arm64) ok "Architecture : $ARCH" ;;
    *)
      fail "Architecture non supportée : $ARCH. Supportées : x86_64, aarch64/arm64"
      exit $EXIT_UNSUPPORTED_ARCH
      ;;
  esac

  # OS
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    log "Système : $PRETTY_NAME"
    case "$ID" in
      ubuntu|debian) ok "OS supporté : $ID $VERSION_ID" ;;
      *) warn "OS non testé : $ID — continuez à vos risques." ;;
    esac
  fi

  # CPU
  CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0)
  if [ "$CPU_CORES" -lt 4 ]; then
    fail "CPU insuffisant : $CPU_CORES cœur(s) détecté(s), minimum 4 requis."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "CPU : $CPU_CORES cœurs"

  # RAM
  if command -v free &>/dev/null; then
    RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [ "${RAM_GB:-0}" -lt 8 ]; then
      fail "RAM insuffisante : ${RAM_GB:-?} Go détecté(s), minimum 8 Go requis."
      exit $EXIT_PREREQ_FAILED
    fi
    ok "RAM : ${RAM_GB} Go"
  fi

  # Espace disque
  DISK_GB=$(df -BG "$PALABRE_DIR" 2>/dev/null | awk 'NR==2{gsub("G",""); print $4}' || df -BG / | awk 'NR==2{gsub("G",""); print $4}')
  if [ "${DISK_GB:-0}" -lt 50 ]; then
    fail "Espace disque insuffisant : ${DISK_GB:-?} Go disponibles, minimum 50 Go requis."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "Disque : ${DISK_GB} Go disponibles"

  # Docker
  if ! command -v docker &>/dev/null; then
    fail "Docker n'est pas installé. Installez-le avec : curl -fsSL https://get.docker.com | sh"
    exit $EXIT_PREREQ_FAILED
  fi
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  DOCKER_MAJOR=$(echo "$DOCKER_VERSION" | cut -d. -f1)
  if [ "${DOCKER_MAJOR:-0}" -lt 24 ]; then
    fail "Docker $DOCKER_VERSION trop ancien, version ≥ 24 requise. Mettez Docker à jour."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "Docker : $DOCKER_VERSION"

  # Docker Compose
  if ! docker compose version &>/dev/null 2>&1; then
    fail "docker compose (v2) n'est pas disponible. Mettez Docker à jour."
    exit $EXIT_PREREQ_FAILED
  fi
  ok "Docker Compose : $(docker compose version --short)"

  # Vérification des ports
  check_ports
}

check_ports() {
  local blocked=()

  # Ports TCP
  for port in 443 80; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
      blocked+=("${port}/TCP")
    fi
  done

  # Port UDP TURN
  if ss -ulnp 2>/dev/null | grep -q ":3478 "; then
    blocked+=("3478/UDP")
  fi

  if [ "${#blocked[@]}" -gt 0 ]; then
    fail "Ports déjà utilisés : ${blocked[*]}"
    fail "Libérez ces ports avant de continuer."
    exit $EXIT_PORTS_BLOCKED
  fi
  ok "Ports requis disponibles (443/TCP, 80/TCP, 3478/UDP)"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 2 — Connectivité vers le serveur central
# ─────────────────────────────────────────────────────────────────────────────
check_central_connectivity() {
  title "Vérification de la connectivité vers le serveur central"
  log "Test de connexion vers $CENTRAL_API_URL..."

  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    --max-time 10 \
    "${CENTRAL_API_URL}/health" 2>/dev/null || echo "000")

  if [ "$status" != "200" ]; then
    fail "Serveur central inaccessible (HTTP $status)."
    fail "Vérifiez la connectivité Internet vers $CENTRAL_API_URL"
    exit $EXIT_CENTRAL_UNREACHABLE
  fi
  ok "Serveur central joignable ($CENTRAL_API_URL)"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 3 — Collecte des informations
# ─────────────────────────────────────────────────────────────────────────────
collect_config() {
  title "Configuration"

  if [ "$HEADLESS" = false ]; then
    if [ -z "$ORG_ID" ]; then
      read -rp "  Identifiant de l'organisation (ORG_ID) : " ORG_ID
    fi
    if [ -z "$CONTROL_TOKEN" ]; then
      read -rsp "  Token de contrôle (CONTROL_TOKEN) : " CONTROL_TOKEN
      echo
    fi
    if [ -z "$ORG_SLUG" ]; then
      read -rp "  Sous-domaine souhaité (ex: monorg) [optionnel] : " ORG_SLUG
    fi
  fi

  [ -z "$ORG_ID" ]        && { fail "ORG_ID obligatoire.";        exit $EXIT_PREREQ_FAILED; }
  [ -z "$CONTROL_TOKEN" ] && { fail "CONTROL_TOKEN obligatoire."; exit $EXIT_PREREQ_FAILED; }

  # Auto-détecter l'IP publique si non fournie
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -sS --max-time 5 https://api.ipify.org 2>/dev/null || \
                curl -sS --max-time 5 https://ifconfig.me 2>/dev/null || \
                hostname -I | awk '{print $1}')
    log "IP publique détectée : $PUBLIC_IP"
  fi

  ok "Organisation : $ORG_ID"
  ok "IP publique  : $PUBLIC_IP"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 4 — Génération des clés tenant
# ─────────────────────────────────────────────────────────────────────────────
generate_keys() {
  title "Génération des clés tenant"

  sudo mkdir -p "$KEYS_DIR"
  sudo chmod 700 "$CONF_DIR"

  if [ ! -f "${KEYS_DIR}/tenant.key" ]; then
    # Générer une paire de clés Ed25519
    openssl genpkey -algorithm ed25519 \
      -out "${KEYS_DIR}/tenant.key" 2>/dev/null || \
    openssl genrsa -out "${KEYS_DIR}/tenant.key" 2048 2>/dev/null
    sudo chmod 600 "${KEYS_DIR}/tenant.key"

    openssl pkey -in "${KEYS_DIR}/tenant.key" -pubout \
      -out "${KEYS_DIR}/tenant.pub" 2>/dev/null || \
    openssl rsa -in "${KEYS_DIR}/tenant.key" -pubout \
      -out "${KEYS_DIR}/tenant.pub" 2>/dev/null

    ok "Paire de clés générée dans ${KEYS_DIR}/"
  else
    ok "Clés existantes conservées : ${KEYS_DIR}/"
  fi

  PUBLIC_KEY=$(cat "${KEYS_DIR}/tenant.pub")
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 5 — Enregistrement auprès du serveur central (avec retry)
# ─────────────────────────────────────────────────────────────────────────────
register_with_central() {
  title "Enregistrement auprès du serveur central"

  local payload
  payload=$(printf '{"orgId":"%s","orgSlug":"%s","publicKey":"%s","ipAddress":"%s","componentsVersion":"%s","controlToken":"%s"}' \
    "$ORG_ID" \
    "${ORG_SLUG:-}" \
    "$(echo "$PUBLIC_KEY" | tr -d '\n')" \
    "$PUBLIC_IP" \
    "$COMPONENTS_VERSION" \
    "$CONTROL_TOKEN")

  local response http_code
  local attempt=1 max_attempts=3

  while [ $attempt -le $max_attempts ]; do
    log "Tentative $attempt/$max_attempts..."

    response=$(curl -sS -w "\n%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$payload" \
      --max-time 30 \
      "${CENTRAL_API_URL}/api/v1/tenants/register" 2>/dev/null || echo -e "\n000")

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      TENANT_SUBDOMAIN=$(echo "$response_body" | grep -o '"tenantSubdomain":"[^"]*"' | cut -d'"' -f4)
      REGISTRATION_TOKEN=$(echo "$response_body" | grep -o '"registrationToken":"[^"]*"' | cut -d'"' -f4 || echo "")
      TUNNEL_SOCKET_URL=$(echo "$response_body" | grep -o '"tunnelSocketUrl":"[^"]*"' | cut -d'"' -f4 || echo "")
      ok "Tenant enregistré : $TENANT_SUBDOMAIN"
      return 0
    fi

    warn "Tentative $attempt échouée (HTTP $http_code). Nouvelle tentative dans 30s..."
    attempt=$((attempt + 1))
    [ $attempt -le $max_attempts ] && sleep 30
  done

  fail "Enregistrement échoué après $max_attempts tentatives."
  fail "Vérifiez le token de contrôle et réessayez avec : sudo palabre-register"
  # Sauvegarder la configuration locale pour permettre une re-tentative manuelle
  write_conf_file_partial
  exit $EXIT_REGISTRATION_FAILED
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 6 — Écriture de la configuration
# ─────────────────────────────────────────────────────────────────────────────
write_conf_file() {
  title "Écriture de la configuration"
  sudo mkdir -p "$CONF_DIR"

  sudo tee "$CONF_FILE" > /dev/null <<EOF
# /etc/palabre/tenant.conf — NE PAS MODIFIER MANUELLEMENT
# Généré le $(date -u +"%Y-%m-%dT%H:%M:%SZ")
TENANT_SUBDOMAIN=${TENANT_SUBDOMAIN}
TENANT_ORG_ID=${ORG_ID}
CENTRAL_SERVER_URL=${CENTRAL_API_URL}
CENTRAL_TUNNEL_URL=$(echo "${TUNNEL_SOCKET_URL:-${CENTRAL_API_URL/https:/wss:}/tunnel/socket}")
TENANT_PUBLIC_KEY_PATH=${KEYS_DIR}/tenant.pub
TENANT_PRIVATE_KEY_PATH=${KEYS_DIR}/tenant.key
REGISTRATION_TOKEN=${REGISTRATION_TOKEN:-}
COMPONENTS_VERSION=${COMPONENTS_VERSION}
INSTALLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

  sudo chmod 600 "$CONF_FILE"
  ok "Configuration écrite dans $CONF_FILE"
}

write_conf_file_partial() {
  sudo mkdir -p "$CONF_DIR"
  sudo tee "$CONF_FILE" > /dev/null <<EOF
# /etc/palabre/tenant.conf — Enregistrement partiel (re-tentative requise)
TENANT_ORG_ID=${ORG_ID}
CENTRAL_SERVER_URL=${CENTRAL_API_URL}
TENANT_PUBLIC_KEY_PATH=${KEYS_DIR}/tenant.pub
TENANT_PRIVATE_KEY_PATH=${KEYS_DIR}/tenant.key
COMPONENTS_VERSION=${COMPONENTS_VERSION}
INSTALLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
  sudo chmod 600 "$CONF_FILE"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 7 — Déploiement des services Docker
# ─────────────────────────────────────────────────────────────────────────────
deploy_services() {
  title "Déploiement des services"

  # Créer les répertoires
  sudo mkdir -p "$PALABRE_DIR" "$LOG_DIR"
  cd "$PALABRE_DIR"

  # Copier ou télécharger le docker-compose
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
  if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
    sudo cp "${SCRIPT_DIR}/docker-compose.yml" "${PALABRE_DIR}/docker-compose.yml"
  else
    log "Téléchargement de docker-compose.yml depuis le serveur central..."
    sudo curl -sSL "${CENTRAL_API_URL}/tenant/docker-compose.yml" \
      -o "${PALABRE_DIR}/docker-compose.yml"
  fi

  # Générer le .env à partir de tenant.conf + secrets
  generate_env_file

  # Pull des images + démarrage
  log "Démarrage des services (cela peut prendre quelques minutes)..."
  sudo docker compose --env-file "${PALABRE_DIR}/.env" up -d --pull always 2>&1 | \
    while IFS= read -r line; do log "$line"; done

  ok "Services démarrés"
}

generate_env_file() {
  # Charger tenant.conf
  # shellcheck disable=SC1090
  [ -f "$CONF_FILE" ] && source <(sudo cat "$CONF_FILE" | grep -v '^#')

  # Générer les secrets locaux
  local DB_PASS; DB_PASS=$(openssl rand -hex 16)
  local INT_SEC; INT_SEC=$(openssl rand -hex 32)
  local ERLANG;  ERLANG=$(openssl rand -hex 32)
  local PHOENIX; PHOENIX=$(openssl rand -hex 64)
  local TURN_S;  TURN_S=$(openssl rand -hex 32)
  local JWT_A;   JWT_A=$(openssl rand -hex 32)
  local JWT_R;   JWT_R=$(openssl rand -hex 32)

  sudo tee "${PALABRE_DIR}/.env" > /dev/null <<EOF
# Generé automatiquement — ne pas modifier manuellement
ORG_ID=${ORG_ID}
ORG_NAME=${ORG_SLUG:-Palabre Tenant}
CONTROL_TOKEN=${CONTROL_TOKEN}
CENTRAL_API_URL=${CENTRAL_API_URL}
CENTRAL_WS_URL=$(echo "${CENTRAL_API_URL}" | sed 's|https://|wss://|;s|http://|ws://|')
POSTGRES_USER=palabre
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=palabre_tenant
DATABASE_URL=postgres://palabre:${DB_PASS}@postgres:5432/palabre_tenant
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=${JWT_A}
JWT_REFRESH_SECRET=${JWT_R}
INTERNAL_SERVICES_SECRET=${INT_SEC}
ERLANG_COOKIE=${ERLANG}
PHOENIX_SECRET_KEY_BASE=${PHOENIX}
TURN_SECRET=${TURN_S}
TURN_REALM=${TENANT_SUBDOMAIN:-local.palabre.app}
AGENT_PORT=8080
HEARTBEAT_INTERVAL_MS=30000
AGENT_PUBLIC_URL=https://${TENANT_SUBDOMAIN:-localhost}
PUBLIC_HOST=${TENANT_SUBDOMAIN:-localhost}
FILE_SERVER_PUBLIC_URL=https://${TENANT_SUBDOMAIN:-localhost}/files
MESSAGE_ROUTER_PUBLIC_URL=wss://${TENANT_SUBDOMAIN:-localhost}/ws
LOCAL_MESSAGE_ROUTER_URL=http://message-router:4020
LOCAL_CALL_SIGNAL_URL=http://call-signal:4040
PRESENCE_SERVICE_URL=http://presence:4010
EOF

  sudo chmod 600 "${PALABRE_DIR}/.env"
  ok ".env généré dans ${PALABRE_DIR}/"
}

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 8 — Vérification de santé
# ─────────────────────────────────────────────────────────────────────────────
verify_health() {
  title "Vérification de la santé des composants"

  log "Attente du démarrage des services (60s max)..."
  local elapsed=0 all_healthy=false

  while [ $elapsed -lt 60 ]; do
    sleep 5; elapsed=$((elapsed + 5))

    # Vérifier l'agent
    if curl -sS --max-time 3 "http://localhost:8080/health" &>/dev/null; then
      all_healthy=true
      break
    fi
    log "Attente... ($elapsed s)"
  done

  if [ "$all_healthy" = true ]; then
    local health
    health=$(curl -sS --max-time 5 "http://localhost:8080/health" 2>/dev/null || echo '{}')
    ok "Agent opérationnel"
    log "Statut : $health"
  else
    warn "L'agent n'a pas démarré dans les 60s. Vérifiez : docker logs palabre-tenant-agent"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# RÉSUMÉ FINAL
# ─────────────────────────────────────────────────────────────────────────────
print_summary() {
  title "Installation terminée"

  echo -e "${BOLD}  Votre service tenant Palabre est opérationnel.${RESET}"
  echo ""
  echo "  Organisation  : ${ORG_ID}"
  echo "  URL du service: https://${TENANT_SUBDOMAIN}"
  echo "  Serveur central : ${CENTRAL_API_URL}"
  echo ""
  echo -e "${BOLD}  → Partagez cette URL avec vos collaborateurs :${RESET}"
  echo -e "${CYAN}     https://${TENANT_SUBDOMAIN}${RESET}"
  echo ""
  echo "  Commandes utiles :"
  echo "    Statut    : curl http://localhost:8080/health"
  echo "    Logs      : sudo docker compose -f ${PALABRE_DIR}/docker-compose.yml logs -f"
  echo "    Redémarrer: sudo docker compose -f ${PALABRE_DIR}/docker-compose.yml restart"
  echo "    Arrêter   : sudo docker compose -f ${PALABRE_DIR}/docker-compose.yml down"
  echo ""
  if [ -n "${REGISTRATION_TOKEN:-}" ]; then
    warn "Conservez ce token d'enregistrement en lieu sûr (affiché une seule fois) :"
    echo -e "${BOLD}  REGISTRATION_TOKEN=${REGISTRATION_TOKEN}${RESET}"
    echo ""
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# POINT D'ENTRÉE
# ─────────────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}║     PALABRE — Installation du service tenant local   ║${RESET}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════╝${RESET}"
  echo ""

  # Vérifier si une installation existe déjà
  if [ -f "$CONF_FILE" ] && [ "$UPDATE_MODE" = false ]; then
    warn "Une installation existe déjà ($CONF_FILE)."
    if [ "$HEADLESS" = false ]; then
      read -rp "  Voulez-vous mettre à jour ? [o/N] : " answer
      [[ "$answer" =~ ^[oOyY]$ ]] || { log "Installation annulée."; exit 0; }
    else
      log "Mode headless : mise à jour automatique."
    fi
    UPDATE_MODE=true
  fi

  check_prerequisites
  check_central_connectivity
  collect_config
  generate_keys
  register_with_central
  write_conf_file
  deploy_services
  verify_health
  print_summary
}

main "$@"
