export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await query(
    `SELECT id::text, series_id::text AS "seriesId", name, description, role,
            personality, backstory, goals, speech_style AS "speechStyle", status
     FROM characters WHERE series_id = $1 ORDER BY id`,
    [params.id]
  );
  return ok(rows);
}
