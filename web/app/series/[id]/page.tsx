"use client";
import * as React from "react";
import Link from "next/link";
import { Star, Users, PencilLine } from "lucide-react";
import { getSeriesById, getEpisodes, getEpisodeTimelines } from "@/lib/api";
import type { Episode } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/components/AuthProvider";
import { Shell } from "@/components/layout/Shell";
import { TimelineTree } from "@/components/TimelineTree";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardMeta, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SeriesPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { isOwner } = useAuth();

  const { data: series, loading: sLoading } = useAsync(() => getSeriesById(id), [id]);
  const { data: episodes, loading: eLoading } = useAsync(() => getEpisodes(id), [id]);
  const [forksByEpisode, setForks] = React.useState<Record<string, Episode[]>>({});

  React.useEffect(() => {
    if (!episodes) return;
    const decisionEps = episodes.filter((e) => e.decisionPoint);
    Promise.all(
      decisionEps.map((e) => getEpisodeTimelines(e.id).then((f) => [e.id, f] as const))
    ).then((pairs) => setForks(Object.fromEntries(pairs)));
  }, [episodes]);

  const topBranches = React.useMemo(
    () => Object.values(forksByEpisode).flat().sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)),
    [forksByEpisode]
  );

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Hero */}
        {sLoading || !series ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : (
          <div className="radial-glow relative overflow-hidden rounded-2xl border border-line p-8">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="neutral">{series.genre}</Badge>
                  {(series.tag ?? "").split(",").filter(Boolean).map((t) => (
                    <Badge key={t} variant="neutral">{t}</Badge>
                  ))}
                </div>
                <h1 className="font-display text-4xl">{series.title}</h1>
                <p className="mt-2 max-w-lg text-muted">{series.description}</p>
                <p className="mt-3 flex items-center gap-4 font-mono text-xs text-muted">
                  <span>by {series.authorName}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {series.contributorCount}
                  </span>
                  <span className="inline-flex items-center gap-1 text-canon">
                    <Star className="h-3 w-3 fill-canon" /> {series.avgRating}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Follow</Button>
                {/* Owner-only: Edit / Create (wireframe note) */}
                {isOwner(series) && (
                  <Button asChild variant="primary">
                    <Link href={`/series/${series.id}/branches`}>
                      <PencilLine className="h-4 w-4" /> Edit / Create
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Sacred timeline + branches */}
          <section>
            <details open className="rounded-xl border border-line bg-panel">
              <summary className="cursor-pointer select-none px-4 py-3 font-display text-xl">
                Season 1
              </summary>
              <div className="px-4 pb-5 pt-1">
                {eLoading || !episodes ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <TimelineTree episodes={episodes} forksByEpisode={forksByEpisode} />
                )}
              </div>
            </details>
          </section>

          {/* Top Rated Branch panel */}
          <aside className="space-y-3">
            <h2 className="font-display text-xl">Top Rated Branches</h2>
            {topBranches.length === 0 ? (
              <p className="text-sm text-muted">No alternate timelines yet.</p>
            ) : (
              topBranches.slice(0, 5).map((b) => (
                <Link key={b.id} href={`/episodes/${b.id}`} className="block">
                  <Card className="hover:shadow-glow-fork">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{b.title}</CardTitle>
                      <Badge variant="fork">{b.avgRating}★</Badge>
                    </div>
                    <CardMeta className="mt-1">
                      by {b.coAuthorName}
                      {b.verifiedByAuthor ? " · ✓ verified" : ""}
                    </CardMeta>
                  </Card>
                </Link>
              ))
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
