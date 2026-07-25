// Single API client. MODE=mock reads dummy JSON; MODE=live calls /api/*.
// Components import ONLY these functions — swapping MODE needs no component change.
import type { Series, Episode, Review, Character } from "./types";
import { nestReviews, rankTimelines } from "./logic";
import * as db from "@/mocks/data";
import type { User } from "@/mocks/data";

const MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
const isMock = MODE !== "live";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

async function live<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json.data as T;
}

// ---------- Reads ----------
export async function getMe(): Promise<User> {
  if (!isMock) return live<User>("/me");
  await delay();
  return db.me;
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
  return out;
}

export async function getSeriesById(id: string): Promise<Series | undefined> {
  if (!isMock) return live<Series>(`/series/${id}`);
  await delay();
  return db.series.find((s) => s.id === id);
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
export type GenerateBody = {
  sourceEpisodeId: string;
  decisionPoint: string;
  drivingReviewId?: string;
  instructions?: string;
};

/** Async generator: yields text chunks, returns the final Draft. */
export async function* generate(
  body: GenerateBody
): AsyncGenerator<string, Draft, unknown> {
  if (!isMock) {
    // Live: consume SSE from /api/generate; normalized elsewhere. Simplified here.
    const draft = await live<Draft>("/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });
    yield draft.content;
    return draft;
  }
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
  decisionPoint: string;
  title: string;
  content: string;
  summary: string;
  isCanonical?: boolean;
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
