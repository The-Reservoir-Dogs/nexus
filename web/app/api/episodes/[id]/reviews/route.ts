export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";
import { nestReviews } from "@/lib/logic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await query(
    `SELECT r.id::text, r.episode_id::text AS "episodeId", r.created_by::text AS "createdBy",
            u.username AS "authorName", r.review_text AS "reviewText",
            r.parent_review_id::text AS "parentReviewId", r.created_at AS "createdAt"
     FROM reviews r JOIN users u ON u.id = r.created_by
     WHERE r.episode_id = $1 ORDER BY r.created_at`,
    [params.id]
  );
  return ok(nestReviews(rows as any));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body?.reviewText) return fail("BAD_REQUEST", "reviewText required");
  const me = await getCurrentUser();
  const rows = await query(
    `INSERT INTO reviews (episode_id, created_by, review_text, parent_review_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text, episode_id::text AS "episodeId", created_by::text AS "createdBy",
               review_text AS "reviewText", parent_review_id::text AS "parentReviewId", created_at AS "createdAt"`,
    [params.id, me.id, body.reviewText, body.parentReviewId ?? null]
  );
  return ok(rows[0]);
}
