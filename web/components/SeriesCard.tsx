"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, GitBranch, Users } from "lucide-react";
import type { Series } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

export function SeriesCard({ series }: { series: Series }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="w-60 shrink-0"
    >
      <Link
        href={`/series/${series.id}`}
        className="group block overflow-hidden border border-line bg-panel shadow-card transition-colors hover:border-canon/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-canon"
      >
        <div className="relative aspect-[3/4] overflow-hidden border-b border-line bg-panel-2">
          <div className="paper-glow absolute inset-0" />
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <span className="font-display text-3xl italic leading-tight text-text">
              {series.title}
            </span>
          </div>
          <div className="absolute left-3 top-3">
            <Badge variant="canon">Canon</Badge>
          </div>
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-text">{series.title}</span>
            <Badge variant="neutral">{series.genre}</Badge>
          </div>
          <p className="flex items-center gap-3 font-mono text-[11px] text-muted">
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
