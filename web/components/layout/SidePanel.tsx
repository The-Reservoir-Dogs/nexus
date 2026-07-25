"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The reused right-column shell (UX_PLAN §3): header + scrollable body + optional footer.
 * Reader passes the comment thread; editor passes the agent chat/tool-call stream.
 */
export function SidePanel({
  title,
  icon,
  accent = "canon",
  children,
  footer,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: "canon" | "ai" | "fork";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const dot = accent === "ai" ? "bg-ai" : accent === "fork" ? "bg-fork" : "bg-canon";
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-panel",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {icon}
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-4">{children}</div>
      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </div>
  );
}
