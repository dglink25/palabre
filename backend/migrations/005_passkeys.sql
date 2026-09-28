-- 005_passkeys.sql

-- ========== PASSKEYS (WebAuthn) ==========
-- Remplace le mécanisme "biometric_credentials" (clé WebCrypto maison) par
-- de vrais passkeys conformes au standard W3C WebAuthn - la table
-- biometric_credentials reste en base pour ne rien casser rétroactivement,
-- mais n'est plus utilisée par l'API à partir de cette version.

CREATE TABLE passkeys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id   TEXT NOT NULL UNIQUE,       -- identifiant WebAuthn (base64url)
  public_key      TEXT NOT NULL,              -- clé publique COSE, base64
  counter         BIGINT NOT NULL DEFAULT 0,  -- compteur anti-clonage d'authentificateur
  device_type     VARCHAR(20),                -- 'singleDevice' | 'multiDevice'
  backed_up       BOOLEAN NOT NULL DEFAULT false,
  transports      JSONB DEFAULT '[]'::jsonb,  -- ex. ["internal","hybrid"]
  label           VARCHAR(150),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ
);
CREATE INDEX idx_passkeys_user ON passkeys(user_id);

-- ========== SECOND FACTEUR SUR LA CONNEXION TÉLÉPHONE DU SUPER-ADMIN ==========
-- Toute connexion du super-administrateur est désormais renforcée, quel que
-- soit le canal : après l'OTP WhatsApp habituel, un code e-mail (6 chiffres,
-- réutilise email_verifications/purpose='confirm_action') est exigé avant
-- l'émission de la session. Aucune colonne supplémentaire nécessaire - la
-- logique est portée par superAdminAuth.service.js.
