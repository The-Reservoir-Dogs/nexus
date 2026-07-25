export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

// Author-only: verify/canonize-endorse a fork. Access derived from series author.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const verified = body?.verified !== false;
  const me = await getCurrentUser();

  const owner = await query<{ authorId: string }>(
    `SELECT s.author_id::text AS "authorId"
     FROM episodes e JOIN series s ON s.id = e.series_id WHERE e.id = $1`,
    [params.id]
  );
  if (!owner.length) return fail("NOT_FOUND", "Episode not found", 404);
  if (owner[0].authorId !== me.id)
    return fail("FORBIDDEN", "Only the original author can verify", 403);

  const rows = await query(
    `UPDATE episodes SET verified_by_author = $2, updated_at = now()
     WHERE id = $1
     RETURNING id::text, verified_by_author AS "verifiedByAuthor"`,
    [params.id, verified]
  );
  return ok(rows[0]);
}
