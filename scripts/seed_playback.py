#!/usr/bin/env python3
"""Generate demo playback_events for retention analytics and emit SQL on stdout.

Produces, per target episode, a realistic listening funnel:
  * N sessions each start (play_start),
  * emit a heartbeat every 10s while "listening",
  * drop off along an exponential-ish survival curve (steeper early),
  * a fraction that reach the end emit `complete`.

The retention view buckets by position_ms/10000, so heartbeats land on 10s marks.

Idempotent for demo purposes: the emitted SQL first DELETEs existing events for
the target episodes, then re-inserts, all in one transaction. Re-running yields a
fresh, self-consistent dataset.

Usage:
  python scripts/seed_playback.py | psql ...        # pipe straight into the DB
"""
import random
import uuid

random.seed(42)  # reproducible demo data

# episode_id -> (duration_seconds, starters, completion_bias)
# completion_bias nudges how "sticky" an episode is (0..1, higher = better retention).
EPISODES = {
    # --- Sherlock canonical (series 20) ---
    2101: (210, 320, 0.72),   # pilot: high starts, strong retention
    2102: (240, 250, 0.70),
    2103: (200, 210, 0.62),
    2104: (260, 190, 0.60),
    2105: (280, 175, 0.66),   # "They Were Married" — a standout
    2106: (300, 150, 0.55),
    2107: (230, 140, 0.58),
    2108: (250, 120, 0.50),
    2109: (270, 115, 0.57),
    2110: (260, 130, 0.68),   # "Oberstein Was Not Shot" — the ballistics turn
    2111: (240, 105, 0.54),
    2112: (300, 110, 0.63),   # finale
    # --- Sherlock branches ---
    4116: (200, 90, 0.48),
    4117: (280, 130, 0.71),   # "The Kinder Lie" — beloved branch
    4118: (300, 70, 0.46),
    4119: (260, 85, 0.64),
}

DEVICES = ["web", "ios", "android"]
SPEEDS = [1.0, 1.0, 1.0, 1.25, 1.5]  # most listen at 1x


def survival(bucket: int, total_buckets: int, bias: float) -> float:
    """Fraction of starters still active at a given 10s bucket."""
    # exponential decay, gentler when bias is high; small extra cliff near the end
    base = (0.90 + 0.09 * bias) ** bucket
    if bucket >= total_buckets - 1:
        base *= 0.9  # a few bail right before the very end
    return max(0.0, min(1.0, base))


def sql_lit(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main() -> None:
    rows = []  # (episode_id, user_id, session_id, event_type, position_ms, seek_to_ms,
    #            duration_ms, speed, device, autoplay)
    user_pool = [1, 2, 11, None, None]  # some anonymous listens (NULL user)

    for ep, (dur_s, starters, bias) in EPISODES.items():
        dur_ms = dur_s * 1000
        total_buckets = dur_s // 10
        for _ in range(starters):
            sid = str(uuid.uuid4())
            uid = random.choice(user_pool)
            device = random.choice(DEVICES)
            speed = random.choice(SPEEDS)
            autoplay = random.random() < 0.35

            rows.append((ep, uid, sid, "play_start", 0, None, dur_ms, speed, device, autoplay))

            # how far this session survives: inverse-sample the survival curve so
            # the fraction of sessions reaching bucket b equals survival(b).
            # (A per-bucket Bernoulli against a *cumulative* curve would compound
            # the decay and let nobody finish.)
            u = random.random()
            reached = 0
            for b in range(1, total_buckets + 1):
                if survival(b, total_buckets, bias) >= u:
                    reached = b
                else:
                    break

            # occasional skip forward mid-listen (adds a seek event)
            if reached > 3 and random.random() < 0.12:
                skip_from = random.randint(1, reached) * 10000
                skip_to = min(dur_ms, skip_from + random.randint(1, 3) * 10000)
                rows.append((ep, uid, sid, "seek", skip_from, skip_to, dur_ms, speed, device, autoplay))

            # heartbeats on each 10s mark up to where they reached
            for b in range(1, reached + 1):
                rows.append((ep, uid, sid, "heartbeat", b * 10000, None, dur_ms, speed, device, autoplay))

            # completion for sessions that made it to (near) the end
            if reached >= total_buckets - 1 and random.random() < (0.85 * (0.6 + 0.4 * bias)):
                rows.append((ep, uid, sid, "complete", dur_ms, None, dur_ms, speed, device, autoplay))

    # --- emit SQL ---
    ep_list = ",".join(str(e) for e in EPISODES)
    print("BEGIN;")
    print(f"DELETE FROM playback_events WHERE episode_id IN ({ep_list});")
    cols = ("episode_id", "user_id", "session_id", "event_type", "position_ms",
            "seek_to_ms", "duration_ms", "speed", "device", "autoplay")
    # chunk inserts to keep statements a sane size
    CHUNK = 500
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        values = ",\n".join(
            "(" + ",".join(sql_lit(c) for c in r) + ")" for r in chunk
        )
        print(f"INSERT INTO playback_events ({', '.join(cols)}) VALUES\n{values};")
    # keep episodes.audio_duration_ms in sync so the UI shows a length
    for ep, (dur_s, _, _) in EPISODES.items():
        print(f"UPDATE episodes SET audio_duration_ms = {dur_s*1000} "
              f"WHERE id = {ep} AND audio_duration_ms IS NULL;")
    print("COMMIT;")


if __name__ == "__main__":
    main()
