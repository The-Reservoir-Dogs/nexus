// Shared response types — mirror docs/API_CONTRACT.md.

export type Series = {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  genre: string | null;
  tag: string | null;
  authorId: string;
  authorName?: string;
  episodeCount?: number;
  contributorCount?: number;
  avgRating?: number;
  createdAt?: string;
};

export type Season = {
  id: string;
  seriesId: string;
  title: string;
  summary: string | null;
  orderIndex: number;
};

export type Episode = {
  id: string;
  seriesId: string;
  seasonId: string;
  title: string;
  content: string | null;
  summary: string | null;
  prevEpisodeSummary: string | null;
  orderIndex: number;
  authorId: string;
  authorName?: string;
  coAuthorId: string | null;
  coAuthorName?: string | null;
  forkedFromEpisodeId: string | null;
  decisionPoint: string | null;
  isCanonical: boolean;
  verifiedByAuthor: boolean;
  audioUrl?: string | null;
  audioDurationMs?: number | null;
  avgRating?: number;
  ratingCount?: number;
  createdAt?: string;
};

export type Review = {
  id: string;
  episodeId: string;
  createdBy: string;
  authorName?: string;
  reviewText: string;
  parentReviewId: string | null;
  replies?: Review[];
  createdAt?: string;
};

export type Character = {
  id: string;
  seriesId: string;
  name: string;
  description: string | null;
  role: string | null;
  personality: string | null;
  backstory: string | null;
  goals: string | null;
  speechStyle: string | null;
  status: string;
};

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return Response.json(meta ? { data, meta } : { data });
}
export function fail(code: string, message: string, status = 400) {
  return Response.json({ error: { code, message } }, { status });
}
