-- ============================================================
-- Migration 016 - Rapports de sessions (appels P2P + vidéoconférences)
-- Serveur central uniquement. Ne concerne pas les tenants.
-- ============================================================

-- ── Rapports générés automatiquement à la fin de chaque session ─────────────
CREATE TABLE session_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source : type de session concernée
  session_type    TEXT NOT NULL
                    CHECK (session_type IN ('video_room', 'p2p_call', 'support_call')),
  source_id       UUID NOT NULL,            -- id de la video_room, p2p_call ou support_call
  -- Participants ayant reçu le rapport
  participants    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Données du rapport
  title           TEXT NOT NULL,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_seconds INTEGER,
  participant_count INTEGER,
  summary         JSONB,                    -- résumé structuré produit par l'AI (optionnel)
  -- Fichiers générés
  pdf_path        TEXT,
  audio_path      TEXT,                     -- résumé audio TTS (optionnel)
  -- Statut de génération
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'generating', 'done', 'error')),
  error           TEXT,
  -- Envoi email
  emails_sent_at  TIMESTAMPTZ,
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_reports_source    ON session_reports(source_id);
CREATE INDEX idx_session_reports_type      ON session_reports(session_type);
CREATE INDEX idx_session_reports_status    ON session_reports(status) WHERE status != 'done';
CREATE INDEX idx_session_reports_created   ON session_reports(created_at DESC);
