export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await query(
    `SELECT e.id::text, e.series_id::text AS "seriesId", e.season_id::text AS "seasonId",
            e.title, e.content, e.summary, e.prev_episode_summary AS "prevEpisodeSummary",
            e.order_index AS "orderIndex", e.author_id::text AS "authorId",
            e.co_author_id::text AS "coAuthorId",
            e.forked_from_episode_id::text AS "forkedFromEpisodeId",
            e.decision_point AS "decisionPoint", e.is_canonical AS "isCanonical",
            e.verified_by_author AS "verifiedByAuthor",
            e.audio_url AS "audioUrl", e.audio_duration_ms AS "audioDurationMs",
            COALESCE(round(avg(r.score),2),0)::float AS "avgRating", count(r.*)::int AS "ratingCount"
     FROM episodes e LEFT JOIN ratings r ON r.episode_id = e.id
     WHERE e.id = $1 GROUP BY e.id`,
    [params.id]
  );
  if (!rows.length) return fail("NOT_FOUND", "Episode not found", 404);
  return ok(rows[0]);
}

// In-place update of an existing episode (author of the series OR co-author of the
// branch). Distinct from fork: mutates the same row. No new lineage.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => null);
  if (!b || (b.title === undefined && b.content === undefined && b.summary === undefined)) {
    return fail("BAD_REQUEST", "title, content or summary required");
  }
  const me = await getCurrentUser();

  const owner = await query<{ authorId: string; coAuthorId: string | null }>(
    `SELECT s.author_id::text AS "authorId", e.co_author_id::text AS "coAuthorId"
     FROM episodes e JOIN series s ON s.id = e.series_id WHERE e.id = $1`,
    [params.id]
  );
  if (!owner.length) return fail("NOT_FOUND", "Episode not found", 404);
  const canEdit = owner[0].authorId === me.id || owner[0].coAuthorId === me.id;
  if (!canEdit) return fail("FORBIDDEN", "Only the author or co-author can edit this episode", 403);

  try {
    const rows = await query(
      `UPDATE episodes
          SET title = COALESCE($2, title),
              content = COALESCE($3, content),
              summary = COALESCE($4, summary),
              updated_at = now()
        WHERE id = $1
        RETURNING id::text, series_id::text AS "seriesId", season_id::text AS "seasonId",
                  title, content, summary, order_index AS "orderIndex",
                  author_id::text AS "authorId", co_author_id::text AS "coAuthorId",
                  forked_from_episode_id::text AS "forkedFromEpisodeId",
                  decision_point AS "decisionPoint", is_canonical AS "isCanonical",
                  verified_by_author AS "verifiedByAuthor"`,
      [params.id, b.title ?? null, b.content ?? null, b.summary ?? null]
    );
    if (!rows.length) return fail("NOT_FOUND", "Episode not found", 404);
    return ok(rows[0]);
  } catch (e: any) {
    return fail("SERVER_ERROR", e?.message ?? "Failed to update episode", 500);
  }
}
