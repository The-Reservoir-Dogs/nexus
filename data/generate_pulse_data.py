#!/usr/bin/env python3
"""
PULSE — synthetic listener-signal generator for "The Hollow Crown".

WHY THIS EXISTS
---------------
We have no real Pocket FM behavioural data. This script fabricates it, but not
randomly: it plants known weaknesses in specific scenes and then simulates how
10 listener personas would behave against them. That gives us FREE GROUND TRUTH
-- we know which scene is broken and why, so we can prove the detector found the
right one rather than just drawing a pretty chart.

Everything emitted here is SIMULATED and is labelled as such in the output.
The engagement math that consumes it (schema_pulse.sql views) is real arithmetic
on the event log -- no model, no ML, no fitting.

WHAT IS PLANTED (see out/GROUND_TRUTH.md for the full statement)
---------------------------------------------------------------
1. Ep 1004 scene 2 "The Council of Grain" is the dominant weak scene: pure
   logistics exposition, stalls the thread the audience cares about, stars the
   character they skip most, ends with no hook.
2. Ep 1002 scene 5 "The Butcher's Ledger" is a milder second offender, so the
   detector has to RANK, not just flag one thing.
3. Sera (side character) is secretly loved: highest replay, lowest skip. She is
   never in a weak scene. Nobody would ever rate her -- only behaviour reveals it.
4. Maester Ord is the drag: high skip, high speed-up wherever he leads a scene.
5. Thread 400 (Corvin's fate) is high-investment; thread 401 (northern shadow)
   is low-investment. Ep 1004 sags precisely where it swaps 400 for 401.

RUN
---
    python data/generate_pulse_data.py
    (stdlib only -- no pip install)

OUTPUTS -> data/out/
    seed_pulse.sql        scenes, links, extra users/characters/threads, events
    playback_events.csv   raw event log, for pandas/Excel/whiteboard analysis
    scene_engagement.json derived engagement map (verifies the SQL views)
    investment.json       per-character and per-thread investment
    GROUND_TRUTH.md       what we planted, to check the detector against
"""

from __future__ import annotations

import csv
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).parent / "out"
SERIES_ID = 10
SEED = 20260725  # hackathon date; deterministic reruns
NS = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")

HEARTBEAT_MS = 10_000  # matches the 10s buckets in schema.sql's episode_retention view

# The 10 named listeners are the labelled panel -- the ones we show in the UI,
# name on stage, and can point at individually ("Meera rewound this three times").
#
# But 10 users cannot MEASURE anything. Only ~6 of them survive to episode 4,
# so every rate there lands on a denominator of 6 and a drop-off of 0.00 vs 0.33
# is one person having a bad evening. Ranking scenes on that is noise.
#
# ANON_SESSIONS adds anonymous listeners (user_id NULL, which the schema already
# permits) drawn from the same persona mix. Same behaviour model, same
# conclusions -- they just give the arithmetic a denominator worth trusting.
# Set to 0 if you want the strict 10-user-only dataset.
ANON_SESSIONS = 140

# ============================================================
# CHARACTERS  (700-702 already exist in seed.sql; 703 is new)
# ============================================================
NEW_CHARACTERS = [
    dict(
        id=703, name="Maester Ord", description="Greymoor's keeper of ledgers and law.",
        role="side",
        personality="Precise, tireless, utterly without urgency.",
        backstory="Forty years in the same tower room, outlasting three kings.",
        goals="Keep the accounts balanced and the precedents observed.",
        speech_style="Long qualifying clauses, cites precedent, never finishes early.",
        status="alive",
    ),
]

ALDRIC, CORVIN, SERA, ORD = 700, 701, 702, 703

# ============================================================
# PLOT THREADS  (400, 401 exist; 402 is new)
# ============================================================
NEW_THREADS = [
    dict(id=402, thread="The war between Greymoor and House Corvin.",
         status="open", opened_episode_id=1001, resolved_episode_id=None),
]
T_CORVIN_FATE, T_NORTH_SHADOW, T_WAR = 400, 401, 402

# ============================================================
# LISTENERS — 10 personas
# ============================================================
# ids 2,3,4 already exist in seed.sql. 5-11 are new. User 1 (sriman) is the
# author, not a listener, so he is excluded from the panel.
#
# attention   : 1.0 = normal patience. Lower = bails sooner on friction.
# skip        : multiplier on the urge to jump forward out of a dull scene.
# replay      : multiplier on the urge to rewind and re-hear something good.
# base_speed  : their default playback rate.
# speeds_up   : do they crank the speed when bored, or just leave?
# loyalty     : baseline probability of coming back for the next episode.
# sera_bias   : extra pull toward scenes with Sera (the secret-favourite effect).
# repeats_on  : episode ids they re-listen to (a second session).
LISTENERS = [
    dict(id=2,  username="reader_amy",    exists=True,  persona="Devoted follower",
         attention=1.35, skip=0.35, replay=1.55, base_speed=1.00, speeds_up=False,
         loyalty=0.97, sera_bias=1.30, device="android", repeats_on=[1003]),
    dict(id=3,  username="coauthor_ravi", exists=True,  persona="Studies every beat",
         attention=1.50, skip=0.20, replay=1.85, base_speed=1.00, speeds_up=False,
         loyalty=0.99, sera_bias=1.15, device="web",     repeats_on=[1003, 1002]),
    dict(id=4,  username="reader_john",   exists=True,  persona="Commute listener",
         attention=1.00, skip=0.85, replay=0.70, base_speed=1.25, speeds_up=True,
         loyalty=0.88, sera_bias=1.00, device="ios",     repeats_on=[]),
    dict(id=5,  username="reader_priya",  exists=False, persona="Binge completer",
         attention=1.20, skip=0.70, replay=0.85, base_speed=1.50, speeds_up=True,
         loyalty=0.94, sera_bias=1.10, device="android", repeats_on=[]),
    dict(id=6,  username="reader_arjun",  exists=False, persona="Impatient skimmer",
         attention=0.55, skip=1.75, replay=0.35, base_speed=1.50, speeds_up=True,
         loyalty=0.74, sera_bias=0.95, device="android", repeats_on=[]),
    dict(id=7,  username="reader_neha",   exists=False, persona="Emotional listener",
         attention=1.25, skip=0.45, replay=1.90, base_speed=1.00, speeds_up=False,
         loyalty=0.93, sera_bias=1.55, device="ios",     repeats_on=[1003]),
    dict(id=8,  username="reader_vikram", exists=False, persona="Falls asleep listening",
         attention=0.75, skip=0.55, replay=0.90, base_speed=0.90, speeds_up=False,
         loyalty=0.85, sera_bias=1.05, device="android", repeats_on=[1002]),
    dict(id=9,  username="reader_divya",  exists=False, persona="Bails on filler",
         attention=0.65, skip=1.45, replay=0.60, base_speed=1.25, speeds_up=True,
         loyalty=0.82, sera_bias=1.00, device="web",     repeats_on=[]),
    dict(id=10, username="reader_karan",  exists=False, persona="Distracted but loyal",
         attention=0.95, skip=0.75, replay=1.00, base_speed=1.00, speeds_up=False,
         loyalty=0.90, sera_bias=1.10, device="ios",     repeats_on=[]),
    dict(id=11, username="reader_meera",  exists=False, persona="Side-character superfan",
         attention=1.10, skip=1.20, replay=2.10, base_speed=1.00, speeds_up=True,
         loyalty=0.95, sera_bias=2.00, device="android", repeats_on=[1003, 1001]),
]

