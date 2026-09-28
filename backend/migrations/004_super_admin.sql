-- 004_super_admin.sql

-- ========== PROVISIONNEMENT DU SUPER-ADMINISTRATEUR ==========
-- Idempotent : relancer cette migration ne duplique rien, que le compte
-- existe déjà (créé via un autre canal) ou non.
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM users
  WHERE email = 'dglink25@gmail.com' OR phone_e164 = '+2290190956919'
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO users (full_name, email, phone_e164, is_super_admin, email_verified)
    VALUES ('Super Administrateur Palabre', 'dglink25@gmail.com', '+2290190956919', true, true);
  ELSE
    UPDATE users
    SET is_super_admin = true,
        email = 'dglink25@gmail.com',
        phone_e164 = '+2290190956919',
        email_verified = true
    WHERE id = v_id;
  END IF;
END $$;

-- ========== FLUX DE CONNEXION RENFORCÉ DU SUPER-ADMIN ==========
-- Étape 1 de son parcours Google : un code de 12 caractères (composition
-- complexe, voir superAdminAuth.service.js) envoyé par e-mail, distinct des
-- OTP à 6 chiffres classiques (table dédiée plutôt que de complexifier
-- email_verifications, dont le format de code diffère).
CREATE TABLE super_admin_email_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL,
  code_hash     VARCHAR(255) NOT NULL,
  attempts      SMALLINT NOT NULL DEFAULT 0,
  max_attempts  SMALLINT NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nouveau motif d'usage pour email_verifications : confirmation d'une
-- action sensible (double vérification systématique des modifications
-- effectuées par le super-administrateur, voir security.routes.js).
ALTER TABLE email_verifications DROP CONSTRAINT email_verifications_purpose_check;
ALTER TABLE email_verifications ADD CONSTRAINT email_verifications_purpose_check
  CHECK (purpose IN ('verify_email','recovery','link','confirm_action'));
