export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await query(
    `SELECT s.id::text, s.title, s.description, s.summary, s.genre, s.tag,
            s.author_id::text AS "authorId", u.username AS "authorName"
     FROM series s JOIN users u ON u.id = s.author_id
     WHERE s.id = $1`,
    [params.id]
  );
  if (!rows.length) return fail("NOT_FOUND", "Series not found", 404);
  return ok(rows[0]);
}
