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
--
-- BRANCH CONTINUITY (N, N+1, N+2 ...):
--   forked_from_episode_id = WHERE a branch diverged (the decision point). Set on the
--     first episode of a branch; marks the split from the parent timeline.
--   prev_episode_id        = the immediately PRECEDING episode in THIS SAME timeline.
--     This is the chain that makes N+2 possible:
--       canonical E3 <- canonical E4 (prev = E3)
--       canonical E3 <- branch  E4' (prev = E3, forked_from = E3)
--       branch   E4' <- branch  E5' (prev = E4', forked_from = E3)  <-- N+2
--   Walk prev_episode_id back to the root to reconstruct a timeline's full lineage
--   (see the episode_ancestry view + continuity query at the bottom of this file).
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
    forked_from_episode_id BIGINT REFERENCES episodes(id),   -- self-ref = the decision point (branch origin)
    prev_episode_id       BIGINT REFERENCES episodes(id),   -- self-ref = previous episode in THIS timeline
    decision_point        TEXT,                              -- the "what if" premise of the fork
    is_canonical          BOOLEAN NOT NULL DEFAULT false,    -- sacred timeline?
    verified_by_author    BOOLEAN NOT NULL DEFAULT false,    -- author's tick
    audio_url             TEXT,                              -- TTS render of this episode
    audio_duration_ms     INT,                               -- length of the audio (for retention buckets)
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
-- AUDIO PLAYBACK ANALYTICS (retention)
-- ============================================================

-- ---------- Playback events (raw event log) ----------
-- One row per player event (Spotify/YT-style). Source of truth for all
-- retention metrics; curves/completion/drop-off are DERIVED by aggregation,
-- not stored. Retention math is deterministic SQL, not the LLM.
CREATE TABLE playback_events (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    episode_id   BIGINT NOT NULL REFERENCES episodes(id),
    user_id      BIGINT REFERENCES users(id),           -- nullable: anonymous listens
    session_id   UUID   NOT NULL,                        -- one listening session
    event_type   VARCHAR(20) NOT NULL,                   -- play_start|heartbeat|pause|resume|seek|skip|complete
    position_ms  INT    NOT NULL,                         -- playhead at event time
    seek_to_ms   INT,                                     -- only for seek events
    duration_ms  INT,                                     -- episode audio length at play time
    speed        NUMERIC(3,2),                            -- playback rate (1.0, 1.5, ...)
    device       VARCHAR(30),                             -- web|ios|android
    autoplay     BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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
    status             VARCHAR(20),                                 -- alive|dead|unknown AS OF this episode
                                                                    --   (per-timeline override of characters.status)
    UNIQUE (character_id, episode_id)
);
-- NOTE: characters.status = canonical/default seed. The LIVE status of a character
-- along any timeline is the character_state.status of the NEAREST ancestor episode
-- that has a snapshot (see episode_ancestry). This is what lets "she killed him"
-- make the villain dead in the branch while staying alive on the sacred timeline.

-- ---------- Character relationships (character M:N character) ----------
CREATE TABLE char_relationship (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    char_id              BIGINT NOT NULL REFERENCES characters(id),
    relation_char_id     BIGINT NOT NULL REFERENCES characters(id),
    relationship_summary TEXT,
    UNIQUE (char_id, relation_char_id)
);

-- ---------- Character relationship state (per-episode snapshot) ----------
-- Same snapshot pattern as character_state: lets a relationship diverge per timeline
-- (e.g. allies in canon, enemies in a branch). char_relationship holds the seed;
-- the live value is the nearest-ancestor snapshot for the current episode.
CREATE TABLE char_relationship_state (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    char_id              BIGINT NOT NULL REFERENCES characters(id),
    relation_char_id     BIGINT NOT NULL REFERENCES characters(id),
    episode_id           BIGINT NOT NULL REFERENCES episodes(id),   -- state as of this episode
    relationship_summary TEXT,
    UNIQUE (char_id, relation_char_id, episode_id)
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

-- ---------- Plot thread state (per-episode snapshot) ----------
-- plot_threads defines the thread once (series seed). Its status can diverge per
-- timeline: a thread resolved on the sacred timeline may stay open in a branch, or
-- a branch may open a brand-new thread. One row per (thread, episode) it changes at.
CREATE TABLE plot_thread_state (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thread_id   BIGINT NOT NULL REFERENCES plot_threads(id),
    episode_id  BIGINT NOT NULL REFERENCES episodes(id),          -- status as of this episode
    status      VARCHAR(20) NOT NULL,                             -- open | resolved
    note        TEXT,                                            -- how it advanced in this timeline
    UNIQUE (thread_id, episode_id)
);

-- ---------- Helpful indexes ----------
CREATE INDEX idx_episodes_series      ON episodes(series_id);
CREATE INDEX idx_episodes_forkedfrom  ON episodes(forked_from_episode_id);
CREATE INDEX idx_episodes_prev        ON episodes(prev_episode_id);
CREATE INDEX idx_charstate_episode    ON character_state(episode_id);
CREATE INDEX idx_relstate_episode     ON char_relationship_state(episode_id);
CREATE INDEX idx_threadstate_episode  ON plot_thread_state(episode_id);
CREATE INDEX idx_ratings_episode      ON ratings(episode_id);
CREATE INDEX idx_reviews_episode      ON reviews(episode_id);
CREATE INDEX idx_characters_series    ON characters(series_id);
CREATE INDEX idx_charstate_character  ON character_state(character_id);
CREATE INDEX idx_playback_episode     ON playback_events(episode_id);
CREATE INDEX idx_playback_session     ON playback_events(session_id);
CREATE INDEX idx_playback_ep_pos      ON playback_events(episode_id, position_ms);

-- ---------- Retention helper view (derived metrics; example) ----------
-- 10-second-bucket retention curve per episode: fraction of starters still
-- active in each bucket. Drop-offs = buckets where this falls sharply.
CREATE VIEW episode_retention AS
WITH starts AS (
  SELECT episode_id, count(DISTINCT session_id) AS starters
  FROM playback_events WHERE event_type = 'play_start' GROUP BY episode_id
),
buckets AS (
  SELECT episode_id, (position_ms / 10000) AS bucket_10s,
         count(DISTINCT session_id) AS active_sessions
  FROM playback_events
  WHERE event_type IN ('heartbeat','complete')
  GROUP BY episode_id, (position_ms / 10000)
)
SELECT b.episode_id, b.bucket_10s,
       b.active_sessions,
       s.starters,
       round(b.active_sessions::numeric / NULLIF(s.starters,0), 3) AS retention
FROM buckets b JOIN starts s ON s.episode_id = b.episode_id
ORDER BY b.episode_id, b.bucket_10s;

-- ============================================================
-- BRANCH LINEAGE (context for N, N+1, N+2 ... continuation)
-- ============================================================

-- ---------- episode_ancestry: every episode -> all its ancestors on ITS timeline ----------
-- Walks prev_episode_id back to the root. depth 0 = the episode itself; depth grows
-- toward the root. This is the spine the agent uses to assemble continuity context
-- for a branch: prior episodes, and the NEAREST snapshot of each character/thread.
CREATE VIEW episode_ancestry AS
WITH RECURSIVE walk AS (
  SELECT id AS episode_id, id AS ancestor_id, 0 AS depth
  FROM episodes
  UNION ALL
  SELECT w.episode_id, e.prev_episode_id, w.depth + 1
  FROM walk w
  JOIN episodes e ON e.id = w.ancestor_id
  WHERE e.prev_episode_id IS NOT NULL
)
SELECT episode_id, ancestor_id, depth FROM walk;

-- Example: LIVE state of character :char_id as of episode :episode_id (nearest ancestor
-- snapshot along the timeline). Same pattern works for char_relationship_state and
-- plot_thread_state. Falls back to characters.status when no snapshot exists yet.
--
--   SELECT cs.memory_snapshot, cs.char_summary,
--          COALESCE(cs.status, c.status) AS status
--   FROM episode_ancestry a
--   JOIN character_state cs
--     ON cs.episode_id = a.ancestor_id AND cs.character_id = :char_id
--   JOIN characters c ON c.id = :char_id
--   WHERE a.episode_id = :episode_id
--   ORDER BY a.depth ASC          -- nearest ancestor wins
--   LIMIT 1;
