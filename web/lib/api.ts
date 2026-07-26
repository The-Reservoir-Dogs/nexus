// Single API client. MODE=mock reads dummy JSON; MODE=live calls /api/*.
// Components import ONLY these functions — swapping MODE needs no component change.
import type { Series, Episode, Review, Character, Retention } from "./types";
import { nestReviews, rankTimelines } from "./logic";
import * as db from "@/mocks/data";
import type { User } from "@/mocks/data";

const MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
const isMock = MODE !== "live";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// mock helper: first canonical episode id for a series (to link straight to the reader)
function firstEpisodeId(seriesId: string): string | undefined {
  return db.episodes
    .filter((e) => e.seriesId === seriesId && e.isCanonical)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0]?.id;
}
const withFirst = (s: Series): Series => ({ ...s, firstEpisodeId: firstEpisodeId(s.id) });

async function live<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api${path}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  // Defensive parse: an empty or non-JSON body must not blow up with a cryptic
  // "JSON.parse: unexpected end of data" — surface a clear error instead.
  const raw = await res.text();
  let json: any = null;
  if (raw) {
    try { json = JSON.parse(raw); } catch { /* non-JSON body */ }
  }
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status} ${res.statusText})`);
  }
  return json?.data as T;
}

// ---------- Reads ----------
export async function getMe(): Promise<User> {
  return live<User>("/me");
}

export async function loginUser(username: string, password: string): Promise<User> {
  return live<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function signupUser(username: string, password: string): Promise<User> {
  return live<User>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutUser(): Promise<void> {
  await live<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
}

export async function getSeries(params?: { q?: string; genre?: string }): Promise<Series[]> {
  if (!isMock) return live<Series[]>("/series");
  await delay();
  let out = [...db.series];
  if (params?.q) {
    const q = params.q.toLowerCase();
    out = out.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.genre ?? "").toLowerCase().includes(q)
    );
  }
  if (params?.genre) out = out.filter((s) => s.genre === params.genre);
  return out.map(withFirst);
}

export async function getSeriesById(id: string): Promise<Series | undefined> {
  if (!isMock) return live<Series>(`/series/${id}`);
  await delay();
  const s = db.series.find((s) => s.id === id);
  return s ? withFirst(s) : undefined;
}

export async function getSeriesCharacters(id: string): Promise<Character[]> {
  if (!isMock) return live<Character[]>(`/series/${id}/characters`);
  await delay();
  return db.characters.filter((c) => c.seriesId === id);
}

export async function getEpisodes(seriesId: string): Promise<Episode[]> {
  // canonical episodes = the sacred timeline, ordered
  if (!isMock) return live<Episode[]>(`/series/${seriesId}/episodes`);
  await delay();
  return db.episodes
    .filter((e) => e.seriesId === seriesId && e.isCanonical)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  if (!isMock) return live<Episode>(`/episodes/${id}`);
  await delay();
  return db.episodes.find((e) => e.id === id);
}

export async function getEpisodeTimelines(id: string): Promise<Episode[]> {
  // alternate timelines forked from this decision-point episode, ranked
  if (!isMock) return live<Episode[]>(`/episodes/${id}/timelines`);
  await delay();
  const forks = db.episodes.filter((e) => e.forkedFromEpisodeId === id);
  return rankTimelines(forks);
}

export async function getRetention(id: string): Promise<Retention> {
  if (!isMock) return live<Retention>(`/episodes/${id}/retention`);
  await delay();
  const r = db.retention[id];
  if (r) return r as Retention;
  return {
    episodeId: id,
    durationMs: null,
    plays: 0,
    avgListenMs: 0,
    completionRate: 0,
    curve: [],
    dropoff: null,
  };
}

export async function getReviews(id: string): Promise<Review[]> {
  if (!isMock) return live<Review[]>(`/episodes/${id}/reviews`);
  await delay();
  return nestReviews(db.reviews.filter((r) => r.episodeId === id).map((r) => ({ ...r })));
}

// ---------- Fork context ----------
export type ForkContext = {
  sourceEpisode: Episode;
  decisionPoint: string;
  drivingComment: Review | null;
  characters: Character[];
};

export async function forkEpisode(id: string, drivingReviewId?: string): Promise<ForkContext> {
  if (!isMock)
    return live<ForkContext>(`/episodes/${id}/fork`, {
      method: "POST",
      body: JSON.stringify({ drivingReviewId }),
    });
  await delay();
  const sourceEpisode = db.episodes.find((e) => e.id === id)!;
  const drivingComment =
    db.reviews.find((r) => r.id === (drivingReviewId ?? "5001")) ?? null;
  return {
    sourceEpisode,
    decisionPoint: sourceEpisode.decisionPoint ?? "",
    drivingComment,
    characters: db.characters.filter((c) => c.seriesId === sourceEpisode.seriesId),
  };
}

// ---------- Generate (streamed) ----------
export type Draft = { title: string; summary: string; content: string };
// Non-token events from the agent's thinking stream (reasoning + tool calls).
export type AgentEvent =
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; name: string; args?: unknown }
  | { type: "tool_result"; name: string; summary?: string };
export type GenerateBody = {
  sourceEpisodeId: string;
  decisionPoint: string;
  drivingReviewId?: string;
  instructions?: string;
};

/** Async generator: yields text chunks, returns the final Draft. */
export async function* generate(
  body: GenerateBody,
  onEvent?: (e: AgentEvent) => void
): AsyncGenerator<string, Draft, unknown> {
  if (!isMock) {
    // Live: consume the normalized SSE stream from /api/generate.
    // Events: `token` {text} streamed, then `done` {draft:{title,summary,content}}.
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error("generate failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    let draft: Draft = { title: "Untitled Alternate", summary: "", content: "" };
    let event = "message";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        event = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (event === "token" && parsed.text) { acc += parsed.text; yield parsed.text as string; }
        else if (event === "reasoning") onEvent?.({ type: "reasoning", text: parsed.text ?? "" });
        else if (event === "tool_call") onEvent?.({ type: "tool_call", name: parsed.name ?? "tool", args: parsed.args });
        else if (event === "tool_result") onEvent?.({ type: "tool_result", name: parsed.name ?? "tool", summary: parsed.summary });
        else if (event === "done" && parsed.draft) { draft = parsed.draft; }
        else if (event === "error") {
          const msg = `\n\n[generation failed: ${parsed.message ?? "unknown error"}]`;
          acc += msg;
          yield msg;
        }
      }
    }
    if (!draft.content) draft = { ...draft, content: acc };
    return draft;
  }
  // mock thinking stream
  const steps: AgentEvent[] = [
    { type: "reasoning", text: "Gathering context for the changed decision…" },
    { type: "tool_call", name: "get_episode", args: { episode_id: body.sourceEpisodeId } },
    { type: "tool_result", name: "get_episode", summary: "1 record" },
    { type: "tool_call", name: "get_characters" },
    { type: "tool_result", name: "get_characters", summary: "3 rows" },
    { type: "reasoning", text: "Writing the alternate future, keeping characters consistent…" },
  ];
  if (onEvent) for (const s of steps) { await delay(180); onEvent(s); }
  const draft = db.generatedDraft;
  const words = draft.content.split(/(\s+)/);
  for (const w of words) {
    await delay(25);
    yield w;
  }
  return draft;
}

// ---------- Writes ----------
export async function postRating(
  id: string,
  score: number
): Promise<{ avgRating: number; ratingCount: number }> {
  if (!isMock)
    return live(`/episodes/${id}/ratings`, {
      method: "POST",
      body: JSON.stringify({ score }),
    });
  await delay();
  const ep = db.episodes.find((e) => e.id === id);
  const count = (ep?.ratingCount ?? 0) + 1;
  return { avgRating: ep?.avgRating ?? score, ratingCount: count };
}

export async function postReview(
  id: string,
  reviewText: string,
  parentReviewId: string | null = null
): Promise<Review> {
  if (!isMock)
    return live(`/episodes/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ reviewText, parentReviewId }),
    });
  await delay();
  return {
    id: `new-${Date.now()}`,
    episodeId: id,
    createdBy: db.me.id,
    authorName: db.me.username,
    reviewText,
    parentReviewId,
    replies: [],
    createdAt: new Date().toISOString(),
  };
}

