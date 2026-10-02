-- ============================================================
-- Migration 009 - Vidéoconférence (white-label Jitsi/JaaS)
-- ============================================================

-- ── Rooms de vidéoconférence ──────────────────────────────────
-- org_id est NULL pour les vidéoconférences publiques (sans tenant)
-- jitsi_room_name est un identifiant interne JAMAIS exposé au client
CREATE TABLE video_rooms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  host_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 255),
  status                  TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','active','ended','cancelled')),
  access_policy           TEXT NOT NULL DEFAULT 'closed'
                            CHECK (access_policy IN ('open','closed')),
  -- Identifiant de salle Jitsi interne : JAMAIS retourné au client dans aucune réponse API
  jitsi_room_name         TEXT NOT NULL UNIQUE,
  scheduled_at            TIMESTAMPTZ,
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  estimated_duration_min  INTEGER CHECK (estimated_duration_min BETWEEN 1 AND 480),
  max_participants        INTEGER NOT NULL DEFAULT 300
                            CHECK (max_participants BETWEEN 1 AND 300),
  -- Renseigné à la fermeture de la session
  actual_participant_count INTEGER,
  recording_available     BOOLEAN NOT NULL DEFAULT false,
  recording_storage_path  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_rooms_org        ON video_rooms(org_id)        WHERE org_id IS NOT NULL;
CREATE INDEX idx_video_rooms_host       ON video_rooms(host_user_id);
CREATE INDEX idx_video_rooms_status     ON video_rooms(status)        WHERE status IN ('scheduled','active');
CREATE INDEX idx_video_rooms_scheduled  ON video_rooms(scheduled_at)  WHERE status = 'scheduled';

-- ── Participants à une vidéoconférence ────────────────────────
CREATE TABLE video_room_participants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'participant'
                        CHECK (role IN ('host','moderator','participant')),
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited','waiting','active','excluded','left')),
  session_token_hash  TEXT,
  joined_at           TIMESTAMPTZ,
  left_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

CREATE INDEX idx_vrp_room    ON video_room_participants(room_id, status);
CREATE INDEX idx_vrp_user    ON video_room_participants(user_id);
CREATE INDEX idx_vrp_waiting ON video_room_participants(room_id) WHERE status = 'waiting';
CREATE INDEX idx_vrp_active  ON video_room_participants(room_id) WHERE status = 'active';

-- ── Invitations à une vidéoconférence ─────────────────────────
CREATE TABLE video_room_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES video_rooms(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, invitee_user_id)
);

CREATE INDEX idx_vri_room    ON video_room_invitations(room_id);
CREATE INDEX idx_vri_invitee ON video_room_invitations(invitee_user_id);
CREATE INDEX idx_vri_token   ON video_room_invitations(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_vri_active  ON video_room_invitations(room_id) WHERE revoked_at IS NULL AND consumed_at IS NULL;
