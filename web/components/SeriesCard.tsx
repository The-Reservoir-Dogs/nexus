"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, GitBranch, Users, ArrowUpRight } from "lucide-react";
import type { Series } from "@/lib/types";
import { genreStyle } from "@/lib/genre";
import { Badge } from "@/components/ui/Badge";

export function SeriesCard({ series }: { series: Series }) {
  const g = genreStyle(series.genre);
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative"
    >
      <Link
        href={`/series/${series.id}`}
        className="block overflow-hidden border border-line bg-panel shadow-card transition-colors group-hover:border-canon/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-canon"
      >
        {/* Cover */}
        <div className="relative aspect-[3/4] overflow-hidden border-b border-line">
          {/* genre gradient wash */}
          <div
            className="absolute inset-0 opacity-[0.14] transition-opacity duration-300 group-hover:opacity-25"
            style={{ background: `linear-gradient(150deg, ${g.from}, ${g.to})` }}
          />
          {/* corner glow */}
          <div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
            style={{ background: g.from }}
          />
          {/* branching motif (multiverse) */}
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.10]"
            viewBox="0 0 200 260"
            fill="none"
            aria-hidden
          >
            <path
              d="M100 250 L100 150 M100 150 L60 90 M100 150 L150 80 M60 90 L40 40 M150 80 L170 30 M100 150 L100 60"
              stroke={g.accent}
              strokeWidth="1.5"
            />
            {[
              [100, 150],
              [60, 90],
              [150, 80],
              [40, 40],
              [170, 30],
              [100, 60],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="3.5" fill={g.accent} />
            ))}
          </svg>

          {/* spine accent */}
          <div className="absolute left-0 top-0 h-full w-1" style={{ background: g.accent }} />

          {/* badges */}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Badge variant="canon">Canon</Badge>
          </div>
          <span
            className="absolute right-3 top-3 font-display text-2xl leading-none"
            style={{ color: g.accent }}
            aria-hidden
          >
            {g.glyph}
          </span>

          {/* title */}
          <div className="absolute inset-x-0 bottom-0 flex items-end p-5">
            <h3 className="font-display text-[28px] font-medium italic leading-[1.05] text-text">
              {series.title}
            </h3>
          </div>

          {/* hover reveal */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span
              className="inline-flex items-center gap-1 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ borderColor: g.accent, color: g.accent, background: "rgba(11,11,15,0.82)" }}
            >
              Read <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* meta footer */}
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text">
              by {series.authorName}
            </span>
            <Badge variant="neutral">{series.genre}</Badge>
          </div>
          <p className="flex items-center gap-3 font-mono text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> {series.episodeCount} eps
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {series.contributorCount}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-canon">
              <Star className="h-3 w-3 fill-canon" /> {series.avgRating}
            </span>
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
