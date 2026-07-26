export const dynamic = "force-dynamic";
import { agentJsonHeaders } from "@/lib/agent";

// Classify a chat message: EDIT (modify the manuscript) vs ASK (answer in chat).
// Proxies to the Python agent's POST /route. Falls back to a keyword heuristic when the
// agent/LLM is unavailable so the UX still routes sensibly locally.
const EDIT_HINT =
  /\b(rewrite|rework|revise|edit|change|make it|make the|add|insert|remove|delete|cut|trim|shorten|lengthen|expand|tighten|darker|lighter|tenser|punch\w*|replace|turn (it|the)|give \w+ a|kill|resurrect|swap)\b/i;

export async function POST(req: Request) {
  const body = await req.text();
  const agentUrl = process.env.AGENT_URL;
  const forceFallback = process.env.GENERATE_FALLBACK === "1";

  if (agentUrl && !forceFallback) {
    try {
      const upstream = await fetch(`${agentUrl}/route`, {
        method: "POST",
        headers: agentJsonHeaders(),
        body,
      });
      if (upstream.ok) {
        const j = await upstream.json();
        const intent = j?.intent === "EDIT" ? "EDIT" : "ASK";
        return Response.json({ data: { intent } });
      }
    } catch {
      /* fall through to heuristic */
    }
  }

  let message = "";
  try {
    message = (JSON.parse(body || "{}").message ?? "").toString();
  } catch {
    /* ignore */
  }
  return Response.json({ data: { intent: EDIT_HINT.test(message) ? "EDIT" : "ASK" } });
}
