"""Scorers for NEXUS generation evals.

Two kinds:
  * LLM-judge scorers (Guidelines / Safety / RelevanceToQuery) — domain quality rules
    phrased in natural language; judged by the Databricks default judge model.
  * Code-based scorers (@scorer) — deterministic, no judge/LLM needed. Cheap format and
    safety-net checks (word count, TITLE contract, no marker leak, no fabricated %).

Guidelines judges see the record's `inputs` and the model `outputs`; where a rule needs
canon, we pass it through `inputs`/`expectations` in datasets.py.
"""
import re

from mlflow.entities import Feedback
from mlflow.genai.scorers import Guidelines, RelevanceToQuery, Safety, scorer

# ---------------------------------------------------------------------------
# LLM-judge guideline scorers, per surface
# ---------------------------------------------------------------------------
REGEN_JUDGES = [
    Guidelines(
        name="divergence_honored",
        guidelines=(
            "The response is the next episode of an ALTERNATE timeline. Given the changed "
            "decision in `inputs.decision_point` (and `expectations.divergence`), the episode "
            "must follow that changed path and NOT snap back to the original outcome."
        ),
    ),
    Guidelines(
        name="continuity_consistent",
        guidelines=(
            "The episode must stay consistent with the canon in `expectations.canon_facts`: "
            "character identities, who is alive/dead, and prior events. It must not contradict "
            "them or invent facts that conflict with them."
        ),
    ),
    Guidelines(
        name="craft_hook",
        guidelines=(
            "The episode should read as publishable serialized fiction: it opens with a pull "
            "and ends on a hook or turn that makes the next episode enticing, and it dramatizes "
            "scenes rather than summarizing them."
        ),
    ),
    Guidelines(
        name="output_contract",
        guidelines=(
            "The response must be ONLY the episode: a single 'TITLE:' line followed by prose, "
            "with no meta-commentary, notes, or analysis outside the story."
        ),
    ),
    Safety(),
]

EDIT_JUDGES = [
    Guidelines(
        name="change_applied",
        guidelines=(
            "The revised manuscript must clearly apply the change requested in "
            "`inputs.instruction` (see `expectations.change`)."
        ),
    ),
    Guidelines(
        name="preserved_untouched",
        guidelines=(
            "Only the requested change should be made. Parts of the manuscript unrelated to the "
            "instruction must be preserved in substance and voice — not rewritten, dropped, or "
            "summarized away."
        ),
    ),
    Safety(),
]

ANALYZE_JUDGES = [
    Guidelines(
        name="cites_data",
        guidelines=(
            "The analysis must cite concrete retention figures and at least one timestamp "
            "(m:ss) tied to a scene, and connect a reader complaint to a drop-off when one lines "
            "up. It must not fabricate numbers beyond what could be fetched."
        ),
    ),
    Guidelines(
        name="survival_curve_correct",
        guidelines=(
            "Audience retention here is a survival fraction that only DECLINES over time. The "
            "analysis must not claim retention 'recovers', 'rebounds', or rises later in the "
            "episode; it may only describe steeper vs flatter decline (drop-offs vs plateaus)."
        ),
    ),
    Guidelines(
        name="actionable_advice",
        guidelines="The analysis ends with 2-3 concrete, actionable suggestions, each tied to a specific moment.",
    ),
    RelevanceToQuery(),
]

CHAT_JUDGES = [
    Guidelines(
        name="grounded_no_fabrication",
        guidelines=(
            "The answer must be grounded in real story data consistent with "
            "`expectations.canon_facts`. It must not invent characters, ids, quotes, or numbers, "
            "and must not output full episode prose or a 'TITLE:' line."
        ),
    ),
    Guidelines(
        name="proactive_when_asked",
        guidelines=(
            "If `expectations.expect_proactive` is present, the answer should correlate a reader "
            "reaction with the retention dip at the same timestamp and propose a specific fix "
            "(e.g. suggest a /rewrite). If it is absent, this rule passes automatically."
        ),
    ),
    RelevanceToQuery(),
    Safety(),
]


# ---------------------------------------------------------------------------
# Code-based deterministic scorers (no judge/LLM)
# ---------------------------------------------------------------------------
_PCT = re.compile(r"\b\d{1,3}\s?%")
_TIME = re.compile(r"\b\d{1,2}:\d{2}\b")


@scorer
def regen_format(outputs) -> Feedback:
    """Episode must have a TITLE line and land near the 1000-1400 word target."""
    text = outputs if isinstance(outputs, str) else str(outputs)
    has_title = "TITLE:" in text[:200]
    words = len(re.findall(r"\S+", text))
    ok = has_title and 700 <= words <= 1800  # generous band; judge covers quality
    return Feedback(
        value=ok,
        rationale=f"title={has_title}, words={words} (target ~1000-1400)",
    )


@scorer
def edit_no_marker_leak(outputs) -> Feedback:
    """The @@SUMMARY@@ delimiter must never appear in the revised manuscript."""
    text = outputs if isinstance(outputs, str) else str(outputs)
    leaked = "@@SUMMARY@@" in text
    nonempty = bool(text.strip())
    return Feedback(value=(nonempty and not leaked), rationale=f"nonempty={nonempty}, marker_leak={leaked}")


@scorer
def analyze_has_numbers(outputs) -> Feedback:
    """Analysis must contain at least one % figure and one m:ss timestamp."""
    text = outputs if isinstance(outputs, str) else str(outputs)
    has_pct = bool(_PCT.search(text))
    has_time = bool(_TIME.search(text))
    return Feedback(value=(has_pct and has_time), rationale=f"has_pct={has_pct}, has_timestamp={has_time}")


@scorer
def chat_not_episode(outputs) -> Feedback:
    """Chat must not dump an episode draft (no TITLE: line)."""
    text = outputs if isinstance(outputs, str) else str(outputs)
    return Feedback(value=("TITLE:" not in text), rationale="no 'TITLE:' in a chat reply")


# convenience bundles: judges + code scorers per surface
REGEN_SCORERS = REGEN_JUDGES + [regen_format]
EDIT_SCORERS = EDIT_JUDGES + [edit_no_marker_leak]
ANALYZE_SCORERS = ANALYZE_JUDGES + [analyze_has_numbers]
CHAT_SCORERS = CHAT_JUDGES + [chat_not_episode]
