"use client";
import * as React from "react";
import { GitBranch, Reply, Heart } from "lucide-react";
import type { Review } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function ago(iso?: string): string {
  if (!iso) return "just now";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ReviewNode({
  r,
  driving,
  onReply,
  onBranch,
}: {
  r: Review;
  driving?: boolean;
  onReply?: (parentId: string, text: string) => void;
  onBranch?: (review: Review) => void;
}) {
  const [replying, setReplying] = React.useState(false);
  const [liked, setLiked] = React.useState(false);
  const [text, setText] = React.useState("");
  const hasKids = !!r.replies && r.replies.length > 0;

  return (
    <div className="relative">
      <div className="flex gap-2.5">
        <Avatar name={r.authorName ?? "user"} className="h-7 w-7 shrink-0 text-[11px] ring-2 ring-panel" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-semibold text-text">{r.authorName}</span>
            {driving && (
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-fork">
                driving comment
              </span>
            )}
            <span className="text-[11px] text-muted">{ago(r.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-body">{r.reviewText}</p>

          <div className="mt-1 flex items-center gap-4 text-[11px] text-muted">
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="inline-flex items-center gap-1 transition-colors hover:text-fork"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              className={cn("inline-flex items-center gap-1 transition-colors hover:text-canon", liked && "text-canon")}
            >
              <Heart className={cn("h-3 w-3", liked && "fill-canon")} /> Like
            </button>
            {onBranch && (
              <button
                type="button"
                onClick={() => onBranch(r)}
                className="inline-flex items-center gap-1 transition-colors hover:text-fork"
              >
                <GitBranch className="h-3 w-3" /> Create branch
              </button>
            )}
          </div>

          {replying && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                onReply?.(r.id, text.trim());
                setText("");
                setReplying(false);
              }}
            >
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Reply to ${r.authorName}…`}
                aria-label="Write a reply"
                className="h-8 flex-1 rounded-md border border-line-2 bg-ink px-3 text-[13px] text-text placeholder:text-muted focus:border-fork/60 focus:outline-none"
              />
              <Button type="submit" variant="fork" size="sm" disabled={!text.trim()}>
                Reply
              </Button>
            </form>
          )}

          {hasKids && (
            <div className="relative mt-3 space-y-3 pl-4">
              <span className="absolute left-[13px] top-1 bottom-1 w-px bg-line" aria-hidden />
              {r.replies!.map((rep) => (
                <ReviewNode key={rep.id} r={rep} onReply={onReply} onBranch={onBranch} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentThread({
  reviews,
  drivingId,
  onReply,
  onBranch,
}: {
  reviews: Review[];
  drivingId?: string;
  onReply?: (parentId: string, text: string) => void;
  onBranch?: (review: Review) => void;
}) {
  if (reviews.length === 0) return <p className="text-sm text-muted">No comments yet.</p>;
  return (
    <div className="space-y-5">
      {reviews.map((r) => (
        <ReviewNode key={r.id} r={r} driving={r.id === drivingId} onReply={onReply} onBranch={onBranch} />
      ))}
    </div>
  );
}

export function CommentComposer({ onPost }: { onPost: (text: string) => void }) {
  const [text, setText] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onPost(text.trim());
        setText("");
      }}
      className="space-y-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your view — it may steer the next timeline…"
        aria-label="Write a comment"
        rows={3}
        className="w-full resize-none rounded-lg border border-line bg-panel p-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fork"
      />
      <Button type="submit" variant="fork" size="sm" disabled={!text.trim()}>
        Post comment
      </Button>
    </form>
  );
}
