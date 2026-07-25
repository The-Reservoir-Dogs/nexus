export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok } from "@/lib/types";

// Canonical episodes (the sacred timeline), ordered.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await query(
    `SELECT e.id::text, e.series_id::text AS "seriesId", e.season_id::text AS "seasonId",
            e.title, e.summary, e.order_index AS "orderIndex",
            e.author_id::text AS "authorId", e.is_canonical AS "isCanonical",
            e.verified_by_author AS "verifiedByAuthor", e.decision_point AS "decisionPoint",
            COALESCE(round(avg(r.score),2),0)::float AS "avgRating", count(r.*)::int AS "ratingCount"
     FROM episodes e LEFT JOIN ratings r ON r.episode_id = e.id
     WHERE e.series_id = $1 AND e.is_canonical
     GROUP BY e.id
     ORDER BY e.order_index`,
    [params.id]
  );
  return ok(rows);
}
