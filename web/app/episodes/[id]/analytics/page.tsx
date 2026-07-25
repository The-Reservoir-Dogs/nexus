"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, TrendingDown, Users, Clock } from "lucide-react";
import { getEpisode, getSeriesById } from "@/lib/api";
import type { Episode, Series } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/components/AuthProvider";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

// Demo retention curve (10s buckets, % of listeners still present). Wire to
// GET /api/episodes/:id/retention (episode_retention view) at integration.
const RETENTION = [100, 98, 95, 91, 88, 79, 74, 71, 68, 61, 44, 41, 39, 37, 35, 33];
const DROPOFF_BUCKET = 9; // biggest cliff (61% → 44%)

function RetentionChart({ data }: { data: number[] }) {
  const w = 720;
  const h = 240;
  const pad = 28;
  const max = 100;
  const step = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
  const cliffX = pad + DROPOFF_BUCKET * step;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="ret" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D9A441" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D9A441" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => {
        const y = h - pad - (g / max) * (h - pad * 2);
        return (
          <g key={g}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#2A2A36" strokeWidth="1" />
            <text x={4} y={y + 3} fill="#9A968C" fontSize="9" fontFamily="monospace">{g}%</text>
          </g>
        );
      })}
      {/* dropoff marker */}
      <line x1={cliffX} y1={pad} x2={cliffX} y2={h - pad} stroke="#E5484D" strokeWidth="1" strokeDasharray="4 4" />
      <text x={cliffX + 4} y={pad + 10} fill="#E5484D" fontSize="9" fontFamily="monospace">drop-off</text>
      <path d={area} fill="url(#ret)" />
      <path d={line} fill="none" stroke="#D9A441" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#D9A441" />
      ))}
    </svg>
  );
}

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
          <>
            <div className="mt-4 mb-5">
              <p className="eyebrow mb-1">Audience retention</p>
              <h1 className="text-xl font-semibold text-text">{episode.title}</h1>
            </div>

            {/* headline stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Users, label: "Plays", value: "1,284" },
                { icon: Clock, label: "Avg. listen", value: "2:41" },
                { icon: TrendingDown, label: "Completion", value: "33%" },
              ].map(({ icon: Icon, label, value }) => (
                <Card key={label} className="p-4">
                  <Icon className="h-4 w-4 text-canon" />
                  <div className="mt-2 font-display text-2xl text-text">{value}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</div>
                </Card>
              ))}
            </div>

            {/* retention curve */}
            <Card className="mt-4 p-5">
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text">Retention curve</h2>
              <RetentionChart data={RETENTION} />
            </Card>

            {/* AI insight (wire to POST /api/analyze SSE) */}
            <div className="mt-4 rounded-[14px] border border-ai/40 bg-ai/10 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ai" />
                <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ai">AI insight</h2>
              </div>
              <p className="prose-story text-[16px] leading-relaxed">
                61% of listeners drop off around the <span className="text-canon">2:10 mark</span> — right after
                the mentor’s death is revealed but before Aldric acts. The scene lingers in reflection too long.
                Consider tightening the internal monologue and cutting to the decision faster; the next generation
                will be conditioned to raise tension through this beat.
              </p>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
