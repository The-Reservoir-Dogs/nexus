"use client";
import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  avg,
  count,
  onRate,
}: {
  avg: number;
  count: number;
  onRate?: (score: number) => void;
}) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || Math.round(avg);
  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="radiogroup" aria-label="Rate this episode">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={n === Math.round(avg)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate?.(n)}
            className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-canon rounded"
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                n <= shown ? "fill-canon text-canon" : "text-line"
              )}
            />
          </button>
        ))}
      </div>
      <span className="font-mono text-xs text-muted" data-testid="rating-summary">
        {avg.toFixed(1)} · {count} ratings
      </span>
    </div>
  );
}
