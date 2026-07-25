"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Volume2, Rewind, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getEpisode,
  getEpisodes,
  getReviews,
  getEpisodeTimelines,
  postRating,
  postReview,
  forkEpisode,
} from "@/lib/api";
import type { Episode, Review } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useFork } from "@/components/ForkProvider";
import { Shell } from "@/components/layout/Shell";
import { RatingStars } from "@/components/reader/RatingStars";
import { CommentThread, CommentComposer } from "@/components/reader/Comments";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardMeta, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const DRIVING_ID = "5001";

export default function ReaderPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const fork = useFork();

  const { data: episode, loading } = useAsync(() => getEpisode(id), [id]);
  const { data: initialReviews } = useAsync(() => getReviews(id), [id]);
  const { data: timelines } = useAsync(() => getEpisodeTimelines(id), [id]);

  // prev/next along the sacred timeline
  const [siblings, setSiblings] = React.useState<Episode[]>([]);
  React.useEffect(() => {
    if (episode?.isCanonical) getEpisodes(episode.seriesId).then(setSiblings);
  }, [episode?.seriesId, episode?.isCanonical]);
  const idx = siblings.findIndex((e) => e.id === id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [rating, setRating] = React.useState<{ avg: number; count: number } | null>(null);
  const [tab, setTab] = React.useState<"text" | "audio">("text");
  const [rewinding, setRewinding] = React.useState(false);

  React.useEffect(() => {
    if (initialReviews) setReviews(initialReviews);
  }, [initialReviews]);
  React.useEffect(() => {
    if (episode) setRating({ avg: episode.avgRating ?? 0, count: episode.ratingCount ?? 0 });
  }, [episode]);

  async function handleRate(score: number) {
    // optimistic
    setRating((r) => (r ? { avg: score, count: r.count + 1 } : r));
    try {
      const res = await postRating(id, score);
      setRating({ avg: res.avgRating, count: res.ratingCount });
    } catch {
      if (episode) setRating({ avg: episode.avgRating ?? 0, count: episode.ratingCount ?? 0 });
    }
  }

  async function handlePost(text: string) {
    const optimistic: Review = {
      id: `tmp-${Date.now()}`,
      episodeId: id,
      createdBy: "1",
      authorName: "sriman",
      reviewText: text,
      parentReviewId: null,
      replies: [],
    };
    setReviews((rs) => [optimistic, ...rs]);
    try {
      const saved = await postReview(id, text);
      setReviews((rs) => rs.map((r) => (r.id === optimistic.id ? saved : r)));
    } catch {
      setReviews((rs) => rs.filter((r) => r.id !== optimistic.id));
    }
  }

  async function handleRewind() {
    if (!episode) return;
    setRewinding(true);
    const ctx = await forkEpisode(episode.id, DRIVING_ID);
    fork.reset();
    fork.setContext(ctx);
    fork.setWhatIf("");
    fork.setDrivingReviewId(DRIVING_ID);
    router.push(`/episodes/${episode.id}/fork`);
  }

  return (
    <Shell>
      {rewinding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/85 backdrop-blur-sm">
          <div className="text-center">
            <Rewind className="mx-auto h-10 w-10 animate-pulse text-fork" />
            <p className="mt-3 font-display text-2xl">Rewinding to the decision point…</p>
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_320px]">
        <article>
          {loading || !episode ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-2/3" />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Text | Audio tabs */}
              <div className="mb-4 inline-flex rounded-lg border border-line bg-panel p-0.5">
                {(["text", "audio"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={
                      "rounded-md px-3 py-1 text-sm capitalize " +
                      (tab === t ? "bg-panel-2 text-text" : "text-muted")
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>

              {tab === "audio" && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-panel p-3 text-sm text-muted">
                  <Volume2 className="h-4 w-4" />
                  {episode.decisionPoint ? "Audio drama coming soon." : "No audio for this episode yet."}
                </div>
              )}

              <h1 className="font-display text-4xl">{episode.title}</h1>
              <div className="mt-4 max-w-[68ch] space-y-4 leading-relaxed text-text/90">
                {(episode.content ?? "").split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {/* Decision point */}
              {episode.decisionPoint && (
                <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-fork/40 bg-fork/10 p-4">
                  <Badge variant="fork">DECISION POINT</Badge>
                  <span className="text-sm text-text/90">{episode.decisionPoint}</span>
                  <Button variant="fork" size="sm" className="ml-auto" onClick={handleRewind}>
                    <Rewind className="h-4 w-4" /> Rewind / change this decision
                  </Button>
                </div>
              )}

              {/* Prev / Next episode navigation */}
              {(prev || next) && (
                <div className="mt-8 flex items-center justify-between gap-3">
                  {prev ? (
                    <Link
                      href={`/episodes/${prev.id}`}
                      className="group flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm transition-colors hover:border-fork/60"
                    >
                      <ChevronLeft className="h-4 w-4 text-fork" />
                      <span className="text-left">
                        <span className="block font-mono text-[10px] uppercase text-muted">Previous</span>
                        <span className="text-text">{prev.title}</span>
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <Link
                      href={`/episodes/${next.id}`}
                      className="group flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-right text-sm transition-colors hover:border-fork/60"
                    >
                      <span>
                        <span className="block font-mono text-[10px] uppercase text-muted">Next</span>
                        <span className="text-text">{next.title}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-fork" />
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              )}

              {/* Rating + comments */}
              <div className="mt-8 space-y-4 border-t border-line pt-6">
                {rating && (
                  <RatingStars avg={rating.avg} count={rating.count} onRate={handleRate} />
                )}
                <CommentComposer onPost={handlePost} />
              </div>
            </>
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-xl">Comments</h2>
            <CommentThread reviews={reviews} drivingId={DRIVING_ID} />
          </div>
          {timelines && timelines.length > 0 && (
            <div>
              <h2 className="mb-3 font-display text-xl">Alternate Timelines</h2>
              <div className="space-y-2">
                {timelines.map((t: Episode) => (
                  <Link key={t.id} href={`/episodes/${t.id}`} className="block">
                    <Card className="hover:shadow-lift">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <ArrowRight className="h-4 w-4 text-fork" />
                      </div>
                      <CardMeta className="mt-1">
                        by {t.coAuthorName} · {t.avgRating}★
                        {t.verifiedByAuthor ? " · ✓" : ""}
                      </CardMeta>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}
