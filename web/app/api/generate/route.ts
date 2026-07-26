export const dynamic = "force-dynamic";
// SSE stream: allow up to 60s (Vercel default is 10s, which would truncate it).
export const maxDuration = 60;
import { query } from "@/lib/db";

// Proxy to the Python agent's POST /generate (SSE). Normalizes the stream so the
// frontend never changes even if the agent's internal shape differs.
//
// Dev fallback: when the agent is unreachable (no local Databricks LLM), stream a
// canned SSE draft so the full fork→generate→approve loop works end-to-end locally.
// Disabled in production so real agent errors surface.
export async function POST(req: Request) {
  const body = await req.text();
  const agentUrl = process.env.AGENT_URL;
  const allowFallback = process.env.NODE_ENV !== "production";
  // Force the canned stream when the LLM endpoint is disabled/rate-limited locally.
  const forceFallback = process.env.GENERATE_FALLBACK === "1";

  if (agentUrl && !forceFallback) {
    try {
      const upstream = await fetch(`${agentUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
      if (!allowFallback) {
        return new Response(await upstream.text(), { status: upstream.status });
      }
    } catch {
      if (!allowFallback) {
        return Response.json(
          { error: { code: "SERVER_ERROR", message: "Agent unreachable" } },
          { status: 502 }
        );
      }
    }
  } else if (!agentUrl && !allowFallback && !forceFallback) {
    return Response.json(
      { error: { code: "SERVER_ERROR", message: "AGENT_URL not configured" } },
      { status: 500 }
    );
  }

  // ---- Dev fallback: canned SSE draft with a simulated thinking stream ----
  let title = "The Fallen Blade";
  let summary = "The hero kills the villain — and inherits her war.";
  let content =
    "The blade fell without hesitation. Lady Corvin's eyes went wide, then still. " +
    "Aldric stood over her body as the rain washed the mud from his hands, and knew, " +
    "with a cold certainty, that mercy had died with her. The war would not end here — it would drown.";

  let parsed: any = {};
  let charNames: string[] = [];
  try {
    parsed = JSON.parse(body || "{}");
    if (parsed.sourceEpisodeId) {
      const driving = parsed.drivingReviewId
        ? await query<{ reviewText: string; authorName: string }>(
            `SELECT r.review_text AS "reviewText", u.username AS "authorName"
               FROM reviews r JOIN users u ON u.id = r.created_by WHERE r.id = $1 LIMIT 1`,
            [parsed.drivingReviewId]
          )
        : [];
      const rows = await query<{ title: string; summary: string; content: string; series_id: string }>(
        `SELECT title, summary, content, series_id::text AS series_id FROM episodes
         WHERE forked_from_episode_id = $1 AND is_canonical = false
         ORDER BY verified_by_author DESC LIMIT 1`,
        [parsed.sourceEpisodeId]
      );
      if (driving[0]) {
        title = "The Reader's Cut";
        summary = `A branch that addresses @${driving[0].authorName}'s feedback.`;
        content =
          `This branch opens from the reader pain point: “${driving[0].reviewText}”\n\n` +
          "The scene keeps the same continuity, but turns toward the complaint instead of ignoring it. " +
          "The slow beat tightens; the consequence arrives earlier; the character choice becomes visible in action, not explanation.\n\n" +
          "By the end, the alternate timeline has answered the reader directly — not by undoing the story, but by making the wounded moment sharper, clearer, and harder to stop listening to.";
      } else if (rows[0]?.content) ({ title, summary, content } = rows[0]);
      const src = await query<{ series_id: string }>(
        `SELECT series_id::text AS series_id FROM episodes WHERE id = $1`,
        [parsed.sourceEpisodeId]
      );
      if (src[0]) {
        const cs = await query<{ name: string }>(
          `SELECT name FROM characters WHERE series_id = $1 ORDER BY id`,
          [src[0].series_id]
        );
        charNames = cs.map((c) => c.name);
      }
    }
  } catch {
    /* keep canned defaults */
  }

  const enc = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, ev: string, data: unknown) =>
    controller.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // simulated reasoning + tool-calling steps (mirrors the real agent's stream shape)
  const decision = parsed.decisionPoint || "the changed decision";
  const steps: Array<[string, unknown, number]> = [
    ["reasoning", { text: `Gathering context for "${decision}"…` }, 500],
    ["tool_call", { name: "get_episode", args: { episode_id: parsed.sourceEpisodeId ?? "?" } }, 350],
    ["tool_result", { name: "get_episode", summary: "1 record" }, 250],
    ["tool_call", { name: "get_characters", args: { as_of_episode_id: parsed.sourceEpisodeId ?? "?" } }, 350],
    ["tool_result", { name: "get_characters", summary: `${charNames.length || 3} rows${charNames.length ? ": " + charNames.slice(0, 3).join(", ") : ""}` }, 250],
    ["tool_call", { name: "get_open_threads", args: { series_id: "…" } }, 300],
    ["tool_result", { name: "get_open_threads", summary: "2 rows" }, 250],
    ["reasoning", { text: "Keeping every character true to their memory; writing the alternate future…" }, 450],
  ];

  const words = content.split(/(\s+)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (const [ev, data, ms] of steps) {
        send(controller, ev, data);
        await sleep(ms);
      }
      for (const w of words) {
        send(controller, "token", { text: w });
        await sleep(15);
      }
      send(controller, "done", { draft: { title, summary, content } });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
