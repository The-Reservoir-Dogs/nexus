export const dynamic = "force-dynamic";
// Proxy to the Python agent's POST /generate (SSE). Normalizes the stream so the
// frontend never changes even if the agent's internal shape differs.
export async function POST(req: Request) {
  const agentUrl = process.env.AGENT_URL;
  if (!agentUrl) {
    return Response.json(
      { error: { code: "SERVER_ERROR", message: "AGENT_URL not configured" } },
      { status: 500 }
    );
  }
  const body = await req.text();
  const upstream = await fetch(`${agentUrl}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  // Stream SSE straight through.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
