-- ============================================================
-- PULSE — additive schema on top of NEXUS schema.sql
-- Run AFTER schema.sql. Adds nothing destructive.
--
-- Why this exists: retention is only actionable at SCENE level.
-- "Episode 4 underperforms" is not a fixable note. "Scene 2 of
-- episode 4 loses 38% of listeners because it stalls the thread
-- they care about" is a rewrite instruction.
--
-- Design rules kept from schema.sql:
--   - FK on the MANY side, pointing at the ONE side.
--   - Derived metrics are VIEWS, never stored columns.
--   - All retention math is deterministic SQL. No model. No ML.
-- ============================================================

-- ---------- Scenes (one episode -> many scenes) ----------
-- start_ms/end_ms are the scene's span inside the episode audio.
-- A playback event is attributed to a scene purely by its position.
CREATE TABLE scenes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    episode_id    BIGINT NOT NULL REFERENCES episodes(id),
    order_index   INT    NOT NULL,                    -- 1-based, within episode
    title         TEXT   NOT NULL,
    text          TEXT   NOT NULL,                    -- the prose the LLM critiques/rewrites
    function      VARCHAR(30),                        -- hook|setup|conflict|character|action|exposition|climax|close
    start_ms      INT    NOT NULL,
    end_ms        INT    NOT NULL,
    est_duration_sec INT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (episode_id, order_index),
    CHECK (end_ms > start_ms)
);

-- ---------- Scene <-> Character (M:N) ----------
-- Drives the "audience investment per character" layer: a character's
-- investment is inferred from behaviour on the scenes they appear in.
CREATE TABLE scene_characters (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scene_id     BIGINT NOT NULL REFERENCES scenes(id),
    character_id BIGINT NOT NULL REFERENCES characters(id),
    UNIQUE (scene_id, character_id)
);

-- ---------- Scene <-> Plot thread (M:N) ----------
CREATE TABLE scene_threads (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scene_id  BIGINT NOT NULL REFERENCES scenes(id),
    thread_id BIGINT NOT NULL REFERENCES plot_threads(id),
    UNIQUE (scene_id, thread_id)
);

CREATE INDEX idx_scenes_episode      ON scenes(episode_id);
CREATE INDEX idx_scenes_span         ON scenes(episode_id, start_ms, end_ms);
CREATE INDEX idx_scene_chars_scene   ON scene_characters(scene_id);
CREATE INDEX idx_scene_chars_char    ON scene_characters(character_id);
CREATE INDEX idx_scene_threads_scene ON scene_threads(scene_id);

-- ============================================================
-- DERIVED VIEWS — the engagement map. Pure counting.
-- ============================================================

-- ---------- Attribute every raw event to the scene it happened in ----------
-- The player never reports a scene id; it only reports a playhead position,
-- exactly like a real player. Scene attribution is a join, not instrumentation.
CREATE VIEW scene_playback AS
SELECT pe.*, s.id AS scene_id, s.order_index AS scene_order, s.episode_id AS scene_episode_id
FROM playback_events pe
JOIN scenes s
  ON s.episode_id = pe.episode_id
 AND pe.position_ms >= s.start_ms
 AND pe.position_ms <  s.end_ms;

-- ---------- Where each session actually stopped ----------
CREATE VIEW session_last_position AS
SELECT DISTINCT ON (session_id)
       session_id, episode_id, user_id, position_ms,
       (event_type = 'complete') AS finished
FROM playback_events
ORDER BY session_id, position_ms DESC, id DESC;

