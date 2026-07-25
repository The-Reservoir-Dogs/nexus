export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

// Persist an approved alternate-timeline episode (HITL accept). Backend owns writes.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.seriesId || !b?.seasonId || !b?.forkedFromEpisodeId || !b?.title || !b?.content) {
    return fail("BAD_REQUEST", "seriesId, seasonId, forkedFromEpisodeId, title, content required");
  }
  const me = await getCurrentUser();
  // original author of the series (episodes keep author_id = series author).
  const series = await query<{ authorId: string; orderIndex: number }>(
    `SELECT s.author_id::text AS "authorId",
            (SELECT order_index FROM episodes WHERE id = $2) AS "orderIndex"
     FROM series s WHERE s.id = $1`,
    [b.seriesId, b.forkedFromEpisodeId]
  );
  if (!series.length) return fail("NOT_FOUND", "Series not found", 404);

  const rows = await query(
    `INSERT INTO episodes
       (series_id, season_id, title, content, summary, order_index,
        author_id, co_author_id, forked_from_episode_id, decision_point, is_canonical)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)
     RETURNING id::text, series_id::text AS "seriesId", season_id::text AS "seasonId",
               title, content, summary, order_index AS "orderIndex",
               author_id::text AS "authorId", co_author_id::text AS "coAuthorId",
               forked_from_episode_id::text AS "forkedFromEpisodeId",
               decision_point AS "decisionPoint", is_canonical AS "isCanonical",
               verified_by_author AS "verifiedByAuthor"`,
    [
      b.seriesId, b.seasonId, b.title, b.content, b.summary ?? null,
      (series[0].orderIndex ?? 0) + 1, series[0].authorId, me.id,
      b.forkedFromEpisodeId, b.decisionPoint ?? null,
    ]
  );
  return ok(rows[0]);
}
