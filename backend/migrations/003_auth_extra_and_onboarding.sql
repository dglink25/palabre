-- 003_auth_extra_and_onboarding.sql

-- ========== AUTHENTIFICATION / COMPTE - ce qui restait de la section 7 ==========

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Vérification d'adresse e-mail (même logique que phone_verifications, pour l'e-mail).
CREATE TABLE email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       CITEXT NOT NULL,
  purpose     VARCHAR(20) NOT NULL CHECK (purpose IN ('verify_email','recovery','link')),
  code_hash   VARCHAR(255) NOT NULL,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 5,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_verifications_email ON email_verifications(email, purpose);

-- Historique des tentatives de connexion (succès/échec), pour limitation et audit
-- de sécurité (section 36 : "limitation des tentatives de connexion").
CREATE TABLE login_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  VARCHAR(255) NOT NULL, -- numéro de téléphone ou provider_uid tenté
  method      VARCHAR(20) NOT NULL,  -- phone | google | github | facebook | apple | tiktok
  ip_address  VARCHAR(64),
  success     BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_identifier ON login_attempts(identifier, created_at);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, created_at);

-- ========== ONBOARDING - DEMANDE D'INSCRIPTION D'ORGANISATION (section 8-9) ==========

CREATE TABLE organization_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Le formulaire public (site vitrine) n'a pas de compte utilisateur : la
  -- reprise de saisie et l'accès à la demande se font via un jeton secret
  -- remis une seule fois à la création (haché en base, jamais stocké en clair).
  draft_token_hash       VARCHAR(255) NOT NULL,

  status                 VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','submitted','rejected','approved')),

  -- Étape 1 - Organisation : nom, siège, pays, ville, adresse, secteur, IFU
  step1_organization     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Étape 2 - Dirigeant : nom complet, sexe, pièce d'identité (référence doc), email, téléphone
  step2_leader           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Étape 3 - Documents : { rccm, ifuAttestation, leaderId, logo } → URLs de fichiers uploadés
  step3_documents        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Étape 4 - Certification : { infoCertified: bool, termsAccepted: bool }
  step4_certification    JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Champs précis que le super-administrateur demande de corriger en cas de
  -- rejet (ex. ["step1_organization.address", "step3_documents.rccm"]) - la
  -- correction ne doit pouvoir toucher QUE ces champs (section 9, point 3).
  flagged_fields          JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason        TEXT,

  organization_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_admin_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,

  reviewed_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at               TIMESTAMPTZ,
  submitted_at               TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_requests_status ON organization_requests(status);

-- Invitation envoyée à l'administrateur créé lors de l'approbation d'une
-- demande (section 9, points 5-6) : puisque Palabre est intégralement sans
-- mot de passe, "identifiants sécurisés envoyés par e-mail" devient un code
-- d'activation à usage unique à saisir à la première connexion.
CREATE TABLE org_admin_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash           VARCHAR(255) NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  consumed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
