"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { CornerDownRight } from "lucide-react";
import type { Character } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

export type SplitViewProps = {
  drivingComment: string;
  originalTitle: string;
  originalContent: string;
  alternateTitle: string;
  alternateContent: string;
  streaming?: boolean;
  /** a character whose consistent behavior we highlight */
  consistentCharacter?: Character | null;
  scores?: { continuity: number; character: number };
};

export function SplitView({
  drivingComment,
  originalTitle,
  originalContent,
  alternateTitle,
  alternateContent,
  streaming = false,
  consistentCharacter,
  scores = { continuity: 4.6, character: 4.8 },
}: SplitViewProps) {
  return (
    <div className="space-y-4">
      {/* Banner + driving comment */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">Timeline regenerated</h2>
        <span className="rounded-full border border-fork/40 bg-fork/15 px-3 py-1 text-sm text-fork">
          “{drivingComment}”
        </span>
      </div>

      {/* Two panels */}
      <div className="grid gap-0 overflow-hidden rounded-xl border border-line md:grid-cols-2">
        {/* Original */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r">
          <Badge variant="canon">Original Timeline</Badge>
          <h3 className="mt-2 font-display text-xl">{originalTitle}</h3>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
            {originalContent.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {/* Alternate */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="bg-fork/[0.06] p-5"
        >
          <Badge variant="fork">Alternate Timeline</Badge>
          <h3 className="mt-2 font-display text-xl">{alternateTitle}</h3>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-text/90" data-testid="alt-content">
            {alternateContent.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {streaming && <span className="inline-block h-4 w-2 animate-pulse bg-fork align-middle" />}
          </div>

          {/* consistency callout */}
          {consistentCharacter && !streaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 flex items-start gap-2 rounded-lg border border-canon/30 bg-canon/10 p-2 text-xs text-canon"
            >
              <CornerDownRight className="mt-0.5 h-3.5 w-3.5" />
              <span>
                <b>{consistentCharacter.name}</b> stays consistent — same “
                {consistentCharacter.speechStyle}” voice as the original.
              </span>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* score chip */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-xs text-muted"
          data-testid="score-chip"
        >
          MLflow · Continuity {scores.continuity}/5 · Character {scores.character}/5
        </span>
      </div>
    </div>
  );
}
