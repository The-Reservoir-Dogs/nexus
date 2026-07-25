-- ============================================================
-- NEXUS seed — "The Hollow Crown" living universe for the demo
-- Uses explicit ids (OVERRIDING SYSTEM VALUE) so FKs are stable.
-- Sequences are re-synced at the end.
-- ============================================================
BEGIN;

-- ---------- Users ----------
INSERT INTO users (id, username, password_hash) OVERRIDING SYSTEM VALUE VALUES
  (1, 'sriman',       'x'),   -- original author
  (2, 'reader_amy',   'x'),
  (3, 'coauthor_ravi','x'),   -- co-author (directs an alternate timeline)
  (4, 'reader_john',  'x');

-- ---------- Series ----------
INSERT INTO series (id, title, description, summary, genre, tag, author_id) OVERRIDING SYSTEM VALUE VALUES
  (10, 'The Hollow Crown',
       'A kingdom fractured by a single act of mercy.',
       'Political dark fantasy of warring houses and one fateful decision.',
       'Fantasy', 'political,drama,dark', 1);

-- ---------- Season ----------
INSERT INTO seasons (id, series_id, title, summary, description, order_index) OVERRIDING SYSTEM VALUE VALUES
  (100, 10, 'Season 1', 'The fall begins.', 'The opening arc of the war of houses.', 1);

-- ---------- Canonical episodes (sacred timeline) ----------
INSERT INTO episodes (id, series_id, season_id, title, content, summary, prev_episode_summary,
                      order_index, author_id, is_canonical, verified_by_author, decision_point)
OVERRIDING SYSTEM VALUE VALUES
  (1001, 10, 100, 'The Gathering Storm',
   'Rain hammered the ramparts of Greymoor as Prince Aldric read the war declaration...',
   'Aldric learns House Corvin has declared war.', NULL, 1, 1, true, false, NULL),
  (1002, 10, 100, 'Blood on the Snow',
   'The first battle broke at dawn. Aldric watched good men fall for a border stone...',
   'Aldric wins a brutal battle but loses his mentor.', 'Aldric learns of the war.', 2, 1, true, false, NULL),
  (1003, 10, 100, 'The Spared Blade',
   'Lady Corvin knelt in the mud, blade at her throat. Aldric hesitated — and lowered his sword.',
   'Aldric captures Lady Corvin and chooses to spare her.', 'Aldric wins a costly battle.', 3, 1, true, false,
   'The hero spares the villain, Lady Corvin, instead of executing her.'),
  (1004, 10, 100, 'Uneasy Peace',
   'Mercy bought a fragile truce. But mercy, Aldric would learn, has a price...',
   'The spared Corvin becomes an uneasy ally; a new threat stirs.', 'Aldric spares Lady Corvin.', 4, 1, true, false, NULL);

-- ---------- Alternate timelines forked from ep 1003 ----------
INSERT INTO episodes (id, series_id, season_id, title, content, summary, prev_episode_summary,
                      order_index, author_id, co_author_id, forked_from_episode_id,
                      is_canonical, verified_by_author, decision_point)
OVERRIDING SYSTEM VALUE VALUES
  (2001, 10, 100, 'The Fallen Blade',
   'The blade fell without hesitation. Lady Corvin''s eyes went wide, then still. The war would not end here — it would drown.',
   'Aldric executes Lady Corvin; the war escalates into vengeance.', 'Aldric captures Lady Corvin.', 4, 1, 3, 1003,
   false, true,  'What if she killed him instead? — Aldric executes Lady Corvin.'),
  (2002, 10, 100, 'A Bargain in Blood',
   'Corvin smiled through the mud. "Kill me and you kill your only path to the throne. Or... we could make a deal."',
   'Aldric strikes a dark pact with Corvin instead of sparing or killing.', 'Aldric captures Lady Corvin.', 4, 1, 3, 1003,
   false, false, 'What if Aldric made a pact with Corvin?');

-- ---------- Characters ----------
INSERT INTO characters (id, series_id, name, description, role, personality, backstory, goals, speech_style, status)
OVERRIDING SYSTEM VALUE VALUES
  (700, 10, 'Prince Aldric', 'Heir of Greymoor.', 'protagonist',
   'Principled, weary, merciful to a fault.', 'Raised to rule, forged by war.',
   'End the war without becoming a monster.', 'Measured, plain-spoken, avoids grand oaths.', 'alive'),
  (701, 10, 'Lady Corvin', 'Head of the rival house.', 'antagonist',
   'Calculating, proud, secretly loyal to her people.', 'Lost her family to Greymoor decades ago.',
   'Reclaim her house''s honor by any means.', 'Formal, clipped, fond of old proverbs.', 'alive'),
  (702, 10, 'Sera', 'Aldric''s scout and conscience.', 'side',
   'Sharp, loyal, darkly funny.', 'A commoner who rose through the ranks.',
   'Keep Aldric human.', 'Wry, fast, uses camp slang.', 'alive');

