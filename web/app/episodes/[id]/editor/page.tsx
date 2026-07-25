"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Check, X, Columns2, Send, Bot, ArrowLeft } from "lucide-react";
import { generate, approveEpisode, forkEpisode, getEpisodes, getEpisodeTimelines, type Draft } from "@/lib/api";
import type { Episode } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useFork } from "@/components/ForkProvider";
import { Shell } from "@/components/layout/Shell";
import { SeasonTree } from "@/components/reader/SeasonTree";
import { SidePanel } from "@/components/layout/SidePanel";
import { Manuscript } from "@/components/editor/Manuscript";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type ChatMsg = { role: "user" | "ai"; text: string };

export default function EditorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const fork = useFork();

  useAsync(async () => {
    if (!fork.context) {
      const ctx = await forkEpisode(id, "5001");
      fork.setContext(ctx);
      fork.setDrivingReviewId("5001");
      fork.setWhatIf("What if she killed him instead?");
    }
    return true;
  }, [id]);

  const [siblings, setSiblings] = React.useState<Episode[]>([]);
  const [branchesByEp, setBranchesByEp] = React.useState<Record<string, Episode[]>>({});
  React.useEffect(() => {
    const sid = fork.context?.sourceEpisode?.seriesId;
    if (!sid) return;
    getEpisodes(sid).then(async (eps) => {
      setSiblings(eps);
      const entries = await Promise.all(eps.map(async (e) => [e.id, await getEpisodeTimelines(e.id)] as const));
      setBranchesByEp(Object.fromEntries(entries));
    });
  }, [fork.context?.sourceEpisode?.seriesId]);

  const [manuscript, setManuscript] = React.useState("");
  const [chat, setChat] = React.useState<ChatMsg[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const chatEnd = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { chatEnd.current?.scrollIntoView?.({ behavior: "smooth" }); }, [chat]);

  const runGenerate = React.useCallback(
    async (extra?: string) => {
      setGenerating(true);
      setManuscript("");
      setChat((c) => [...c,
        { role: "user", text: extra ?? (fork.whatIf || "Generate the alternate future.") },
        { role: "ai", text: "" }]);
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
        setChat((c) => { const copy = [...c]; copy[copy.length - 1] = { role: "ai", text: acc }; return copy; });
        res = await gen.next();
      }
      fork.setDraft({ ...(res.value as Draft), content: acc });
      setGenerating(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, fork.whatIf, fork.drivingReviewId]
  );

  const started = React.useRef(false);
  React.useEffect(() => {
    if (!started.current && fork.context) { started.current = true; runGenerate(); }
  }, [fork.context, runGenerate]);

  async function handleApprove() {
    const src = fork.context?.sourceEpisode;
    if (!src) return;
    const created = await approveEpisode({
      seriesId: src.seriesId, seasonId: src.seasonId, forkedFromEpisodeId: src.id,
      decisionPoint: fork.whatIf, title: fork.draft?.title ?? "Untitled Alternate",
      content: manuscript, summary: fork.draft?.summary ?? "",
    });
    router.push(`/episodes/${created.id}`);
  }

  return (
    <Shell>
      <div className="grid h-[calc(100vh-48px)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        {/* Left: tree */}
        <nav className="hidden min-h-0 flex-col overflow-y-auto scroll-thin border-r border-line p-2 lg:flex">
          <Link href={`/episodes/${id}`} className="mb-1 inline-flex items-center gap-1.5 px-2 py-1 text-[12px] text-muted hover:text-fork">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to episode
          </Link>
          {siblings.length > 0 && (
            <SeasonTree episodes={siblings} branchesByEpisode={branchesByEp} currentId={id} />
          )}
        </nav>

        {/* Center: manuscript */}
        <section className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <Badge variant="fork">editing branch</Badge>
            <span className="truncate text-[13px] text-muted">{fork.whatIf}</span>
            <Button variant="pill" size="sm" className="ml-auto" onClick={() => router.push(`/episodes/${id}/split`)}>
              <Columns2 className="h-3.5 w-3.5" /> Split view
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <Manuscript value={manuscript} onChange={setManuscript} />
          </div>
          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <Button variant="primary" size="sm" onClick={handleApprove} disabled={generating}>
              <Check className="h-3.5 w-3.5" /> Approve &amp; publish
            </Button>
            <Button variant="danger" size="sm" onClick={() => router.push(`/episodes/${id}`)}>
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
              <Sparkles className="h-3 w-3" /> nothing saved until approve
            </span>
          </div>
        </section>

        {/* Right: agent chat */}
        <div className="hidden min-h-0 border-l border-line lg:block">
          <SidePanel
            bare
            title="AI Co-Author"
            accent="ai"
            icon={<Bot className="h-3.5 w-3.5 text-ai" />}
            footer={
              <form
                onSubmit={(e) => { e.preventDefault(); if (!instruction.trim() || generating) return; runGenerate(instruction.trim()); setInstruction(""); }}
                className="flex gap-2"
              >
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Direct the co-author… e.g. make it darker"
                  aria-label="Instruct the AI"
                  className="h-8 flex-1 rounded-md border border-line-2 bg-ink px-3 text-[13px] text-text placeholder:text-muted focus:border-ai/60 focus:outline-none"
                />
                <Button type="submit" variant="ai" size="icon" aria-label="Send" disabled={generating}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            }
          >
            <div className="space-y-3" data-testid="chat">
              {chat.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%] rounded-md bg-fork/15 px-3 py-2 text-[13px] text-text">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%] rounded-md border border-ai/25 bg-ai/10 px-3 py-2 text-[13px] text-body">
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ai">
                      <Bot className="h-3 w-3" /> draft
                    </span>
                    {m.text ? (
                      <span className="whitespace-pre-wrap">{m.text}</span>
                    ) : (
                      <span className="inline-flex gap-1">
                        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai" />
                        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai [animation-delay:0.15s]" />
                        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai [animation-delay:0.3s]" />
                      </span>
                    )}
                  </div>
                )
              )}
              <div ref={chatEnd} />
            </div>
          </SidePanel>
        </div>
      </div>
    </Shell>
  );
}