# ============================================================
# SCENES — prose + planted craft attributes
# ============================================================
# Simulation attributes (these are the PLANT, not measurements):
#   quality    0-1  overall craft of the writing
#   tension    0-1  is something at stake right now
#   emotional  0-1  is there a moment worth rewinding for
#   thread_inv 0-1  how much the audience cares about the thread it advances
#   hook       0-1  does it pull you into the next scene
#   chars      character ids present
#   threads    thread ids touched
#
# The generator turns these into behaviour. It never writes metrics directly.

def S(sid, ep, order, title, function, dur, text, *, quality, tension, emotional,
      thread_inv, hook, chars, threads):
    return dict(id=sid, episode_id=ep, order_index=order, title=title,
                function=function, est_duration_sec=dur, text=text.strip(),
                quality=quality, tension=tension, emotional=emotional,
                thread_inv=thread_inv, hook=hook, chars=chars, threads=threads)


SCENES = [
    # ---------------- Ep 1001 — The Gathering Storm (strong opener) ----------------
    S(3011, 1001, 1, "Rain on the Ramparts", "hook", 85, """
Rain hammered the ramparts of Greymoor. Aldric read the declaration twice, then a
third time, because the words refused to mean what they meant. House Corvin had
declared war at harvest, when the granaries were full and the men were tired.
Below him the courtyard went on with its evening as though nothing had changed —
a boy hauling water, a smith shutting his shutters against the wet. Aldric folded
the parchment along its crease and held it there. In an hour he would have to
tell them. For now he let them have the hour.
""", quality=0.90, tension=0.80, emotional=0.65, thread_inv=0.80, hook=0.85,
      chars=[ALDRIC], threads=[T_WAR]),

    S(3012, 1001, 2, "Sera on the Wall", "character", 95, """
"You've read it four times," Sera said, appearing at his elbow the way she always
did, from a direction he hadn't been watching. "Does it say something different
on the fourth?"
"It says my father would have known what to do."
"Your father would have burned their fields and called it strategy." She leaned
on the parapet beside him, entirely unbothered by the rain. "You're not going to
do that. Which is why I'm still standing here and not halfway to the coast."
Aldric almost smiled. "That's your whole reason?"
"It's a better reason than most men have," Sera said. "Don't waste it."
""", quality=0.95, tension=0.45, emotional=0.90, thread_inv=0.75, hook=0.70,
      chars=[ALDRIC, SERA], threads=[T_WAR]),

    S(3013, 1001, 3, "The Long Table", "exposition", 70, """
The council assembled before dawn. Maester Ord read the muster rolls: eleven
hundred spears from the highlands, four hundred from the river holdings, and a
qualification regarding the river holdings that took some time to deliver. The
lords argued about precedence. Aldric listened to none of it and heard all of it,
the way you hear rain.
""", quality=0.60, tension=0.35, emotional=0.20, thread_inv=0.55, hook=0.40,
      chars=[ALDRIC, ORD], threads=[T_WAR]),

    S(3014, 1001, 4, "Terms", "conflict", 90, """
Corvin's envoy came under a white banner and did not dismount. "My lady offers
terms," he said. "Greymoor kneels, and the north keeps its harvest."
"And if Greymoor doesn't kneel?"
"Then the north keeps nothing, and my lady keeps her patience for someone who
deserves it." The envoy turned his horse. "She said you'd want the choice
written down. She said you were the kind who reads things four times."
Aldric felt the wall of his own chest go cold. Someone in Greymoor was telling
her things.
""", quality=0.92, tension=0.90, emotional=0.60, thread_inv=0.85, hook=0.90,
      chars=[ALDRIC], threads=[T_WAR, T_CORVIN_FATE]),

    S(3015, 1001, 5, "The March", "setup", 75, """
They went out at first light, eleven hundred spears and four hundred more, down
the road their grandfathers had built to move grain and had never once used for
grain. Aldric rode at the front because that was where you rode. Sera rode beside
him because nobody had told her not to.
""", quality=0.82, tension=0.60, emotional=0.55, thread_inv=0.75, hook=0.65,
      chars=[ALDRIC, SERA], threads=[T_WAR]),

    S(3016, 1001, 6, "A Fire in the North", "close", 60, """
That night Sera woke him. She did not speak; she only pointed north, past the
line of their own fires, to where a light burned on a ridge that should have been
empty. It was not a Corvin fire. It was not the right colour for any fire Aldric
knew.
"How long?" he said.
"It was there when I took the watch," Sera said. "It hasn't moved. It hasn't
gone out."
""", quality=0.88, tension=0.75, emotional=0.60, thread_inv=0.50, hook=0.95,
      chars=[ALDRIC, SERA], threads=[T_NORTH_SHADOW]),

    # ---------------- Ep 1002 — Blood on the Snow ----------------
    S(3021, 1002, 1, "The Line Forms", "setup", 70, """
Dawn came grey and without ceremony. The line formed the way lines do — badly,
then all at once. Aldric walked it because his father had walked it, and found
that the walking did something the speeches never had. Men straightened. A boy
with a borrowed spear stopped shaking.
""", quality=0.85, tension=0.75, emotional=0.55, thread_inv=0.75, hook=0.70,
      chars=[ALDRIC], threads=[T_WAR]),

    S(3022, 1002, 2, "Blood on the Snow", "action", 110, """
The first battle broke at dawn and did not stop being dawn for a very long time.
Aldric watched good men fall for a border stone that had been moved twice in his
lifetime, once by his grandfather and once by a farmer who wanted a wider gate.
He killed a man who was trying to surrender and did not know it, because the man
had dropped his spear and Aldric's arm was already moving. He would remember the
dropped spear for the rest of his life. He would not remember the face.
The snow took it all and turned the colour snow turns.
""", quality=0.93, tension=0.95, emotional=0.85, thread_inv=0.85, hook=0.80,
      chars=[ALDRIC], threads=[T_WAR]),

    S(3023, 1002, 3, "Pulled from the Press", "character", 85, """
Sera got a fistful of his collar and hauled him backward out of the crush, which
should not have been possible, and swore at him in three dialects, which was.
"You went in," she said.
"I went in."
"You went in like a man who wants a statue." She shoved a waterskin at him. Her
hands were shaking and she was furious about it. "Statues don't end wars, Aldric.
They just stand in the square where the war happened."
""", quality=0.96, tension=0.70, emotional=0.95, thread_inv=0.80, hook=0.75,
      chars=[ALDRIC, SERA], threads=[T_WAR]),

    S(3024, 1002, 4, "What the Old Man Said", "climax", 95, """
Ser Bren died slowly, which he would have hated, and lucidly, which was worse.
"You'll want to make it mean something," he said. "Don't. It doesn't. Make the
next one mean something."
"I don't know how to do this without you."
"You've been doing it without me since spring," Bren said. "I just kept standing
near you so it would look supervised."
He went quiet a while. Then: "Aldric. When you have her — and you will have her —
don't do it because you're angry. Anything else. Just not that."
""", quality=0.94, tension=0.80, emotional=0.98, thread_inv=0.85, hook=0.85,
      chars=[ALDRIC], threads=[T_WAR, T_CORVIN_FATE]),

    # PLANTED WEAKNESS #2 — milder offender, so the detector must RANK.
    S(3025, 1002, 5, "The Butcher's Ledger", "exposition", 100, """
Afterward there was the counting. Maester Ord established himself at a trestle
table with three tallies — the dead, the wounded, and the wounded who would
become dead, which he insisted on keeping separate for reasons of accuracy. He
read the highland losses. He read the river-holding losses. He noted that the
river-holding figure was provisional pending confirmation from the reeve, and
then, some minutes later, he noted this again. He observed that the supply train
had lost four carts, of which two might be repaired, and enumerated the contents
of all four. Aldric signed where he was told to sign. The tallies went into the
ledger. The ledger went into the chest. The chest was carried to the wagon.
""", quality=0.35, tension=0.15, emotional=0.15, thread_inv=0.40, hook=0.20,
      chars=[ALDRIC, ORD], threads=[T_WAR]),

    S(3026, 1002, 6, "She Rode Out Herself", "close", 65, """
"My lord." The scout was out of breath. "The Corvin banner. On the field. Not the
envoy — the banner."
Aldric was already moving. "She's here?"
"She's here, and my lord —" the scout swallowed — "she came with forty men. Forty.
Against eleven hundred."
Sera said, quietly, "That's not a mistake. That's an offer."
""", quality=0.90, tension=0.92, emotional=0.65, thread_inv=0.90, hook=0.95,
      chars=[ALDRIC, SERA], threads=[T_CORVIN_FATE, T_WAR]),

    # ---------------- Ep 1003 — The Spared Blade (the peak) ----------------
    S(3031, 1003, 1, "Mud and Iron", "setup", 65, """
They took her without a fight, which was the insult. She walked between two of
Aldric's men with her chin level, and the men, who had every right to be proud,
looked instead like boys escorting a schoolmistress.
""", quality=0.88, tension=0.75, emotional=0.60, thread_inv=0.95, hook=0.80,
      chars=[ALDRIC, CORVIN], threads=[T_CORVIN_FATE]),

    S(3032, 1003, 2, "The Tent", "conflict", 120, """
"You had forty men," Aldric said.
"I had forty men I trusted." Lady Corvin sat without being invited. "You have
fifteen hundred, and you're standing in a tent asking a prisoner why she isn't
afraid. Do the arithmetic yourself, Prince."
"You wanted to be caught."
"I wanted to be *heard*. Being caught was the price. An old proverb of my house:
the door you kick opens onto the yard; the door you knock on opens onto the hall."
She let that sit. "Someone in your camp has been writing to me for two years. I
did not ask them to. I would very much like to know who they are — because
whoever they are, Prince, they are not doing it for me."
""", quality=0.97, tension=0.95, emotional=0.85, thread_inv=0.98, hook=0.92,
      chars=[ALDRIC, CORVIN], threads=[T_CORVIN_FATE, T_WAR]),

    # The quiet Sera scene — the "secretly loved" plant. Small, no plot weight,
    # highest replay in the whole series.
    S(3033, 1003, 3, "Two Cups", "character", 90, """
Sera brought him something hot and sat down on the floor of the tent like it was
a thing floors were for.
"You're going to spare her," she said.
"I haven't decided."
"You decided in the snow. You've just been finding a route to it since." She
turned her cup around in her hands. "I'm not going to tell you it's the right
call. I don't know. I've killed people for less than she's done and slept fine."
"Then why are you here?"
"Because whichever way you go, someone should be in the room who isn't afraid of
you," Sera said. "That list is getting short."
""", quality=0.98, tension=0.55, emotional=0.99, thread_inv=0.85, hook=0.75,
      chars=[ALDRIC, SERA], threads=[T_CORVIN_FATE]),

    S(3034, 1003, 4, "Precedent", "exposition", 85, """
Maester Ord had prepared a document. There was precedent, he explained, in the
matter of captured heads of house: the Aldwin case, the second Aldwin case, and a
disputed instance from the interregnum which he characterised as instructive but
imperfect. Execution was lawful. Clemency was also lawful, provided the terms
were recorded. He noted that the terms would need to be recorded either way.
Aldric asked what the maester would do.
"That, my lord, is not a matter of precedent," said Ord, and looked genuinely
sorry about it.
""", quality=0.68, tension=0.40, emotional=0.35, thread_inv=0.75, hook=0.45,
      chars=[ALDRIC, ORD], threads=[T_CORVIN_FATE]),

    S(3035, 1003, 5, "The Spared Blade", "climax", 95, """
Lady Corvin knelt in the mud, blade at her throat. The camp had gone entirely
quiet — fifteen hundred men holding one breath between them.
Aldric thought about a dropped spear. He thought about Bren saying *anything else,
just not that*. He thought, absurdly, about a boy hauling water across a
courtyard in the rain, on an evening when nothing had changed yet.
His arm was already moving. He made it stop.
He lowered the sword.
Somewhere behind him a man swore, in the tone of a man who has just lost money.
""", quality=0.99, tension=0.99, emotional=0.97, thread_inv=0.99, hook=0.90,
      chars=[ALDRIC, CORVIN], threads=[T_CORVIN_FATE, T_WAR]),

    S(3036, 1003, 6, "Mercy Has a Price", "close", 70, """
Corvin got to her feet unaided. She looked at the sword, and then, for a longer
moment, at Aldric.
"You've made this much harder," she said. "For both of us. You understand that."
"I know."
"No," said Lady Corvin, brushing the mud from her knees, "you don't. But you
will, and I'll be there when you do."
""", quality=0.93, tension=0.85, emotional=0.80, thread_inv=0.97, hook=0.93,
      chars=[ALDRIC, CORVIN], threads=[T_CORVIN_FATE]),

    # ---------------- Ep 1004 — Uneasy Peace (THE SAG) ----------------
    S(3041, 1004, 1, "Ink and Wax", "setup", 70, """
The truce was signed in a room too small for the number of people who insisted on
being in it. Corvin signed first, which was either grace or strategy. Aldric
signed second. The wax took a long time to set.
""", quality=0.72, tension=0.45, emotional=0.40, thread_inv=0.80, hook=0.45,
      chars=[ALDRIC, CORVIN, ORD], threads=[T_CORVIN_FATE]),

    # ======================================================================
    # PLANTED WEAKNESS #1 — the dominant one. This is the scene the whole
    # demo turns on. Every revamp trigger from the spec fires here at once:
    #   - stalls the main thread (drops T_CORVIN_FATE entirely)
    #   - focuses on the lowest-investment character (Ord)
    #   - no tension, no stakes, heavy repetition
    #   - no end hook
    #   - and it is the LONGEST scene in the series (145s)
    # ======================================================================
    S(3042, 1004, 2, "The Council of Grain", "exposition", 145, """
Maester Ord unrolled the ledger across the long table. The southern granaries
held four thousand bushels. The eastern granaries held three thousand two
hundred, though the eastern figure was provisional, pending the reeve's count,
which was late. Aldric nodded. Ord continued.
There was the matter of the tariff on the river road, which had been set at one
part in twelve during his father's reign, and which the merchants of Greymoor had
petitioned to reduce to one part in fifteen — a petition considered by the council
in the spring, deferred, and now before them again. The council discussed the
tariff. Lord Halloway favoured twelve. Lord Merrick favoured fifteen. Lord
Halloway restated his position at greater length.
Then they discussed the granaries again, because the eastern figure was still
provisional. Ord observed that until the reeve's count arrived, any decision
would be premature, which he had also observed before the tariff was raised.
Aldric said they would decide when the count arrived. Ord made a note.
Outside, it had begun to rain, and then it stopped.
""", quality=0.20, tension=0.08, emotional=0.05, thread_inv=0.20, hook=0.05,
      chars=[ALDRIC, ORD], threads=[T_NORTH_SHADOW]),

    S(3043, 1004, 3, "Border Surveys", "exposition", 110, """
The surveys occupied the following morning. Ord had commissioned three, and the
three disagreed, chiefly regarding the watercourse east of the mill, which had
moved. Whether a border follows a river or the memory of a river is, the maester
explained, a question with considerable precedent on both sides. He summarised
the precedent. Aldric authorised a fourth survey. The lords withdrew, satisfied
in the way men are satisfied by having postponed something together.
""", quality=0.30, tension=0.15, emotional=0.10, thread_inv=0.25, hook=0.15,
      chars=[ALDRIC, ORD], threads=[T_NORTH_SHADOW]),

    S(3044, 1004, 4, "A Rider from the North", "conflict", 80, """
The rider came in at dusk with frost still on him though the frost had broken
weeks ago.
"The ridge fire," he said. "My lord, it's not one fire. It was never one fire.
You can only see one from Greymoor because of the shoulder of the hill."
"How many?"
The rider looked at him. "I stopped counting at sixty."
""", quality=0.84, tension=0.88, emotional=0.55, thread_inv=0.45, hook=0.80,
      chars=[ALDRIC], threads=[T_NORTH_SHADOW]),

    # The relief scene. Retention visibly RECOVERS here -- and it is a Sera
    # scene. That single upward kink is one of the strongest pieces of
    # evidence in the whole demo.
    S(3045, 1004, 5, "Sera Comes Back Muddy", "character", 75, """
Sera came back three days late, on foot, having lost the horse in a manner she
declined to describe.
"Sixty fires," Aldric said.
"Ninety." She sat down heavily. "And Aldric — they're not camped. Camps have
edges. This has a *shape*." She pulled off a boot and considered it. "Also
they're not burning wood."
"What are they burning?"
"That," said Sera, "is the part I walked ninety miles to not have to say out loud."
""", quality=0.94, tension=0.80, emotional=0.90, thread_inv=0.60, hook=0.85,
      chars=[ALDRIC, SERA], threads=[T_NORTH_SHADOW]),

    S(3046, 1004, 6, "Mercy, and the Price of It", "close", 65, """
Aldric stood on the ramparts where he had stood at harvest, and the rain came the
way it had come then. Mercy had bought a fragile truce. Mercy, he was beginning
to understand, has a price, and prices come due. He went inside. The council
would meet again in the morning.
""", quality=0.38, tension=0.25, emotional=0.30, thread_inv=0.35, hook=0.12,
      chars=[ALDRIC], threads=[T_NORTH_SHADOW, T_CORVIN_FATE]),
]

