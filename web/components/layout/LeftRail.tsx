"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, GitBranch } from "lucide-react";
import type { Episode } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Reader/editor left column: home link, season dropdown, episode list (current highlighted). */
export function LeftRail({
  episodes,
  currentId,
  seasonTitle = "Season 1",
}: {
  episodes: Episode[];
  currentId: string;
  seasonTitle?: string;
}) {
  return (
    <aside className="flex h-full flex-col gap-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-canon"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> home
      </Link>

      <div className="flex items-center justify-between rounded-[10px] border border-line-2 bg-panel-2 px-3 py-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-text">{seasonTitle}</span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto scroll-thin pr-1">
        {episodes.map((ep, i) => {
          const active = ep.id === currentId;
          return (
            <Link
              key={ep.id}
              href={`/episodes/${ep.id}`}
              className={cn(
                "block rounded-[10px] px-3 py-2 text-sm transition-colors",
                active
                  ? "border border-canon/40 bg-canon/10 text-text"
                  : "border border-transparent text-muted hover:bg-panel-2 hover:text-text"
              )}
            >
              <span className="font-mono text-[10px] text-muted">EP {i + 1}</span>
              <span className="mt-0.5 block truncate leading-snug">{ep.title}</span>
              {ep.decisionPoint && (
                <span className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-fork">
                  <GitBranch className="h-2.5 w-2.5" /> decision point
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
