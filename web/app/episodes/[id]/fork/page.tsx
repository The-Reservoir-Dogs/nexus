"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, MessageSquareQuote, Info } from "lucide-react";
import { forkEpisode } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useFork } from "@/components/ForkProvider";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ForkPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const fork = useFork();

  // If landed directly (no context in memory), rebuild it from the API.
  const { loading } = useAsync(async () => {
    if (!fork.context) {
      const ctx = await forkEpisode(id, "5001");
      fork.setContext(ctx);
      fork.setDrivingReviewId("5001");
    }
    return true;
  }, [id]);

  const ctx = fork.context;

  React.useEffect(() => {
    if (ctx && !fork.whatIf) fork.setWhatIf(ctx.drivingComment?.reviewText.split(".")[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  function goGenerate() {
    router.push(`/episodes/${id}/editor`);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-fork">
          Time Machine · Fork a Decision
        </p>
        {loading || !ctx ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl">
              Rewriting: <span className="text-canon">{ctx.sourceEpisode.title}</span>
            </h1>

            {/* Original decision */}
            <div className="mt-5 rounded-xl border border-line bg-panel p-4">
              <Badge variant="canon">ORIGINAL DECISION</Badge>
              <p className="mt-2 text-text/90">{ctx.decisionPoint}</p>
            </div>

            {/* Editable what-if */}
            <label className="mt-6 block text-sm text-muted" htmlFor="whatif">
              Your “what if…” — the new decision
            </label>
            <input
              id="whatif"
              value={fork.whatIf}
              onChange={(e) => fork.setWhatIf(e.target.value)}
              placeholder="What if she killed him instead?"
              className="mt-1 h-11 w-full rounded-lg border border-fork/40 bg-fork/5 px-3 text-text focus:outline-none focus:ring-2 focus:ring-fork"
            />

            {/* Driving comment */}
            <div className="mt-6">
              <label className="mb-1 flex items-center gap-2 text-sm text-muted">
                <MessageSquareQuote className="h-4 w-4" /> Driving reader comment
              </label>
              <select
                value={fork.drivingReviewId ?? ""}
                onChange={(e) => fork.setDrivingReviewId(e.target.value || null)}
                className="h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm focus:outline-none focus:ring-2 focus:ring-fork"
              >
                <option value="5001">
                  {ctx.drivingComment?.authorName}: {ctx.drivingComment?.reviewText}
                </option>
              </select>
            </div>

            {/* Characters strip */}
            <div className="mt-6">
              <p className="mb-2 text-sm text-muted">
                The AI will keep these characters consistent:
              </p>
              <div className="flex flex-wrap gap-2">
                {ctx.characters.map((c) => (
                  <span
                    key={c.id}
                    title={c.speechStyle ?? ""}
                    className="rounded-full border border-line bg-panel px-3 py-1 text-xs"
                  >
                    <span className="font-medium">{c.name}</span>{" "}
                    <span className="text-muted">· {c.role}</span>
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-6 flex items-center gap-2 text-xs text-muted">
              <Info className="h-3.5 w-3.5" /> Nothing is saved yet — this only assembles context.
            </p>

            <Button
              variant="fork"
              size="lg"
              className="mt-4"
              onClick={goGenerate}
              disabled={!fork.whatIf.trim()}
            >
              <Sparkles className="h-4 w-4" /> Generate Alternate Future
            </Button>
          </>
        )}
      </div>
    </Shell>
  );
}