EPISODES = [1001, 1002, 1003, 1004]
EPISODE_TITLES = {
    1001: "The Gathering Storm", 1002: "Blood on the Snow",
    1003: "The Spared Blade",    1004: "Uneasy Peace",
}


# ============================================================
# Derive scene spans from durations
# ============================================================
def compute_spans() -> None:
    for ep in EPISODES:
        cursor = 0
        for sc in [s for s in SCENES if s["episode_id"] == ep]:
            sc["start_ms"] = cursor
            cursor += sc["est_duration_sec"] * 1000
            sc["end_ms"] = cursor


def episode_scenes(ep: int) -> list[dict]:
    return sorted([s for s in SCENES if s["episode_id"] == ep], key=lambda s: s["order_index"])


def episode_duration_ms(ep: int) -> int:
    return episode_scenes(ep)[-1]["end_ms"]


# ============================================================
# The behaviour model
# ============================================================
# friction = how much this scene makes a listener want to leave.
# Built only from the planted craft attributes -- the simulator never
# reads or writes a metric directly.
def friction(scene: dict) -> float:
    f = (0.40 * (1 - scene["quality"])
         + 0.25 * (1 - scene["tension"])
         + 0.20 * (1 - scene["thread_inv"])
         + 0.15 * (1 - scene["hook"]))
    if ORD in scene["chars"] and SERA not in scene["chars"]:
        f += 0.12          # an Ord-led scene: the audience checks out
    if SERA in scene["chars"]:
        f -= 0.18          # Sera's presence buys patience
    return max(0.0, min(1.0, f))


