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
  bare,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: "canon" | "ai" | "fork";
  children: React.ReactNode;
  footer?: React.ReactNode;
  bare?: boolean;
  className?: string;
}) {
  const dot = accent === "ai" ? "bg-ai" : accent === "fork" ? "bg-fork" : "bg-canon";
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden",
        bare ? "" : "rounded-md border border-line bg-panel",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">{children}</div>
      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </div>
  );
}