-- ---------- SceneEngagement: the core Pulse metric table ----------
-- reached        = sessions that got any playback inside this scene
-- completed      = sessions that made it past this scene's end
-- drop_off_rate  = of those who reached it, the fraction who stopped here
-- replay_rate    = fraction who seeked BACKWARD into this scene (rewound to re-hear)
-- skip_rate      = fraction who jumped FORWARD out of this scene
-- avg_speed      = mean playback rate while inside this scene (>1 = "get on with it")
CREATE VIEW scene_engagement AS
WITH reached AS (
    -- "reached" = the playhead entered this scene at all, INCLUDING sessions
    -- that immediately skipped out of it. Excluding skippers shrinks the
    -- denominator of exactly the scenes people skip, which makes the worst
    -- scenes look healthiest. Do not "optimise" this back to heartbeats only.
    SELECT scene_id, count(DISTINCT session_id) AS reached
    FROM scene_playback
    WHERE event_type IN ('play_start','heartbeat','resume','complete',
                         'skip','seek','pause','stop')
    GROUP BY scene_id
),
completed AS (
    SELECT s.id AS scene_id, count(DISTINCT slp.session_id) AS completed
    FROM scenes s
    JOIN session_last_position slp ON slp.episode_id = s.episode_id
    WHERE slp.position_ms >= s.end_ms OR slp.finished
    GROUP BY s.id
),
dropped AS (
    SELECT s.id AS scene_id, count(DISTINCT slp.session_id) AS dropped
    FROM scenes s
    JOIN session_last_position slp ON slp.episode_id = s.episode_id
    WHERE NOT slp.finished
      AND slp.position_ms >= s.start_ms
      AND slp.position_ms <  s.end_ms
    GROUP BY s.id
),
replays AS (
    SELECT scene_id, count(DISTINCT session_id) AS replays
    FROM scene_playback
    WHERE event_type = 'seek' AND seek_to_ms < position_ms
    GROUP BY scene_id
),
skips AS (
    SELECT scene_id, count(DISTINCT session_id) AS skips
    FROM scene_playback
    WHERE event_type = 'skip' AND seek_to_ms > position_ms
    GROUP BY scene_id
),
speed AS (
    SELECT scene_id, avg(speed) AS avg_speed
    FROM scene_playback
    WHERE event_type = 'heartbeat' AND speed IS NOT NULL
    GROUP BY scene_id
)
SELECT
    s.id                AS scene_id,
    s.episode_id,
    s.order_index       AS scene_order,
    s.title,
    s.function,
    COALESCE(r.reached, 0)   AS reached,
    COALESCE(c.completed, 0) AS completed,
    round(COALESCE(d.dropped,0)::numeric / NULLIF(r.reached,0), 3) AS drop_off_rate,
    round(COALESCE(rp.replays,0)::numeric / NULLIF(r.reached,0), 3) AS replay_rate,
    round(COALESCE(sk.skips,0)::numeric   / NULLIF(r.reached,0), 3) AS skip_rate,
    round(COALESCE(sp.avg_speed,1.0), 2) AS avg_speed
FROM scenes s
LEFT JOIN reached   r  ON r.scene_id  = s.id
LEFT JOIN completed c  ON c.scene_id  = s.id
LEFT JOIN dropped   d  ON d.scene_id  = s.id
LEFT JOIN replays   rp ON rp.scene_id = s.id
LEFT JOIN skips     sk ON sk.scene_id = s.id
LEFT JOIN speed     sp ON sp.scene_id = s.id
ORDER BY s.episode_id, s.order_index;

-- ---------- Episode-level return rate (did they come back for the next one?) ----------
CREATE VIEW episode_return_rate AS
WITH starters AS (
    SELECT e.id AS episode_id, e.order_index, e.series_id, pe.user_id
    FROM playback_events pe
    JOIN episodes e ON e.id = pe.episode_id
    WHERE pe.event_type = 'play_start' AND pe.user_id IS NOT NULL
    GROUP BY e.id, e.order_index, e.series_id, pe.user_id
)
SELECT a.episode_id,
       count(DISTINCT a.user_id) AS listeners,
       count(DISTINCT b.user_id) AS returned_next,
       round(count(DISTINCT b.user_id)::numeric
             / NULLIF(count(DISTINCT a.user_id),0), 3) AS return_next_ep_rate
