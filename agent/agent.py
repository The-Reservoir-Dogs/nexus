"""Tool-calling agent for NEXUS.

Read-only: the LLM decides which Lakebase tools to call, we execute them, and we
STREAM every step (reasoning, tool_call, tool_result, token) so the UI shows the
agent thinking live. No DB writes — the web backend owns writes.

Two entry points, same loop:
  - generate_stream(): regenerate the next episode of an alternate timeline
  - analyze_stream():  narrate exact retention numbers into author insight
"""
import base64
import json
import os
from typing import Iterator

from openai import OpenAI

import tools

LLM_ENDPOINT = os.environ.get("LLM_ENDPOINT", "databricks-claude-sonnet-5")
MAX_TOOL_ITERS = 8
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/"
SECRET_SCOPE = os.environ.get("SECRET_SCOPE", "nexus")

_gemini_cache: str | None = None


def _gemini_key() -> str:
    """Resolve the paid Gemini key WITHOUT ever putting it in git/CI/app config.
    Local dev: GEMINI_API_KEY env (from .env, gitignored).
    Deployed: fetched at runtime from the Databricks secret scope via the app's
    service principal (requires READ acl on the scope)."""
    global _gemini_cache
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    if _gemini_cache:
        return _gemini_cache
    from databricks.sdk import WorkspaceClient

    raw = WorkspaceClient().secrets.get_secret(scope=SECRET_SCOPE, key="gemini_api_key").value
    _gemini_cache = base64.b64decode(raw).decode()
    return _gemini_cache


def _client() -> OpenAI:
    """Provider-aware client. Uses Gemini's OpenAI-compatible API when LLM_ENDPOINT is a
    gemini-* model; otherwise the Databricks serving endpoint."""
    if LLM_ENDPOINT.startswith("gemini"):
        return OpenAI(base_url=GEMINI_BASE, api_key=_gemini_key())
    host = os.environ["DATABRICKS_HOST"].rstrip("/")
    token = os.environ["DATABRICKS_TOKEN"]
    return OpenAI(base_url=f"{host}/serving-endpoints", api_key=token)


