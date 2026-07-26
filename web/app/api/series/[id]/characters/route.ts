export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await query(
    `SELECT id::text, series_id::text AS "seriesId", name, description, role,
            personality, backstory, goals, speech_style AS "speechStyle", status
     FROM characters WHERE series_id = $1 ORDER BY id`,
    [params.id]
  );
  return ok(rows);
}

// Add a character to the series (context engineering). Series-author only.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => null);
  if (!b?.name) return fail("BAD_REQUEST", "name required");
  const me = await getCurrentUser();
  const owner = await query<{ authorId: string }>(
    `SELECT author_id::text AS "authorId" FROM series WHERE id = $1`,
    [params.id]
  );
  if (!owner.length) return fail("NOT_FOUND", "Series not found", 404);
  if (owner[0].authorId !== me.id) return fail("FORBIDDEN", "Only the series author can add characters", 403);

  const rows = await query(
    `INSERT INTO characters (series_id, name, description, role, personality, backstory, goals, speech_style, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'alive'))
     RETURNING id::text, series_id::text AS "seriesId", name, description, role,
               personality, backstory, goals, speech_style AS "speechStyle", status`,
    [params.id, b.name, b.description ?? null, b.role ?? null, b.personality ?? null,
     b.backstory ?? null, b.goals ?? null, b.speechStyle ?? null, b.status ?? null]
  );
  return ok(rows[0]);
}
