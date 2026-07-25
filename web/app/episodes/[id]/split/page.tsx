"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { generate, forkEpisode, approveEpisode, type Draft } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useFork } from "@/components/ForkProvider";
import { Shell } from "@/components/layout/Shell";
import { SplitView } from "@/components/SplitView";
import { Button } from "@/components/ui/Button";

export default function SplitPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const fork = useFork();

  useAsync(async () => {
    if (!fork.context) {
      const ctx = await forkEpisode(id, "5001");
      fork.setContext(ctx);
      fork.setWhatIf("What if she killed him instead?");
    }
    return true;
  }, [id]);

  const [alt, setAlt] = React.useState(fork.draft?.content ?? "");
  const [streaming, setStreaming] = React.useState(!fork.draft);
  const [draft, setLocalDraft] = React.useState<Draft | null>(fork.draft);

  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current || !fork.context) return;
    started.current = true;
    if (fork.draft) {
      setAlt(fork.draft.content);
      setStreaming(false);
      return;
    }
    (async () => {
      const gen = generate({
        sourceEpisodeId: id,
        decisionPoint: fork.whatIf || "What if she killed him instead?",
      });
      let acc = "";
      let res = await gen.next();
      while (!res.done) {
        acc += res.value;
        setAlt(acc);
        res = await gen.next();
      }
      const d = res.value as Draft;
      setLocalDraft({ ...d, content: acc });
      fork.setDraft({ ...d, content: acc });
      setStreaming(false);
    })();
  }, [fork.context]); // eslint-disable-line react-hooks/exhaustive-deps

  const src = fork.context?.sourceEpisode;
  const consistent = fork.context?.characters.find((c) => c.name === "Lady Corvin") ?? null;

  async function handleApprove() {
    if (!src) return;
    const created = await approveEpisode({
      seriesId: src.seriesId,
      seasonId: src.seasonId,
      forkedFromEpisodeId: src.id,
      decisionPoint: fork.whatIf,
      title: draft?.title ?? "The Fallen Blade",
      content: alt,
      summary: draft?.summary ?? "",
    });
    router.push(`/episodes/${created.id}`);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <SplitView
          drivingComment={fork.whatIf || "What if she killed him instead?"}
          originalTitle={src?.title ?? "Original"}
          originalContent={src?.content ?? ""}
          alternateTitle={draft?.title ?? "The Fallen Blade"}
          alternateContent={alt}
          streaming={streaming}
          consistentCharacter={consistent}
        />
        <div className="mt-5 flex items-center gap-3">
          <Button variant="success" onClick={handleApprove} disabled={streaming}>
            <Check className="h-4 w-4" /> Approve this timeline
          </Button>
          <Button variant="outline" onClick={() => router.push(`/episodes/${id}/editor`)}>
            <Pencil className="h-4 w-4" /> Edit in Co-Author Editor
          </Button>
        </div>
      </div>
    </Shell>
  );
}
