-- 002_platform_entities.sql
-- Reste du modèle de données du cahier des charges (section 38-39).
-- Ces tables complètent le schéma "au complet" demandé ; seules les tables
-- de la migration 001 (identité / authentification) sont exposées par l'API
-- livrée ici (voir périmètre en fin de conversation).

CREATE TABLE tenant_control_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL,
  qr_issued_at    TIMESTAMPTZ,
  qr_used_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vpn_peers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  public_key      TEXT,
  endpoint        VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','disconnected')),
  connected_at    TIMESTAMPTZ,
  last_handshake_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE heartbeat_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status_reported VARCHAR(20) NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            VARCHAR(10) NOT NULL CHECK (type IN ('direct','group')),
  name            VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content_type    VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','image','file','voice')),
  content         TEXT,
  media_url       TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            VARCHAR(10) NOT NULL CHECK (type IN ('audio','video')),
  status          VARCHAR(20) NOT NULL DEFAULT 'ringing',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_seconds INT
);

CREATE TABLE call_queues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL DEFAULT 'default',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE call_center_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'offline'
);

CREATE TABLE ivr_languages (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code    VARCHAR(10) NOT NULL UNIQUE,
  label   VARCHAR(100) NOT NULL
);

CREATE TABLE ivr_menus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = menu plateforme (super-admin)
  language_id     UUID REFERENCES ivr_languages(id),
  config          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE ai_knowledge_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title           VARCHAR(255),
  content         TEXT,
  audio_sample_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ussd_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            VARCHAR(20) NOT NULL,
  label           VARCHAR(150),
  UNIQUE (code)
);

CREATE TABLE analog_gateways (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fxs_endpoint    VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive'
);

CREATE TABLE mobile_app_builds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_label   VARCHAR(50),
  apk_url         TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','building','ready','failed')),
  generated_at    TIMESTAMPTZ
);

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id   UUID REFERENCES users(id),
  category        VARCHAR(50),
  file_url        TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  payload     JSONB DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(30) NOT NULL UNIQUE CHECK (code IN ('starter','pro','business','enterprise')),
  label       VARCHAR(100) NOT NULL,
  limits      JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_amount NUMERIC(12,2),
  price_currency VARCHAR(10) DEFAULT 'XOF',
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES plans(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','expired','suspended','cancelled')),
  trial_ends_at   TIMESTAMPTZ,
  renews_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'XOF',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE promo_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE,
  discount_percent SMALLINT,
  expires_at  TIMESTAMPTZ
);

CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  subject         VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
