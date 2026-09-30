-- ============================================================
-- Migration 008 — Table des agents tenant
-- Enregistre l'URL publique de chaque agent tenant
-- pour le routage inter-organisations (multi-tenant)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- URL HTTP de l'agent tenant (pour le relai de messages inter-org)
  -- Ex : https://tenant.monentreprise.com:8080
  agent_url       TEXT NOT NULL,
  -- Statut de l'agent
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'suspended')),
  -- Version du logiciel tenant (pour compatibilité)
  agent_version   TEXT,
  -- Dernière fois que cet agent a été vu actif (via heartbeat)
  last_seen_at    TIMESTAMPTZ,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_agent UNIQUE (organization_id)
);

CREATE INDEX idx_tenant_agents_org ON tenant_agents(organization_id);
CREATE INDEX idx_tenant_agents_active ON tenant_agents(status) WHERE status = 'active';

-- Ajouter la colonne agent_url dans heartbeat_logs pour suivre l'URL déclarée
ALTER TABLE heartbeat_logs ADD COLUMN IF NOT EXISTS agent_url TEXT;
ALTER TABLE heartbeat_logs ADD COLUMN IF NOT EXISTS agent_version TEXT;
