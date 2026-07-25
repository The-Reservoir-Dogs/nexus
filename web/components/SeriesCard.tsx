"use client";
import Link from "next/link";
import { Star, GitBranch, Users, BookText } from "lucide-react";
import type { Series } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

export function SeriesCard({ series }: { series: Series }) {
  return (
    <Link
      href={`/series/${series.id}`}
      className="group block rounded-md border border-line bg-panel p-3 transition-colors hover:border-line-2 hover:bg-panel-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-fork/50"
    >
      <div className="flex items-center gap-2">
        <BookText className="h-4 w-4 shrink-0 text-fork" />
        <span className="truncate text-[15px] font-semibold text-fork group-hover:underline">
          {series.title}
        </span>
        {series.genre && <Badge variant="neutral" className="ml-auto">{series.genre}</Badge>}
      </div>
      {series.description && (
        <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{series.description}</p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>by {series.authorName}</span>
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3 w-3" /> {series.episodeCount} eps
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {series.contributorCount}
        </span>
        <span className="inline-flex items-center gap-1 text-canon">
          <Star className="h-3 w-3 fill-canon" /> {series.avgRating}
        </span>
      </div>
    </Link>
  );
}
