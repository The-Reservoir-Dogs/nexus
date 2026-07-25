"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, GitBranch, Users } from "lucide-react";
import type { Series } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

export function SeriesCard({ series }: { series: Series }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="w-56 shrink-0"
    >
      <Link
        href={`/series/${series.id}`}
        className="group block overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition-colors hover:border-fork/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-fork"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-panel-2 via-panel to-ink">
          <div className="absolute inset-0 bg-aurora-soft opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="radial-glow absolute inset-0 opacity-70" />
          <div className="absolute inset-0 grid place-items-center p-5 text-center">
            <span className="font-display text-3xl italic leading-tight text-text/95">
              {series.title}
            </span>
          </div>
          <div className="absolute left-3 top-3">
            <Badge variant="canon">Canon</Badge>
          </div>
        </div>
        <div className="space-y-1.5 p-3">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium text-text">{series.title}</span>
            <Badge variant="neutral">{series.genre}</Badge>
          </div>
          <p className="flex items-center gap-3 font-mono text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> {series.episodeCount} eps
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {series.contributorCount}
            </span>
            <span className="inline-flex items-center gap-1 text-canon">
              <Star className="h-3 w-3 fill-canon" /> {series.avgRating}
            </span>
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
