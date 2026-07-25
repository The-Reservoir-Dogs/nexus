export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const score = Number(body?.score);
  if (!(score >= 1 && score <= 5)) return fail("BAD_REQUEST", "score must be 1-5");
  const me = await getCurrentUser();
  await query(
    `INSERT INTO ratings (episode_id, user_id, score) VALUES ($1, $2, $3)
     ON CONFLICT (episode_id, user_id) DO UPDATE SET score = EXCLUDED.score`,
    [params.id, me.id, score]
  );
  const agg = await query<{ avgRating: number; ratingCount: number }>(
    `SELECT COALESCE(round(avg(score),2),0)::float AS "avgRating", count(*)::int AS "ratingCount"
     FROM ratings WHERE episode_id = $1`,
    [params.id]
  );
  return ok(agg[0]);
}
