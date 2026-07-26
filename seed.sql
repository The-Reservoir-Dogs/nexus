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
-- prev_episode_id chains each episode to the one before it on THIS timeline.
INSERT INTO episodes (id, series_id, season_id, title, content, summary, prev_episode_summary,
                      order_index, author_id, is_canonical, verified_by_author, decision_point,
                      prev_episode_id, audio_duration_ms)
OVERRIDING SYSTEM VALUE VALUES
  (1001, 10, 100, 'The Gathering Storm',
   E'Rain hammered the ramparts of Greymoor as Prince Aldric read the war declaration a third time, as if the words might rearrange themselves into something survivable.\n\n"House Corvin marches at dawn," said Sera, wringing rain from her cloak. "Three thousand spears. Maybe more."\n\nAldric folded the parchment along its old creases. His father had died with the realm at peace; he would not let it burn in a single season. "Then we ride to meet them," he said, "before they choose the ground for us."\n\nBelow in the yards the war-drums began, low and patient, and the long night of the war of houses opened its eye.',
   'Aldric learns House Corvin has declared war and rides to meet them.', NULL, 1, 1, true, false, NULL, NULL, 174000),
  (1002, 10, 100, 'Blood on the Snow',
   E'The first battle broke at dawn on the Whitefield, and by midmorning the snow was no longer white.\n\nAldric fought at the center where the line bent but did not break. Beside him, old Ser Hallis — who had taught him the sword when his hands were too small to hold it — took a Corvin lance meant for the prince.\n\n"Hold the line," Hallis breathed, and then he held nothing at all.\n\nThey won the field. Aldric did not feel like a victor. He knelt in the red slush beside his mentor and understood, for the first time, the true price of the crown he would one day wear.',
   'Aldric wins a brutal battle but loses his mentor Ser Hallis.', 'Aldric learns of the war and rides out.', 2, 1, true, false, NULL, 1001, 174000),
  (1003, 10, 100, 'The Spared Blade',
   E'Lady Corvin knelt in the mud of her own broken camp, blade at her throat, and did not look away.\n\n"Do it, boy," she said. "Or don\'t. But spare me the sermon."\n\nAldric\'s arm ached with the weight of the sword and the weight of every man who had died to put her here. One stroke would end the war. One stroke would also end the part of him that his father had believed in.\n\nHe hesitated — and lowered his sword. "Iron chains, not iron in the belly," he told his captains. "She is worth more alive."\n\nCorvin watched him with an expression he could not read: not gratitude, not quite. Somewhere between contempt and calculation, a door had opened that neither of them could close.',
   'Aldric captures Lady Corvin and chooses to spare her rather than execute her.', 'Aldric wins a costly battle and loses his mentor.', 3, 1, true, false,
   'The hero spares the villain, Lady Corvin, instead of executing her.', 1002, 174000),
  (1004, 10, 100, 'Uneasy Peace',
   E'Mercy bought a fragile truce, and fragile things, Aldric would learn, are the most expensive of all.\n\nCorvin was given rooms in the west tower — a prisoner in silk. She dined at his table, advised his council, and let her clipped proverbs settle into the cracks of his court like water before a frost.\n\n"You spared me because you are good," she told him one evening, "and goodness is a debt your enemies will collect."\n\nThat same night, riders came from the north with news that emptied the room: something old had woken beyond the border, and it did not care whose banner flew over Greymoor.',
   'The spared Corvin becomes an uneasy ally at court; a new threat stirs in the north.', 'Aldric spares Lady Corvin.', 4, 1, true, false,
   'Aldric must decide whether to trust Corvin''s counsel about the northern threat.', 1003, 174000);

-- ---------- Alternate timelines forked from ep 1003 ----------
-- First branch episode: prev_episode_id = the decision point (1003), forked_from = 1003.
INSERT INTO episodes (id, series_id, season_id, title, content, summary, prev_episode_summary,
                      order_index, author_id, co_author_id, forked_from_episode_id,
                      is_canonical, verified_by_author, decision_point,
                      prev_episode_id, audio_duration_ms)
