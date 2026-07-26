"use client";
import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  avg,
  count,
  value,
  onRate,
}: {
  avg: number;
  count: number;
  value?: number;
  onRate?: (score: number) => void;
}) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value || Math.round(avg);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted">Rate</span>
      <div className="flex" role="radiogroup" aria-label="Rate this episode">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={n === (value || Math.round(avg))}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate?.(n)}
            className="p-px focus:outline-none focus-visible:ring-2 focus-visible:ring-canon rounded"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                n <= shown ? "fill-canon text-canon" : "text-line hover:text-canon/50"
              )}
            />
          </button>
        ))}
      </div>
      <span className="font-mono text-[11px] text-muted" data-testid="rating-summary">
        {avg.toFixed(1)} · {count}
      </span>
    </div>
  );
}
