export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok } from "@/lib/types";
import type { RetentionPoint } from "@/lib/types";

// Audience retention for one episode. All math is deterministic SQL:
//  - curve      = episode_retention view (10s buckets, fraction of starters active)
//  - plays      = distinct sessions with a play_start
//  - completion = distinct sessions with a complete / starters
//  - avgListen  = avg of each session's max playhead position
//  - dropoff    = the steepest single-bucket fall in the curve
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const [curveRows, aggRows] = await Promise.all([
    query<{ bucket10s: number; retention: number; activeSessions: number }>(
      `SELECT bucket_10s AS "bucket10s",
              retention::float AS "retention",
              active_sessions::int AS "activeSessions"
       FROM episode_retention
       WHERE episode_id = $1
       ORDER BY bucket_10s`,
      [id]
    ),
    query<{
      durationMs: number | null;
      plays: number;
      completes: number;
      avgListenMs: number;
    }>(
      `WITH sess AS (
         SELECT session_id,
                max(position_ms) AS max_pos,
                bool_or(event_type = 'complete') AS completed
         FROM playback_events
         WHERE episode_id = $1
         GROUP BY session_id
       ),
       starters AS (
         SELECT DISTINCT session_id FROM playback_events
         WHERE episode_id = $1 AND event_type = 'play_start'
       )
       SELECT (SELECT max(duration_ms) FROM playback_events WHERE episode_id = $1) AS "durationMs",
              (SELECT count(*) FROM starters)::int AS "plays",
              (SELECT count(*) FROM sess WHERE completed)::int AS "completes",
              COALESCE(round(avg(max_pos)),0)::int AS "avgListenMs"
       FROM sess`,
      [id]
    ),
  ]);

  const curve: RetentionPoint[] = curveRows;
  const agg = aggRows[0] ?? { durationMs: null, plays: 0, completes: 0, avgListenMs: 0 };

  // steepest single-bucket drop
  let dropoff: { bucket10s: number; from: number; to: number } | null = null;
  let worst = 0;
  for (let i = 1; i < curve.length; i++) {
    const fall = curve[i - 1].retention - curve[i].retention;
    if (fall > worst) {
      worst = fall;
      dropoff = { bucket10s: curve[i].bucket10s, from: curve[i - 1].retention, to: curve[i].retention };
    }
  }

  return ok({
    episodeId: id,
    durationMs: agg.durationMs,
    plays: agg.plays,
    avgListenMs: agg.avgListenMs,
    completionRate: agg.plays ? agg.completes / agg.plays : 0,
    curve,
    dropoff,
  });
}
