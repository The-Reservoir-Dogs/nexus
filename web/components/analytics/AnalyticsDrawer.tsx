"use client";
import * as React from "react";
import { X } from "lucide-react";
import { AnalyticsPanel } from "./AnalyticsPanel";

// Right-side drawer over the reader (reader stays mounted underneath).
export function AnalyticsDrawer({
  episodeId,
  title,
  open,
  onClose,
}: {
  episodeId: string;
  title?: string;
  open: boolean;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Audience retention">
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto scroll-thin border-l border-line bg-panel p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <span className="eyebrow">analytics</span>
          <button
            onClick={onClose}
            aria-label="Close analytics"
            className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AnalyticsPanel episodeId={episodeId} title={title} />
      </aside>
    </div>
  );
}
