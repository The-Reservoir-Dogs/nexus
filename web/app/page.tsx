"use client";
import * as React from "react";
import Link from "next/link";
import { getSeries } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Shell } from "@/components/layout/Shell";
import { SeriesCard } from "@/components/SeriesCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}

export default function Home() {
  const { data: series, loading } = useAsync(() => getSeries(), []);
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!series) return [];
    const needle = q.toLowerCase().trim();
    if (!needle) return series;
    return series.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        (s.genre ?? "").toLowerCase().includes(needle)
    );
  }, [series, q]);

  const featured = series?.[0];

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        {/* Hero */}
        {loading || !featured ? (
          <Skeleton className="h-56 w-full rounded-2xl" />
        ) : (
          <div className="radial-glow relative overflow-hidden rounded-3xl border border-line p-10 shadow-card">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-aurora-soft blur-3xl" />
            <Badge variant="fork" className="mb-4">
              ✦ Featured Multiverse
            </Badge>
            <h1 className="max-w-2xl font-display text-6xl leading-[1.02]">
              {featured.title}
            </h1>
            <p className="mt-3 max-w-lg text-lg text-muted">{featured.description}</p>
            <div className="mt-6 flex items-center gap-3">
              <Button asChild variant="aurora" size="lg">
                <Link href={`/series/${featured.id}`}>Enter the Multiverse</Link>
              </Button>
              <span className="font-mono text-xs text-muted">
                {featured.episodeCount} episodes · {featured.contributorCount} contributors ·{" "}
                {featured.avgRating}★
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter series by title or genre…"
          aria-label="Filter series"
          className="h-10 w-full max-w-md rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fork"
        />

        {loading ? (
          <Row title="Continue">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-56 shrink-0 space-y-2">
                <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </Row>
        ) : filtered.length === 0 ? (
          <p className="text-muted">No series match “{q}”.</p>
        ) : (
          <>
            <Row title="Continue">
              {filtered.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </Row>
            <Row title="Trending Multiverses">
              {[...filtered].reverse().map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </Row>
          </>
        )}
      </div>
    </Shell>
  );
}
