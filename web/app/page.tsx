"use client";
import * as React from "react";
import Link from "next/link";
import { getSeries } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { genreStyle } from "@/lib/genre";
import { Shell } from "@/components/layout/Shell";
import { SeriesCard } from "@/components/SeriesCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const { data: series, loading } = useAsync(() => getSeries(), []);
  const [q, setQ] = React.useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("q") ?? ""
      : ""
  );

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
  const fg = genreStyle(featured?.genre);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-14 px-6 py-10">
        {/* Hero */}
        {loading || !featured ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="paper-glow relative overflow-hidden border border-line bg-panel shadow-card">
            <div className="grid gap-0 md:grid-cols-[1.3fr_1fr]">
              {/* left: text */}
              <div className="p-10">
                <p className="eyebrow mb-5">
                  <span className="eyebrow-mark">// 01 </span>featured multiverse
                </p>
                <h1 className="font-display text-6xl font-medium leading-[1.02]">
                  {featured.title.split(" ").slice(0, -1).join(" ")}{" "}
                  <span className="accent-word underline-sketch">
                    {featured.title.split(" ").slice(-1)}
                  </span>
                </h1>
                <p className="mt-4 max-w-md text-lg text-body">{featured.description}</p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Button asChild variant="primary" size="lg">
                    <Link href={`/series/${featured.id}`}>Enter the multiverse →</Link>
                  </Button>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    {featured.episodeCount} episodes / {featured.contributorCount} contributors /{" "}
                    {featured.avgRating}★
                  </span>
                </div>
              </div>

              {/* right: decorative generative cover */}
              <div className="relative hidden overflow-hidden border-l border-line md:block">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{ background: `linear-gradient(150deg, ${fg.from}, ${fg.to})` }}
                />
                <div
                  className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
                  style={{ background: fg.from }}
                />
                <svg
                  className="absolute inset-0 h-full w-full opacity-[0.14]"
                  viewBox="0 0 300 300"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M150 300 L150 170 M150 170 L80 100 M150 170 L230 90 M80 100 L40 40 M230 90 L260 30 M150 170 L150 60 M80 100 L120 50"
                    stroke={fg.accent}
                    strokeWidth="2"
                  />
                  {[
                    [150, 170],
                    [80, 100],
                    [230, 90],
                    [40, 40],
                    [260, 30],
                    [150, 60],
                    [120, 50],
                  ].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="5" fill={fg.accent} />
                  ))}
                </svg>
                <div className="absolute inset-0 grid place-items-center p-8 text-center">
                  <span
                    className="font-display text-7xl italic leading-none"
                    style={{ color: fg.accent }}
                  >
                    {fg.glyph}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All series grid */}
        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">
                <span className="eyebrow-mark">// 02 </span>the library
              </p>
              <h2 className="font-display text-3xl font-medium">Explore every multiverse</h2>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by title or genre…"
              aria-label="Filter series"
              className="h-11 w-full max-w-xs border border-line-2 bg-panel px-3 text-sm text-text placeholder:text-muted focus:border-canon focus:outline-none sm:w-72"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted">No series match “{q}”.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {filtered.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
