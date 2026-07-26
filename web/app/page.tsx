"use client";
import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSeries } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { SeriesCard } from "@/components/SeriesCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Home() {
  const { data: series, loading } = useAsync(() => getSeries(), []);
  const [q, setQ] = React.useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("q") ?? ""
      : ""
  );

  const filtered = React.useMemo(() => {
    if (!series) return [];
    const n = q.toLowerCase().trim();
    if (!n) return series;
    return series.filter(
      (s) => s.title.toLowerCase().includes(n) || (s.genre ?? "").toLowerCase().includes(n)
    );
  }, [series, q]);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text">Series</h1>
            <p className="text-[13px] text-muted">
              {loading ? "…" : `${filtered.length} multiverses`} · fork any timeline, hear it change
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by title or genre…"
              aria-label="Filter series"
              className="h-8 w-64 rounded-md border border-line-2 bg-panel px-3 text-[13px] text-text placeholder:text-muted focus:border-fork/60 focus:outline-none"
            />
            <Button asChild variant="primary" size="sm">
              <Link href="/series/new"><Plus className="h-3.5 w-3.5" /> New series</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">No series match “{q}”.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => <SeriesCard key={s.id} series={s} />)}
          </div>
        )}
      </div>
    </Shell>
  );
}
