// Pure, testable domain logic (no DB / no framework) — TDD lives here.
import type { Review, Episode } from "./types";

/** Nest flat reviews into a one-level threaded tree (top-level + replies). */
export function nestReviews(rows: Review[]): Review[] {
  const byId: Record<string, Review> = {};
  const roots: Review[] = [];
  for (const r of rows) {
    r.replies = [];
    byId[r.id] = r;
  }
  for (const r of rows) {
    if (r.parentReviewId && byId[r.parentReviewId]) {
      byId[r.parentReviewId].replies!.push(r);
    } else {
      roots.push(r);
    }
  }
  return roots;
}

/** Rank alternate timelines: verified first, then by avgRating, then ratingCount. */
export function rankTimelines(eps: Episode[]): Episode[] {
  return [...eps].sort((a, b) => {
    if (a.verifiedByAuthor !== b.verifiedByAuthor) return a.verifiedByAuthor ? -1 : 1;
    const ar = a.avgRating ?? 0;
    const br = b.avgRating ?? 0;
    if (ar !== br) return br - ar;
    return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
  });
}

/** Access checks derived from episode ownership (no role column). */
export function canEditEpisode(userId: string, ep: Pick<Episode, "authorId" | "coAuthorId">): boolean {
  return ep.authorId === userId || ep.coAuthorId === userId;
}
export function canVerify(userId: string, ep: Pick<Episode, "authorId">): boolean {
  return ep.authorId === userId;
}