def length_penalty(scene: dict) -> float:
    """A long scene has more opportunity to lose you. 90s is the reference beat."""
    return (scene["est_duration_sec"] / 90.0) ** 0.7


def pull(scene: dict, listener: dict) -> float:
    """Probability-ish weight that a listener rewinds to re-hear this scene."""
    p = 0.50 * scene["emotional"] + 0.20 * scene["quality"]
    if SERA in scene["chars"]:
        p *= listener["sera_bias"]
    return max(0.0, min(0.80, p * listener["replay"] * 0.42))


def p_drop(scene: dict, listener: dict) -> float:
    # friction^1.8 makes weak scenes dominate instead of bleeding uniformly.
    # Length belongs HERE, not in skipping: a long dull scene is what finally
    # makes someone quit, whereas the decision to skip is made at its start.
    base = 0.008 + (friction(scene) ** 1.8) * 0.38 * length_penalty(scene)
    return max(0.0, min(0.60, base / listener["attention"]))


def p_skip(scene: dict, listener: dict) -> float:
    # Ceiling of 0.70 deliberately below 1.0. If the worst scene saturates at
    # "everybody skips", nobody is left inside it to drop out, its drop_off_rate
    # collapses to zero, and it ranks as HEALTHIER than a mildly-bad scene.
    return max(0.0, min(0.70, (friction(scene) ** 2.0) * 0.80 * listener["skip"]))


