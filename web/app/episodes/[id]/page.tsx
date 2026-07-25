"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rewind, GitBranch, ArrowUpRight, BarChart3, Pencil, ArrowLeft, Star, CheckCircle2 } from "lucide-react";
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
import { SeasonTree } from "@/components/reader/SeasonTree";
import { AudioPlayer } from "@/components/player/AudioPlayer";
import { RatingStars } from "@/components/reader/RatingStars";
import { CommentThread, CommentComposer } from "@/components/reader/Comments";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const DRIVING_ID = "5001";

export default function ReaderPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const fork = useFork();
  const { me } = useAuth();

  const { data: episode, loading } = useAsync(() => getEpisode(id), [id]);
  const { data: initialReviews } = useAsync(() => getReviews(id), [id]);

  const [siblings, setSiblings] = React.useState<Episode[]>([]);
  const [branchesByEp, setBranchesByEp] = React.useState<Record<string, Episode[]>>({});
  const [series, setSeries] = React.useState<Series | undefined>();

  React.useEffect(() => {
    if (!episode) return;
    getSeriesById(episode.seriesId).then(setSeries);
    getEpisodes(episode.seriesId).then(async (eps) => {
      setSiblings(eps);
      const entries = await Promise.all(
        eps.map(async (e) => [e.id, await getEpisodeTimelines(e.id)] as const)
      );
      setBranchesByEp(Object.fromEntries(entries));
    });
  }, [episode?.seriesId, episode]);

  const currentBranches = branchesByEp[id] ?? (episode?.decisionPoint ? [] : []);
  const idx = siblings.findIndex((e) => e.id === id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const isAuthor = !!me && !!series && (series.authorId === me.id || episode?.coAuthorId === me.id);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [rating, setRating] = React.useState<{ avg: number; count: number } | null>(null);
  const [rewinding, setRewinding] = React.useState(false);

  React.useEffect(() => { if (initialReviews) setReviews(initialReviews); }, [initialReviews]);
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
      id: `tmp-${Date.now()}`, episodeId: id, createdBy: me?.id ?? "1",
      authorName: me?.username ?? "you", reviewText: text, parentReviewId: null, replies: [],
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
    router.push(`/episodes/${episode.id}/editor`);
  }

  return (
    <Shell>
      {rewinding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/85 backdrop-blur-sm">
          <div className="text-center">
            <Rewind className="mx-auto h-8 w-8 animate-pulse text-fork" />
            <p className="mt-3 text-lg text-text">Rewinding to the decision point…</p>
          </div>
        </div>
      )}

      <div className="grid h-[calc(100vh-48px)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        {/* Left: tree nav */}
        <nav className="hidden min-h-0 flex-col overflow-y-auto scroll-thin border-r border-line p-2 lg:flex">
          <Link href="/" className="mb-1 inline-flex items-center gap-1.5 px-2 py-1 text-[12px] text-muted hover:text-fork">
            <ArrowLeft className="h-3.5 w-3.5" /> {series?.title ?? "Home"}
          </Link>
          {siblings.length ? (
            <SeasonTree episodes={siblings} branchesByEpisode={branchesByEp} currentId={id} />
          ) : (
            <div className="space-y-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          )}
        </nav>

        {/* Center: script + player */}
        <section className="flex min-h-0 flex-col">
          {/* toolbar */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            {episode?.isCanonical ? <Badge variant="canon">canon</Badge> : <Badge variant="fork">branch</Badge>}
            {episode?.decisionPoint && (
              <Button variant="fork" size="sm" onClick={handleRewind}>
                <GitBranch className="h-3.5 w-3.5" /> Create branch
              </Button>
            )}
            {isAuthor && (
              <div className="ml-auto flex items-center gap-1.5">
                <Button asChild variant="pill" size="sm">
                  <Link href={`/episodes/${id}/analytics`}><BarChart3 className="h-3.5 w-3.5" /> Analytics</Link>
                </Button>
                <Button asChild variant="pill" size="sm">
                  <Link href={`/episodes/${id}/editor`}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                </Button>
              </div>
            )}
          </div>

          {/* script */}
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-6 py-5">
            {loading || !episode ? (
              <div className="mx-auto max-w-[74ch] space-y-3">
                <Skeleton className="h-7 w-2/3" />
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : (
              <article className="mx-auto max-w-[74ch]">
                <h1 className="text-2xl font-semibold text-text">{episode.title}</h1>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {episode.isCanonical ? "Canonical timeline" : `Branch by ${episode.coAuthorName ?? "co-author"}`}
                  {rating && rating.count > 0 && (
                    <span className="flex items-center gap-0.5 text-canon">
                      <Star className="h-3 w-3 fill-canon" /> {rating.avg} · {rating.count} ratings
                    </span>
                  )}
                </div>

                <div className="mt-5 prose-story">
                  {(episode.content ?? "").split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
                </div>

                {episode.decisionPoint && (
                  <div className="mt-6 flex flex-wrap items-center gap-2 rounded-md border border-fork/40 bg-fork/10 px-3 py-2 text-[13px]">
                    <Badge variant="fork">decision point</Badge>
                    <span className="text-body">{episode.decisionPoint}</span>
                  </div>
                )}

                {/* top-K branches for this episode */}
                {currentBranches.length > 0 && (
                  <div className="mt-8">
                    <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      <GitBranch className="h-3.5 w-3.5" /> Top branches
                    </h2>
                    <div className="divide-y divide-line rounded-md border border-line">
                      {currentBranches.map((b) => (
                        <Link
                          key={b.id}
                          href={`/episodes/${b.id}`}
                          className="flex items-center gap-3 px-3 py-2 text-[13px] hover:bg-panel-2"
                        >
                          <GitBranch className="h-3.5 w-3.5 shrink-0 text-fork" />
                          <span className="truncate font-medium text-text">{b.title}</span>
                          {b.verifiedByAuthor && <CheckCircle2 className="h-3.5 w-3.5 text-canon" />}
                          <span className="ml-auto shrink-0 text-muted">by {b.coAuthorName}</span>
                          <span className="flex shrink-0 items-center gap-0.5 text-canon">
                            <Star className="h-3 w-3 fill-canon" /> {b.avgRating}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {rating && (
                  <div className="mt-8 border-t border-line pt-4">
                    <RatingStars avg={rating.avg} count={rating.count} onRate={handleRate} />
                  </div>
                )}
              </article>
            )}
          </div>

          {/* audio player bar */}
          <div className="border-t border-line px-3 py-1.5">
            <AudioPlayer
              bare
              src={episode?.audioUrl}
              title={episode?.title}
              onPrev={prev ? () => router.push(`/episodes/${prev.id}`) : undefined}
              onNext={next ? () => router.push(`/episodes/${next.id}`) : undefined}
            />
          </div>
        </section>

        {/* Right: comments */}
        <aside className="hidden min-h-0 flex-col border-l border-line lg:flex">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Comments
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
            <CommentThread reviews={reviews} drivingId={DRIVING_ID} />
          </div>
          <div className="border-t border-line p-3">
            <CommentComposer onPost={handlePost} />
          </div>
        </aside>
      </div>
    </Shell>
  );
}