OVERRIDING SYSTEM VALUE VALUES
  (2001, 10, 100, 'The Fallen Blade',
   E'The blade fell without hesitation.\n\nLady Corvin\'s eyes went wide, then still, and the war that might have ended in mercy ended instead in a single wet sound that Aldric would hear for the rest of his life.\n\n"It is done," he told the silent camp. No one cheered.\n\nBy the time the sun cleared the ridge, Captain Verr had cut his way free and vanished north with a dozen loyal blades and a promise on his lips. The war would not end here. It would drown — and Aldric had handed it the water.',
   'Aldric executes Lady Corvin; her captain escapes and the war escalates into vengeance.', 'Aldric captures Lady Corvin.', 4, 1, 3, 1003,
   false, true,  'What if she killed him instead? — Aldric executes Lady Corvin.', 1003, 174000),
  (2002, 10, 100, 'A Bargain in Blood',
   E'Corvin smiled up at him through the mud, unbothered by the steel at her throat.\n\n"Kill me and you kill your only road to the throne," she said. "Your uncle wants it too, or hadn\'t you noticed? Or… we could make a deal."\n\nAldric should have struck. Instead he listened — and listening, he later thought, was the first bar of the cage.\n\nThey sealed it the old way, a blood oath sworn over a shared cut, and the two houses that had bled each other for a generation became, in one breath, something far more dangerous: allies.',
   'Aldric strikes a dark blood-oath pact with Corvin instead of sparing or killing her.', 'Aldric captures Lady Corvin.', 4, 1, 3, 1003,
   false, false, 'What if Aldric made a pact with Corvin?', 1003, 174000);

-- N+2: continuation of the execution branch (prev = 2001). forked_from stays 1003
-- (branch origin), but prev_episode_id = 2001 makes this the SECOND episode of that
-- timeline. This is what episode_ancestry walks to give the agent N+2 context.
INSERT INTO episodes (id, series_id, season_id, title, content, summary, prev_episode_summary,
                      order_index, author_id, co_author_id, forked_from_episode_id,
                      is_canonical, verified_by_author, decision_point,
                      prev_episode_id, audio_duration_ms)
OVERRIDING SYSTEM VALUE VALUES
  (2003, 10, 100, 'The Vengeance Tide',
   E'With Corvin dead, Captain Verr raised the black banners, and grief did what her armies never could: it united the border houses against Greymoor.\n\nThey called Aldric the Blade of Greymoor now, and they did not mean it kindly. Villages that had cheered him shuttered their doors.\n\n"You ended one enemy," Sera said quietly, cleaning her knife by the fire, "and forged a thousand."\n\nAldric said nothing. In the dark beyond the firelight he thought he could still see Corvin kneeling, could still hear her: goodness is a debt your enemies will collect. He had chosen not to be good, and the debt had come due anyway.',
   'Corvin''s loyalists rise under Verr; Aldric is hunted for the execution.',
   'Aldric executed Lady Corvin.', 5, 1, 3, 1003,
   false, false, 'Aldric must answer the uprising his execution provoked.', 2001, 174000);

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

-- character_state snapshots. status is per-timeline (overrides characters.status).
-- Along the EXECUTION branch, Corvin is DEAD; on the sacred timeline she stays alive.
INSERT INTO character_state (id, character_id, episode_id, memory_snapshot, char_summary, status) OVERRIDING SYSTEM VALUE VALUES
  (800, 701, 1003, 'Captured, at Aldric''s mercy. Bitter but observant; gauging whether he is weak or wise.',
   'Lady Corvin, defeated but unbroken, kneels before Aldric.', 'alive'),
  (801, 700, 1003, 'Just won a costly battle; sickened by killing. Holding the blade over a kneeling enemy.',
   'Aldric, victorious but morally exhausted, faces the choice to kill or spare.', 'alive'),
  -- execution branch (ep 2001): Corvin dies, Aldric crosses a line
  (802, 701, 2001, 'Executed by Aldric''s blade. Gone — but her loyalists remember.',
   'Lady Corvin, slain in the mud.', 'dead'),
  (803, 700, 2001, 'Killed a kneeling enemy. The mercy he prided himself on is gone.',
   'Aldric, now a man who executes prisoners.', 'alive'),
  -- N+2 (ep 2003): Aldric''s memory evolves; Corvin remains dead via ancestry (no new row needed)
  (804, 700, 2003, 'Hunted by Corvin''s loyalists under Captain Verr. Haunted by the execution.',
   'Aldric, besieged by the vengeance his choice unleashed.', 'alive');