# ============================================================
# Session simulation
# ============================================================
class EventLog:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    def add(self, **kw) -> None:
        self.rows.append(kw)


def simulate_session(listener: dict, ep: int, take: int, start_dt: datetime,
                     log: EventLog) -> dict:
    """Play one episode once. Returns a small summary used for return-rate logic."""
    rng = random.Random(f"{SEED}-{listener['id']}-{ep}-{take}")
    sid = str(uuid.uuid5(NS, f"{listener['id']}-{ep}-{take}"))
    scenes = episode_scenes(ep)
    dur = episode_duration_ms(ep)
    speed = listener["base_speed"]
    now = start_dt
    autoplay = take == 0 and ep != 1001

    def emit(event_type: str, pos: int, *, seek_to: int | None = None) -> None:
        log.add(session_id=sid, episode_id=ep, user_id=listener["id"],
                event_type=event_type, position_ms=int(max(0, min(pos, dur))),
                seek_to_ms=None if seek_to is None else int(max(0, min(seek_to, dur))),
                duration_ms=dur, speed=round(speed, 2), device=listener["device"],
                autoplay=autoplay, created_at=now)

    def advance(ms: int) -> None:
        nonlocal now
        now = now + timedelta(milliseconds=ms / max(speed, 0.1))

    emit("play_start", 0)
    completed = True
    last_scene_hook = 0.0

    for scene in scenes:
        f = friction(scene)

        # --- speed up out of boredom -------------------------------------
        # Past a certain dullness even patient listeners reach for the 1.5x
        # button. That is why avg_speed is a revamp trigger and not a preference.
        if speed < 1.5 and rng.random() < (0.60 if listener["speeds_up"] else 0.0) and f > 0.45:
            speed = min(1.5, speed + 0.25)
            emit("speed_change", scene["start_ms"])
        elif speed < 1.5 and f > 0.72 and rng.random() < 0.65:
            speed = min(1.5, speed + 0.25)
            emit("speed_change", scene["start_ms"])
        elif f < 0.25 and speed > listener["base_speed"] and rng.random() < 0.45:
            speed = listener["base_speed"]
            emit("speed_change", scene["start_ms"])

        # --- skip forward out of a dull scene ----------------------------
        if rng.random() < p_skip(scene, listener):
            jump_at = scene["start_ms"] + int(scene["est_duration_sec"] * 1000 * rng.uniform(0.15, 0.45))
            emit("skip", jump_at, seek_to=scene["end_ms"])
            advance(2_000)
            last_scene_hook = scene["hook"]
            continue

        # --- normal playback through the scene ---------------------------
        pos = scene["start_ms"]
        drop_here = rng.random() < p_drop(scene, listener)
        drop_at = scene["start_ms"] + int(scene["est_duration_sec"] * 1000 * rng.uniform(0.20, 0.90)) \
            if drop_here else None

        replayed = False
        while pos < scene["end_ms"]:
            if drop_at is not None and pos >= drop_at:
                emit("stop", pos)
                completed = False
                break

            emit("heartbeat", pos)
            advance(HEARTBEAT_MS)
            pos += HEARTBEAT_MS

            # --- rewind to re-hear a good moment --------------------------
            frac = (pos - scene["start_ms"]) / max(1, scene["end_ms"] - scene["start_ms"])
            if (not replayed and 0.55 < frac < 0.9 and rng.random() < pull(scene, listener)):
                back_to = scene["start_ms"] + int((scene["end_ms"] - scene["start_ms"]) * rng.uniform(0.05, 0.3))
                emit("seek", pos, seek_to=back_to)
                pos = back_to
                replayed = True
                advance(1_500)

            # --- distraction: pause and come back -------------------------
            if rng.random() < 0.035:
                emit("pause", pos)
                advance(rng.randint(4_000, 90_000))
                emit("resume", pos)

        if not completed:
            break
        last_scene_hook = scene["hook"]

    if completed:
        emit("complete", dur)

    return dict(session_id=sid, user_id=listener["id"], episode_id=ep,
                completed=completed, final_hook=last_scene_hook, ended_at=now)


def simulate_all() -> EventLog:
    log = EventLog()
    rng = random.Random(SEED)
    base = datetime(2026, 7, 12, 20, 30, tzinfo=timezone.utc)

    for listener in LISTENERS:
        # each listener starts the series on their own day, evening-ish
        day = base + timedelta(days=rng.randint(0, 3), minutes=rng.randint(-90, 150))
        active = True
        for i, ep in enumerate(EPISODES):
            if not active:
                break
            summary = simulate_session(listener, ep, 0, day, log)

            # a re-listen of an episode they loved
            if ep in listener["repeats_on"]:
                simulate_session(listener, ep, 1, summary["ended_at"] + timedelta(days=1, hours=rng.randint(0, 5)), log)

            # do they come back for the next episode?
            p_return = (listener["loyalty"]
                        * (0.75 + 0.25 * (1.0 if summary["completed"] else 0.0))
                        * (0.70 + 0.30 * summary["final_hook"]))
            if rng.random() > p_return:
                active = False
            day = summary["ended_at"] + timedelta(days=1, hours=rng.randint(-3, 8),
                                                 minutes=rng.randint(0, 59))

    # ---- optional anonymous traffic, same personas, no user_id ----
    for n in range(ANON_SESSIONS):
        proto = LISTENERS[rng.randrange(len(LISTENERS))]
        ghost = dict(proto, id=None, username=None,
                     attention=proto["attention"] * rng.uniform(0.8, 1.2),
                     skip=proto["skip"] * rng.uniform(0.8, 1.2),
                     replay=proto["replay"] * rng.uniform(0.8, 1.2),
                     loyalty=proto["loyalty"] * rng.uniform(0.85, 1.1),
                     repeats_on=[])
        day = base + timedelta(days=rng.randint(0, 6), hours=rng.randint(0, 5),
                               minutes=rng.randint(0, 59))
        for ep in EPISODES:
            s = simulate_session(ghost, ep, 1000 + n, day, log)
            p_return = (ghost["loyalty"]
                        * (0.75 + 0.25 * (1.0 if s["completed"] else 0.0))
                        * (0.70 + 0.30 * s["final_hook"]))
            if rng.random() > p_return:
                break
            day = s["ended_at"] + timedelta(days=1, hours=rng.randint(-3, 8))
    return log