export type ApproveBody = {
  seriesId: string;
  seasonId: string;
  forkedFromEpisodeId: string;
  prevEpisodeId?: string; // previous episode in this timeline (N+2); defaults to fork point
  decisionPoint: string;
  title: string;
  content: string;
  summary: string;
  prevEpisodeSummary?: string;
  isCanonical?: boolean;
  characterStates?: {
    characterId: string;
    memorySnapshot?: string;
    charSummary?: string;
    status?: string;
  }[];
};

export async function approveEpisode(body: ApproveBody): Promise<Episode> {
  if (!isMock)
    return live("/episodes", { method: "POST", body: JSON.stringify(body) });
  await delay();
  const ep: Episode = {
    id: `new-${Date.now()}`,
    seriesId: body.seriesId,
    seasonId: body.seasonId,
    title: body.title,
    content: body.content,
    summary: body.summary,
    prevEpisodeSummary: null,
    orderIndex: 4,
    authorId: "1",
    authorName: "sriman",
    coAuthorId: db.me.id,
    coAuthorName: db.me.username,
    forkedFromEpisodeId: body.forkedFromEpisodeId,
    decisionPoint: body.decisionPoint,
    isCanonical: body.isCanonical ?? false,
    verifiedByAuthor: false,
    avgRating: 0,
    ratingCount: 0,
    createdAt: new Date().toISOString(),
  };
  db.episodes.push(ep);
  return ep;
}