-- relationship state: on the execution branch the captor/captive bond becomes killer/hunted.
INSERT INTO char_relationship_state (char_id, relation_char_id, episode_id, relationship_summary) VALUES
  (700, 701, 2001, 'Killer and victim. Corvin''s loyalists now hunt Aldric for her death.');

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

-- plot thread state: "fate of Corvin" resolves on the execution branch; stays open in canon.
INSERT INTO plot_thread_state (thread_id, episode_id, status, note) VALUES
  (400, 2001, 'resolved', 'Lady Corvin executed by Aldric.');

-- ---------- Reviews / comments (across episodes) ----------
INSERT INTO reviews (id, episode_id, created_by, review_text, parent_review_id) OVERRIDING SYSTEM VALUE VALUES
  -- ep 1001
  (5101, 1001, 2, 'What an opening. The drums line gave me chills.', NULL),
  (5102, 1001, 4, 'Aldric already feels doomed and I am here for it.', NULL),
  (5103, 1001, 3, 'Three thousand spears against Greymoor? He is going to need Corvin alive.', 5102),
  -- ep 1002
  (5201, 1002, 4, 'Ser Hallis dying in the first real battle... I was not ready.', NULL),
  (5202, 1002, 2, '"Hold the line" and then he holds nothing. Brutal, perfect.', NULL),
  -- ep 1003 (the decision point)
  (5001, 1003, 2, 'What if she killed him instead? This mercy will haunt him.', NULL),  -- the "driving" comment
  (5002, 1003, 4, 'Loved the restraint — totally in character for Aldric.', NULL),
  (5003, 1003, 3, 'Agreed with Amy, an execution timeline would be brutal. I want to write it.', 5001),
  (5004, 1003, 4, 'That last look between them is the whole series in one beat.', NULL),
  -- ep 1004
  (5301, 1004, 2, '"Goodness is a debt your enemies will collect" — chills. Corvin is the best.', NULL),
  (5302, 1004, 3, 'The northern threat teaser is a great hook into season 2.', NULL),
  -- fork ep 2001
  (5401, 2001, 4, 'Colder, darker, and the Verr escape is a great thread. Love this branch.', NULL),
  (5402, 2001, 2, 'This is the timeline I wanted. Aldric paying for it is the point.', NULL);

-- ---------- Ratings ----------
INSERT INTO ratings (id, episode_id, user_id, score) OVERRIDING SYSTEM VALUE VALUES
  (6001, 1001, 2, 4), (6002, 1001, 4, 5), (6014, 1001, 3, 4),
  (6003, 1002, 2, 5), (6004, 1002, 4, 4), (6015, 1002, 3, 5),
  (6005, 1003, 2, 5), (6006, 1003, 4, 5), (6007, 1003, 3, 4), (6016, 1003, 1, 5),
  (6008, 1004, 2, 4), (6017, 1004, 3, 4), (6018, 1004, 4, 5),
  (6009, 2001, 2, 5), (6010, 2001, 4, 5), (6011, 2001, 1, 5),   -- verified fork: high
  (6012, 2002, 2, 3), (6013, 2002, 4, 4),                        -- other fork: lower
  (6019, 2003, 4, 4), (6020, 2003, 2, 5);

-- ---------- Synthetic playback for ep 1003 (retention demo) ----------
-- ~120 sessions; per-bucket survival reproduces a curve with a sharp cliff at ~1:40.
-- Emits play_start (bucket 0) + heartbeats per surviving bucket + complete at the end.
WITH pct(b, p) AS (VALUES
    (0,1.00),(1,0.98),(2,0.95),(3,0.91),(4,0.88),(5,0.79),(6,0.74),(7,0.71),
    (8,0.68),(9,0.61),(10,0.44),(11,0.41),(12,0.39),(13,0.37),(14,0.35),(15,0.33)),
  sess AS (SELECT g AS n, gen_random_uuid() AS sid FROM generate_series(1,120) g)
INSERT INTO playback_events (episode_id, user_id, session_id, event_type, position_ms, duration_ms, speed, device, autoplay)
SELECT 1003, NULL, s.sid,
       CASE WHEN pct.b = 0 THEN 'play_start'
            WHEN pct.b = 15 THEN 'complete'
            ELSE 'heartbeat' END,
       pct.b * 10000, 174000, 1.0, 'web', false
FROM sess s JOIN pct ON s.n <= round(pct.p * 120);

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
