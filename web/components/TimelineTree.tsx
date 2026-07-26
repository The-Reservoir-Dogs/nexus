"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, GitBranch, Star } from "lucide-react";
import type { Episode } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

export type TimelineTreeProps = {
  /** canonical episodes = the sacred timeline, ordered */
  episodes: Episode[];
  /** forks keyed by the decision-point episode id (already ranked) */
  forksByEpisode: Record<string, Episode[]>;
};

export function TimelineTree({ episodes, forksByEpisode }: TimelineTreeProps) {
  return (
    <ol className="relative space-y-6 pl-8" aria-label="Story timeline">
      {/* the sacred gold line */}
      <span
        className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-canon/70 to-canon/10"
        aria-hidden
      />
      {episodes.map((ep) => {
        const forks = forksByEpisode[ep.id] ?? [];
        return (
          <li key={ep.id} className="relative">
            <span
              className="absolute -left-[1.35rem] top-1 grid h-6 w-6 place-items-center rounded-full border border-canon/50 bg-ink font-mono text-xs text-canon"
              aria-hidden
            >
              {ep.orderIndex}
            </span>
            <Link
              href={`/episodes/${ep.id}`}
              className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-panel-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-canon"
            >
              <span className="font-medium text-text">{ep.title}</span>
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-muted">
                <Star className="h-3 w-3 fill-canon text-canon" /> {ep.avgRating}
              </span>
            </Link>

            {/* violet branches at the decision point */}
            {forks.length > 0 && (
              <ul className="mt-2 space-y-2 border-l border-fork/40 pl-4">
                {forks.map((f) => (
                  <motion.li
                    key={f.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Link
                      href={`/episodes/${f.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-fork/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-fork"
                    >
                      <GitBranch className="h-3.5 w-3.5 text-fork" />
                      <span className="text-sm text-text">{f.title}</span>
                      {f.verifiedByAuthor && (
                        <span
                          className="inline-flex items-center gap-0.5 text-canon"
                          title="Verified by author"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <Badge variant="fork" className="ml-auto">
                        {f.avgRating}★
                      </Badge>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