# ---------------------------------------------------------------------------
# Tool registry: JSON schemas advertised to the LLM + the callables that run.
# ---------------------------------------------------------------------------
TOOL_DEFS = [
    {
        "type": "function",
        "function": {
            "name": "get_episode",
            "description": "Fetch one episode by id: content, summary, decision_point, series_id, order_index.",
            "parameters": {
                "type": "object",
                "properties": {"episode_id": {"type": "string"}},
                "required": ["episode_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_prior_episodes",
            "description": "Prior episodes for continuity. Pass episode_id to walk THIS timeline's lineage (includes prior branch episodes for N+2); otherwise pass series_id+before_order for the canonical spine.",
            "parameters": {
                "type": "object",
                "properties": {
                    "series_id": {"type": "string"},
                    "before_order": {"type": "integer"},
                    "episode_id": {"type": "string", "description": "the current episode; walk its timeline lineage"},
                },
                "required": ["series_id", "before_order"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_characters",
            "description": "Characters of a series with personality, voice, goals, status. Pass as_of_episode_id to get each character's LIVE state for this timeline (nearest-ancestor memory/status): keeps a killed character dead on a branch and carries evolving memory into N+2.",
            "parameters": {
                "type": "object",
                "properties": {
                    "series_id": {"type": "string"},
                    "as_of_episode_id": {"type": "string", "description": "overlay timeline-specific state as of this episode"},
                },
                "required": ["series_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_style_guide",
            "description": "Series style: pov, tense, tone, pacing, content_rating, narrative_voice.",
            "parameters": {
                "type": "object",
                "properties": {"series_id": {"type": "string"}},
                "required": ["series_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_open_threads",
            "description": "Open plot threads to honor or advance. Pass as_of_episode_id so thread status reflects THIS timeline (a thread resolved on a branch may stay open on canon).",
            "parameters": {
                "type": "object",
                "properties": {
                    "series_id": {"type": "string"},
                    "as_of_episode_id": {"type": "string"},
                },
                "required": ["series_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_comments",
            "description": "Reader reviews on an episode, including the driving comment.",
            "parameters": {
                "type": "object",
                "properties": {"episode_id": {"type": "string"}},
                "required": ["episode_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_retention",
            "description": "10s-bucket audience retention curve for an episode (analytics).",
            "parameters": {
                "type": "object",
                "properties": {"episode_id": {"type": "string"}},
                "required": ["episode_id"],
            },
        },
    },
]

TOOL_FUNCS = {
    "get_episode": tools.get_episode,
    "get_prior_episodes": tools.get_prior_episodes,
    "get_characters": tools.get_characters,
    "get_style_guide": tools.get_style_guide,
    "get_open_threads": tools.get_open_threads,
    "get_comments": tools.get_comments,
    "get_retention": tools.get_retention,
}


def _dispatch(name: str, args: dict):
    fn = TOOL_FUNCS.get(name)
    if not fn:
        return {"error": f"unknown tool {name}"}
    if "before_order" in args:
        try:
            args["before_order"] = int(args["before_order"])
        except (TypeError, ValueError):
            pass
    # Never let a bad tool call (e.g. a hallucinated id) crash the stream.
    # Return the error so the model can see it and self-correct on the next turn.
    try:
        return fn(**args)
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}


def _summarize(name: str, result) -> str:
    """Short human-readable line for the tool_result event (the visible reasoning)."""
    if isinstance(result, list):
        return f"{len(result)} row(s)"
    if isinstance(result, dict):
        title = result.get("title") or result.get("name")
        return title or "1 record"
    return "ok" if result is not None else "empty"


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------
REGEN_SYSTEM = (
    "You are the AI co-author of a serialized story. Task: write the NEXT episode of an "
    "ALTERNATE TIMELINE that branches from a single changed decision.\n\n"
    "GATHER CONTEXT FIRST via tools. ALWAYS call get_episode on the given source episode id "
    "FIRST to get the real series_id and order_index, then use those EXACT ids for the rest. "
    "Never invent or guess ids. Before you write, make sure you have gathered ALL of: the "
    "source episode text (get_episode), the style guide (get_style_guide), the live characters "
    "(get_characters with as_of_episode_id=source), the open threads (get_open_threads with "
    "as_of_episode_id=source), the prior-episode summaries (get_prior_episodes with "
    "episode_id=source), and the reader signal (get_comments AND get_retention on the source) so "
    "you know what landed and what didn't.\n\n"
    "CONTINUITY IS TIMELINE-SPECIFIC: pass the source episode id as as_of_episode_id to "
    "get_characters and get_open_threads, and pass episode_id to get_prior_episodes, so you see "
    "the state of THIS branch (a character killed earlier stays dead, evolved memory carries into "
    "N+2) rather than the sacred timeline's defaults.\n\n"
    "USE THE READER SIGNAL: cross-reference reader comments with the retention curve. Where "
    "listeners dropped off (a low-retention bucket marks the timestamp bucket_10s*10s) or a reader "
    "complained, treat that beat as a weakness to FIX in this episode — tighten it, raise the "
    "stakes, or cut the dead air. Let the driving comment steer the branch, never at the cost of "
    "the continuity rules below.\n\n"
    "NON-NEGOTIABLE CONTINUITY RULES:\n"
    "1. CHARACTER CONSISTENCY — match each character's personality, voice, goals, status; they "
    "cannot know things impossible in this timeline.\n"
    "2. CONTINUITY — honor all prior canon EXCEPT the changed decision and its downstream "
    "consequences.\n"
    "3. DIVERGENCE — establish the changed decision EARLY and show its first real consequence "
    "in-scene this episode; never snap back to the original path.\n"
    "4. STYLE — obey the style guide exactly (pov, tense, tone, pacing, voice); never exceed the "
    "content rating.\n"
    "5. THREADS — advance or acknowledge open threads naturally; don't resolve unset ones.\n\n"
    "CRAFT — this is what makes it publishable, not merely correct:\n"
    "- DRAMATIZE, don't summarize: render key moments as scenes with action, sensory detail, and "
    "dialogue; show emotion through behavior instead of naming it.\n"
    "- Enter scenes late and leave early; cut throat-clearing and recap.\n"
    "- Dialogue carries character and subtext — no on-the-nose exposition.\n"
    "- Vary sentence rhythm; ground every scene in a place and a body.\n"
    "- OPEN with a pull and END on a hook or turn that makes the next episode irresistible.\n"
    "- AVOID: cliches, purple prose, over-explaining feelings, filler, restating what the reader "
    "already knows, and generic 'AI' phrasing.\n\n"
    "When done gathering, output ONLY the episode as:\n"
    "TITLE: <episode title>\n<prose, 1000-1400 words>\n"
    "No commentary or meta-notes."
)

ANALYZE_SYSTEM = (
    "You are a story analytics assistant for the author. You interpret EXACT audience retention "
    "numbers (computed by SQL) for an episode and turn them into insight.\n\n"
    "WORK LIKE AN ANALYST — reason, act, observe, refine:\n"
    "- Form a hypothesis, then call a tool to test it. Call get_retention and get_episode FIRST; "
    "call get_comments to hear readers; call get_characters or get_open_threads only if a dip "
    "points at a specific character or unresolved thread.\n"
    "- After each tool result, briefly note what it tells you before the next step. Stop gathering "
    "once the numbers, the scene, and the reader voice line up.\n\n"
    "RULES:\n"
    "1. TRUST THE NUMBERS — interpret only fetched figures; never invent, round away, or soften a "
    "problem. If data is sparse, say so and lower your confidence.\n"
    "2. LOCATE — the curve is a SURVIVAL fraction (share of starters still listening); it only "
    "declines. Read the SLOPE: steep segments are drop-offs, flat segments (plateaus) are scenes "
    "that hold. Map each steep drop / plateau to its timestamp (bucket_10s * 10 seconds = m:ss) "
    "and the scene or line playing there.\n"
    "3. CORROBORATE — when a reader complaint matches a dip, cite it: quote + exact retention % + "
    "timestamp.\n"
    "4. EXPLAIN — give the most likely narrative cause (pacing, slow scene, absent character, "
    "confusion, a weak or strong hook).\n"
    "5. ADVISE — 2-3 concrete, actionable fixes for the next episode, each tied to a specific "
    "moment.\n\n"
    "OUTPUT: a 3-5 sentence summary, then a bullet list of suggestions. Cite real numbers and real "
    "quotes only.\n\n"
    "THE EXAMPLES BELOW ARE FORMAT ILLUSTRATIONS ONLY — never reuse their numbers, names, or "
    "quotes; use only the data YOU fetched.\n\n"
    "--- Example A (strong episode, one mid cliff) ---\n"
    "Fetched: retention eases 100%→88% over the first 1:30, then cliffs 88%→61% between 1:30 and "
    "1:40, and the slide flattens to ~40% by the 2:54 end; 120 starters. Comment @rin: 'the tavern "
    "chat dragged.' Scene at ~1:40: a long exposition dialogue in the tavern.\n"
    "Summary: The episode holds well through the first 90 seconds, then loses over a quarter of its "
    "audience in a single 10-second cliff at 1:40 — 88% to 61% — during the tavern exposition, the "
    "one beat reader @rin calls out as dragging. The curve flattens after 2:00, so whoever survives "
    "the tavern mostly stays: that cliff is the whole problem. 120 starters is a decent sample, so "
    "trust the shape.\n"
    "Suggestions:\n"
    "- Cut the tavern exposition ~40% and fold the one needed fact into the following scene.\n"
    "- Enter the scene later — open on tension, not pleasantries.\n"
    "- Move a hook into the 1:30–2:00 window to hold the audience through the exposition.\n\n"
    "--- Example B (weak opening, sparse data) ---\n"
    "Fetched: 100%→48% across the first 0:30, then a gentle slide to ~40%; only 22 starters. "
    "Comment @dev: 'took forever to get going.' Scene 0:00–0:30: a recap of the prior episode.\n"
    "Summary: The cold open bleeds more than half the audience in the first 30 seconds during a "
    "recap of last episode, and @dev names the slow start directly. The curve is nearly flat after "
    "0:40, so whoever gets past the recap stays — the opening is the leak. With only 22 starters, "
    "treat magnitudes as directional, not precise.\n"
    "Suggestions:\n"
    "- Drop the recap; open in the middle of the action.\n"
    "- Seed the one necessary callback as a single line mid-scene.\n"
    "- Put your strongest image in the first two sentences."
)

CHAT_SYSTEM = (
    "You are the AI co-author of a serialized story, chatting with the author in a side panel. "
    "Answer questions about the story, its characters, reader reception, open plot threads, "
    "retention, and craft. Decide which tools to call to ground EVERY answer in real data — never "
    "invent facts, ids, quotes, or numbers.\n\n"
    "You are given the CURRENT EPISODE id in context. Call get_episode on it FIRST when you need "
    "its series_id/order_index, then use those EXACT ids for the other tools. Pick the tools "
    "relevant to the question: reader reactions -> get_comments; who's in the story -> "
    "get_characters; unresolved arcs -> get_open_threads; audience drop-off -> get_retention; "
    "prior events -> get_prior_episodes; style -> get_style_guide. If a question needs no data, "
    "just answer.\n\n"
    "BE A PROACTIVE EDITOR: when the author asks how the episode is doing or how to make it "
    "better, CORRELATE signals — pull get_comments AND get_retention AND get_episode, then connect "
    "a specific reader complaint to the retention dip at the SAME timestamp (bucket_10s*10s) and "
    "the scene playing there. State it concretely, e.g. 'Reader @maya disliked killing Aldric; "
    "retention drops to 58% at 2:10 — exactly that beat.' Then propose a specific fix and offer to "
    "apply it: tell the author to run `/rewrite <instruction>` (or spell out the change) to draft "
    "it into the editor.\n\n"
    "Be concise and specific. Quote real reader comments and cite real numbers when you have them. "
    "You are CHATTING, not writing an episode — do not output episode prose or a 'TITLE:' line "
    "unless the author explicitly asks you to draft/rewrite the episode."
)

EDIT_SYSTEM = (
    "You are the AI co-author editing the CURRENT manuscript open in the author's editor. "
    "The author gives a change request in plain language; you apply it to the text.\n\n"
    "Apply ONLY the requested change. Preserve EVERYTHING else verbatim — the author's "
    "wording, voice, continuity, and every scene you were not asked to touch. Do not "
    "rewrite untouched passages, do not 'improve' unrelated lines, do not drop content.\n\n"
    "Obey the series style guide and never exceed the content rating. You MAY call tools "
    "(get_style_guide, get_characters, get_open_threads) to stay consistent with the series; "
    "never invent facts, ids, or quotes. Call get_episode with the given id only if you need "
    "its series_id for another tool.\n\n"
    "Match the surrounding prose quality and voice: dramatize rather than summarize, keep dialogue "
    "and sentence rhythm natural, and add no filler or generic 'AI' phrasing. The change should "
    "read as if the original author wrote it.\n\n"
    "Output EXACTLY, in this order:\n"
    "1. The FULL revised episode prose — the entire manuscript with your change applied, "
    "ready to REPLACE the editor's contents. Reproduce unchanged parts verbatim. No 'TITLE:' "
    "line, no commentary inside the prose.\n"
    "2. A line containing only: @@SUMMARY@@\n"
    "3. 1-3 sentences describing what you changed and why (this goes to the chat panel, NOT "
    "the manuscript).\n\n"
    "Even for a tiny change, output the complete manuscript — never a fragment or a diff."
)

INTENT_SYSTEM = (
    "You classify an author's message in a serialized-story editor. Reply with ONE word only:\n"
    "EDIT — they want you to change, rewrite, add to, trim, or otherwise modify the episode "
    "TEXT in the editor (e.g. 'make the ending darker', 'remove the fight scene', 'add more "
    "tension in the opening', 'give Aldric a limp').\n"
    "ASK — they want information, analysis, or an answer, with no change to the manuscript "
    "(e.g. 'who is Aldric?', 'why did readers drop off?', 'what are the open threads?').\n"
    "Reply with exactly EDIT or ASK. Nothing else."
)


def route_intent(message: str) -> str:
    """LLM router: EDIT (modify manuscript) vs ASK (answer in chat). Defaults to ASK on
    any error so a failure never silently overwrites the author's text."""
    try:
        client = _client()
        resp = client.chat.completions.create(
            model=LLM_ENDPOINT,
            messages=[
                {"role": "system", "content": INTENT_SYSTEM},
                {"role": "user", "content": message},
            ],
            max_tokens=3,
            temperature=0,
        )
        out = (resp.choices[0].message.content or "").strip().upper()
        return "EDIT" if out.startswith("EDIT") else "ASK"
    except Exception:  # noqa: BLE001
        return "ASK"


# ---------------------------------------------------------------------------
# Core loop — yields event dicts: {"type": "reasoning"|"tool_call"|"tool_result"|
#            "token"|"done"|"error", ...}
# ---------------------------------------------------------------------------
def _run(
    system: str,
    user: str,
    force_first_tool: bool = True,
    max_tokens: int = 1800,
    split_marker: str | None = None,
) -> Iterator[dict]:
    client = _client()
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    # Tool-gathering phase (non-streamed turns; tool calls are the visible reasoning).
    for i in range(MAX_TOOL_ITERS):
        # Optionally force a tool call on the first turn so the agent grounds itself in
        # real data before writing; let it decide (auto) afterwards. Chat lets the agent
        # choose freely from the start (some questions need no data).
        tool_choice = "required" if (i == 0 and force_first_tool) else "auto"
        resp = client.chat.completions.create(
            model=LLM_ENDPOINT, messages=messages, tools=TOOL_DEFS, tool_choice=tool_choice
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            # Gathering done. Discard any early inline answer so it can't pollute /
            # short-circuit the streamed write phase below; we always write fresh there.
            break
        if msg.content:
            yield {"type": "reasoning", "delta": msg.content}
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            }
        )
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            yield {"type": "tool_call", "name": name, "args": args}
            result = _dispatch(name, args)
            yield {"type": "tool_result", "name": name, "summary": _summarize(name, result)}
            messages.append(
                {"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result, default=str)}
            )

    # Final phase: stream the prose. tool_choice="none" forces an answer, no more tools.
    title = None
    buf = ""
    pending = ""      # buffered text not yet safe to emit (possible partial marker)
    summary = ""      # everything after split_marker -> chat summary, not the editor
    in_summary = False
    stream = client.chat.completions.create(
        model=LLM_ENDPOINT, messages=messages, tools=TOOL_DEFS, tool_choice="none",
        stream=True, max_tokens=max_tokens,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if not delta:
            continue
        if in_summary:
            summary += delta
            continue
        if split_marker:
            pending += delta
            mi = pending.find(split_marker)
            if mi != -1:
                emit = pending[:mi]
                if emit:
                    yield {"type": "token", "delta": emit}
                summary += pending[mi + len(split_marker):]
                in_summary = True
                pending = ""
                continue
            # hold back a suffix that could be the start of the marker
            safe = len(pending) - (len(split_marker) - 1)
            if safe > 0:
                emit, pending = pending[:safe], pending[safe:]
                yield {"type": "token", "delta": emit}
            continue
        buf += delta
        if title is None and "TITLE:" in buf and "\n" in buf.split("TITLE:", 1)[1]:
            after = buf.split("TITLE:", 1)[1]
            title = after.split("\n", 1)[0].strip()
        yield {"type": "token", "delta": delta}
    if split_marker and not in_summary and pending:
        yield {"type": "token", "delta": pending}
    yield {"type": "done", "title": title, "summary": summary.strip()}


def generate_stream(
    source_episode_id: str,
    decision_point: str,
    driving_review_id: str | None = None,
    instructions: str | None = None,
) -> Iterator[dict]:
    try:
        ctx = tools.build_generation_context(source_episode_id, driving_review_id=driving_review_id)
    except Exception:  # noqa: BLE001 — never let a context-fetch error kill generation
        ctx = None
    user = (
        f"SOURCE EPISODE id={source_episode_id} (the decision point).\n"
        f"CHANGED DECISION: {decision_point}\n"
        f"EXTRA INSTRUCTIONS: {instructions or '(none)'}\n\n"
        "=== GROUNDING CONTEXT (authoritative, already fetched for you) ===\n"
        f"{ctx or '(unavailable — gather it yourself via tools before writing)'}\n"
        "=== END CONTEXT ===\n\n"
        "Treat the context above as the source of truth for continuity and reader signal. "
        "Call tools only for anything not already provided, then write the next "
        "alternate-timeline episode."
    )
    if ctx:
        # keep the live "thinking" panel meaningful even though we pre-fetched server-side
        yield {
            "type": "reasoning",
            "delta": "Grounded in source episode, style guide, live character state, open "
            "threads, prior episodes, reader comments, and the retention curve.",
        }
    # If context is present we don't need to force a first tool call; if it failed to load,
    # force the model to gather via tools so a draft is never written blind.
    yield from _run(REGEN_SYSTEM, user, force_first_tool=ctx is None)


def analyze_stream(episode_id: str) -> Iterator[dict]:
    user = (
        f"Analyze audience retention for episode id={episode_id}. "
        "Fetch the retention curve and the episode text, then explain and advise."
    )
    yield from _run(ANALYZE_SYSTEM, user)


def chat_stream(
    episode_id: str,
    message: str,
    history: list[dict] | None = None,
) -> Iterator[dict]:
    """Conversational co-author. The agent freely picks tools to answer the author's
    question grounded in real data. Does NOT force a first tool call and does NOT write
    an episode unless explicitly asked."""
    convo = ""
    for h in history or []:
        role = h.get("role", "user")
        text = (h.get("text") or "").strip()
        if text:
            convo += f"{'AUTHOR' if role == 'user' else 'YOU'}: {text}\n"
    user = (
        f"CURRENT EPISODE id={episode_id}.\n"
        + (f"CONVERSATION SO FAR:\n{convo}\n" if convo else "")
        + f"AUTHOR: {message}\n\n"
        "Answer the author. Call whatever tools you need first, then reply."
    )
    yield from _run(CHAT_SYSTEM, user, force_first_tool=False)


def edit_stream(
    episode_id: str,
    manuscript: str,
    instruction: str,
) -> Iterator[dict]:
    """Copilot-style edit: apply the author's change to the CURRENT manuscript and stream
    the full revised text into the editor, followed by a short summary (after @@SUMMARY@@)
    that the UI shows in the chat panel. tokens = revised prose; done.summary = what changed."""
    try:
        ctx = tools.build_generation_context(episode_id, include_source_text=False)
    except Exception:  # noqa: BLE001
        ctx = None
    user = (
        f"CURRENT EPISODE id={episode_id}.\n"
        f"CHANGE REQUESTED: {instruction}\n\n"
        "=== GROUNDING CONTEXT (authoritative, already fetched for you) ===\n"
        f"{ctx or '(unavailable — use tools if you need series facts)'}\n"
        "=== END CONTEXT ===\n\n"
        "CURRENT MANUSCRIPT (edit this, keep everything you weren't asked to change):\n"
        f"{manuscript}\n\n"
        "Apply the change consistently with the grounding context (voice, continuity, threads, "
        "content rating). Output the FULL revised manuscript, then a line '@@SUMMARY@@', then "
        "1-3 sentences on what you changed."
    )
    yield from _run(
        EDIT_SYSTEM, user, force_first_tool=False, max_tokens=2600, split_marker="@@SUMMARY@@"
    )
