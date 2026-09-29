-- ============================================================
-- Migration 007 — Liaison organisation (nouveau modèle mobile)
-- Ajoute le code d'invitation pour les utilisateurs standard
-- ============================================================

-- Code d'invitation de l'organisation (hashé)
-- Généré par l'admin, partagé aux membres via QR ou saisie manuelle
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  join_code_hash VARCHAR(255);

-- Index pour éviter les scans complets lors de la vérification
CREATE INDEX IF NOT EXISTS idx_org_join_code ON organizations(join_code_hash)
  WHERE join_code_hash IS NOT NULL;

-- Rôle org_member s'il n'existe pas encore
INSERT INTO roles (code, label) VALUES ('org_member', 'Membre organisation')
  ON CONFLICT (code) DO NOTHING;
