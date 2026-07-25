export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/types";

// Assemble the context shown in the editor when starting a fork. No DB write.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const src = await query(
    `SELECT e.id::text, e.series_id::text AS "seriesId", e.season_id::text AS "seasonId",
            e.title, e.content, e.summary, e.decision_point AS "decisionPoint"
     FROM episodes e WHERE e.id = $1`,
    [params.id]
  );
  if (!src.length) return fail("NOT_FOUND", "Episode not found", 404);

  const characters = await query(
    `SELECT id::text, name, role, personality, speech_style AS "speechStyle", status
     FROM characters WHERE series_id = $1 ORDER BY id`,
    [src[0].seriesId]
  );

  let drivingComment = null;
  if (body?.drivingReviewId) {
    const dc = await query(
      `SELECT r.id::text, r.review_text AS "reviewText", u.username AS "authorName"
       FROM reviews r JOIN users u ON u.id = r.created_by WHERE r.id = $1`,
      [body.drivingReviewId]
    );
    drivingComment = dc[0] ?? null;
  }

  return ok({
    sourceEpisode: src[0],
    decisionPoint: src[0].decisionPoint,
    drivingComment,
    characters,
  });
}
