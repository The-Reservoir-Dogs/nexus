"""Single context-aware generation step for an alternate timeline.

Read-only: gathers context from Lakebase via tools, calls the Databricks-hosted
LLM (OpenAI-compatible serving endpoint), and streams tokens. No DB writes.
"""
import os
from typing import Iterator

from openai import OpenAI

import tools

LLM_ENDPOINT = os.environ.get("LLM_ENDPOINT", "databricks-claude-sonnet-5")


def _client() -> OpenAI:
    host = os.environ["DATABRICKS_HOST"].rstrip("/")
    token = os.environ["DATABRICKS_TOKEN"]
    return OpenAI(base_url=f"{host}/serving-endpoints", api_key=token)


def build_context(source_episode_id: str, driving_review_id: str | None) -> dict:
    ep = tools.get_episode(source_episode_id)
    if not ep:
        raise ValueError(f"episode {source_episode_id} not found")
    series_id = ep["series_id"]
    prior = tools.get_prior_episodes(series_id, ep["order_index"])
    characters = tools.get_characters(series_id)
    style = tools.get_style_guide(series_id)
    threads = tools.get_open_threads(series_id)
    comments = tools.get_comments(source_episode_id)
    driving = None
    if driving_review_id:
        driving = next((c for c in comments if c["id"] == driving_review_id), None)
    return {
        "episode": ep,
        "series_id": series_id,
        "prior": prior,
        "characters": characters,
        "style": style,
        "threads": threads,
        "comments": comments,
        "driving": driving,
    }


def _prompt(ctx: dict, decision_point: str, instructions: str | None) -> list[dict]:
    style = ctx["style"] or {}
    chars = "\n".join(
        f"- {c['name']} ({c['role']}): {c['personality']} | voice: {c['speech_style']} | status: {c['status']}"
        for c in ctx["characters"]
    )
    prior = "\n".join(f"  Ep{p['order_index']}: {p['title']} — {p['summary']}" for p in ctx["prior"])
    threads = "\n".join(f"- {t['thread']}" for t in ctx["threads"])
    driving = ctx["driving"]["review_text"] if ctx["driving"] else "(none)"

    system = (
        "You are the AI co-author of a serialized story. Write the NEXT episode of an "
        "ALTERNATE TIMELINE that branches from a decision point. Keep every character "
        "consistent with their established personality, voice, and memory. Preserve "
        "continuity with prior canon except for the changed decision. Match the series style.\n\n"
        f"STYLE: pov={style.get('pov')} tense={style.get('tense')} tone={style.get('tone')} "
        f"pacing={style.get('pacing')} rating={style.get('content_rating')} "
        f"voice={style.get('narrative_voice')}\n\n"
        f"CHARACTERS:\n{chars}\n\n"
        f"PRIOR EPISODES:\n{prior}\n\n"
        f"OPEN PLOT THREADS:\n{threads}\n"
    )
    user = (
        f"SOURCE EPISODE (the decision point): {ctx['episode']['title']}\n"
        f"{ctx['episode']['content']}\n\n"
        f"CHANGED DECISION: {decision_point}\n"
        f"DRIVING READER COMMENT: {driving}\n"
        f"EXTRA INSTRUCTIONS: {instructions or '(none)'}\n\n"
        "Write the next episode for this alternate timeline. Start with a title line "
        "'TITLE: <title>' then the prose."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def generate_stream(
    source_episode_id: str,
    decision_point: str,
    driving_review_id: str | None = None,
    instructions: str | None = None,
) -> Iterator[str]:
    ctx = build_context(source_episode_id, driving_review_id)
    messages = _prompt(ctx, decision_point, instructions)
    stream = _client().chat.completions.create(
        model=LLM_ENDPOINT, messages=messages, stream=True, max_tokens=1500
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta
