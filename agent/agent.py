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
            "description": "Canonical episodes up to and including the fork point, for continuity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "series_id": {"type": "string"},
                    "before_order": {"type": "integer"},
                },
                "required": ["series_id", "before_order"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_characters",
            "description": "All characters of a series with personality, voice, goals, status.",
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
            "description": "Open plot threads to honor or advance.",
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
    "You are the AI co-author of a serialized story. Your task: write the NEXT "
    "episode of an ALTERNATE TIMELINE that branches from a single changed decision.\n\n"
    "First GATHER CONTEXT by calling the available tools. ALWAYS call get_episode with "
    "the given source episode id FIRST to obtain the real series_id and order_index, then "
    "use those EXACT ids for the other tools. Never invent or guess ids.\n\n"
    "Non-negotiable rules:\n"
    "1. CHARACTER CONSISTENCY — match each character's personality, voice, goals, "
    "status; they cannot know things impossible in this timeline.\n"
    "2. CONTINUITY — honor all prior canon EXCEPT the changed decision and its "
    "downstream consequences.\n"
    "3. DIVERGENCE — the changed decision must cause a genuinely different outcome; "
    "do not snap back to the original path.\n"
    "4. STYLE — obey the style guide exactly; never exceed the content rating.\n"
    "5. THREADS — advance/acknowledge open threads naturally; don't resolve unset ones.\n"
    "6. READER INTENT — let the driving comment steer the branch, never at the cost of 1-4.\n\n"
    "When done gathering, output ONLY the episode as:\n"
    "TITLE: <episode title>\n<prose, ~800-1500 words>\n"
    "No commentary or meta-notes."
)

ANALYZE_SYSTEM = (
    "You are a story analytics assistant for the author. You are given EXACT audience "
    "retention numbers (computed by SQL) for an episode. Call get_retention and "
    "get_episode to fetch the data and the text.\n\n"
    "Rules:\n"
    "1. TRUST THE NUMBERS — never invent or alter figures; only interpret what you fetch. "
    "If data is sparse, say so.\n"
    "2. LOCATE — tie notable drop-offs / peaks to the scene at that timestamp "
    "(bucket_10s * 10 seconds).\n"
    "3. EXPLAIN — give the most likely narrative reason (pacing, slow scene, character "
    "absence, confusion, a good hook).\n"
    "4. ADVISE — 2-3 concrete suggestions for the next episode.\n"
    "5. BE HONEST about sample size.\n\n"
    "Output: a 3-5 sentence summary, then a bullet list of suggestions. No fabricated stats."
)


# ---------------------------------------------------------------------------
# Core loop — yields event dicts: {"type": "reasoning"|"tool_call"|"tool_result"|
#            "token"|"done"|"error", ...}
# ---------------------------------------------------------------------------
def _run(system: str, user: str) -> Iterator[dict]:
    client = _client()
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    # Tool-gathering phase (non-streamed turns; tool calls are the visible reasoning).
    for i in range(MAX_TOOL_ITERS):
        # Force a tool call on the first turn so the agent always grounds itself in
        # real data before writing; let it decide (auto) afterwards.
        tool_choice = "required" if i == 0 else "auto"
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
    stream = client.chat.completions.create(
        model=LLM_ENDPOINT, messages=messages, tools=TOOL_DEFS, tool_choice="none",
        stream=True, max_tokens=1800,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if not delta:
            continue
        buf += delta
        if title is None and "TITLE:" in buf and "\n" in buf.split("TITLE:", 1)[1]:
            after = buf.split("TITLE:", 1)[1]
            title = after.split("\n", 1)[0].strip()
        yield {"type": "token", "delta": delta}
    yield {"type": "done", "title": title}


def generate_stream(
    source_episode_id: str,
    decision_point: str,
    driving_review_id: str | None = None,
    instructions: str | None = None,
) -> Iterator[dict]:
    user = (
        f"SOURCE EPISODE id={source_episode_id} (the decision point).\n"
        f"CHANGED DECISION: {decision_point}\n"
        f"DRIVING READER COMMENT id: {driving_review_id or '(none)'}\n"
        f"EXTRA INSTRUCTIONS: {instructions or '(none)'}\n\n"
        "Gather the context you need via tools, then write the next alternate-timeline episode."
    )
    yield from _run(REGEN_SYSTEM, user)


def analyze_stream(episode_id: str) -> Iterator[dict]:
    user = (
        f"Analyze audience retention for episode id={episode_id}. "
        "Fetch the retention curve and the episode text, then explain and advise."
    )
    yield from _run(ANALYZE_SYSTEM, user)