# ============================================================
# Derived engagement map (mirrors the SQL views; used to verify them)
# ============================================================
def build_engagement_map(rows: list[dict]) -> list[dict]:
    by_session: dict[str, list[dict]] = {}
    for r in rows:
        by_session.setdefault(r["session_id"], []).append(r)

    def scene_of(ep: int, pos: int) -> dict | None:
        for s in episode_scenes(ep):
            if s["start_ms"] <= pos < s["end_ms"]:
                return s
        return None

    reached: dict[int, set] = {}
    completed_past: dict[int, set] = {}
    dropped: dict[int, set] = {}
    replays: dict[int, set] = {}
    skips: dict[int, set] = {}
    speeds: dict[int, list[float]] = {}

    for sid, evs in by_session.items():
        ep = evs[0]["episode_id"]
        finished = any(e["event_type"] == "complete" for e in evs)
        last_pos = max(e["position_ms"] for e in evs)

        for e in evs:
            sc = scene_of(ep, e["position_ms"])
            if sc is None:
                continue
            # "reached" = the playhead entered this scene at all. Skipping OUT of a
            # scene still counts as reaching it — otherwise the scenes everyone
            # skips get a tiny denominator and a meaningless 100% skip rate.
            if e["event_type"] in ("play_start", "heartbeat", "resume", "complete",
                                   "skip", "seek", "pause", "stop"):
                reached.setdefault(sc["id"], set()).add(sid)
            if e["event_type"] == "heartbeat":
                speeds.setdefault(sc["id"], []).append(float(e["speed"]))
            if e["event_type"] == "seek" and e["seek_to_ms"] is not None and e["seek_to_ms"] < e["position_ms"]:
                replays.setdefault(sc["id"], set()).add(sid)
            if e["event_type"] == "skip" and e["seek_to_ms"] is not None and e["seek_to_ms"] > e["position_ms"]:
                skips.setdefault(sc["id"], set()).add(sid)

        for s in episode_scenes(ep):
            if finished or last_pos >= s["end_ms"]:
                completed_past.setdefault(s["id"], set()).add(sid)
            if not finished and s["start_ms"] <= last_pos < s["end_ms"]:
                dropped.setdefault(s["id"], set()).add(sid)

    out = []
    for s in SCENES:
        r = len(reached.get(s["id"], ()))
        sp = speeds.get(s["id"], [])
        rate = lambda n: round(n / r, 3) if r else None
        out.append(dict(
            scene_id=s["id"], episode_id=s["episode_id"], scene_order=s["order_index"],
            title=s["title"], function=s["function"],
            reached=r, completed=len(completed_past.get(s["id"], ())),
            drop_off_rate=rate(len(dropped.get(s["id"], ()))),
            replay_rate=rate(len(replays.get(s["id"], ()))),
            skip_rate=rate(len(skips.get(s["id"], ()))),
            avg_speed=round(sum(sp) / len(sp), 2) if sp else 1.0,
        ))
    return out


def weakness_score(m: dict) -> float:
    # Keep in sync with the revamp_candidates view in schema_pulse.sql.
    # drop-off and skip are weighted near-equally: both are abandonment, one
    # just leaves the app and the other jumps the scene.
    return round(100 * (0.40 * (m["drop_off_rate"] or 0)
                        + 0.35 * (m["skip_rate"] or 0)
                        + 0.15 * max((m["avg_speed"] or 1.0) - 1.0, 0)
                        + 0.10 * (1 - (m["replay_rate"] or 0))), 1)


def build_investment(emap: list[dict]) -> dict:
    by_id = {m["scene_id"]: m for m in emap}
    names = {ALDRIC: "Prince Aldric", CORVIN: "Lady Corvin", SERA: "Sera", ORD: "Maester Ord"}
    roles = {ALDRIC: "protagonist", CORVIN: "antagonist", SERA: "side", ORD: "side"}
    thread_names = {
        T_CORVIN_FATE: "The fate of the captured Lady Corvin.",
        T_NORTH_SHADOW: "A shadow threat stirring beyond the northern border.",
        T_WAR: "The war between Greymoor and House Corvin.",
    }

    def score(scene_ids: list[int]) -> dict:
        ms = [by_id[i] for i in scene_ids]
        avg = lambda k: sum((m[k] or 0) for m in ms) / len(ms)
        comp = sum((m["completed"] / m["reached"]) if m["reached"] else 0 for m in ms) / len(ms)
        raw = 0.60 * avg("replay_rate") - 0.25 * avg("skip_rate") - 0.15 * avg("drop_off_rate") + 0.20 * comp
        return dict(scenes_present=len(ms),
                    avg_replay_rate=round(avg("replay_rate"), 3),
                    avg_skip_rate=round(avg("skip_rate"), 3),
                    avg_drop_off_rate=round(avg("drop_off_rate"), 3),
                    investment_score=round(100 * max(0.0, raw), 1))

    chars = []
    for cid, name in names.items():
        ids = [s["id"] for s in SCENES if cid in s["chars"]]
        chars.append(dict(character_id=cid, name=name, role=roles[cid], **score(ids)))
    threads = []
    for tid, label in thread_names.items():
        ids = [s["id"] for s in SCENES if tid in s["threads"]]
        threads.append(dict(thread_id=tid, thread=label, **score(ids)))

    chars.sort(key=lambda c: -c["investment_score"])
    threads.sort(key=lambda t: -t["investment_score"])
    return dict(characters=chars, threads=threads)


# ============================================================
# Emitters
# ============================================================
def q(s) -> str:
    if s is None:
        return "NULL"
    if isinstance(s, bool):
        return "true" if s else "false"
    if isinstance(s, (int, float)):
        return str(s)
    return "'" + str(s).replace("'", "''") + "'"


