#!/usr/bin/env python3
"""Generate idempotent SQL to (re)seed the NEXUS DB from seed.json.

seed.json is the canonical content export; this maps it onto schema.sql tables and emits
a single transaction that wipes the base tables and reinserts, with explicit ids and a
sequence resync. Views (episode_ancestry, episode_retention) are derived — not seeded.

Usage:
  python scripts/seed_from_json.py seed.json > /tmp/seed_from_json.sql
  psql "$PG..." -v ON_ERROR_STOP=1 -f /tmp/seed_from_json.sql
"""
import json
import sys

# insert order respects FK dependencies; schema column order per table (only columns
# present in seed.json are written, the rest take schema defaults).
TABLES = [
    ("users", ["id", "username", "password_hash"]),
    ("series", ["id", "title", "description", "summary", "genre", "tag", "author_id"]),
    ("seasons", ["id", "series_id", "title", "summary", "description", "order_index"]),
    ("episodes", ["id", "series_id", "season_id", "title", "content", "summary",
                  "prev_episode_summary", "order_index", "author_id", "co_author_id",
                  "forked_from_episode_id", "decision_point", "is_canonical",
                  "verified_by_author"]),
    ("characters", ["id", "series_id", "name", "description", "role", "personality",
                    "backstory", "goals", "speech_style", "status"]),
    ("char_relationship", ["id", "char_id", "relation_char_id", "relationship_summary"]),
    ("character_state", ["id", "character_id", "episode_id", "memory_snapshot",
                         "char_summary", "status"]),
    ("world", ["id", "series_id", "entry_type", "name", "location", "description"]),
    ("style_guide", ["id", "series_id", "pov", "tense", "tone", "pacing",
                    "content_rating", "narrative_voice"]),
    ("plot_threads", ["id", "series_id", "thread", "status", "opened_episode_id",
                     "resolved_episode_id"]),
    ("reviews", ["id", "episode_id", "created_by", "review_text", "parent_review_id"]),
    ("ratings", ["id", "episode_id", "user_id", "score"]),
]

# wipe order: children -> parents (the app role has DELETE but not TRUNCATE, so we
# can't use CASCADE; explicit FK order avoids constraint violations).
WIPE = [
    "playback_events", "ratings", "reviews", "character_state",
    "plot_threads", "char_relationship", "world", "style_guide",
    "episodes", "seasons", "characters",
    "series", "users",
]

SEQ_TABLES = ["users", "series", "seasons", "episodes", "characters", "char_relationship",
              "character_state", "world", "style_guide", "plot_threads", "reviews", "ratings"]


def lit(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    tag = "$q$"
    if tag in s:  # pick a collision-free dollar-quote tag
        i = 0
        while f"$q{i}$" in s:
            i += 1
        tag = f"$q{i}$"
    return f"{tag}{s}{tag}"


def main(path: str) -> int:
    data = json.load(open(path))
    out = []
    out.append("-- Generated from seed.json by scripts/seed_from_json.py. DO NOT EDIT BY HAND.")
    out.append("BEGIN;")
    for t in WIPE:
        out.append(f"DELETE FROM {t};")
    out.append("")
    for table, cols in TABLES:
        rows = data.get(table, [])
        if not rows:
            continue
        out.append(f"-- {table} ({len(rows)})")
        collist = ", ".join(cols)
        values = []
        for r in rows:
            vals = ", ".join(lit(r.get(c)) for c in cols)
            values.append(f"  ({vals})")
        out.append(
            f"INSERT INTO {table} ({collist}) OVERRIDING SYSTEM VALUE VALUES\n"
            + ",\n".join(values) + ";"
        )
        out.append("")
    # resync identity sequences past the explicit ids
    for t in SEQ_TABLES:
        if data.get(t):
            out.append(
                f"SELECT setval(pg_get_serial_sequence('{t}','id'), "
                f"(SELECT max(id) FROM {t}));"
            )
    out.append("COMMIT;")
    sys.stdout.write("\n".join(out) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "seed.json"))
