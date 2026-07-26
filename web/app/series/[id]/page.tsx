"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEpisodes, getSeriesById } from "@/lib/api";
import type { Series } from "@/lib/types";
import { Shell } from "@/components/layout/Shell";

/**
 * The standalone series page was removed — season/episode/branch navigation now lives
 * in the reader's tree view. Entering a series opens its first canonical episode; if it
 * has none yet, we show an empty state instead of bouncing.
 */
export default function SeriesEntry({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [state, setState] = React.useState<"loading" | "empty" | "error">("loading");
  const [series, setSeries] = React.useState<Series | undefined>();

  React.useEffect(() => {
    let alive = true;
    getSeriesById(id).then((s) => alive && setSeries(s));
    getEpisodes(id)
      .then((eps) => {
        if (!alive) return;
        const first = eps.find((e) => e.isCanonical) ?? eps[0];
        if (first) router.replace(`/episodes/${first.id}`);
        else setState("empty");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [id, router]);

  return (
    <Shell>
      <div className="grid h-[calc(100vh-48px)] place-items-center">
        {state === "loading" ? (
          <span className="text-sm text-muted">Opening series…</span>
        ) : (
          <div className="text-center">
            <p className="text-sm text-text">
              {state === "error" ? "Couldn’t load this series." : `${series?.title ?? "This series"} has no episodes yet.`}
            </p>
            {state === "empty" && (
              <div className="mt-3 flex items-center justify-center gap-4 text-[13px]">
                <Link href={`/series/${id}/episode/new`} className="text-canon hover:underline">Write first episode</Link>
                <Link href={`/series/${id}/characters`} className="text-fork hover:underline">Add characters</Link>
              </div>
            )}
            <Link href="/" className="mt-3 inline-block text-[13px] text-muted hover:underline">
              ← Back to series
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
