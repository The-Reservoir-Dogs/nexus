"use client";
import * as React from "react";
import type { Review } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function ReviewItem({ r, driving }: { r: Review; driving?: boolean }) {
  return (
    <li
      className={cn(
        "rounded-lg border border-line bg-panel p-3",
        driving && "border-l-2 border-l-fork"
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar name={r.authorName ?? "user"} className="h-6 w-6 text-xs" />
        <span className="text-sm font-medium">{r.authorName}</span>
        {driving && <span className="font-mono text-[10px] text-fork">DRIVING COMMENT</span>}
      </div>
      <p className="mt-1.5 text-sm text-text/90">{r.reviewText}</p>
      {r.replies && r.replies.length > 0 && (
        <ul className="mt-2 space-y-2 border-l border-line pl-3">
          {r.replies.map((rep) => (
            <ReviewItem key={rep.id} r={rep} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentThread({
  reviews,
  drivingId,
}: {
  reviews: Review[];
  drivingId?: string;
}) {
  if (reviews.length === 0) return <p className="text-sm text-muted">No comments yet.</p>;
  return (
    <ul className="space-y-2">
      {reviews.map((r) => (
        <ReviewItem key={r.id} r={r} driving={r.id === drivingId} />
      ))}
    </ul>
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
