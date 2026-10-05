-- ============================================================
-- Migration 012 - Appels P2P (audio/vidéo WebRTC 1:1)
-- Distinct des vidéoconférences de groupe (009).
-- ============================================================

CREATE TABLE p2p_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  caller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type       TEXT NOT NULL DEFAULT 'audio'
                    CHECK (call_type IN ('audio', 'video')),
  status          TEXT NOT NULL DEFAULT 'ringing'
                    CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'rejected', 'busy')),
  -- Durée calculée côté serveur à la fin de l'appel
  duration_seconds INTEGER,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_p2p_calls_caller ON p2p_calls(caller_id, created_at DESC);
CREATE INDEX idx_p2p_calls_callee ON p2p_calls(callee_id, created_at DESC);
CREATE INDEX idx_p2p_calls_org    ON p2p_calls(org_id, created_at DESC);
