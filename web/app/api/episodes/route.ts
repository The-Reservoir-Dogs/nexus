export const dynamic = "force-dynamic";
import { withTx } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

// Persist an approved alternate-timeline episode (HITL accept). Backend owns writes.
// Continuity: sets prev_episode_id (chains this episode into its timeline so N+2
// continuations can walk episode_ancestry) and persists optional character_state
// snapshots so evolving memory/status diverges per branch.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.seriesId || !b?.seasonId || !b?.forkedFromEpisodeId || !b?.title || !b?.content) {
    return fail("BAD_REQUEST", "seriesId, seasonId, forkedFromEpisodeId, title, content required");
  }
  const me = await getCurrentUser();

  try {
    const created = await withTx(async (c) => {
      // original author of the series + order_index of the previous episode.
      // prev_episode_id defaults to the decision point (first branch episode); a
      // continuation (N+2) passes prevEpisodeId = the previous branch episode.
      const prevEpisodeId: string = b.prevEpisodeId ?? b.forkedFromEpisodeId;
      const ctx = await c.query(
        `SELECT s.author_id::text AS "authorId",
                (SELECT order_index FROM episodes WHERE id = $2) AS "prevOrder"
         FROM series s WHERE s.id = $1`,
        [b.seriesId, prevEpisodeId]
      );
      if (!ctx.rows.length) throw new Error("NOT_FOUND");
      const authorId = ctx.rows[0].authorId as string;
      const nextOrder = (ctx.rows[0].prevOrder ?? 0) + 1;

      const rows = await c.query(
        `INSERT INTO episodes
           (series_id, season_id, title, content, summary, prev_episode_summary, order_index,
            author_id, co_author_id, forked_from_episode_id, prev_episode_id,
            decision_point, is_canonical)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)
         RETURNING id::text, series_id::text AS "seriesId", season_id::text AS "seasonId",
                   title, content, summary, prev_episode_summary AS "prevEpisodeSummary",
                   order_index AS "orderIndex",
                   author_id::text AS "authorId", co_author_id::text AS "coAuthorId",
                   forked_from_episode_id::text AS "forkedFromEpisodeId",
                   prev_episode_id::text AS "prevEpisodeId",
                   decision_point AS "decisionPoint", is_canonical AS "isCanonical",
                   verified_by_author AS "verifiedByAuthor"`,
        [
          b.seriesId, b.seasonId, b.title, b.content, b.summary ?? null,
          b.prevEpisodeSummary ?? null, nextOrder, authorId, me.id,
          b.forkedFromEpisodeId, prevEpisodeId, b.decisionPoint ?? null,
        ]
      );
      const ep = rows.rows[0];

      // Optional per-episode continuity snapshots (character memory/status).
      const states: any[] = Array.isArray(b.characterStates) ? b.characterStates : [];
      for (const s of states) {
        if (!s?.characterId) continue;
        await c.query(
          `INSERT INTO character_state (character_id, episode_id, memory_snapshot, char_summary, status)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (character_id, episode_id) DO UPDATE
             SET memory_snapshot = EXCLUDED.memory_snapshot,
                 char_summary = EXCLUDED.char_summary,
                 status = EXCLUDED.status`,
          [s.characterId, ep.id, s.memorySnapshot ?? null, s.charSummary ?? null, s.status ?? null]
        );
      }

      return ep;
    });

    return ok(created);
  } catch (e: any) {
    if (e.message === "NOT_FOUND") return fail("NOT_FOUND", "Series or previous episode not found", 404);
    return fail("SERVER_ERROR", e.message ?? "Failed to persist episode", 500);
  }
}
