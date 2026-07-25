"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rewind, GitBranch, ArrowRight, BarChart3, Pencil } from "lucide-react";
import {
  getEpisode,
  getEpisodes,
  getReviews,
  getEpisodeTimelines,
  getSeriesById,
  postRating,
  postReview,
  forkEpisode,
} from "@/lib/api";
import type { Episode, Review, Series } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/components/AuthProvider";
import { useFork } from "@/components/ForkProvider";
import { Shell } from "@/components/layout/Shell";
import { LeftRail } from "@/components/layout/LeftRail";
import { SidePanel } from "@/components/layout/SidePanel";
import { AudioPlayer } from "@/components/player/AudioPlayer";
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
  const { me } = useAuth();

  const { data: episode, loading } = useAsync(() => getEpisode(id), [id]);
  const { data: initialReviews } = useAsync(() => getReviews(id), [id]);
  const { data: timelines } = useAsync(() => getEpisodeTimelines(id), [id]);

  const [siblings, setSiblings] = React.useState<Episode[]>([]);
  const [series, setSeries] = React.useState<Series | undefined>();
  React.useEffect(() => {
    if (!episode) return;
    getEpisodes(episode.seriesId).then(setSiblings);
    getSeriesById(episode.seriesId).then(setSeries);
  }, [episode?.seriesId, episode]);

  const idx = siblings.findIndex((e) => e.id === id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const isAuthor = !!me && !!series && (series.authorId === me.id || episode?.coAuthorId === me.id);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [rating, setRating] = React.useState<{ avg: number; count: number } | null>(null);
  const [rewinding, setRewinding] = React.useState(false);

  React.useEffect(() => {
    if (initialReviews) setReviews(initialReviews);
  }, [initialReviews]);
  React.useEffect(() => {
    if (episode) setRating({ avg: episode.avgRating ?? 0, count: episode.ratingCount ?? 0 });
  }, [episode]);

  async function handleRate(score: number) {
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
      createdBy: me?.id ?? "1",
      authorName: me?.username ?? "you",
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

      <div className="mx-auto grid h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-[210px_1fr_340px]">
        {/* Left rail */}
        <div className="hidden lg:block">
          <LeftRail episodes={siblings} currentId={id} seasonTitle={series ? "Season 1" : "Season"} />
        </div>

        {/* Center: script + player */}
        <section className="flex min-h-0 flex-col">
          {/* action bar */}
          <div className="mb-3 flex items-center gap-2">
            {episode?.decisionPoint && (
              <Button variant="fork" size="sm" onClick={handleRewind}>
                <GitBranch className="h-4 w-4" /> Create branches
              </Button>
            )}
            {episode?.isCanonical ? (
              <Badge variant="canon">Canonical</Badge>
            ) : (
              <Badge variant="fork">Alternate timeline</Badge>
            )}
            {isAuthor && (
              <div className="ml-auto flex items-center gap-2">
                <Button asChild variant="pill" size="sm">
                  <Link href={`/episodes/${id}/analytics`}>
                    <BarChart3 className="h-3.5 w-3.5" /> analytics
                  </Link>
                </Button>
                <Button asChild variant="pill" size="sm">
                  <Link href={`/episodes/${id}/editor`}>
                    <Pencil className="h-3.5 w-3.5" /> edit
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* script */}
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin rounded-[14px] border border-line bg-panel p-8">
            {loading || !episode ? (
              <div className="space-y-4">
                <Skeleton className="h-9 w-2/3" />
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <article>
                <h1 className="font-display text-4xl italic text-text">{episode.title}</h1>
                <div className="mt-6 prose-story">
                  {(episode.content ?? "").split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>

                {episode.decisionPoint && (
                  <div className="mt-8 flex flex-wrap items-center gap-3 rounded-[14px] border border-fork/40 bg-fork/10 p-4">
                    <Badge variant="fork">DECISION POINT</Badge>
                    <span className="text-sm text-body">{episode.decisionPoint}</span>
                  </div>
                )}

                <div className="mt-8 border-t border-line pt-6">
                  {rating && <RatingStars avg={rating.avg} count={rating.count} onRate={handleRate} />}
                </div>
              </article>
            )}
          </div>

          {/* audio player docked at bottom */}
          <AudioPlayer
            className="mt-3"
            src={episode?.audioUrl}
            title={episode?.title}
            onPrev={prev ? () => router.push(`/episodes/${prev.id}`) : undefined}
            onNext={next ? () => router.push(`/episodes/${next.id}`) : undefined}
          />
        </section>

        {/* Right: comments */}
        <div className="hidden min-h-0 lg:block">
          <SidePanel
            title="Comments"
            footer={<CommentComposer onPost={handlePost} />}
          >
            <div className="space-y-5">
              <CommentThread reviews={reviews} drivingId={DRIVING_ID} />
              {timelines && timelines.length > 0 && (
                <div>
                  <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    Alternate timelines
                  </h3>
                  <div className="space-y-2">
                    {timelines.map((t: Episode) => (
                      <Link key={t.id} href={`/episodes/${t.id}`} className="block">
                        <Card className="p-3 hover:border-fork/50 hover:shadow-lift">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{t.title}</CardTitle>
                            <ArrowRight className="h-4 w-4 text-fork" />
                          </div>
                          <CardMeta className="mt-1">
                            by {t.coAuthorName} · {t.avgRating}★{t.verifiedByAuthor ? " · ✓" : ""}
                          </CardMeta>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SidePanel>
        </div>
      </div>
    </Shell>
  );
}
