export const dynamic = "force-dynamic";
import { agentJsonHeaders } from "@/lib/agent";

// Proxy to the Python agent's POST /edit (SSE). Copilot-style edit: tokens are the
// full revised manuscript (stream into the editor), then a `done` event carrying the
// change summary (rendered in the chat panel).
//
// Dev fallback: when the agent is unreachable, stream a canned edited manuscript so the
// chat-drives-editor loop works end-to-end locally. Disabled in production.
export async function POST(req: Request) {
  const body = await req.text();
  const agentUrl = process.env.AGENT_URL;
  const allowFallback = process.env.NODE_ENV !== "production";
  const forceFallback = process.env.GENERATE_FALLBACK === "1";

  if (agentUrl && !forceFallback) {
    try {
      const upstream = await fetch(`${agentUrl}/edit`, {
        method: "POST",
        headers: agentJsonHeaders(),
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

  // ---- Dev fallback: echo the manuscript back with a note, simulate the stream ----
  let manuscript = "";
  let instruction = "your change";
  try {
    const parsed = JSON.parse(body || "{}");
    manuscript = parsed.manuscript ?? "";
    instruction = parsed.instruction ?? instruction;
  } catch {
    /* keep defaults */
  }

  const enc = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, ev: string, data: unknown) =>
    c.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const steps: Array<[string, unknown, number]> = [
    ["reasoning", { text: `Applying "${instruction}" to the manuscript…` }, 400],
    ["tool_call", { name: "get_style_guide", args: {} }, 300],
    ["tool_result", { name: "get_style_guide", summary: "1 record" }, 250],
  ];
  const revised = manuscript || "The blade fell without hesitation.";
  const words = revised.split(/(\s+)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (const [ev, data, ms] of steps) {
        send(controller, ev, data);
        await sleep(ms);
      }
      for (const w of words) {
        send(controller, "token", { text: w });
        await sleep(10);
      }
      send(controller, "done", {
        summary: `Applied "${instruction}" while keeping the rest of the manuscript intact. (dev fallback — no LLM)`,
      });
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
