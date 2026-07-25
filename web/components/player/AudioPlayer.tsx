"use client";
import * as React from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  title,
  onPrev,
  onNext,
  onGenerate,
  generating,
  bare,
  className,
}: {
  src?: string | null;
  title?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onGenerate?: () => void;
  generating?: boolean;
  bare?: boolean;
  className?: string;
}) {
  const shell = bare
    ? "flex items-center gap-3 px-1"
    : "flex items-center gap-3 rounded-md border border-line bg-panel px-3 py-2";
  const ref = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [dur, setDur] = React.useState(0);

  React.useEffect(() => {
    setPlaying(false);
    setCur(0);
  }, [src]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  // No audio yet — offer to generate narration.
  if (!src) {
    return (
      <div className={cn(shell, className)}>
        <Volume2 className="h-4 w-4 text-muted" />
        <span className="text-sm text-muted">No narration yet.</span>
        <button
          onClick={onGenerate}
          disabled={generating || !onGenerate}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-ai/40 bg-ai/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ai transition-colors hover:bg-ai/25 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
          {generating ? "Generating…" : "Generate narration"}
        </button>
      </div>
    );
  }

  return (
    <div className={cn(shell, className)}>
      <audio
        ref={ref}
        src={src}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="Previous episode"
        className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-text disabled:opacity-30"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="grid h-10 w-10 place-items-center rounded-full bg-canon text-ink shadow-cta transition-transform hover:scale-105"
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
      </button>
      <button
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next episode"
        className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:text-text disabled:opacity-30"
      >
        <SkipForward className="h-4 w-4" />
      </button>

      <div className="ml-1 min-w-0 flex-1">
        {title && <div className="truncate text-xs text-muted">{title}</div>}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tabular-nums text-muted">{fmt(cur)}</span>
          <input
            type="range"
            min={0}
            max={dur || 0}
            value={cur}
            step={0.1}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (ref.current) ref.current.currentTime = t;
              setCur(t);
            }}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line-2 accent-canon"
            aria-label="Seek"
          />
          <span className="font-mono text-[10px] tabular-nums text-muted">{fmt(dur)}</span>
        </div>
      </div>
    </div>
  );
}
