"""Eval datasets for NEXUS generation, grounded in the seeded Lakebase demo data.

Every case references real seed ids so the agent's pre-fetched grounding context is
exercised end-to-end (schema.sql / seed.sql):
  - series 100 "The Ashes of Aldric"; canonical episodes 1001..1004
  - decision-point episode 1003 "The Spared Blade" (Aldric spares Lady Corvin)
  - driving review 5001 ("What if she killed him instead?")
  - retention seeded for ep 1003 (120 starters, ~2:54, cliff at ~1:40)

Each row is an MLflow `data` record: {"inputs": {...}, "expectations": {...}}.
`inputs` maps 1:1 to the predict_fn kwargs; `expectations` feeds the judges facts they
can hold the output to (never invent beyond fetched data).
"""

SOURCE_EPISODE = "1003"
SERIES_ID = "100"
DRIVING_REVIEW = "5001"

# Facts the model must stay consistent with (from seed.sql). Judges use these to catch
# continuity breaks and fabrications.
CANON_FACTS = (
    "Aldric is the protagonist knight. Lady Corvin is the antagonist he spared at the "
    "decision point in episode 1003. Ser Hallis died earlier (episode 1002). The retention "
    "curve for episode 1003 is a survival fraction that only declines (100% -> ~33%), with "
    "its steepest cliff around 1:40."
)

# --- REGEN: write the next alternate-timeline episode ---------------------------
REGEN_CASES = [
    {
        "inputs": {
            "source_episode_id": SOURCE_EPISODE,
            "decision_point": "What if Aldric killed Lady Corvin instead of sparing her?",
            "driving_review_id": DRIVING_REVIEW,
            "instructions": None,
        },
        "expectations": {
            "canon_facts": CANON_FACTS,
            "divergence": "Aldric kills Lady Corvin; the branch must not snap back to sparing her.",
        },
    },
    {
        "inputs": {
            "source_episode_id": SOURCE_EPISODE,
            "decision_point": "Continue this timeline — write the next episode after Aldric spares her.",
            "driving_review_id": None,
            "instructions": "Raise the stakes and end on a strong hook.",
        },
        "expectations": {
            "canon_facts": CANON_FACTS,
            "divergence": "Aldric spared Corvin; she remains alive and a live threat.",
        },
    },
]

# --- EDIT: apply a plain-language change to the CURRENT manuscript ----------------
# manuscript is filled at runtime from the seeded episode text (see run_evals.py).
EDIT_CASES = [
    {
        "inputs": {"episode_id": SOURCE_EPISODE, "instruction": "Make the ending darker and more ominous."},
        "expectations": {"change": "The ending becomes darker/ominous; the rest is preserved."},
    },
    {
        "inputs": {"episode_id": SOURCE_EPISODE, "instruction": "Tighten the opening — cut throat-clearing so it starts on tension."},
        "expectations": {"change": "The opening is tighter and starts on tension; later scenes unchanged."},
    },
]

# --- ANALYZE: interpret retention numbers ---------------------------------------
ANALYZE_CASES = [
    {
        "inputs": {"episode_id": SOURCE_EPISODE},
        "expectations": {
            "canon_facts": CANON_FACTS,
            "must_locate": "A drop-off near 1:40 (the seeded cliff), tied to the scene there.",
        },
    },
]

# --- CHAT: grounded Q&A + proactive suggestions ---------------------------------
CHAT_CASES = [
    {
        "inputs": {"episode_id": SOURCE_EPISODE, "message": "How is this episode doing with readers, and how can I improve it?", "history": []},
        "expectations": {
            "canon_facts": CANON_FACTS,
            "expect_proactive": "Correlate a reader comment with the retention dip at the same timestamp and propose a concrete fix.",
        },
    },
    {
        "inputs": {"episode_id": SOURCE_EPISODE, "message": "Who is Lady Corvin and what is her status in this timeline?", "history": []},
        "expectations": {"canon_facts": CANON_FACTS},
    },
]
