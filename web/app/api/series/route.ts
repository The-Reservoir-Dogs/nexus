export const dynamic = "force-dynamic";
import { query, withTx } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

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

// Create a new series (the current user becomes the author). Auto-creates Season 1
// so the author can start writing canonical episodes immediately.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.title) return fail("BAD_REQUEST", "title required");
  const me = await getCurrentUser();
  const created = await withTx(async (c) => {
    const s = await c.query(
      `INSERT INTO series (title, description, summary, genre, tag, author_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id::text, title, description, summary, genre, tag,
                 author_id::text AS "authorId"`,
      [b.title, b.description ?? null, b.summary ?? null, b.genre ?? null, b.tag ?? null, me.id]
    );
    const series = s.rows[0];
    await c.query(
      `INSERT INTO seasons (series_id, title, summary, description, order_index)
       VALUES ($1, 'Season 1', $2, $3, 1)`,
      [series.id, b.summary ?? null, b.description ?? null]
    );
    return { ...series, authorName: me.username, episodeCount: 0, contributorCount: 0, avgRating: 0 };
  });
  return ok(created);
}