// ---------- Update in place ----------
export async function updateEpisode(
  id: string,
  body: { title?: string; content?: string; summary?: string }
): Promise<Episode> {
  if (!isMock) return live(`/episodes/${id}`, { method: "PUT", body: JSON.stringify(body) });
  await delay();
  const ep = db.episodes.find((e) => e.id === id)!;
  if (body.title !== undefined) ep.title = body.title;
  if (body.content !== undefined) ep.content = body.content;
  if (body.summary !== undefined) ep.summary = body.summary;
  return ep;
}

// ---------- Analyze (streamed insight) ----------
export async function* analyze(episodeId: string): AsyncGenerator<string, string, unknown> {
  if (!isMock) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId }),
    });
    if (!res.ok || !res.body) throw new Error("analyze failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        let event = "message", data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (event === "token" && parsed.text) { acc += parsed.text; yield parsed.text as string; }
        else if (event === "error") {
          const msg = `[analysis failed: ${parsed.message ?? "unknown error"}]`;
          acc += msg;
          yield msg;
        }
      }
    }
    return acc;
  }
  const text =
    "61% of listeners drop off around the 2:10 mark — right after the mentor's death is " +
    "revealed but before Aldric acts. The scene lingers too long; tighten the monologue and " +
    "cut to the decision faster.";
  const words = text.split(/(\s+)/);
  for (const w of words) { await delay(12); yield w; }
  return text;
}

// ---------- Chat (AI Co-Author, streamed) ----------
export type ChatTurn = { role: "user" | "ai"; text: string };

/** Slash commands the co-author understands (drives the editor's autocomplete). */
export const CHAT_COMMANDS: { name: string; help: string }[] = [
  { name: "characters", help: "List characters with role, personality and status" },
  { name: "comments", help: "Reader reviews on this episode" },
  { name: "threads", help: "Open plot threads to honor or advance" },
  { name: "retention", help: "Audience retention summary for this episode" },
  { name: "style", help: "Series style guide (POV, tense, tone, rating)" },
  { name: "episode", help: "This episode's title, summary and decision point" },
  { name: "rewrite", help: "Draft / rewrite the episode into the editor" },
  { name: "help", help: "Show all slash commands" },
];

/** Streamed conversational reply. Yields text chunks, returns the full message.
 * Non-token events (tool calls) are surfaced via onEvent, mirroring generate(). */
