export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok } from "@/lib/types";

export async function GET() {
  const rows = await query(
    `SELECT s.id::text, s.title, s.description, s.summary, s.genre, s.tag,
            s.author_id::text AS "authorId", u.username AS "authorName",
            (SELECT count(*) FROM episodes e WHERE e.series_id = s.id AND e.is_canonical) AS "episodeCount",
            (SELECT count(DISTINCT e.co_author_id) FROM episodes e WHERE e.series_id = s.id AND e.co_author_id IS NOT NULL) AS "contributorCount",
            COALESCE(round(avg(r.score), 2), 0)::float AS "avgRating"
     FROM series s
     JOIN users u ON u.id = s.author_id
     LEFT JOIN episodes e ON e.series_id = s.id
     LEFT JOIN ratings r ON r.episode_id = e.id
     GROUP BY s.id, u.username
     ORDER BY s.id`
  );
  return ok(rows);
}
