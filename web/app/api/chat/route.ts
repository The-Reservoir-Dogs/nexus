export const dynamic = "force-dynamic";
import { query } from "@/lib/db";
import { agentJsonHeaders } from "@/lib/agent";

// AI Co-Author chat.
//
// Two paths:
//  1) Slash commands (e.g. /characters, /comments) are handled HERE, deterministically,
//     straight from Lakebase — no LLM needed. This makes the "call a tool by slash"
//     feature work even when the LLM endpoint is disabled/rate-limited locally, and it
//     surfaces the SAME tool_call/tool_result events the UI already renders.
//  2) Free-form messages proxy to the Python agent's POST /chat (SSE), where the agent
//     itself picks the appropriate tool(s) to answer. If the agent is unreachable or
//     the LLM is unavailable, we fall back to a helpful message that nudges toward the
//     slash commands (which always work).

type Body = { episodeId?: string; message?: string; history?: { role: string; text: string }[] };

const enc = new TextEncoder();
function frame(ev: string, data: unknown) {
  return enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
}

// --- slash command registry (name -> {tool, describe, run}) --------------------
type CmdCtx = { episodeId: string; seriesId: string | null; arg: string };
type Cmd = {
  tool: string;
  help: string;
  run: (ctx: CmdCtx) => Promise<{ summary: string; text: string }>;
};

async function seriesIdOf(episodeId: string): Promise<string | null> {
  const rows = await query<{ series_id: string }>(
    `SELECT series_id::text AS series_id FROM episodes WHERE id = $1`,
    [episodeId]
  );
  return rows[0]?.series_id ?? null;
}

const COMMANDS: Record<string, Cmd> = {
  characters: {
    tool: "get_characters",
    help: "List the characters in this series with role, personality and status.",
    run: async ({ seriesId }) => {
      if (!seriesId) return { summary: "no series", text: "Couldn't resolve this episode's series." };
      const rows = await query<{ name: string; role: string; status: string; personality: string }>(
        `SELECT name, role, status, personality
           FROM characters WHERE series_id = $1 ORDER BY id`,
        [seriesId]
      );
      const text = rows.length
        ? "Characters in this series:\n" +
          rows
            .map((c) => `${c.name} — ${c.role}${c.status ? ` · ${c.status}` : ""}\nPersonality: ${c.personality ?? ""}`.trim())
            .join("\n\n") +
          "\n\nCreative note: when rewriting, make each character reveal their motive through action and dialogue, not explanation."
        : "No characters found for this series.";
      return { summary: `${rows.length} rows: ${rows.map((r) => r.name).slice(0, 4).join(", ")}`, text };
    },
  },
  comments: {
    tool: "get_comments",
    help: "Show reader reviews/comments on this episode.",
    run: async ({ episodeId }) => {
      const rows = await query<{ author: string; review_text: string }>(
        `SELECT u.username AS author, r.review_text
           FROM reviews r JOIN users u ON u.id = r.created_by
          WHERE r.episode_id = $1 ORDER BY r.created_at`,
        [episodeId]
      );
      const text = rows.length
        ? "Reader comments and branch opportunities:\n" + rows.map((r) =>
            `@${r.author}: ${r.review_text}\nSuggestion: treat this as a pain point. Open the branch with a visible consequence, make the decision land sooner, then let the character pay for it emotionally in-scene.`
          ).join("\n\n")
        : "No reader comments on this episode yet. Use the decision point and retention curve to choose the branch pressure.";
      return { summary: `${rows.length} rows`, text };
    },
  },
  threads: {
    tool: "get_open_threads",
    help: "List the open plot threads to honor or advance.",
    run: async ({ seriesId }) => {
      if (!seriesId) return { summary: "no series", text: "Couldn't resolve this episode's series." };
      const rows = await query<{ thread: string }>(
        `SELECT thread FROM plot_threads WHERE series_id = $1 AND status = 'open'`,
        [seriesId]
      );
      const text = rows.length
        ? "Open plot threads to honor or advance:\n" + rows.map((r) => `${r.thread}\nSuggestion: touch this thread through a concrete object, choice, or consequence rather than summary.`).join("\n\n")
        : "No open plot threads.";
      return { summary: `${rows.length} rows`, text };
    },
  },
  style: {
    tool: "get_style_guide",
    help: "Show the series style guide (POV, tense, tone, rating).",
    run: async ({ seriesId }) => {
      if (!seriesId) return { summary: "no series", text: "Couldn't resolve this episode's series." };
      const rows = await query<{ pov: string; tense: string; tone: string; pacing: string; content_rating: string; narrative_voice: string }>(
        `SELECT pov, tense, tone, pacing, content_rating, narrative_voice
           FROM style_guide WHERE series_id = $1`,
        [seriesId]
      );
      const s = rows[0];
      const text = s
        ? `Style guide:\nPOV: ${s.pov}\nTense: ${s.tense}\nTone: ${s.tone}\nPacing: ${s.pacing}\nRating: ${s.content_rating}\nVoice: ${s.narrative_voice}\n\nCreative rule: keep suggestions in this voice. No generic AI phrasing, no markdown, no meta notes. Write like an editor beside the author.`
        : "No style guide set for this series.";
      return { summary: s ? "1 record" : "empty", text };
    },
  },
  retention: {
    tool: "get_retention",
    help: "Summarize the audience retention curve for this episode.",
    run: async ({ episodeId }) => {
      const rows = await query<{ bucket_10s: number; retention: number }>(
        `SELECT bucket_10s, retention::float AS retention
           FROM episode_retention WHERE episode_id = $1 ORDER BY bucket_10s`,
        [episodeId]
      );
      if (!rows.length) return { summary: "empty", text: "No retention data for this episode yet." };
      const worst = rows.reduce((a, b) => (b.retention < a.retention ? b : a));
      const t = worst.bucket_10s * 10;
      const text =
        `Retention: ${rows.length} buckets.\n` +
        `Lowest retention: ${Math.round(worst.retention * 100)}% around ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}.\n` +
        "Creative fix: move a stronger choice or image before this moment, then cut any explanation that delays consequence.";
      return { summary: `${rows.length} rows`, text };
    },
  },
  episode: {
    tool: "get_episode",
    help: "Show this episode's title, summary and decision point.",
    run: async ({ episodeId }) => {
      const rows = await query<{ title: string; summary: string; decision_point: string }>(
        `SELECT title, summary, decision_point FROM episodes WHERE id = $1`,
        [episodeId]
      );
      const e = rows[0];
      const text = e
        ? `Episode: ${e.title}\nSummary: ${e.summary ?? ""}${e.decision_point ? `\nDecision point: ${e.decision_point}` : ""}\n\nAlignment rule: any branch or rewrite must stay grounded in this exact episode, its prior timeline, and the visible manuscript.`
        : "Episode not found.";
      return { summary: e ? e.title : "empty", text };
    },
  },
};

