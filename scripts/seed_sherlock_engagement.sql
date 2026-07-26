-- ---------------------------------------------------------------------------
-- Demo engagement for "Sherlock Holmes: The Baker Street Casebook" (series 20):
-- a handful of reader accounts, ratings on canonical + branch episodes, and a
-- couple of threaded comment discussions.
--
-- Idempotent:
--   * users        -> ON CONFLICT (username) DO NOTHING
--   * ratings      -> ON CONFLICT (episode_id, user_id) DO UPDATE
--   * reviews      -> guarded by NOT EXISTS on (episode_id, created_by, text)
-- Safe to re-run.
-- ---------------------------------------------------------------------------
BEGIN;

-- ---- demo reader accounts (password_hash is a placeholder; local auth uses
--      DEV_USER / x-nexus-dev-user impersonation, so these never log in) ----
INSERT INTO users (username, password_hash) VALUES
  ('reader_ada',   'x'),
  ('reader_iris',  'x'),
  ('reader_jules', 'x'),
  ('reader_nora',  'x')
ON CONFLICT (username) DO NOTHING;

-- ---- ratings ---------------------------------------------------------------
-- Spread scores across canonical highlights and every branch so the demo shows
-- non-trivial averages and counts.
INSERT INTO ratings (episode_id, user_id, score)
SELECT e.id, u.id, v.score
FROM (VALUES
  -- canonical
  (2105, 'sriman',       5),
  (2105, 'author_watson',4),
  (2105, 'reader_ada',   5),
  (2105, 'reader_iris',  4),
  (2105, 'reader_jules', 5),
  (2110, 'sriman',       5),
  (2110, 'reader_ada',   5),
  (2110, 'reader_nora',  4),
  (2112, 'reader_iris',  5),
  (2112, 'reader_jules', 4),
  -- branches
  (4116, 'sriman',       4),
  (4116, 'reader_ada',   3),
  (4116, 'reader_iris',  4),
  (4117, 'sriman',       5),
  (4117, 'reader_ada',   5),
  (4117, 'reader_jules', 4),
  (4117, 'reader_nora',  5),
  (4118, 'reader_iris',  3),
  (4118, 'reader_jules', 4),
  (4118, 'author_watson',4),
  (4119, 'sriman',       5),
  (4119, 'reader_ada',   4),
  (4119, 'reader_nora',  5)
) AS v(episode_id, username, score)
JOIN episodes e ON e.id = v.episode_id
JOIN users u ON u.username = v.username
ON CONFLICT (episode_id, user_id) DO UPDATE SET score = EXCLUDED.score;

-- ---- comments (reviews), including one thread ------------------------------
-- Top-level comments.
INSERT INTO reviews (episode_id, created_by, review_text)
SELECT e.id, u.id, v.review_text
FROM (VALUES
  (2105, 'reader_ada',   'The moment Holmes hands Lestrade the rope is chilling. Nobody thanks him and that is exactly right.'),
  (2110, 'reader_nora',  'That ballistics turn took the whole case apart in two pages. Loved it.'),
  (4117, 'reader_jules', 'A Holmes who chooses the kinder lie is a Holmes I did not know I needed. Great branch.'),
  (4119, 'reader_iris',  'Brutal. One unasked question and an innocent woman hangs. This ending haunted me.'),
  (4116, 'reader_ada',   'The "what if she killed him" fork is a great entry point for new readers.')
) AS v(episode_id, username, review_text)
JOIN episodes e ON e.id = v.episode_id
JOIN users u ON u.username = v.username
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r
  WHERE r.episode_id = e.id AND r.created_by = u.id AND r.review_text = v.review_text
);

-- Threaded replies (author + reader responding to the top-level comment on 4117).
INSERT INTO reviews (episode_id, created_by, review_text, parent_review_id)
SELECT p.episode_id, u.id, v.review_text, p.id
FROM (VALUES
  ('sriman',      'Glad it landed — the silence costs him later, which is the whole point of the branch.'),
  ('reader_nora', 'Agreed. It reframes his coldness in the canonical timeline too.')
) AS v(username, review_text)
JOIN users u ON u.username = v.username
JOIN reviews p ON p.episode_id = 4117
             AND p.parent_review_id IS NULL
             AND p.review_text LIKE 'A Holmes who chooses the kinder lie%'
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r
  WHERE r.parent_review_id = p.id AND r.created_by = u.id AND r.review_text = v.review_text
);

COMMIT;
