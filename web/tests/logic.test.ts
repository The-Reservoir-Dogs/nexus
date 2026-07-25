import { describe, it, expect } from "vitest";
import { nestReviews, rankTimelines, canEditEpisode, canVerify } from "@/lib/logic";
import type { Review, Episode } from "@/lib/types";

const rev = (id: string, parentReviewId: string | null = null): Review => ({
  id,
  episodeId: "1",
  createdBy: "1",
  reviewText: `r${id}`,
  parentReviewId,
});

const ep = (o: Partial<Episode>): Episode =>
  ({
    id: "x", seriesId: "10", seasonId: "100", title: "t", content: null, summary: null,
    prevEpisodeSummary: null, orderIndex: 1, authorId: "1", coAuthorId: null,
    forkedFromEpisodeId: "1003", decisionPoint: null, isCanonical: false,
    verifiedByAuthor: false, ...o,
  }) as Episode;

describe("nestReviews", () => {
  it("nests replies under their parent", () => {
    const out = nestReviews([rev("1"), rev("2", "1"), rev("3")]);
    expect(out.map((r) => r.id)).toEqual(["1", "3"]);
    expect(out[0].replies!.map((r) => r.id)).toEqual(["2"]);
  });

  it("treats orphan replies as roots", () => {
    const out = nestReviews([rev("2", "999")]);
    expect(out.map((r) => r.id)).toEqual(["2"]);
  });
});

describe("rankTimelines", () => {
  it("puts verified first, then by avgRating", () => {
    const out = rankTimelines([
      ep({ id: "a", avgRating: 5, verifiedByAuthor: false }),
      ep({ id: "b", avgRating: 3, verifiedByAuthor: true }),
      ep({ id: "c", avgRating: 4, verifiedByAuthor: false }),
    ]);
    expect(out.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("breaks avgRating ties by ratingCount", () => {
    const out = rankTimelines([
      ep({ id: "a", avgRating: 4, ratingCount: 2 }),
      ep({ id: "b", avgRating: 4, ratingCount: 9 }),
    ]);
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("access checks", () => {
  it("author or co-author can edit", () => {
    expect(canEditEpisode("1", { authorId: "1", coAuthorId: null })).toBe(true);
    expect(canEditEpisode("2", { authorId: "1", coAuthorId: "2" })).toBe(true);
    expect(canEditEpisode("3", { authorId: "1", coAuthorId: "2" })).toBe(false);
  });
  it("only author can verify", () => {
    expect(canVerify("1", { authorId: "1" })).toBe(true);
    expect(canVerify("2", { authorId: "1" })).toBe(false);
  });
});
