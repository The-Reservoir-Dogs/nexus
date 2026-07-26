"""Read-only context tools. The agent NEVER writes; the web backend owns writes."""
from db import fetch_all


def get_episode(episode_id: str) -> dict | None:
    rows = fetch_all(
        """SELECT id::text, series_id::text AS series_id, season_id::text AS season_id,
                  title, content, summary, prev_episode_summary, order_index,
                  decision_point, is_canonical
           FROM episodes WHERE id = %s""",
        (episode_id,),
    )
    return rows[0] if rows else None


def get_prior_episodes(series_id: str, before_order: int, episode_id: str | None = None) -> list[dict]:
    """Prior episodes for continuity.
    - episode_id given: walk THIS timeline's lineage (episode_ancestry) so a branch
      continuation (N+2) sees its own prior branch episodes, not just canon.
    - else: canonical spine up to before_order (fork from the sacred timeline)."""
    if episode_id:
        return fetch_all(
            """SELECT e.id::text, e.title, e.summary, e.order_index
               FROM episode_ancestry a
               JOIN episodes e ON e.id = a.ancestor_id
               WHERE a.episode_id = %s AND a.depth > 0
               ORDER BY a.depth DESC""",
            (episode_id,),
        )
    return fetch_all(
        """SELECT id::text, title, summary, order_index
           FROM episodes
           WHERE series_id = %s AND is_canonical AND order_index <= %s
           ORDER BY order_index""",
        (series_id, before_order),
    )


def get_comments(episode_id: str) -> list[dict]:
    return fetch_all(
        """SELECT r.id::text, r.review_text, u.username AS author
           FROM reviews r JOIN users u ON u.id = r.created_by
           WHERE r.episode_id = %s ORDER BY r.created_at""",
        (episode_id,),
    )


def get_characters(series_id: str, as_of_episode_id: str | None = None) -> list[dict]:
    """Characters of a series. When as_of_episode_id is given, overlay the LIVE state
    for that timeline: the nearest-ancestor character_state (status/memory/summary)
    along episode_ancestry. This is what keeps a killed character dead in a branch
    while alive on the sacred timeline, and carries evolving memory into N+2."""
    if as_of_episode_id:
        return fetch_all(
            """SELECT c.id::text, c.name, c.role, c.personality, c.backstory, c.goals,
                      c.speech_style,
                      COALESCE(cs.status, c.status) AS status,
                      cs.memory_snapshot, cs.char_summary
               FROM characters c
               LEFT JOIN LATERAL (
                 SELECT s.status, s.memory_snapshot, s.char_summary
                 FROM episode_ancestry a
                 JOIN character_state s
                   ON s.episode_id = a.ancestor_id AND s.character_id = c.id
                 WHERE a.episode_id = %s
                 ORDER BY a.depth ASC
                 LIMIT 1
               ) cs ON true
               WHERE c.series_id = %s ORDER BY c.id""",
            (as_of_episode_id, series_id),
        )
    return fetch_all(
        """SELECT id::text, name, role, personality, backstory, goals,
                  speech_style, status
           FROM characters WHERE series_id = %s ORDER BY id""",
        (series_id,),
    )


def get_style_guide(series_id: str) -> dict | None:
    rows = fetch_all(
        """SELECT pov, tense, tone, pacing, content_rating, narrative_voice
           FROM style_guide WHERE series_id = %s""",
        (series_id,),
    )
    return rows[0] if rows else None


def get_open_threads(series_id: str, as_of_episode_id: str | None = None) -> list[dict]:
    """Open plot threads. With as_of_episode_id, statuses diverge per timeline via
    plot_thread_state (a thread resolved on a branch stays open on canon, etc.)."""
    if as_of_episode_id:
        return fetch_all(
            """SELECT pt.thread,
                      COALESCE(ts.status, pt.status) AS status,
                      ts.note
               FROM plot_threads pt
               LEFT JOIN LATERAL (
                 SELECT s.status, s.note
                 FROM episode_ancestry a
                 JOIN plot_thread_state s
                   ON s.episode_id = a.ancestor_id AND s.thread_id = pt.id
                 WHERE a.episode_id = %s
                 ORDER BY a.depth ASC
                 LIMIT 1
               ) ts ON true
               WHERE pt.series_id = %s AND COALESCE(ts.status, pt.status) = 'open'""",
            (as_of_episode_id, series_id),
        )
    return fetch_all(
        """SELECT thread FROM plot_threads WHERE series_id = %s AND status = 'open'""",
        (series_id,),
    )


def get_retention(episode_id: str) -> list[dict]:
    """10s-bucket retention curve for an episode (derived by SQL, not the LLM).
    Each row: bucket_10s, active_sessions, starters, retention (0-1)."""
    return fetch_all(
        """SELECT bucket_10s, active_sessions, starters, retention::float AS retention
           FROM episode_retention WHERE episode_id = %s ORDER BY bucket_10s""",
        (episode_id,),
    )


