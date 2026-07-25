-- ============================================================
-- NEXUS — Lakebase (Postgres) schema
-- Design rule: FK lives on the MANY side, pointing to the ONE side.
-- Access control (author / co-author / reader) is DERIVED from
-- episodes.author_id / episodes.co_author_id — no stored role.
-- Evals run in Databricks (MLflow) for dev + judge benchmarks only;
-- generation/eval data is NOT persisted in the app DB.
-- ============================================================

-- ---------- Users ----------
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------- Series (one author -> many series) ----------
CREATE TABLE series (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       TEXT   NOT NULL,
    description TEXT,
    summary     TEXT,
    genre       TEXT,
    tag         TEXT,
    author_id   BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Seasons (one series -> many seasons) ----------
CREATE TABLE seasons (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id   BIGINT NOT NULL REFERENCES series(id),
    title       TEXT   NOT NULL,
    summary     TEXT,
    description TEXT,
    order_index INT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Episodes ----------
-- Timeline model: canonical episodes = sacred timeline.
-- A fork points at the decision-point episode via forked_from_episode_id (self-ref).
-- author_id = original author; co_author_id = the co-author who created a fork.
-- Edit/view access is decided by comparing the current user to these two columns.
CREATE TABLE episodes (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id             BIGINT NOT NULL REFERENCES series(id),
    season_id             BIGINT NOT NULL REFERENCES seasons(id),
    title                 TEXT   NOT NULL,
    content               TEXT,                              -- full episode script
    summary               TEXT,
    prev_episode_summary  TEXT,                              -- rolling context
    order_index           INT    NOT NULL,
    author_id             BIGINT NOT NULL REFERENCES users(id),
    co_author_id          BIGINT REFERENCES users(id),       -- nullable: only forks have one
    forked_from_episode_id BIGINT REFERENCES episodes(id),   -- self-ref = the decision point
    decision_point        TEXT,                              -- the "what if" premise of the fork
    is_canonical          BOOLEAN NOT NULL DEFAULT false,    -- sacred timeline?
    verified_by_author    BOOLEAN NOT NULL DEFAULT false,    -- author's tick
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Ratings (user x episode) ----------
-- Numeric score, one per user per episode. Derive avg in queries.
CREATE TABLE ratings (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    episode_id BIGINT NOT NULL REFERENCES episodes(id),
    user_id    BIGINT NOT NULL REFERENCES users(id),
    score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (episode_id, user_id)                             -- prevents double-rating
);

-- ---------- Reviews / comments (threaded) ----------
CREATE TABLE reviews (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    episode_id       BIGINT NOT NULL REFERENCES episodes(id),
    created_by       BIGINT NOT NULL REFERENCES users(id),
    review_text      TEXT   NOT NULL,
    parent_review_id BIGINT REFERENCES reviews(id),          -- self-ref = threads
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTEXT-ENGINEERING TABLES (feed the LLM for quality output)
-- ============================================================

-- ---------- Characters (one series -> many characters) ----------
CREATE TABLE characters (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id   BIGINT NOT NULL REFERENCES series(id),
    name        TEXT   NOT NULL,
    description TEXT,
    role        VARCHAR(30),                                 -- protagonist | antagonist | side ...
    personality TEXT,
    backstory   TEXT,
    goals       TEXT,
    speech_style TEXT,                                       -- voice for consistency
    status      VARCHAR(20) NOT NULL DEFAULT 'alive'         -- alive | dead | unknown
);

-- ---------- Character state (one character -> many state snapshots per episode) ----------
-- Enables persistent memory that evolves across episodes/timelines.
CREATE TABLE character_state (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    character_id       BIGINT NOT NULL REFERENCES characters(id),   -- FK on the many side
    episode_id         BIGINT REFERENCES episodes(id),              -- state as of this episode
    memory_snapshot    TEXT,                                        -- what the char knows/feels now
    char_summary       TEXT,
    UNIQUE (character_id, episode_id)
);

-- ---------- Character relationships (character M:N character) ----------
CREATE TABLE char_relationship (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    char_id              BIGINT NOT NULL REFERENCES characters(id),
    relation_char_id     BIGINT NOT NULL REFERENCES characters(id),
    relationship_summary TEXT,
    UNIQUE (char_id, relation_char_id)
);

-- ---------- World / lore (one series -> many entries) ----------
CREATE TABLE world (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id   BIGINT NOT NULL REFERENCES series(id),
    entry_type  VARCHAR(30),                                 -- location | faction | rule | event
    name        TEXT,
    location    TEXT,
    description TEXT
);

-- ---------- Style guide (one per series) ----------
CREATE TABLE style_guide (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id      BIGINT NOT NULL UNIQUE REFERENCES series(id),
    pov            VARCHAR(30),                              -- first | third-limited ...
    tense          VARCHAR(20),
    tone           TEXT,
    pacing         TEXT,
    content_rating VARCHAR(10),
    narrative_voice TEXT
);

-- ---------- Plot threads (one series -> many; carried forward) ----------
CREATE TABLE plot_threads (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id     BIGINT NOT NULL REFERENCES series(id),
    thread        TEXT   NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'open',       -- open | resolved
    opened_episode_id   BIGINT REFERENCES episodes(id),
    resolved_episode_id BIGINT REFERENCES episodes(id)
);

-- ---------- Helpful indexes ----------
CREATE INDEX idx_episodes_series      ON episodes(series_id);
CREATE INDEX idx_episodes_forkedfrom  ON episodes(forked_from_episode_id);
CREATE INDEX idx_ratings_episode      ON ratings(episode_id);
CREATE INDEX idx_reviews_episode      ON reviews(episode_id);
CREATE INDEX idx_characters_series    ON characters(series_id);
CREATE INDEX idx_charstate_character  ON character_state(character_id);
