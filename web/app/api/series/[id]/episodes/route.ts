export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

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

// Author writes the next CANONICAL episode on the sacred timeline. Series-author only.
// Chains prev_episode_id to the previous canonical episode.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => null);
  if (!b?.title || !b?.content) return fail("BAD_REQUEST", "title and content required");
  const me = await getCurrentUser();

  const meta = await query<{ authorId: string; seasonId: string | null; prevId: string | null; nextOrder: number }>(
    `SELECT s.author_id::text AS "authorId",
            (SELECT id::text FROM seasons WHERE series_id = s.id ORDER BY order_index LIMIT 1) AS "seasonId",
            (SELECT id::text FROM episodes WHERE series_id = s.id AND is_canonical ORDER BY order_index DESC LIMIT 1) AS "prevId",
            COALESCE((SELECT max(order_index) FROM episodes WHERE series_id = s.id AND is_canonical), 0) + 1 AS "nextOrder"
     FROM series s WHERE s.id = $1`,
    [params.id]
  );
  if (!meta.length) return fail("NOT_FOUND", "Series not found", 404);
  if (meta[0].authorId !== me.id) return fail("FORBIDDEN", "Only the series author can write canonical episodes", 403);
  if (!meta[0].seasonId) return fail("BAD_REQUEST", "Series has no season");

  const rows = await query(
    `INSERT INTO episodes
       (series_id, season_id, title, content, summary, prev_episode_summary, order_index,
        author_id, prev_episode_id, is_canonical, decision_point)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
     RETURNING id::text, series_id::text AS "seriesId", season_id::text AS "seasonId",
               title, content, summary, order_index AS "orderIndex",
               author_id::text AS "authorId", prev_episode_id::text AS "prevEpisodeId",
               decision_point AS "decisionPoint", is_canonical AS "isCanonical",
               verified_by_author AS "verifiedByAuthor"`,
    [params.id, meta[0].seasonId, b.title, b.content, b.summary ?? null,
     b.prevEpisodeSummary ?? null, meta[0].nextOrder, me.id, meta[0].prevId, b.decisionPoint ?? null]
  );
  return ok(rows[0]);
}