def write_sql(rows: list[dict]) -> None:
    L: list[str] = []
    add = L.append
    add("-- ============================================================")
    add("-- PULSE seed — SIMULATED listener signal for 'The Hollow Crown'")
    add("-- GENERATED FILE. Edit data/generate_pulse_data.py and re-run.")
    add(f"-- seed={SEED}  listeners={len(LISTENERS)}  scenes={len(SCENES)}  events={len(rows)}")
    add("--")
    add("-- Run order:  schema.sql -> seed.sql -> schema_pulse.sql -> THIS FILE")
    add("--")
    add("-- All playback_events rows are SYNTHETIC. They are generated from a")
    add("-- persona x scene-craft model, not collected from real listeners.")
    add("-- ============================================================")
    add("BEGIN;")
    add("")

    add("-- ---------- New listeners (2,3,4 already exist in seed.sql) ----------")
    add("-- The named panel and the persona each one simulates:")
    for l in LISTENERS:
        add(f"--   {l['id']:>2}  {l['username']:<16} {l['persona']}")
    new_users = [l for l in LISTENERS if not l["exists"]]
    add("INSERT INTO users (id, username, password_hash) OVERRIDING SYSTEM VALUE VALUES")
    # NB: never put a trailing "-- comment" on these rows. The row separator
    # comma (and the final semicolon) would end up inside the comment.
    add(",\n".join(f"  ({l['id']}, {q(l['username'])}, 'x')" for l in new_users) + ";")
    add("")

    add("-- ---------- New character: the low-investment one ----------")
    add("INSERT INTO characters (id, series_id, name, description, role, personality,")
    add("                        backstory, goals, speech_style, status)")
    add("OVERRIDING SYSTEM VALUE VALUES")
    add(",\n".join(
        f"  ({c['id']}, {SERIES_ID}, {q(c['name'])}, {q(c['description'])}, {q(c['role'])},\n"
        f"   {q(c['personality'])}, {q(c['backstory'])}, {q(c['goals'])},\n"
        f"   {q(c['speech_style'])}, {q(c['status'])})" for c in NEW_CHARACTERS) + ";")
    add("")
    add("INSERT INTO char_relationship (char_id, relation_char_id, relationship_summary) VALUES")
    add(f"  ({ALDRIC}, {ORD}, 'Relies on Ord for law and ledgers; finds him unbearable.'),")
    add(f"  ({SERA}, {ORD}, 'Mutual, affectionate contempt.');")
    add("")

    add("-- ---------- New plot thread ----------")
    add("INSERT INTO plot_threads (id, series_id, thread, status, opened_episode_id, resolved_episode_id)")
    add("OVERRIDING SYSTEM VALUE VALUES")
    add(",\n".join(
        f"  ({t['id']}, {SERIES_ID}, {q(t['thread'])}, {q(t['status'])}, "
        f"{q(t['opened_episode_id'])}, {q(t['resolved_episode_id'])})" for t in NEW_THREADS) + ";")
    add("")

    add("-- ---------- Episode audio durations ----------")
    for ep in EPISODES:
        add(f"UPDATE episodes SET audio_duration_ms = {episode_duration_ms(ep)} WHERE id = {ep};")
    add("")

    add("-- ---------- Scenes ----------")
    add("INSERT INTO scenes (id, episode_id, order_index, title, text, function,")
    add("                    start_ms, end_ms, est_duration_sec)")
    add("OVERRIDING SYSTEM VALUE VALUES")
    body = []
    for s in SCENES:
        body.append(f"  ({s['id']}, {s['episode_id']}, {s['order_index']}, {q(s['title'])},\n"
                    f"   {q(s['text'])},\n"
                    f"   {q(s['function'])}, {s['start_ms']}, {s['end_ms']}, {s['est_duration_sec']})")
    add(",\n".join(body) + ";")
    add("")

    add("-- ---------- Scene <-> character ----------")
    add("INSERT INTO scene_characters (scene_id, character_id) VALUES")
    pairs = [f"  ({s['id']}, {c})" for s in SCENES for c in s["chars"]]
    add(",\n".join(pairs) + ";")
    add("")

    add("-- ---------- Scene <-> thread ----------")
    add("INSERT INTO scene_threads (scene_id, thread_id) VALUES")
    pairs = [f"  ({s['id']}, {t})" for s in SCENES for t in s["threads"]]
    add(",\n".join(pairs) + ";")
    add("")

    # Batched: a single 30k-row INSERT is one statement many clients refuse to
    # parse. 1000-row batches load fine everywhere and are easy to bisect if one
    # of them ever fails.
    BATCH = 1000
    add(f"-- ---------- Playback events ({len(rows)} rows, SIMULATED) ----------")
    header = ("INSERT INTO playback_events (episode_id, user_id, session_id, event_type,\n"
              "                             position_ms, seek_to_ms, duration_ms, speed,\n"
              "                             device, autoplay, created_at) VALUES")
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        add(f"-- batch {i // BATCH + 1} (rows {i + 1}-{i + len(chunk)})")
        add(header)
        ev = [f"  ({r['episode_id']}, {q(r['user_id'])}, {q(r['session_id'])}::uuid, "
              f"{q(r['event_type'])}, {r['position_ms']}, {q(r['seek_to_ms'])}, "
              f"{r['duration_ms']}, {r['speed']}, {q(r['device'])}, {q(r['autoplay'])}, "
              f"{q(r['created_at'].isoformat())}::timestamptz)" for r in chunk]
        add(",\n".join(ev) + ";")
        add("")

    add("-- ---------- Re-sync sequences ----------")
    for t in ("users", "characters", "char_relationship", "plot_threads", "scenes"):
        add(f"SELECT setval(pg_get_serial_sequence('{t}','id'), (SELECT max(id) FROM {t}));")
    add("")
    add("COMMIT;")
    (OUT / "seed_pulse.sql").write_text("\n".join(L), encoding="utf-8")


