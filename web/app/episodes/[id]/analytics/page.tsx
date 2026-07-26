"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEpisode, getSeriesById } from "@/lib/api";
import type { Episode, Series } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/components/AuthProvider";
import { Shell } from "@/components/layout/Shell";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel";

// Deep-link fallback: full-page render of the analytics panel. In the reader the
// same panel opens as a drawer (AnalyticsDrawer) without leaving the screen.
export default function AnalyticsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { me } = useAuth();
  const { data: episode, loading } = useAsync(() => getEpisode(id), [id]);
  const [series, setSeries] = React.useState<Series | undefined>();
  React.useEffect(() => {
    if (episode) getSeriesById(episode.seriesId).then(setSeries);
  }, [episode]);

  const isAuthor = !!me && !!series && (series.authorId === me.id || (episode as Episode)?.coAuthorId === me.id);

  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-5 py-6">
        <Link
          href={`/episodes/${id}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-canon"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> back to episode
        </Link>

        {loading || !episode ? (
          <Skeleton className="mt-6 h-64 w-full" />
        ) : !isAuthor ? (
          <p className="mt-10 text-center text-muted">Analytics are visible to the series author only.</p>
        ) : (
          <div className="mt-4">
            <AnalyticsPanel episodeId={id} title={episode.title} />
          </div>
        )}
      </div>
    </Shell>
  );
}
