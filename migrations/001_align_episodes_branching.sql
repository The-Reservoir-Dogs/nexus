-- ---------------------------------------------------------------------------
-- 001_align_episodes_branching.sql
--
-- The deployed Lakebase predates the branching columns in schema.sql, so writes
-- from the app fail with e.g.:
--   column "prev_episode_id" of relation "episodes" does not exist
--
-- This migration brings an older database up to the current schema.sql shape.
-- It is idempotent (safe to run repeatedly) and only ADDs nullable columns +
-- indexes, so it never rewrites or drops existing data.
-- ---------------------------------------------------------------------------
BEGIN;

-- ---- episodes: self-referential branching / timeline chaining ----
-- forked_from_episode_id = the decision point (branch origin).
-- prev_episode_id        = the immediately preceding episode in THIS timeline.
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS forked_from_episode_id BIGINT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS prev_episode_id        BIGINT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS decision_point         TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS prev_episode_summary   TEXT;

-- Self-referential FKs (added only if missing; wrapped so a pre-existing
-- constraint name doesn't abort the migration).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'episodes_forked_from_episode_id_fkey'
  ) THEN
    ALTER TABLE episodes
      ADD CONSTRAINT episodes_forked_from_episode_id_fkey
      FOREIGN KEY (forked_from_episode_id) REFERENCES episodes(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'episodes_prev_episode_id_fkey'
  ) THEN
    ALTER TABLE episodes
      ADD CONSTRAINT episodes_prev_episode_id_fkey
      FOREIGN KEY (prev_episode_id) REFERENCES episodes(id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_episodes_forked_from ON episodes(forked_from_episode_id);
CREATE INDEX IF NOT EXISTS idx_episodes_prev        ON episodes(prev_episode_id);

-- ---- character_state: per-episode evolving status ----
-- The app upserts character_state.status; older DBs lack the column.
ALTER TABLE character_state ADD COLUMN IF NOT EXISTS status TEXT;

COMMIT;