export async function* chat(
  body: { episodeId: string; message: string; history?: ChatTurn[] },
  onEvent?: (e: AgentEvent) => void
): AsyncGenerator<string, string, unknown> {
  if (!isMock) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error("chat failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        let event = "message", data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { continue; }
        const tokenText = parsed.text ?? parsed.delta;
        if (event === "token" && tokenText) { acc += tokenText; yield tokenText as string; }
        else if (event === "reasoning") onEvent?.({ type: "reasoning", text: parsed.text ?? parsed.delta ?? "" });
        else if (event === "tool_call") onEvent?.({ type: "tool_call", name: parsed.name ?? "tool", args: parsed.args });
        else if (event === "tool_result") onEvent?.({ type: "tool_result", name: parsed.name ?? "tool", summary: parsed.summary });
        else if (event === "done" && typeof parsed.message === "string" && parsed.message) acc = parsed.message;
        else if (event === "error") {
          const msg = `\n\n[chat failed: ${parsed.message ?? "unknown error"}]`;
          acc += msg;
          yield msg;
        }
      }
    }
    return acc;
  }
  // mock/dev: grounded, command-aware answers from seeded data. Plain text only.
  const ep = db.episodes.find((e) => e.id === body.episodeId);
  const series = ep ? db.series.find((s) => s.id === ep.seriesId) : undefined;
  const chars = ep ? db.characters.filter((c) => c.seriesId === ep.seriesId) : [];
  const comments = db.reviews.filter((r) => r.episodeId === body.episodeId && !r.parentReviewId);
  const msg = body.message.trim().toLowerCase();
  const emitTool = async (name: string, summary: string, args: unknown = { episode_id: body.episodeId }) => {
    if (!onEvent) return;
    await delay(120); onEvent({ type: "tool_call", name, args });
    await delay(120); onEvent({ type: "tool_result", name, summary });
  };

  let text: string;
  if (msg.startsWith("/characters")) {
    await emitTool("get_characters", `${chars.length} rows`, { series_id: ep?.seriesId });
    text = chars.length
      ? `Characters in ${series?.title ?? "this series"}:\n` +
        chars.map((c) => `${c.name} — ${c.role}. Status: ${c.status}. Voice/personality: ${c.personality}`).join("\n")
      : "No characters found for this episode's series.";
  } else if (msg.startsWith("/episode")) {
    await emitTool("get_episode", ep?.title ?? "empty");
    text = ep
      ? `Episode: ${ep.title}\nSummary: ${ep.summary || "No summary."}\nDecision point: ${ep.decisionPoint || "None."}\nCurrent manuscript should stay aligned to this episode's content, characters, and timeline.`
      : "Episode not found.";
  } else if (msg.startsWith("/style")) {
    await emitTool("get_style_guide", "1 record", { series_id: ep?.seriesId });
    text = "Style guide for this series: cinematic serialized fiction, close character stakes, tense pacing, clean prose, no generic AI phrasing. Match the open episode's voice and keep every suggestion usable inside the current manuscript.";
  } else if (msg.startsWith("/comments") || msg.includes("comment") || msg.includes("feedback")) {
    await emitTool("get_comments", `${comments.length} rows`);
    text = comments.length
      ? "Reader pain points to write from:\n" +
        comments.map((r) => `@${r.authorName}: ${r.reviewText}\nSuggestion: turn this into a concrete branch choice, show consequence earlier, and make the emotional cost visible in-scene.`).join("\n")
      : "No reader comments yet. Use the episode decision point and retention signals instead.";
  } else {
    await emitTool("get_episode", ep?.title ?? "empty");
    await emitTool("get_comments", `${comments.length} rows`);
    text = ep
      ? `For ${ep.title}, stay anchored to this open episode. Strong branch direction: use the reader comments as pain points, make the changed decision land in the first scene, then show one irreversible consequence through character action. If you want me to rewrite the manuscript, use /rewrite followed by the exact change.`
      : "I couldn't find this episode in mock data.";
  }
  for (const w of text.split(/(\s+)/)) { await delay(8); yield w; }
  return text;
}

