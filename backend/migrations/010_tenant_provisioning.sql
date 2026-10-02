
CREATE TABLE IF NOT EXISTS tenant_registrations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Sous-domaine attribué : monorg.palabre.com
  tenant_subdomain        TEXT NOT NULL UNIQUE,
  -- IP PUBLIQUE du Tenant_Server - enregistrée sur le DNS public du Central_Server
  -- Utilisée uniquement par le tunnel de relais (les appareils hors LAN passent par ici)
  -- Le Tenant_Server n'est PAS nécessairement accessible directement depuis Internet
  ip_address              INET NOT NULL,
  -- IP LOCALE du Tenant_Server sur le réseau interne (192.168.x.x)
  -- Annoncée par le DNS local (dnsmasq) pour les appareils du réseau LAN
  -- C'est ce qui permet aux appareils du LAN d'accéder directement au serveur
  local_ip                INET,
  -- Clé publique asymétrique du tenant (authentification mTLS/JWT)
  public_key              TEXT NOT NULL,
  -- Hash du token d'enregistrement (jamais stocké en clair)
  registration_token_hash TEXT NOT NULL,
  -- Version des composants déployés (ex: "1.0.0")
  components_version      TEXT NOT NULL DEFAULT '1.0.0',
  -- Statut du tenant
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','inactive','suspended')),
  -- Dernier heartbeat reçu via le Tunnel WebSocket
  last_heartbeat_at       TIMESTAMPTZ,
  -- Composants rapportés au dernier heartbeat (JSONB)
  last_components_health  JSONB DEFAULT '{}'::jsonb,
  -- DNS propagé avec succès
  dns_provisioned         BOOLEAN NOT NULL DEFAULT false,
  dns_provisioned_at      TIMESTAMPTZ,
  -- Certificat TLS généré
  tls_provisioned         BOOLEAN NOT NULL DEFAULT false,
  tls_expires_at          TIMESTAMPTZ,
  registered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_reg_org UNIQUE (organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_reg_subdomain
  ON tenant_registrations(tenant_subdomain);
CREATE INDEX IF NOT EXISTS idx_tenant_reg_org
  ON tenant_registrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_reg_status
  ON tenant_registrations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenant_reg_heartbeat
  ON tenant_registrations(last_heartbeat_at) WHERE status = 'active';

-- ── Journal des événements tunnel ─────────────────────────────
-- Audit complet des connexions/déconnexions du tunnel
CREATE TABLE IF NOT EXISTS tenant_tunnel_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL
                        CHECK (event_type IN ('connected','disconnected','heartbeat','relay','error')),
  ip_address          INET,
  -- Octets relayés pour cet événement (0 si non applicable)
  bytes_relayed       BIGINT NOT NULL DEFAULT 0,
  -- Message d'erreur si event_type = 'error'
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tunnel_logs_org
  ON tenant_tunnel_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tunnel_logs_type
  ON tenant_tunnel_logs(event_type, created_at DESC);