function helpText(): string {
  const lines = Object.entries(COMMANDS).map(([n, c]) => `/${n} — ${c.help}`);
  return "Slash commands:\n" + lines.join("\n") + "\n/rewrite <instruction> — draft or rewrite the episode into the editor.";
}

async function streamSlash(cmdName: string, arg: string, episodeId: string): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: string, d: unknown) => controller.enqueue(frame(ev, d));
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      try {
        if (cmdName === "help") {
          const text = helpText();
          for (const w of text.split(/(\s+)/)) { send("token", { text: w }); await sleep(4); }
          send("done", { message: text });
          controller.close();
          return;
        }
        const cmd = COMMANDS[cmdName];
        if (!cmd) {
          const text = `Unknown command /${cmdName}.\n\n${helpText()}`;
          send("token", { text });
          send("done", { message: text });
          controller.close();
          return;
        }
        const seriesId = await seriesIdOf(episodeId);
        send("tool_call", { name: cmd.tool, args: { episode_id: episodeId } });
        await sleep(120);
        const { summary, text } = await cmd.run({ episodeId, seriesId, arg });
        send("tool_result", { name: cmd.tool, summary });
        await sleep(80);
        for (const w of text.split(/(\s+)/)) { send("token", { text: w }); await sleep(6); }
        send("done", { message: text });
      } catch (e: any) {
        send("error", { message: e?.message ?? "command failed" });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const message = (body.message ?? "").trim();
  const episodeId = body.episodeId ?? "";
  if (!episodeId) {
    return Response.json({ error: { code: "BAD_REQUEST", message: "episodeId required" } }, { status: 400 });
  }

  // 1) Slash command → deterministic DB-backed handler (no LLM required).
  if (message.startsWith("/")) {
    const [word, ...rest] = message.slice(1).split(/\s+/);
    return streamSlash(word.toLowerCase(), rest.join(" "), episodeId);
  }

  // 2) Free-form → proxy to the agent's /chat (agent picks its own tools).
  const agentUrl = process.env.AGENT_URL;
  const allowFallback = process.env.NODE_ENV !== "production";
  const forceFallback = process.env.GENERATE_FALLBACK === "1";
  if (agentUrl && !forceFallback) {
    try {
      const upstream = await fetch(`${agentUrl}/chat`, {
        method: "POST",
        headers: agentJsonHeaders(),
        body: JSON.stringify({ episodeId, message, history: body.history ?? [] }),
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
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

  // Fallback: the conversational LLM isn't available locally. Point the author at the
  // slash commands, which run live against the database.
  const text =
    "The conversational model is not wired up locally, but I can still pull real episode data on demand. " +
    "Use a slash command below. I will answer in plain text and keep every suggestion aligned to the currently open episode.\n\n" +
    helpText();
  const stream = new ReadableStream({
    async start(controller) {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (const w of text.split(/(\s+)/)) { controller.enqueue(frame("token", { text: w })); await sleep(5); }
      controller.enqueue(frame("done", { message: text }));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
