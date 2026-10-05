-- ============================================================
-- Migration 013 -- Infrastructure de clés E2E (Signal Protocol)
-- ============================================================
-- Consolide et complète les tables signal_prekeys et
-- signal_identities créées dans 006_messaging.sql.
-- Ajoute une table de sessions Signal pour le cache serveur.
-- ============================================================

-- Les tables signal_prekeys et signal_identities existent déjà
-- depuis 006. On s'assure qu'elles sont complètes et bien indexées.

-- ── Assurer que signal_identities a tous les champs nécessaires ────────────
ALTER TABLE signal_identities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Index pour lookup rapide par userId (liste des appareils d'un utilisateur)
CREATE INDEX IF NOT EXISTS idx_signal_identities_user
  ON signal_identities(user_id);

-- ── Assurer que signal_prekeys a le champ updated_at ──────────────────────
ALTER TABLE signal_prekeys
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── Table de sessions E2E (cache côté serveur, facultatif) ───────────────
-- Enregistre qu'une session Signal a été établie entre deux appareils.
-- Le serveur ne stocke PAS les secrets partagés - uniquement les métadonnées.
CREATE TABLE IF NOT EXISTS signal_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  peer_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_device_id  TEXT NOT NULL,
  -- Identifiant de la prekey utilisée pour établir cette session
  prekey_id       INTEGER,
  established_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  -- État de la session
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'stale', 'broken')),
  CONSTRAINT uq_signal_session UNIQUE (user_id, device_id, peer_user_id, peer_device_id)
);

CREATE INDEX IF NOT EXISTS idx_signal_sessions_user
  ON signal_sessions(user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_signal_sessions_peer
  ON signal_sessions(peer_user_id, peer_device_id);

-- ── Table de rotation des clés signées ────────────────────────────────────
-- Historique des signed prekeys pour permettre la vérification des anciens messages.
CREATE TABLE IF NOT EXISTS signal_signed_prekey_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL,
  key_id      INTEGER NOT NULL,
  public_key  TEXT NOT NULL,
  signature   TEXT,
  retired_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signed_prekey_history_user
  ON signal_signed_prekey_history(user_id, device_id);

-- ── Vue : stock de prékeys disponibles par utilisateur/appareil ───────────
CREATE OR REPLACE VIEW signal_prekey_stock AS
  SELECT
    user_id,
    device_id,
    COUNT(*) FILTER (WHERE is_signed = false AND consumed = false) AS one_time_available,
    COUNT(*) FILTER (WHERE is_signed = true)                       AS signed_count,
    MAX(created_at) FILTER (WHERE is_signed = false AND consumed = false) AS latest_prekey_at
  FROM signal_prekeys
  GROUP BY user_id, device_id;
