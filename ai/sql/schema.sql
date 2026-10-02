CREATE EXTENSION IF NOT EXISTS vector;

-- Index vectoriel des lignes de connaissance_base (la table d'origine n'est PAS modifiée)
CREATE TABLE IF NOT EXISTS kb_embeddings (
    kb_id        bigint PRIMARY KEY,
    content_hash text   NOT NULL,
    embedding    vector(__DIM__) NOT NULL
);
CREATE INDEX IF NOT EXISTS kb_embeddings_hnsw
    ON kb_embeddings USING hnsw (embedding vector_cosine_ops);

-- Qualité de chaque ligne de connaissance, alimentée par les feedbacks
CREATE TABLE IF NOT EXISTS ai_kb_stats (
    kb_id bigint PRIMARY KEY,
    up    int NOT NULL DEFAULT 0,
    down  int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_conversations (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id              bigserial PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('user','assistant')),
    content         text NOT NULL,
    used_kb_ids     bigint[] NOT NULL DEFAULT '{}',
    meta            jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_messages_conv_idx ON ai_messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS ai_feedback (
    id         bigserial PRIMARY KEY,
    message_id bigint NOT NULL UNIQUE REFERENCES ai_messages(id) ON DELETE CASCADE,
    rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- File d'attente : nouvelles connaissances proposées, validées avant d'entrer dans connaissance_base
CREATE TABLE IF NOT EXISTS ai_kb_candidates (
    id                bigserial PRIMARY KEY,
    question          text NOT NULL UNIQUE,
    response          text NOT NULL,
    type              text NOT NULL DEFAULT 'feedback',
    votes             int  NOT NULL DEFAULT 1,
    status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    source_message_id bigint,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_meetings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room         text NOT NULL,
    title        text,
    participants text[] NOT NULL DEFAULT '{}',
    status       text NOT NULL DEFAULT 'queued',
    error        text,
    transcript   text,
    summary      jsonb,
    summary_text text,
    pdf_path     text,
    audio_path   text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
