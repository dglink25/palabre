-- 001_core_identity_auth.sql
-- Utilisateurs, organisations (tenants), rôles, authentification, sécurité, sessions.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ========== ORGANISATIONS (TENANTS) ==========

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  headquarters    VARCHAR(255),
  country         VARCHAR(100),
  city            VARCHAR(100),
  address         TEXT,
  sector          VARCHAR(150),
  ifu_number      VARCHAR(50),
  logo_url        TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','trial','active','suspended','offline','archived','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status      VARCHAR(20) NOT NULL,
  reason          TEXT,
  changed_by      UUID,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== UTILISATEURS ==========

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           VARCHAR(255),
  email               CITEXT,
  phone_e164          VARCHAR(20),
  photo_url           TEXT,
  sector              VARCHAR(150),
  locale              VARCHAR(10) DEFAULT 'fr',
  timezone            VARCHAR(50) DEFAULT 'Africa/Porto-Novo',
  is_super_admin      BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','disabled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email),
  UNIQUE (phone_e164)
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE, -- super_admin, org_admin, supervisor, agent, standard_user, field_agent
  label       VARCHAR(150) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

-- ========== APPAREILS (unicité "un compte par appareil / par identifiant fédéré") ==========

CREATE TABLE devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(255) NOT NULL UNIQUE, -- empreinte technique stable de l'appareil (voir device.service.js)
  platform          VARCHAR(30),  -- android / ios / web
  model             VARCHAR(150),
  first_user_id     UUID REFERENCES users(id) ON DELETE SET NULL, -- premier utilisateur inscrit sur cet appareil
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== COMPTES FÉDÉRÉS (Google / GitHub / Facebook / Apple / TikTok via Firebase) ==========

CREATE TABLE oauth_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(20) NOT NULL CHECK (provider IN ('google','github','facebook','apple','tiktok')),
  provider_uid    VARCHAR(255) NOT NULL,   -- uid Firebase pour ce provider
  provider_email  CITEXT,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_uid) -- un identifiant fédéré ne peut être lié qu'à un seul compte Palabre
);

-- ========== VÉRIFICATION TÉLÉPHONE / OTP (WhatsApp via Convessa) ==========

CREATE TABLE phone_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164      VARCHAR(20) NOT NULL,
  purpose         VARCHAR(20) NOT NULL CHECK (purpose IN ('register','login','recovery','link')),
  code_hash       VARCHAR(255) NOT NULL,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 5,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  whatsapp_message_id VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone_e164, purpose);

-- ========== SÉCURITÉ : questions de sécurité ==========

CREATE TABLE security_questions (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code    VARCHAR(50) NOT NULL UNIQUE,
  label_fr VARCHAR(255) NOT NULL
);

CREATE TABLE user_security_answers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  security_question_id  UUID NOT NULL REFERENCES security_questions(id),
  answer_hash           VARCHAR(255) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, security_question_id)
);

-- ========== 2FA - identifiant biométrique (WebAuthn / clé publique liée à l'empreinte digitale) ==========
-- Note de conception : Palabre ne stocke jamais de gabarit d'empreinte digitale brut (donnée biométrique
-- sensible). Chaque appareil génère une paire de clés déverrouillée localement par l'empreinte digitale
-- du porteur (WebAuthn / Android BiometricPrompt / iOS Secure Enclave) ; seule la clé publique et un
-- identifiant d'attestation sont stockés ici. C'est ce mécanisme qui permet de vérifier "que c'est bien lui"
-- sur n'importe quel appareil déjà enrôlé, sans jamais faire transiter ni stocker de donnée biométrique brute.

CREATE TABLE biometric_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id         UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  credential_id     TEXT NOT NULL UNIQUE, -- id WebAuthn
  public_key        TEXT NOT NULL,
  sign_count        BIGINT NOT NULL DEFAULT 0,
  label             VARCHAR(150),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at      TIMESTAMPTZ
);

-- ========== MOYENS DE RÉCUPÉRATION DE COMPTE ==========

CREATE TABLE account_recovery_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('phone','google','github','facebook','apple','tiktok','security_questions')),
  reference   VARCHAR(255), -- numéro ou provider_uid associé
  verified    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== SESSIONS (multi-appareils, façon WhatsApp/Gmail) ==========

CREATE TABLE sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id         UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  refresh_family_id UUID NOT NULL,      -- permet la rotation + détection de réutilisation (reuse detection)
  ip_address        VARCHAR(64),
  user_agent        TEXT,
  location_hint     VARCHAR(150),       -- ville/pays approximatif dérivé de l'IP
  two_factor_passed BOOLEAN NOT NULL DEFAULT false,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ
);
CREATE INDEX idx_sessions_user ON sessions(user_id, status);
CREATE INDEX idx_sessions_family ON sessions(refresh_family_id);

-- ========== JOURNAL D'AUDIT ==========

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action          VARCHAR(150) NOT NULL,
  target_type     VARCHAR(100),
  target_id       UUID,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rôles de base
INSERT INTO roles (code, label) VALUES
  ('super_admin', 'Super-administrateur SaaS'),
  ('org_admin', 'Administrateur d''organisation'),
  ('call_center_supervisor', 'Superviseur de centre d''appels'),
  ('call_center_agent', 'Agent de centre d''appels'),
  ('standard_user', 'Utilisateur standard'),
  ('field_agent', 'Agent de terrain')
ON CONFLICT DO NOTHING;

-- Questions de sécurité de base
INSERT INTO security_questions (code, label_fr) VALUES
  ('first_pet', 'Quel est le nom de votre premier animal de compagnie ?'),
  ('birth_city', 'Dans quelle ville êtes-vous né(e) ?'),
  ('mother_maiden_name', 'Quel est le nom de jeune fille de votre mère ?'),
  ('first_school', 'Quel est le nom de votre première école ?')
ON CONFLICT DO NOTHING;
