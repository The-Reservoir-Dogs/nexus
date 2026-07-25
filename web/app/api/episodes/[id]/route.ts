export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
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
            COALESCE(round(avg(r.score),2),0)::float AS "avgRating", count(r.*)::int AS "ratingCount"
     FROM episodes e LEFT JOIN ratings r ON r.episode_id = e.id
     WHERE e.id = $1 GROUP BY e.id`,
    [params.id]
  );
  if (!rows.length) return fail("NOT_FOUND", "Episode not found", 404);
  return ok(rows[0]);
}