def write_csv(rows: list[dict]) -> None:
    cols = ["session_id", "user_id", "episode_id", "event_type", "position_ms",
            "seek_to_ms", "duration_ms", "speed", "device", "autoplay", "created_at"]
    with (OUT / "playback_events.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            out = {k: r[k] for k in cols}
            out["created_at"] = r["created_at"].isoformat()
            w.writerow(out)


def write_ground_truth(emap: list[dict], inv: dict, rows: list[dict]) -> None:
    ranked = sorted(emap, key=weakness_score, reverse=True)
    lines = [
        "# PULSE — Ground Truth for the simulated dataset",
        "",
        "**This data is SIMULATED.** No real listener produced it. It exists so we can",
        "prove the detector finds a weakness we deliberately planted, rather than",
        "prove it can draw a chart.",
        "",
        f"- seed: `{SEED}` (deterministic — reruns produce identical data)",
        f"- named panel: {len(LISTENERS)} listeners (users 2-11)",
        f"- anonymous sessions: {ANON_SESSIONS} (user_id NULL, same persona mix)",
        f"- sessions total: {len({r['session_id'] for r in rows})}",
        f"- raw events: {len(rows)}",
        f"- scenes: {len(SCENES)} across {len(EPISODES)} episodes",
        "",
        "> **On sample size.** The 10 named listeners are the panel we point at by",
        "> name in the UI and on stage. They are *not* enough to measure with: only",
        "> ~6 survive to episode 4, so every rate there would sit on a denominator of",
        "> 6, where 0.00 vs 0.33 is one person. The anonymous sessions exist purely to",
        "> give the arithmetic a denominator worth trusting. Set `ANON_SESSIONS = 0`",
        "> in the generator for the strict 10-user-only dataset.",
        "",
        "## What we planted",
        "",
        "| # | Plant | Where | Expected signature |",
        "|---|---|---|---|",
        "| 1 | **Dominant weak scene** | Ep 1004 sc.2 `The Council of Grain` (id 3042) | rank 1 by weakness: highest skip, high drop-off, avg speed > 1 |",
        "| 2 | **The ep-1004 slump** | sc.2 + sc.3 `Border Surveys` (3043) + weak close sc.6 (3046) | episode 4 should own most of the top of the weakness table |",
        "| 3 | **Secondary weak scene, different episode** | Ep 1002 sc.5 `The Butcher's Ledger` (id 3025) | clearly weak but *inside a strong episode* — forces ranking, not flagging |",
        "| 4 | **Secretly-loved side character** | Sera (id 702) | top investment score, ~zero skip, never appears in a weak scene |",
        "| 5 | **The drag character** | Maester Ord (id 703) | bottom investment; leads every weak scene |",
        "| 6 | **Least-invested thread** | 401 `northern shadow` bottom; 400 `Corvin's fate` high | ep 1004 sags exactly where it swaps 400 for 401 |",
        "| 7 | **Recovery kink** | Ep 1004 sc.5 `Sera Comes Back Muddy` (id 3045) | retention ticks UP mid-slump, on a Sera scene |",
        "",
        "**Pass condition:** scene 3042 ranks #1 by weakness, Sera ranks #1 by",
        "investment, Ord ranks last, thread 401 ranks last, and episode 1004 holds at",
        "least 3 of the top 6 weakest scenes. If any of those flip, the pipeline is",
        "wrong and we know it without asking a human.",
        "",
        "## The causal story the LLM should recover",
        "",
        "> Episode 4 loses its audience at *The Council of Grain*. It abandons the thread",
        "> listeners are most invested in (Lady Corvin's fate), hands the scene to the",
        "> character they skip most (Ord), runs the longest of any scene in the series,",
        "> and ends without a hook. Retention only recovers when Sera appears — the",
        "> character with the highest investment score in the show, who has never",
        "> carried a scene of her own.",
        "",
        "If the pipeline outputs approximately that, it works. If it names a different",
        "scene, it is wrong, and we know it is wrong without needing a human to judge.",
        "",
        "## Measured result (derived from the generated events — no model)",
        "",
        "### Weakest scenes, ranked",
        "",
        "| rank | scene | episode | drop-off | skip | replay | avg speed | weakness |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, m in enumerate(ranked[:8], 1):
        flag = {3042: "  ⟵ **PLANT #1**", 3043: "  ⟵ plant #2 (slump)",
                3046: "  ⟵ plant #2 (slump)", 3025: "  ⟵ **PLANT #3**"}.get(m["scene_id"], "")
        lines.append(
            f"| {i} | {m['title']}{flag} | {m['episode_id']} | {m['drop_off_rate']} | "
            f"{m['skip_rate']} | {m['replay_rate']} | {m['avg_speed']} | {weakness_score(m)} |")

    lines += ["", "### Character investment (the silent vote)", "",
              "| character | role | scenes | replay | skip | drop-off | investment |",
              "|---|---|---|---|---|---|---|"]
    for c in inv["characters"]:
        lines.append(f"| {c['name']} | {c['role']} | {c['scenes_present']} | {c['avg_replay_rate']} | "
                     f"{c['avg_skip_rate']} | {c['avg_drop_off_rate']} | **{c['investment_score']}** |")

    lines += ["", "### Thread investment", "",
              "| thread | scenes | replay | skip | drop-off | investment |",
              "|---|---|---|---|---|---|"]
    for t in inv["threads"]:
        lines.append(f"| {t['thread']} | {t['scenes_present']} | {t['avg_replay_rate']} | "
                     f"{t['avg_skip_rate']} | {t['avg_drop_off_rate']} | **{t['investment_score']}** |")

    lines += ["", "### Per-episode retention", "",
              "| episode | title | sessions | completed | completion rate |",
              "|---|---|---|---|---|"]
    for ep in EPISODES:
        sess = {r["session_id"] for r in rows if r["episode_id"] == ep}
        comp = {r["session_id"] for r in rows if r["episode_id"] == ep and r["event_type"] == "complete"}
        lines.append(f"| {ep} | {EPISODE_TITLES[ep]} | {len(sess)} | {len(comp)} | "
                     f"{round(len(comp)/len(sess), 2) if sess else 0} |")
    lines.append("")
    (OUT / "GROUND_TRUTH.md").write_text("\n".join(lines), encoding="utf-8")


def verify(emap: list[dict], inv: dict) -> bool:
    """Check the detector recovers what we planted. This is the whole point."""
    ranked = sorted(emap, key=weakness_score, reverse=True)
    chars = inv["characters"]
    threads = inv["threads"]
    top6_eps = [m["episode_id"] for m in ranked[:6]]

    checks = [
        ("weakest scene is 3042 (Council of Grain)", ranked[0]["scene_id"] == 3042),
        ("Sera has the top investment score", chars[0]["name"] == "Sera"),
        ("Ord has the bottom investment score", chars[-1]["name"] == "Maester Ord"),
        ("thread 401 (northern shadow) is least invested", threads[-1]["thread_id"] == T_NORTH_SHADOW),
        ("episode 1004 owns >=3 of the 6 weakest scenes", top6_eps.count(1004) >= 3),
        ("3025 (Butcher's Ledger) is in the top 5 weakest", 3025 in [m["scene_id"] for m in ranked[:5]]),
        ("Sera never appears in a top-5 weakest scene",
         not any(SERA in next(s["chars"] for s in SCENES if s["id"] == m["scene_id"]) for m in ranked[:5])),
        ("ep 1004 sc.5 (Sera) is healthier than sc.3 that precedes it",
         weakness_score(next(m for m in emap if m["scene_id"] == 3045))
         < weakness_score(next(m for m in emap if m["scene_id"] == 3043))),
    ]
    print("\nGround-truth checks:")
    for label, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {label}")
    return all(ok for _, ok in checks)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    compute_spans()
    log = simulate_all()
    rows = log.rows
    emap = build_engagement_map(rows)
    inv = build_investment(emap)

    write_sql(rows)
    write_csv(rows)
    (OUT / "scene_engagement.json").write_text(
        json.dumps([dict(m, weakness_score=weakness_score(m)) for m in emap], indent=2), encoding="utf-8")
    (OUT / "investment.json").write_text(json.dumps(inv, indent=2), encoding="utf-8")
    write_ground_truth(emap, inv, rows)

    sessions = len({r["session_id"] for r in rows})
    print(f"listeners={len(LISTENERS)}  sessions={sessions}  events={len(rows)}  scenes={len(SCENES)}")
    print("\nWeakest scenes:")
    for m in sorted(emap, key=weakness_score, reverse=True)[:5]:
        print(f"  {weakness_score(m):5.1f}  ep{m['episode_id']} sc{m['scene_order']} "
              f"{m['title']:<28} drop={m['drop_off_rate']} skip={m['skip_rate']} "
              f"replay={m['replay_rate']} speed={m['avg_speed']}")
    print("\nCharacter investment:")
    for c in inv["characters"]:
        print(f"  {c['investment_score']:5.1f}  {c['name']:<16} ({c['role']:<11}) "
              f"replay={c['avg_replay_rate']} skip={c['avg_skip_rate']}")
    print("\nThread investment:")
    for t in inv["threads"]:
        print(f"  {t['investment_score']:5.1f}  {t['thread'][:52]}")

    ok = verify(emap, inv)
    print(f"\nwrote -> {OUT}")
    if not ok:
        raise SystemExit("ground-truth checks FAILED — the dataset does not "
                         "reproduce its own plants; fix the model before using it")


if __name__ == "__main__":
    main()