FROM starters a
LEFT JOIN starters b
       ON b.series_id  = a.series_id
      AND b.order_index = a.order_index + 1
      AND b.user_id    = a.user_id
GROUP BY a.episode_id
ORDER BY a.episode_id;

-- ---------- Audience investment per character ----------
-- The silent vote. A character the audience secretly loves shows up as:
-- high replay + low skip + low drop-off on the scenes they're in.
-- Deliberately NOT ratings-based: nobody rates a side character.
CREATE VIEW character_investment AS
SELECT
    c.id   AS character_id,
    c.name,
    c.role,
    count(DISTINCT se.scene_id) AS scenes_present,
    round(avg(se.replay_rate), 3)  AS avg_replay_rate,
    round(avg(se.skip_rate), 3)    AS avg_skip_rate,
    round(avg(se.drop_off_rate),3) AS avg_drop_off_rate,
    -- investment_score: rewards rewinding, punishes skipping and bailing.
    -- Scaled 0-100 for readability. Weights are a product decision, not a fit.
    round(100 * greatest(0,
          0.60 * avg(se.replay_rate)
        - 0.25 * avg(se.skip_rate)
        - 0.15 * avg(se.drop_off_rate)
        + 0.20 * avg(se.completed::numeric / NULLIF(se.reached,0))
    ), 1) AS investment_score
FROM characters c
JOIN scene_characters sc ON sc.character_id = c.id
JOIN scene_engagement se ON se.scene_id = sc.scene_id
GROUP BY c.id, c.name, c.role
ORDER BY investment_score DESC;

-- ---------- Audience investment per plot thread ----------
CREATE VIEW thread_investment AS
SELECT
    pt.id AS thread_id,
    pt.thread,
    pt.status,
    count(DISTINCT se.scene_id) AS scenes_touching,
    round(avg(se.replay_rate), 3)   AS avg_replay_rate,
    round(avg(se.skip_rate), 3)     AS avg_skip_rate,
    round(avg(se.drop_off_rate), 3) AS avg_drop_off_rate,
    round(100 * greatest(0,
          0.60 * avg(se.replay_rate)
        - 0.30 * avg(se.skip_rate)
        - 0.20 * avg(se.drop_off_rate)
        + 0.20 * avg(se.completed::numeric / NULLIF(se.reached,0))
    ), 1) AS investment_score
FROM plot_threads pt
JOIN scene_threads st ON st.thread_id = pt.id
JOIN scene_engagement se ON se.scene_id = st.scene_id
GROUP BY pt.id, pt.thread, pt.status
ORDER BY investment_score DESC;

-- ---------- Revamp candidates: scenes the AI should rewrite, ranked ----------
-- This is the trigger list from the product spec, expressed as SQL.
-- No model decides what's weak. Arithmetic does. The LLM only explains WHY.
CREATE VIEW revamp_candidates AS
SELECT
    se.*,
    (CASE WHEN se.drop_off_rate > 0.20 THEN 1 ELSE 0 END
   + CASE WHEN se.skip_rate     > 0.30 THEN 1 ELSE 0 END
   + CASE WHEN se.avg_speed     > 1.15 THEN 1 ELSE 0 END
   + CASE WHEN se.replay_rate   < 0.10 THEN 1 ELSE 0 END) AS triggers_fired,
    -- drop-off and skip weighted near-equally: both are abandonment. One leaves
    -- the app, the other jumps the scene. Keep in sync with weakness_score()
    -- in data/generate_pulse_data.py.
    round( 100 * (0.40 * se.drop_off_rate
                + 0.35 * se.skip_rate
                + 0.15 * greatest(se.avg_speed - 1.0, 0)
                + 0.10 * (1 - se.replay_rate)), 1) AS weakness_score
FROM scene_engagement se
ORDER BY weakness_score DESC;
