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


def get_prior_episodes(series_id: str, before_order: int) -> list[dict]:
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


def get_characters(series_id: str) -> list[dict]:
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


def get_open_threads(series_id: str) -> list[dict]:
    return fetch_all(
        """SELECT thread FROM plot_threads WHERE series_id = %s AND status = 'open'""",
        (series_id,),
    )