# ---------------------------------------------------------------------------
# Pre-fetched grounding context. The agent no longer has to remember to call
# every tool: the server assembles the authoritative continuity + retention
# context up front and injects it into the generation prompt, so EVERY draft is
# strongly grounded. Tools remain available for optional deeper lookups.
# ---------------------------------------------------------------------------
def _fmt_time(bucket_10s: int) -> str:
    t = int(bucket_10s) * 10
    return f"{t // 60}:{t % 60:02d}"


def _summarize_retention(rows: list[dict]) -> str:
    """Compact, timestamped retention summary: overall shape + the biggest drop-offs
    (each is a beat to fix). Timestamp = bucket_10s * 10 seconds."""
    if not rows:
        return "(no retention data yet — treat sample as sparse)"
    rows = sorted(rows, key=lambda r: r["bucket_10s"])
    first = rows[0]["retention"] or 0.0
    last = rows[-1]["retention"] or 0.0
    parts = [f"start {first * 100:.0f}% → end {last * 100:.0f}% across {len(rows)} 10s buckets"]
    drops = []
    for a, b in zip(rows, rows[1:]):
        d = (a["retention"] or 0.0) - (b["retention"] or 0.0)
        if d > 0:
            drops.append((d, b["bucket_10s"], a["retention"] or 0.0, b["retention"] or 0.0))
    drops.sort(reverse=True)
    for _, bucket, before, after in drops[:3]:
        parts.append(
            f"drop {before * 100:.0f}%→{after * 100:.0f}% at {_fmt_time(bucket)} (bucket {bucket})"
        )
    return "; ".join(parts)


def build_generation_context(
    episode_id: str,
    driving_review_id: str | None = None,
    include_source_text: bool = True,
) -> str | None:
    """Assemble the authoritative grounding block for a generation/edit: source episode,
    style guide, live character state, open threads, prior-episode summaries, reader
    comments (driving one flagged), and a timestamped retention summary. Returns a
    labeled text block, or None if the source episode can't be resolved."""
    ep = get_episode(episode_id)
    if not ep:
        return None
    sid = ep["series_id"]
    oi = ep.get("order_index") or 0
    style = get_style_guide(sid) or {}
    chars = get_characters(sid, as_of_episode_id=episode_id)
    threads = get_open_threads(sid, as_of_episode_id=episode_id)
    priors = get_prior_episodes(sid, oi, episode_id=episode_id)
    comments = get_comments(episode_id)
    retention = get_retention(episode_id)

    parts: list[str] = [f"SERIES id={sid} | SOURCE EPISODE id={episode_id} order_index={oi}"]

    if style:
        keys = ("pov", "tense", "tone", "pacing", "content_rating", "narrative_voice")
        parts.append("STYLE GUIDE: " + ", ".join(f"{k}={style[k]}" for k in keys if style.get(k)))

    if chars:
        cl = []
        for c in chars:
            bits = [f"{c['name']} ({c.get('role') or '?'}, {c.get('status') or 'alive'})"]
            if c.get("personality"):
                bits.append(f"personality: {c['personality']}")
            if c.get("speech_style"):
                bits.append(f"voice: {c['speech_style']}")
            if c.get("goals"):
                bits.append(f"goals: {c['goals']}")
            mem = c.get("memory_snapshot") or c.get("char_summary")
            if mem:
                bits.append(f"state now: {mem}")
            cl.append("- " + " | ".join(bits))
        parts.append("CHARACTERS (live state for THIS timeline):\n" + "\n".join(cl))

    if threads:
        tl = [
            f"- {t['thread']}" + (f" (note: {t['note']})" if t.get("note") else "")
            for t in threads
        ]
        parts.append("OPEN THREADS (advance/acknowledge; don't resolve unset ones):\n" + "\n".join(tl))

    if priors:
        pl = [
            f"- E{p.get('order_index')}: {p.get('title')} — {p.get('summary') or ''}".rstrip()
            for p in priors
        ]
        parts.append("PRIOR EPISODES (this timeline's lineage, in order):\n" + "\n".join(pl))

    if comments:
        cl = []
        for c in comments:
            flag = " [DRIVING COMMENT]" if driving_review_id and c.get("id") == driving_review_id else ""
            cl.append(f"- @{c.get('author')}{flag}: {c.get('review_text')}")
        parts.append("READER COMMENTS on source:\n" + "\n".join(cl))

    parts.append("RETENTION on source (fix the drop-off beats): " + _summarize_retention(retention))

    if include_source_text and ep.get("content"):
        parts.append("SOURCE EPISODE TEXT (canon for this branch point):\n" + ep["content"])

    return "\n\n".join(parts)