INSERT INTO char_relationship (id, char_id, relation_char_id, relationship_summary) OVERRIDING SYSTEM VALUE VALUES
  (900, 700, 701, 'Sworn enemies turned uneasy captor and captive.'),
  (901, 700, 702, 'Trusts Sera above all his advisors.');

INSERT INTO character_state (id, character_id, episode_id, memory_snapshot, char_summary) OVERRIDING SYSTEM VALUE VALUES
  (800, 701, 1003, 'Captured, at Aldric''s mercy. Bitter but observant; gauging whether he is weak or wise.',
   'Lady Corvin, defeated but unbroken, kneels before Aldric.'),
  (801, 700, 1003, 'Just won a costly battle; sickened by killing. Holding the blade over a kneeling enemy.',
   'Aldric, victorious but morally exhausted, faces the choice to kill or spare.');

-- ---------- World / lore ----------
INSERT INTO world (id, series_id, entry_type, name, location, description) OVERRIDING SYSTEM VALUE VALUES
  (600, 10, 'location', 'Greymoor', 'Northern highlands', 'Aldric''s ancestral fortress-city.'),
  (601, 10, 'faction',  'House Corvin', NULL, 'The rival house, old and vengeful.'),
  (602, 10, 'rule',     'The Blood Oath', NULL, 'A pact sealed in blood cannot be broken without death.');

-- ---------- Style guide ----------
INSERT INTO style_guide (id, series_id, pov, tense, tone, pacing, content_rating, narrative_voice)
OVERRIDING SYSTEM VALUE VALUES
  (500, 10, 'third-limited', 'past', 'Dark, tense, morally grey.', 'Measured with sharp violent beats.',
   'MA', 'Grounded and cinematic; short punchy sentences at climaxes.');

-- ---------- Plot threads ----------
INSERT INTO plot_threads (id, series_id, thread, status, opened_episode_id, resolved_episode_id)
OVERRIDING SYSTEM VALUE VALUES
  (400, 10, 'The fate of the captured Lady Corvin.', 'open', 1003, NULL),
  (401, 10, 'A shadow threat stirring beyond the northern border.', 'open', 1004, NULL);

-- ---------- Reviews / comments (ep 1003) ----------
INSERT INTO reviews (id, episode_id, created_by, review_text, parent_review_id) OVERRIDING SYSTEM VALUE VALUES
  (5001, 1003, 2, 'What if she killed him instead? This mercy will haunt him.', NULL),  -- the "driving" comment
  (5002, 1003, 4, 'Loved the restraint — totally in character for Aldric.', NULL),
  (5003, 1003, 3, 'Agreed with Amy, an execution timeline would be brutal. I want to write it.', 5001);

-- ---------- Ratings ----------
INSERT INTO ratings (id, episode_id, user_id, score) OVERRIDING SYSTEM VALUE VALUES
  (6001, 1001, 2, 4), (6002, 1001, 4, 5),
  (6003, 1002, 2, 5), (6004, 1002, 4, 4),
  (6005, 1003, 2, 5), (6006, 1003, 4, 5), (6007, 1003, 3, 4),
  (6008, 1004, 2, 4),
  (6009, 2001, 2, 5), (6010, 2001, 4, 5), (6011, 2001, 1, 5),   -- verified fork: high
  (6012, 2002, 2, 3), (6013, 2002, 4, 4);                        -- other fork: lower

-- ---------- Re-sync identity sequences past the explicit ids ----------
SELECT setval(pg_get_serial_sequence('users','id'),        (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('series','id'),       (SELECT max(id) FROM series));
SELECT setval(pg_get_serial_sequence('seasons','id'),      (SELECT max(id) FROM seasons));
SELECT setval(pg_get_serial_sequence('episodes','id'),     (SELECT max(id) FROM episodes));
SELECT setval(pg_get_serial_sequence('characters','id'),   (SELECT max(id) FROM characters));
SELECT setval(pg_get_serial_sequence('char_relationship','id'), (SELECT max(id) FROM char_relationship));
SELECT setval(pg_get_serial_sequence('character_state','id'),   (SELECT max(id) FROM character_state));
SELECT setval(pg_get_serial_sequence('world','id'),        (SELECT max(id) FROM world));
SELECT setval(pg_get_serial_sequence('style_guide','id'),  (SELECT max(id) FROM style_guide));
SELECT setval(pg_get_serial_sequence('plot_threads','id'), (SELECT max(id) FROM plot_threads));
SELECT setval(pg_get_serial_sequence('reviews','id'),      (SELECT max(id) FROM reviews));
SELECT setval(pg_get_serial_sequence('ratings','id'),      (SELECT max(id) FROM ratings));

COMMIT;
