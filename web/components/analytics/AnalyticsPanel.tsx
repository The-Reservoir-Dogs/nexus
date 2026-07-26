"use client";
import * as React from "react";
import { Sparkles, TrendingDown, Users, Clock } from "lucide-react";
import { getRetention, analyze } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function RetentionChart({ retention, dropoffBucket }: { retention: number[]; dropoffBucket: number }) {
  const data = retention;
  const w = 720, h = 240, pad = 28, max = 100;
  const DROPOFF_BUCKET = dropoffBucket;
  const step = (w - pad * 2) / Math.max(data.length - 1, 1);
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
      {DROPOFF_BUCKET >= 0 && (
        <>
          <line x1={cliffX} y1={pad} x2={cliffX} y2={h - pad} stroke="#E5484D" strokeWidth="1" strokeDasharray="4 4" />
          <text x={cliffX + 4} y={pad + 10} fill="#E5484D" fontSize="9" fontFamily="monospace">drop-off</text>
        </>
      )}
      <path d={area} fill="url(#ret)" />
      <path d={line} fill="none" stroke="#D9A441" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#D9A441" />)}
    </svg>
  );
}

export function AnalyticsPanel({ episodeId, title }: { episodeId: string; title?: string }) {
  const { data: retention, loading } = useAsync(() => getRetention(episodeId), [episodeId]);
  const [insight, setInsight] = React.useState("");

  const curvePct = (retention?.curve ?? []).map((p) => Math.round(p.retention * 100));
  const dropoffBucket = retention?.dropoff?.bucket10s ?? -1;
  const hasData = (retention?.plays ?? 0) > 0 && curvePct.length > 0;

  // stream the AI insight once retention shows data
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!hasData || started.current) return;
    started.current = true;
    (async () => {
      let acc = "";
      const gen = analyze(episodeId);
      let res = await gen.next();
      while (!res.done) { acc += res.value; setInsight(acc); res = await gen.next(); }
    })();
  }, [hasData, episodeId]);

  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow mb-1">Audience retention</p>
        {title && <h1 className="text-xl font-semibold text-text">{title}</h1>}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !hasData ? (
        <p className="mt-10 text-center text-muted">Not enough plays yet to chart retention.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: "Plays", value: retention!.plays.toLocaleString() },
              { icon: Clock, label: "Avg. listen", value: fmtDuration(retention!.avgListenMs) },
              { icon: TrendingDown, label: "Completion", value: `${Math.round(retention!.completionRate * 100)}%` },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label} className="p-4">
                <Icon className="h-4 w-4 text-canon" />
                <div className="mt-2 font-display text-2xl text-text">{value}</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</div>
              </Card>
            ))}
          </div>

          <Card className="mt-4 p-5">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text">Retention curve</h2>
            <RetentionChart retention={curvePct} dropoffBucket={dropoffBucket} />
          </Card>

          <div className="mt-4 rounded-[14px] border border-ai/40 bg-ai/10 p-5" data-testid="ai-insight">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ai" />
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ai">AI insight</h2>
            </div>
            <p className="prose-story text-[16px] leading-relaxed">
              {insight || (
                <span className="inline-flex gap-1">
                  <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai" />
                  <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai [animation-delay:0.15s]" />
                  <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai [animation-delay:0.3s]" />
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
