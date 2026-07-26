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