// ---------- Intent routing (EDIT manuscript vs ASK) ----------
export async function routeIntent(message: string): Promise<"EDIT" | "ASK"> {
  if (isMock) {
    await delay(60);
    return /\b(rewrite|revise|edit|change|make it|make the|add|remove|cut|trim|darker|tenser|expand|tighten)\b/i.test(message)
      ? "EDIT"
      : "ASK";
  }
  const res = await live<{ intent: "EDIT" | "ASK" }>("/route-intent", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return res?.intent === "EDIT" ? "EDIT" : "ASK";
}

// ---------- Edit (Copilot-style: streams revised manuscript, returns change summary) ----------
/** Async generator: yields revised-manuscript chunks (stream into editor), returns the
 * change summary (render in chat). Non-token events surface via onEvent like generate(). */
export async function* editStream(
  body: { episodeId: string; manuscript: string; instruction: string },
  onEvent?: (e: AgentEvent) => void
): AsyncGenerator<string, string, unknown> {
  if (!isMock) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const res = await fetch(`${base}/api/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error("edit failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let summary = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        let event = "message", data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (event === "token" && parsed.delta) { yield parsed.delta as string; }
        else if (event === "token" && parsed.text) { yield parsed.text as string; }
        else if (event === "reasoning") onEvent?.({ type: "reasoning", text: parsed.text ?? parsed.delta ?? "" });
        else if (event === "tool_call") onEvent?.({ type: "tool_call", name: parsed.name ?? "tool", args: parsed.args });
        else if (event === "tool_result") onEvent?.({ type: "tool_result", name: parsed.name ?? "tool", summary: parsed.summary });
        else if (event === "done") { summary = parsed.summary ?? summary; }
        else if (event === "error") { summary = `[edit failed: ${parsed.message ?? "unknown error"}]`; }
      }
    }
    return summary;
  }
  // mock: stream the manuscript back unchanged + a canned summary
  const steps: AgentEvent[] = [
    { type: "reasoning", text: `Applying "${body.instruction}" to the manuscript…` },
    { type: "tool_call", name: "get_style_guide" },
    { type: "tool_result", name: "get_style_guide", summary: "1 record" },
  ];
  if (onEvent) for (const s of steps) { await delay(150); onEvent(s); }
  for (const w of (body.manuscript || "").split(/(\s+)/)) { await delay(10); yield w; }
  return `Applied "${body.instruction}", keeping the rest of the manuscript intact.`;
}

// ---------- Narration (TTS render) ----------
export async function narrateEpisode(id: string): Promise<{ audioUrl: string; durationMs: number }> {
  if (!isMock) return live(`/episodes/${id}/narrate`, { method: "POST" });
  await delay(400);
  return { audioUrl: "", durationMs: 0 };
}

// ---------- Authoring (create series / canonical episode / character) ----------
export async function createSeries(body: {
  title: string; description?: string; summary?: string; genre?: string; tag?: string;
}): Promise<Series> {
  if (!isMock) return live("/series", { method: "POST", body: JSON.stringify(body) });
  await delay();
  const s: Series = {
    id: `new-${Date.now()}`, title: body.title, description: body.description ?? null,
    summary: body.summary ?? null, genre: body.genre ?? null, tag: body.tag ?? null,
    authorId: db.me.id, authorName: db.me.username, episodeCount: 0, contributorCount: 0, avgRating: 0,
  };
  db.series.push(s as any);
  return s;
}

export async function createCanonicalEpisode(
  seriesId: string,
  body: { title: string; content: string; summary?: string; decisionPoint?: string }
): Promise<Episode> {
  if (!isMock)
    return live(`/series/${seriesId}/episodes`, { method: "POST", body: JSON.stringify(body) });
  await delay();
  const order = db.episodes.filter((e) => e.seriesId === seriesId && e.isCanonical).length + 1;
  const ep: Episode = {
    id: `new-${Date.now()}`, seriesId, seasonId: "100", title: body.title, content: body.content,
    summary: body.summary ?? null, prevEpisodeSummary: null, orderIndex: order, authorId: db.me.id,
    authorName: db.me.username, coAuthorId: null, coAuthorName: null, forkedFromEpisodeId: null,
    decisionPoint: body.decisionPoint ?? null, isCanonical: true, verifiedByAuthor: false,
    avgRating: 0, ratingCount: 0, createdAt: new Date().toISOString(),
  };
  db.episodes.push(ep);
  return ep;
}

export async function createCharacter(
  seriesId: string,
  body: Partial<Character> & { name: string }
): Promise<Character> {
  if (!isMock)
    return live(`/series/${seriesId}/characters`, { method: "POST", body: JSON.stringify(body) });
  await delay();
  const c: Character = {
    id: `new-${Date.now()}`, seriesId, name: body.name, description: body.description ?? null,
    role: body.role ?? null, personality: body.personality ?? null, backstory: body.backstory ?? null,
    goals: body.goals ?? null, speechStyle: body.speechStyle ?? null, status: body.status ?? "alive",
  };
  db.characters.push(c);
  return c;
}

export async function verifyEpisode(id: string, verified: boolean): Promise<Episode> {
  if (!isMock)
    return live(`/episodes/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ verified }),
    });
  await delay();
  const ep = db.episodes.find((e) => e.id === id)!;
  ep.verifiedByAuthor = verified;
  return ep;
}
