"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check } from "lucide-react";
import { getSeriesById, getEpisodes, getEpisodeTimelines, verifyEpisode } from "@/lib/api";
import type { Episode, Series } from "@/lib/types";
import { rankTimelines } from "@/lib/logic";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/components/AuthProvider";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardMeta, CardTitle } from "@/components/ui/Card";

export default function BranchesPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { isOwner } = useAuth();
  const [series, setSeries] = React.useState<Series | null>(null);
  const [branches, setBranches] = React.useState<Episode[]>([]);

  useAsync(async () => {
    const s = await getSeriesById(id);
    setSeries(s ?? null);
    const eps = await getEpisodes(id);
    const decisionEps = eps.filter((e) => e.decisionPoint);
    const forkLists = await Promise.all(decisionEps.map((e) => getEpisodeTimelines(e.id)));
    setBranches(rankTimelines(forkLists.flat()));
    return true;
  }, [id]);

  // owner guard (client-side)
  React.useEffect(() => {
    if (series && !isOwner(series)) router.replace(`/series/${id}`);
  }, [series, isOwner, id, router]);

  async function handleVerify(ep: Episode) {
    await verifyEpisode(ep.id, true);
    setBranches((bs) =>
      rankTimelines(bs.map((b) => (b.id === ep.id ? { ...b, verifiedByAuthor: true } : b)))
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl">
          {series?.title ?? "My Series"} — Branches
        </h1>
        <p className="mt-1 text-sm text-muted">
          Verify a branch to canonize it. Verifying reshuffles the ranking.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="branch-grid">
          {branches.map((b) => (
            <Card key={b.id} className="border-fork/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{b.title}</CardTitle>
                {b.verifiedByAuthor ? (
                  <Badge variant="canon">
                    <BadgeCheck className="h-3.5 w-3.5" /> Canonized
                  </Badge>
                ) : (
                  <Badge variant="fork">{b.avgRating}★</Badge>
                )}
              </div>
              <CardMeta className="mt-1">
                by {b.coAuthorName} · {b.ratingCount} ratings
              </CardMeta>
              <p className="mt-2 text-sm text-muted">{b.summary}</p>
              {!b.verifiedByAuthor && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleVerify(b)}
                >
                  <Check className="h-4 w-4" /> Verify
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  );
}
