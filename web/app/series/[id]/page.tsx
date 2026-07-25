"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { getEpisodes } from "@/lib/api";
import { Shell } from "@/components/layout/Shell";

/**
 * The standalone series page was removed — season/episode/branch navigation now lives
 * in the reader's tree view. Entering a series opens its first canonical episode.
 */
export default function SeriesRedirect({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  React.useEffect(() => {
    getEpisodes(id).then((eps) => {
      const first = eps.find((e) => e.isCanonical) ?? eps[0];
      router.replace(first ? `/episodes/${first.id}` : "/");
    });
  }, [id, router]);

  return (
    <Shell>
      <div className="grid h-[calc(100vh-48px)] place-items-center text-sm text-muted">
        Opening series…
      </div>
    </Shell>
  );
}
