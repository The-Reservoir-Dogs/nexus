-- ---------------------------------------------------------------------------
-- Seed alternate-timeline branches for "Sherlock Holmes: The Baker Street
-- Casebook" (series_id = 20, season_id = 200).
--
-- Each branch forks a canonical decision point: forked_from_episode_id marks the
-- branch origin and prev_episode_id chains it as the next episode on the new
-- timeline. Idempotent: each insert is guarded by NOT EXISTS on
-- (forked_from_episode_id, decision_point) so re-running adds nothing.
--
-- author_id 2  = author_watson (series author)
-- co_author_id 11 = sriman (AI co-author stand-in used by the existing branch)
-- ---------------------------------------------------------------------------
BEGIN;

-- Branch 1 — fork at Ep.5 "They Were Married": Holmes chooses silence.
INSERT INTO episodes
  (series_id, season_id, title, content, summary, prev_episode_summary, order_index,
   author_id, co_author_id, forked_from_episode_id, prev_episode_id,
   decision_point, is_canonical, verified_by_author)
SELECT
  20, 200,
  'They Were Married — The Kinder Lie',
  E'[ The drawing room, Cunningham house ]\n\n'
  || E'I have seen Holmes withhold the truth on perhaps three occasions in all our years together, and on every one of them it cost him something to do it. This was the first.\n\n'
  || E'Lestrade waited, notebook open, for the motive he knew Holmes was carrying. I watched my friend look once at the widow — grey, upright, quite certain she was about to be saved by cleverness — and then he closed his mouth on the thing that would have hanged her.\n\n'
  || E'"I have nothing for you, Inspector," said Holmes. "The marriage is a matter of record and no more. Whoever did this left me nothing to read."\n\n'
  || E'It was a lie, and a good one, and it saved a life. But a truth does not stop existing merely because a clever man declines to speak it, and I saw in Holmes''s face that he already knew what such a silence would eventually cost some other, innocent, party further down the road.',
  'At the moment he could hand Lestrade the motive that condemns the widow, Holmes chooses silence instead. The innocent woman walks free — but the real murderer walks with her, and Holmes must live with a case deliberately left unsolved.',
  'Holmes has just worked out the marriage that supplies the motive Lestrade was missing.',
  6, 2, 11, 2105, 2105,
  'What if Holmes held his tongue and let the widow walk free?',
  false, false
WHERE NOT EXISTS (
  SELECT 1 FROM episodes
  WHERE forked_from_episode_id = 2105
    AND decision_point = 'What if Holmes held his tongue and let the widow walk free?'
);

-- Branch 2 — fork at Ep.6 "A Thousand Pounds a Week": Holmes leaves before the killer returns.
INSERT INTO episodes
  (series_id, season_id, title, content, summary, prev_episode_summary, order_index,
   author_id, co_author_id, forked_from_episode_id, prev_episode_id,
   decision_point, is_canonical, verified_by_author)
SELECT
  20, 200,
  'A Thousand Pounds a Week — Patience',
  E'[ Baker Street, past midnight ]\n\n'
  || E'"We leave," said Holmes, pocketing the chequebook, "before he comes home."\n\n'
  || E'I confess I was relieved. I had spent the evening waiting for a revolver in the dark, and the sound of Holmes proposing daylight and due process was a great comfort to my nerves.\n\n'
  || E'"Lestrade will not reopen the case," I reminded him on the stair.\n\n'
  || E'"Lestrade will reopen any case you place, fully proved, upon his desk at nine in the morning," said Holmes. "The chequebook is enough. I would rather hand him a conviction than surprise a murderer in his own hall and hand him a corpse — possibly my own."\n\n'
  || E'So we went home, and I slept, and in the morning Holmes was proved right and dull and alive all at once, which he informed me was the least satisfying way for a man of his temperament to be correct.',
  'Rather than lie in wait for the murderer at night, Holmes takes the chequebook and leaves, choosing to build a documented case and force Lestrade to reopen it in daylight. Safer, slower, and it robs the killer of the chance to run.',
  'Holmes has found the chequebook nobody thought to open, and Lestrade has refused to reopen the closed case.',
  7, 2, 11, 2106, 2106,
  'What if Holmes left the house before the murderer returned?',
  false, false
WHERE NOT EXISTS (
  SELECT 1 FROM episodes
  WHERE forked_from_episode_id = 2106
    AND decision_point = 'What if Holmes left the house before the murderer returned?'
);

-- Branch 3 — fork at Ep.10 "Oberstein Was Not Shot": Watson never makes Holmes repeat himself.
INSERT INTO episodes
  (series_id, season_id, title, content, summary, prev_episode_summary, order_index,
   author_id, co_author_id, forked_from_episode_id, prev_episode_id,
   decision_point, is_canonical, verified_by_author)
SELECT
  20, 200,
  'Oberstein Was Not Shot — The Case That Closed',
  E'[ The study, Lord Beryl''s house ]\n\n'
  || E'Holmes said something under his breath about Lady Beryl and a lie, and I — tired, and thinking of my dinner — did not ask him to repeat it.\n\n'
  || E'It is a small thing, to fail to ask a question. I have thought about it a great deal since.\n\n'
  || E'Lestrade''s case was complete and satisfying, and with no one to take it apart it simply stood. Lady Beryl was tried on the strength of her own confession, and the ballistics that would have unmade the whole thing went back to Baker Street unspoken, in Holmes''s coat pocket, and stayed there.\n\n'
  || E'"You were quiet at the trial," I said to him afterwards.\n\n'
  || E'"I was," said Holmes, and did not explain himself, and for once I did not press him. We have both regretted it since — he in his way, and I in mine.',
  'Watson, tired and distracted, never asks Holmes to repeat his muttered doubt about Lady Beryl. The ballistics lesson that would have dismantled the case is never spoken, Lestrade''s tidy version stands, and an innocent woman is convicted on her own confession.',
  'Holmes has just muttered that he wonders why Lady Beryl lied.',
  11, 2, 11, 2110, 2110,
  'What if Watson never made Holmes repeat his remark?',
  false, false
WHERE NOT EXISTS (
  SELECT 1 FROM episodes
  WHERE forked_from_episode_id = 2110
    AND decision_point = 'What if Watson never made Holmes repeat his remark?'
);

COMMIT;
