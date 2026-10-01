-- ============================================================
-- Migration 011 — Service Client (Customer Support)
-- Central_Server uniquement. Toutes les sessions transitent
-- exclusivement par le serveur central, jamais par un Tenant_Server.
-- ============================================================

-- ── Sessions de support (1 active par utilisateur) ───────────────────────
CREATE TABLE support_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'resolved')),
  channel       TEXT NOT NULL DEFAULT 'chat'
                  CHECK (channel IN ('chat', 'call', 'video')),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un utilisateur ne peut avoir qu'une seule session "open" à la fois.
-- Les sessions "resolved" peuvent être multiples (historique).
CREATE UNIQUE INDEX uq_support_session_active
  ON support_sessions(user_id)
  WHERE status = 'open';

CREATE INDEX idx_support_sessions_user     ON support_sessions(user_id);
CREATE INDEX idx_support_sessions_status   ON support_sessions(status) WHERE status = 'open';
CREATE INDEX idx_support_sessions_resolved ON support_sessions(resolved_at DESC) WHERE status = 'resolved';

-- ── Messages de support (ciphertext opaque — jamais déchiffré côté serveur) ──
CREATE TABLE support_messages (
  id             TEXT PRIMARY KEY,
  session_id     UUID NOT NULL REFERENCES support_sessions(id) ON DELETE CASCADE,
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type    TEXT NOT NULL CHECK (sender_type IN ('user', 'super_admin')),
  ciphertext     TEXT NOT NULL,
  sender_key_id  TEXT,
  type           TEXT NOT NULL DEFAULT 'text'
                   CHECK (type IN ('text', 'media_ref', 'video_invite', 'system')),
  status         TEXT NOT NULL DEFAULT 'sent'
                   CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  -- Référence à une room vidéo pour les messages video_invite
  video_room_id  UUID REFERENCES video_rooms(id) ON DELETE SET NULL,
  client_ts      BIGINT NOT NULL,
  server_ts      BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_session ON support_messages(session_id, server_ts DESC);
CREATE INDEX idx_support_messages_sender  ON support_messages(sender_id);
CREATE INDEX idx_support_messages_status  ON support_messages(status) WHERE status != 'read';
CREATE INDEX idx_support_messages_video   ON support_messages(video_room_id) WHERE video_room_id IS NOT NULL;

-- ── Appels audio de support ───────────────────────────────────────────────
-- Exclusivement audio (WebRTC) entre l'utilisateur et le Central_Server.
-- Un seul appel actif/en file par session à la fois.
CREATE TABLE support_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES support_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued', 'ringing', 'active', 'hold', 'ended', 'missed', 'rejected')),
  queue_position   INTEGER,              -- position en Call_Queue (NULL si actif/ended)
  end_reason       TEXT                  -- 'user_hangup' | 'admin_hangup' | 'timeout' | 'disconnected'
                     CHECK (end_reason IN ('user_hangup', 'admin_hangup', 'timeout', 'disconnected', 'queue_full', 'admin_offline')),
  initiated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  queued_at        TIMESTAMPTZ,
  answered_at      TIMESTAMPTZ,
  hold_started_at  TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,              -- calculé à la clôture
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_calls_session  ON support_calls(session_id);
CREATE INDEX idx_support_calls_user     ON support_calls(user_id);
CREATE INDEX idx_support_calls_status   ON support_calls(status)
  WHERE status IN ('queued', 'ringing', 'active', 'hold');
CREATE INDEX idx_support_calls_active   ON support_calls(initiated_at DESC)
  WHERE status IN ('active', 'hold');

-- ── Audit log dédié au service client ────────────────────────────────────
-- Le contenu des messages n'est JAMAIS enregistré ici (chiffrement E2E).
-- Uniquement les événements de cycle de vie.
CREATE TABLE support_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES support_sessions(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
    -- SESSION_CREATED | SESSION_RESOLVED
    -- CALL_INITIATED | CALL_ANSWERED | CALL_HOLD | CALL_RESUMED
    -- CALL_ENDED | VIDEO_INVITE_SENT | MESSAGE_SENT
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_audit_session ON support_audit_logs(session_id);
CREATE INDEX idx_support_audit_user    ON support_audit_logs(user_id);
CREATE INDEX idx_support_audit_action  ON support_audit_logs(action);
CREATE INDEX idx_support_audit_time    ON support_audit_logs(created_at DESC);
