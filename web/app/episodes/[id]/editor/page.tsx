"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Pencil, X, Columns2, Send } from "lucide-react";
import { generate, approveEpisode, forkEpisode, type Draft } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useFork } from "@/components/ForkProvider";
import { Shell } from "@/components/layout/Shell";
import { Manuscript } from "@/components/editor/Manuscript";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type ChatMsg = { role: "user" | "ai"; text: string };

export default function EditorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const fork = useFork();

  // rebuild context if landed directly
  useAsync(async () => {
    if (!fork.context) {
      const ctx = await forkEpisode(id, "5001");
      fork.setContext(ctx);
      fork.setDrivingReviewId("5001");
      fork.setWhatIf("What if she killed him instead?");
    }
    return true;
  }, [id]);

  const [manuscript, setManuscript] = React.useState("");
  const [chat, setChat] = React.useState<ChatMsg[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const runGenerate = React.useCallback(
    async (extra?: string) => {
      setGenerating(true);
      setManuscript("");
      setChat((c) => [
        ...c,
        { role: "user", text: extra ?? (fork.whatIf || "Generate the alternate future.") },
        { role: "ai", text: "" },
      ]);
      const gen = generate({
        sourceEpisodeId: id,
        decisionPoint: fork.whatIf || "What if she killed him instead?",
        drivingReviewId: fork.drivingReviewId ?? undefined,
        instructions: extra,
      });
      let acc = "";
      let res = await gen.next();
      while (!res.done) {
        acc += res.value;
        setManuscript(acc);
        setChat((c) => {
          const copy = [...c];
          copy[copy.length - 1] = { role: "ai", text: acc };
          return copy;
        });
        res = await gen.next();
      }
      const draft = res.value as Draft;
      fork.setDraft({ ...draft, content: acc });
      setGenerating(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, fork.whatIf, fork.drivingReviewId]
  );

  // auto-generate on first mount once context is ready
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!started.current && fork.context) {
      started.current = true;
      runGenerate();
    }
  }, [fork.context, runGenerate]);

  async function handleApprove() {
    const src = fork.context?.sourceEpisode;
    if (!src) return;
    const created = await approveEpisode({
      seriesId: src.seriesId,
      seasonId: src.seasonId,
      forkedFromEpisodeId: src.id,
      decisionPoint: fork.whatIf,
      title: fork.draft?.title ?? "Untitled Alternate",
      content: manuscript,
      summary: fork.draft?.summary ?? "",
    });
    router.push(`/episodes/${created.id}`);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="fork">Episode — Alternate</Badge>
          <span className="text-sm text-muted">{fork.whatIf}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => router.push(`/episodes/${id}/split`)}
          >
            <Columns2 className="h-4 w-4" /> Compare with Original
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Manuscript */}
          <div className="h-[70vh]">
            <Manuscript value={manuscript} onChange={setManuscript} />
          </div>

          {/* AI chat panel */}
          <div className="flex h-[70vh] flex-col rounded-lg border border-line bg-panel">
            <div className="border-b border-line px-3 py-2 text-sm font-medium">
              AI Co-Author
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3" data-testid="chat">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg bg-fork/20 p-2 text-sm"
                      : "max-w-[90%] rounded-lg bg-panel-2 p-2 text-sm text-text/90"
                  }
                >
                  {m.role === "ai" && (
                    <span className="mb-1 block font-mono text-[10px] text-fork">DRAFT</span>
                  )}
                  {m.text || (generating ? "…" : "")}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!instruction.trim()) return;
                runGenerate(instruction.trim());
                setInstruction("");
              }}
              className="flex gap-2 border-t border-line p-2"
            >
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ask the AI… e.g. make it darker"
                aria-label="Instruct the AI"
                className="h-9 flex-1 rounded-lg border border-line bg-ink px-3 text-sm focus:outline-none focus:ring-2 focus:ring-fork"
              />
              <Button type="submit" variant="ghost" size="icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {/* HITL controls */}
            <div className="flex items-center gap-2 border-t border-line p-2">
              <Button variant="success" size="sm" onClick={handleApprove} disabled={generating}>
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => router.push(`/episodes/${id}`)}
              >
                <X className="h-4 w-4" /> Reject
              </Button>
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
                <Sparkles className="h-3 w-3" /> nothing saved until Approve
              </span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
