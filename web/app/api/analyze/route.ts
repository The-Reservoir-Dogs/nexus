export const dynamic = "force-dynamic";
import { query } from "@/lib/db";

// Streamed LLM analytics insight for an episode. Proxies the Python agent's
// /analyze (SSE). Dev fallback: when the agent/LLM is unreachable, synthesize an
// insight from the real retention drop-off so the analytics panel streams locally.
export async function POST(req: Request) {
  const body = await req.text();
  const agentUrl = process.env.AGENT_URL;
  const allowFallback = process.env.NODE_ENV !== "production";
  const forceFallback = process.env.GENERATE_FALLBACK === "1";

  if (agentUrl && !forceFallback) {
    try {
      const upstream = await fetch(`${agentUrl}/analyze`, {
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
      if (!allowFallback) return new Response(await upstream.text(), { status: upstream.status });
    } catch {
      if (!allowFallback) {
        return Response.json({ error: { code: "SERVER_ERROR", message: "Agent unreachable" } }, { status: 502 });
      }
    }
  } else if (!agentUrl && !allowFallback && !forceFallback) {
    return Response.json({ error: { code: "SERVER_ERROR", message: "AGENT_URL not configured" } }, { status: 500 });
  }

  // ---- Dev fallback: synthesize insight from real retention numbers ----
  let insight =
    "Not enough playback data yet to draw a confident conclusion. Once more listeners " +
    "complete this episode, retention drop-offs will point to the exact beats to tighten.";
  try {
    const parsed = JSON.parse(body || "{}");
    const epId = parsed.episodeId;
    if (epId) {
      const curve = await query<{ bucket10s: number; retention: number }>(
        `SELECT bucket_10s AS "bucket10s", retention::float AS retention
         FROM episode_retention WHERE episode_id = $1 ORDER BY bucket_10s`,
        [epId]
      );
      if (curve.length > 1) {
        let worst = 0, at = curve[1].bucket10s, from = 1, to = 1;
        for (let i = 1; i < curve.length; i++) {
          const fall = curve[i - 1].retention - curve[i].retention;
          if (fall > worst) { worst = fall; at = curve[i].bucket10s; from = curve[i - 1].retention; to = curve[i].retention; }
        }
        const mmss = (b: number) => `${Math.floor((b * 10) / 60)}:${String((b * 10) % 60).padStart(2, "0")}`;
        insight =
          `${Math.round(from * 100)}% of listeners are still present at ${mmss(at - 1)}, but retention ` +
          `falls to ${Math.round(to * 100)}% by ${mmss(at)} — the sharpest drop-off in the episode. ` +
          `The scene at this timestamp lingers too long before the next turn; tighten the internal ` +
          `monologue and cut to the decision faster. The next generation will be conditioned to raise ` +
          `tension through this beat.`;
      }
    }
  } catch {
    /* keep default */
  }

  const enc = new TextEncoder();
  const words = insight.split(/(\s+)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(enc.encode(`event: token\ndata: ${JSON.stringify({ text: w })}\n\n`));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.enqueue(enc.encode(`event: done\ndata: ${JSON.stringify({ insight })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
