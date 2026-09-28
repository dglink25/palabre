-- ============================================================
-- Migration 006 — Messagerie temps réel
-- Messages chiffrés E2E, conversations, groupes, files de clés
-- ============================================================

-- ── Conversations 1:1 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Une seule conversation par paire dans une org
  CONSTRAINT uq_conversation UNIQUE (org_id, user_a_id, user_b_id),
  CONSTRAINT chk_different_users CHECK (user_a_id <> user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations(org_id, user_a_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations(org_id, user_b_id);

-- ── Groupes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES users(id),
  avatar_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_org ON rooms(org_id);

-- ── Membres des groupes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id, org_id);

-- ── Messages (ciphertext opaque — jamais déchiffré côté serveur) ──
CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,          -- UUID v7 généré côté client (idempotence)
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,    -- NULL si groupe
  to_room_id     UUID REFERENCES rooms(id) ON DELETE SET NULL,    -- NULL si 1:1
  ciphertext     TEXT NOT NULL,             -- blob chiffré Signal Protocol, base64
  sender_key_id  TEXT,                      -- identifiant de la clé émetteur
  type           TEXT NOT NULL DEFAULT 'text'
                   CHECK (type IN ('text', 'media_ref', 'call_signal', 'delivery_receipt', 'read_receipt', 'system')),
  status         TEXT NOT NULL DEFAULT 'sent'
                   CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  client_ts      BIGINT NOT NULL,           -- timestamp client (ms) — pour l'ordre d'affichage
  server_ts      BIGINT NOT NULL,           -- timestamp serveur (ms) — pour la cohérence
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_message_target CHECK (
    (to_user_id IS NOT NULL AND to_room_id IS NULL) OR
    (to_user_id IS NULL AND to_room_id IS NOT NULL)
  )
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_messages_to_user  ON messages(to_user_id, server_ts DESC) WHERE to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_to_room  ON messages(to_room_id, server_ts DESC) WHERE to_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_from     ON messages(from_user_id, server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org      ON messages(org_id, server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status   ON messages(status) WHERE status != 'read';

-- ── File de clés Signal Protocol (prékeys) ────────────────────
-- Chaque appareil dépose ses prékeys publiques sur le serveur.
-- Le serveur distribue une prékey à chaque nouvel expéditeur.
-- Le serveur ne voit que les clés PUBLIQUES — jamais les privées.
CREATE TABLE IF NOT EXISTS signal_prekeys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,
  key_id       INTEGER NOT NULL,
  public_key   TEXT NOT NULL,               -- clé publique X25519, base64
  signature    TEXT,                        -- signature de la clé (signed prekey)
  is_signed    BOOLEAN NOT NULL DEFAULT false,
  consumed     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_prekey UNIQUE (user_id, device_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_prekeys_available ON signal_prekeys(user_id, device_id)
  WHERE consumed = false;

-- ── Identité Signal par appareil (clé d'identité publique) ───
CREATE TABLE IF NOT EXISTS signal_identities (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  identity_key    TEXT NOT NULL,            -- clé publique d'identité Ed25519, base64
  registration_id INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);
