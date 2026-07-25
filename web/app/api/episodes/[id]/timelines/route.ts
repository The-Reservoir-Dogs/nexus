export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok } from "@/lib/types";

// Alternate timelines forked from this decision-point episode, top-rated first.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 5);
  const rows = await query(
    `SELECT e.id::text, e.title, e.summary, e.decision_point AS "decisionPoint",
            e.co_author_id::text AS "coAuthorId", u.username AS "coAuthorName",
            e.is_canonical AS "isCanonical", e.verified_by_author AS "verifiedByAuthor",
            COALESCE(round(avg(r.score),2),0)::float AS "avgRating", count(r.*)::int AS "ratingCount"
     FROM episodes e
     LEFT JOIN users u ON u.id = e.co_author_id
     LEFT JOIN ratings r ON r.episode_id = e.id
     WHERE e.forked_from_episode_id = $1
     GROUP BY e.id, u.username
     ORDER BY e.verified_by_author DESC, "avgRating" DESC
     LIMIT $2`,
    [params.id, limit]
  );
  return ok(rows);
}
