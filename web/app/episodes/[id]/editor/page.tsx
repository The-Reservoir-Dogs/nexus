"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Check, X, Columns2, Send, Bot, ArrowLeft, ChevronRight } from "lucide-react";
import { generate, chat as chatStream, editStream, routeIntent, approveEpisode, forkEpisode, getEpisodes, getEpisodeTimelines, updateEpisode, CHAT_COMMANDS, type Draft, type AgentEvent, type ChatTurn } from "@/lib/api";
import type { Episode } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useFork } from "@/components/ForkProvider";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Shell } from "@/components/layout/Shell";
import { SeasonTree } from "@/components/reader/SeasonTree";
import { SidePanel } from "@/components/layout/SidePanel";
import { Manuscript } from "@/components/editor/Manuscript";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Step = { kind: "reasoning" | "tool_call" | "tool_result"; label: string };
type ChatMsg =
  | { role: "user"; text: string; at: number }
  | {
      role: "ai";
      at: number;
      // "generate" streams a fresh draft; "edit" revises the current manuscript;
      // both stream into the editor. "chat" answers in the panel only.
      kind: "generate" | "edit" | "chat";
      steps: Step[];
      status: "thinking" | "writing" | "done";
      words: number;
      reply: string;
    };

function ago(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  return m < 1 ? "just now" : `${m}m ago`;
}

function toStep(e: AgentEvent): Step {
  if (e.type === "reasoning") return { kind: "reasoning", label: e.text };
  if (e.type === "tool_call") return { kind: "tool_call", label: e.name };
  return { kind: "tool_result", label: `${e.name}${e.summary ? " → " + e.summary : ""}` };
}

export default function EditorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const isContinue = mode === "continue";
  const isEdit = mode === "edit";
  const fork = useFork();
  const { me } = useAuth();

  const [manuscript, setManuscript] = React.useState("");
  const [title, setTitle] = React.useState("");

  useAsync(async () => {
    if (isEdit) {
      // Always load THIS episode fresh — ignore any stale fork context from a
      // previous create-branch/continue session (that was leaving the editor blank).
      const ctx = await forkEpisode(id);
      fork.setContext(ctx);
      // only seed if the user hasn't started editing yet (avoids clobbering typing
      // if the async load resolves after the first keystroke)
      setTitle((prev) => prev || ctx.sourceEpisode.title);
      setManuscript((prev) => prev || (ctx.sourceEpisode.content ?? ""));
      fork.setWhatIf("");
      fork.setDrivingReviewId(null);
      return true;
    }
    // Create-branch / continue mode: load the current episode as source context
    // and seed the editor with its real manuscript so contributors edit from
    // the actual story, not a blank page. Only seed when empty to avoid
    // clobbering user edits if async work resolves late.
    let ctx = fork.context;
    const needsFreshContext = !ctx || ctx.sourceEpisode.id !== id;
    if (needsFreshContext) {
      ctx = await forkEpisode(id, isContinue ? undefined : "5001");
      fork.setContext(ctx);
    }
    if (!ctx) throw new Error("Could not load episode context");
    setTitle((prev) => prev || `${ctx.sourceEpisode.title} — Branch`);
    setManuscript((prev) => prev || (ctx.sourceEpisode.content ?? ""));
    if (isContinue) {
      fork.setDrivingReviewId(null);
      fork.setWhatIf("");
    } else if (needsFreshContext) {
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
      const map: Record<string, Episode[]> = {};
      const seen = new Set<string>();
      let frontier = eps.map((e) => e.id);
      while (frontier.length) {
        const results = await Promise.all(
          frontier.map(async (fid) => [fid, await getEpisodeTimelines(fid)] as const)
        );
        const next: string[] = [];
        for (const [fid, forks] of results) {
          if (forks.length) map[fid] = forks;
          for (const f of forks) if (!seen.has(f.id)) { seen.add(f.id); next.push(f.id); }
        }
        frontier = next;
      }
      setBranchesByEp(map);
    });
  }, [fork.context?.sourceEpisode?.seriesId]);

  const [chat, setChat] = React.useState<ChatMsg[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [slashIdx, setSlashIdx] = React.useState(0);
  // Active slash-command query: only while typing the FIRST token ("/char"), not after a space.
  const slashQuery = /^\/[a-z]*$/i.test(instruction) ? instruction.slice(1).toLowerCase() : null;
  const suggestions = slashQuery !== null
    ? CHAT_COMMANDS.filter((c) => c.name.startsWith(slashQuery))
    : [];
  const completeSlash = React.useCallback((name: string) => {
    // /rewrite expects an argument, so leave a trailing space; the rest fire on submit.
    setInstruction(name === "rewrite" ? "/rewrite " : `/${name}`);
    setSlashIdx(0);
  }, []);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const chatEnd = React.useRef<HTMLDivElement>(null);
  const seededCommentBrief = React.useRef<string | null>(null);
  React.useEffect(() => { chatEnd.current?.scrollIntoView?.({ behavior: "smooth" }); }, [chat]);

  React.useEffect(() => {
    const dc = fork.context?.drivingComment;
    if (!dc || isEdit || seededCommentBrief.current === dc.id) return;
    seededCommentBrief.current = dc.id;
    setChat((c) => [
      ...c,
      {
        role: "ai",
        at: Date.now(),
        kind: "chat",
        steps: [],
        status: "done",
        words: 0,
        reply:
          `Contributor brief: @${dc.authorName ?? "reader"} said “${dc.reviewText}”. ` +
          "Use this as the pain point: identify what disappointed them, keep the original continuity, " +
          "then edit or /rewrite the manuscript so this branch directly fixes that weakness.",
      },
    ]);
  }, [fork.context?.drivingComment, isEdit]);

  // update the last (AI) chat message immutably
  const patchAi = React.useCallback((fn: (m: Extract<ChatMsg, { role: "ai" }>) => Extract<ChatMsg, { role: "ai" }>) => {
    setChat((c) => {
      const copy = [...c];
      const m = copy[copy.length - 1];
      if (m?.role === "ai") copy[copy.length - 1] = fn(m);
      return copy;
    });
  }, []);

  const runGenerate = React.useCallback(
    async (extra?: string) => {
      setGenerating(true);
      setManuscript("");
      setChat((c) => [...c,
        { role: "user", text: extra ?? (fork.whatIf || "Generate the alternate future."), at: Date.now() },
        { role: "ai", at: Date.now(), kind: "generate", steps: [], status: "thinking", words: 0, reply: "" }]);

      // the DRAFT streams into the editor; the CHAT shows the agent's thinking
      // (reasoning + tool calls) + a status — not a copy of the draft.
      const gen = generate(
        {
          sourceEpisodeId: id,
          decisionPoint: isContinue
            ? "Continue this timeline — write the next episode."
            : fork.whatIf || fork.context?.sourceEpisode?.decisionPoint || "Explore an alternate path from this episode.",
          drivingReviewId: fork.drivingReviewId ?? undefined,
          instructions: extra,
        },
        (e) => patchAi((m) => ({ ...m, steps: [...m.steps, toStep(e)] }))
      );

      let acc = "";
      let res = await gen.next();
      while (!res.done) {
        acc += res.value;
        setManuscript(acc);
        patchAi((m) => (m.status === "writing" ? m : { ...m, status: "writing" }));
        res = await gen.next();
      }
      const wc = acc.trim() ? acc.trim().split(/\s+/).length : 0;
      patchAi((m) => ({ ...m, status: "done", words: wc }));
      fork.setDraft({ ...(res.value as Draft), content: acc });
      setGenerating(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, fork.whatIf, fork.drivingReviewId, isContinue]
  );

  // Copilot-style edit — applies a plain-language change to the CURRENT manuscript,
  // streams the full revision back into the editor, then posts a summary in the chat.
  const runEdit = React.useCallback(
    async (message: string) => {
      const current = manuscript;
      setGenerating(true);
      setChat((c) => [...c,
        { role: "user", text: message, at: Date.now() },
        { role: "ai", at: Date.now(), kind: "edit", steps: [], status: "thinking", words: 0, reply: "" }]);
      try {
        const gen = editStream(
          { episodeId: id, manuscript: current, instruction: message },
          (e) => patchAi((m) => ({ ...m, steps: [...m.steps, toStep(e)] }))
        );
        let acc = "";
        let res = await gen.next();
        while (!res.done) {
          acc += res.value;
          setManuscript(acc);
          patchAi((m) => (m.status === "writing" ? m : { ...m, status: "writing" }));
          res = await gen.next();
        }
        const summary = (res.value as string) || "Done.";
        const wc = acc.trim() ? acc.trim().split(/\s+/).length : 0;
        patchAi((m) => ({ ...m, status: "done", words: wc, reply: summary }));
      } catch (e: any) {
        // don't clobber the author's text on failure
        setManuscript(current);
        patchAi((m) => ({ ...m, status: "done", reply: `Sorry — ${e?.message ?? "edit failed"}.` }));
      } finally {
        setGenerating(false);
      }
    },
    [id, manuscript, patchAi]
  );

  // Conversational turn — answers in the panel, NEVER touches the manuscript.
  const sendChat = React.useCallback(
    async (message: string) => {
      setGenerating(true);
      const history: ChatTurn[] = chat.map((m) =>
        m.role === "user" ? { role: "user", text: m.text } : { role: "ai", text: m.reply }
      );
      setChat((c) => [...c,
        { role: "user", text: message, at: Date.now() },
        { role: "ai", at: Date.now(), kind: "chat", steps: [], status: "thinking", words: 0, reply: "" }]);
      try {
        const gen = chatStream(
          { episodeId: id, message, history },
          (e) => patchAi((m) => ({ ...m, steps: [...m.steps, toStep(e)] }))
        );
        let acc = "";
        let res = await gen.next();
        while (!res.done) {
          acc += res.value;
          patchAi((m) => ({ ...m, reply: acc, status: "writing" }));
          res = await gen.next();
        }
        patchAi((m) => ({ ...m, reply: (res.value as string) || acc, status: "done" }));
      } catch (e: any) {
        patchAi((m) => ({ ...m, reply: `Sorry — ${e?.message ?? "something went wrong"}.`, status: "done" }));
      } finally {
        setGenerating(false);
      }
    },
    [id, chat, patchAi]
  );

  // Route a submitted instruction: /rewrite streams into the editor; a bare message
  // (or any other slash command) is a chat turn that leaves the manuscript untouched.
  const handleSubmit = React.useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || generating) return;
      const m = text.match(/^\/rewrite\b\s*(.*)$/i);
      if (m) { runGenerate(m[1].trim() || undefined); return; }
      if (text.startsWith("/")) { sendChat(text); return; } // other slash cmds -> chat
      // Plain language: let the router decide edit-the-manuscript vs answer-a-question.
      // Only edit when there's actually a manuscript to change.
      const intent = manuscript.trim() ? await routeIntent(text) : "ASK";
      if (intent === "EDIT") runEdit(text);
      else sendChat(text);
    },
    [generating, manuscript, runGenerate, runEdit, sendChat]
  );

  // NOTE: no auto-generate on entry. User must trigger generation explicitly
  // (e.g. /rewrite or the generate action). Prevents the agent writing
  // automatically the moment the branch editor opens.

  async function handleApprove() {
    const src = fork.context?.sourceEpisode;
    if (!src) return;
    setSaving(true);
    setSaveError("");
    try {
      if (isEdit) {
        const updated = await updateEpisode(id, { title, content: manuscript });
        router.push(`/episodes/${updated.id}`);
        return;
      }
      const created = await approveEpisode({
        seriesId: src.seriesId,
        seasonId: src.seasonId,
        // continue: stay in THIS timeline (chain prev = current, keep same branch origin);
        // fork: branch FROM the current episode.
        forkedFromEpisodeId: isContinue ? (src.forkedFromEpisodeId ?? src.id) : src.id,
        prevEpisodeId: isContinue ? src.id : undefined,
        decisionPoint: isContinue ? "" : fork.whatIf,
        title: fork.draft?.title ?? (title.trim() || `${src.title} — Branch`),
        content: manuscript,
        summary: fork.draft?.summary ?? src.summary ?? "",
      });
      router.push(`/episodes/${created.id}`);
    } catch (e: any) {
      setSaveError(e?.message ?? "Save failed. Please try again.");
      setSaving(false);
    }
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
            <Badge variant="fork">{isEdit ? "editing" : isContinue ? "continuing timeline" : "editing branch"}</Badge>
            {isEdit ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Episode title"
                className="min-w-0 flex-1 rounded-md border border-line-2 bg-ink px-2 py-1 text-[13px] text-text focus:border-canon focus:outline-none"
              />
            ) : (
              <span className="truncate text-[13px] text-muted">{isContinue ? "next episode in this timeline" : fork.whatIf}</span>
            )}
            {!isEdit && (
              <Button variant="pill" size="sm" className="ml-auto" onClick={() => router.push(`/episodes/${id}/split`)}>
                <Columns2 className="h-3.5 w-3.5" /> Split view
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <Manuscript value={manuscript} onChange={setManuscript} />
          </div>
          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <Button variant="primary" size="sm" onClick={handleApprove} disabled={generating || saving}>
              <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : isEdit ? "Save changes" : "Approve & publish"}
            </Button>
            <Button variant="danger" size="sm" onClick={() => router.push(`/episodes/${id}`)}>
              <X className="h-3.5 w-3.5" /> {isEdit ? "Cancel" : "Discard"}
            </Button>
            {saveError ? (
              <span className="ml-auto text-[11px] text-danger">{saveError}</span>
            ) : (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
                <Sparkles className="h-3 w-3" /> {isEdit ? "AI assist optional — Save updates this episode" : "nothing saved until approve"}
              </span>
            )}
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
              <div className="relative">
                {/* pi.dev-style slash-command autocomplete */}
                {suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-md border border-line-2 bg-panel-2 shadow-lg">
                    {suggestions.map((c, si) => (
                      <button
                        key={c.name}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); completeSlash(c.name); }}
                        className={cn(
                          "flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-ai/10",
                          si === slashIdx && "bg-ai/10"
                        )}
                      >
                        <span className="font-mono text-[12px] text-ai">/{c.name}</span>
                        <span className="truncate text-[11px] text-muted">{c.help}</span>
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSubmit(instruction); setInstruction(""); }}
                  className="flex gap-2"
                >
                  <input
                    value={instruction}
                    onChange={(e) => { setInstruction(e.target.value); setSlashIdx(0); }}
                    onKeyDown={(e) => {
                      if (!suggestions.length) return;
                      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % suggestions.length); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + suggestions.length) % suggestions.length); }
                      else if (e.key === "Tab" || (e.key === "Enter" && instruction === `/${slashQuery}`)) {
                        e.preventDefault(); completeSlash(suggestions[slashIdx].name);
                      }
                    }}
                    placeholder="Ask, or /command… e.g. /characters, /rewrite make it darker"
                    aria-label="Instruct the AI"
                    className="h-8 flex-1 rounded-md border border-line-2 bg-ink px-3 text-[13px] text-text placeholder:text-muted focus:border-ai/60 focus:outline-none"
                  />
                  <Button type="submit" variant="ai" size="icon" aria-label="Send" disabled={generating}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            }
          >
            <div className="relative space-y-4" data-testid="chat">
              {/* thread line behind the avatars */}
              {chat.length > 0 && (
                <span className="absolute left-[13px] top-3 bottom-3 w-px bg-line" aria-hidden />
              )}
              {chat.map((m, i) => (
                <div key={i} className="relative flex gap-2.5">
                  {m.role === "user" ? (
                    <Avatar name={me?.username ?? "you"} className="h-7 w-7 shrink-0 text-[11px] ring-2 ring-panel" />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ai/40 bg-panel-2 text-ai ring-2 ring-panel">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-text">
                        {m.role === "user" ? "You" : "AI Co-Author"}
                      </span>
                      <span className="text-[11px] text-muted">{ago(m.at)}</span>
                    </div>
                    {m.role === "user" ? (
                      <div className="mt-0.5 text-[13px] leading-relaxed text-body">
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </div>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {/* thinking steps: reasoning + tool calls */}
                        {m.steps.map((s, si) =>
                          s.kind === "reasoning" ? (
                            <div key={si} className="flex items-start gap-1.5 text-[12px] italic text-muted">
                              <Sparkles className="mt-[3px] h-3 w-3 shrink-0 text-ai" />
                              <span>{s.label}</span>
                            </div>
                          ) : s.kind === "tool_call" ? (
                            <div key={si} className="flex items-center gap-1.5 font-mono text-[11px] text-ai/90">
                              <ChevronRight className="h-3 w-3 shrink-0" />
                              <span>{s.label}()</span>
                            </div>
                          ) : (
                            <div key={si} className="flex items-center gap-1.5 pl-[18px] font-mono text-[11px] text-muted">
                              <Check className="h-3 w-3 shrink-0 text-ai/70" />
                              <span>{s.label}</span>
                            </div>
                          )
                        )}
                        {/* status */}
                        {m.status === "thinking" && (
                          <span className="inline-flex gap-1 py-1">
                            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai" />
                            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai [animation-delay:0.15s]" />
                            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-ai [animation-delay:0.3s]" />
                          </span>
                        )}
                        {/* generate/edit: live "writing" indicator while streaming into the editor */}
                        {(m.kind === "generate" || m.kind === "edit") && m.status === "writing" && (
                          <div className="flex items-center gap-1.5 pt-1 text-[12px] text-ai">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai" />
                            {m.kind === "edit" ? "Editing manuscript… updating the editor" : "Writing draft… streaming into the editor"}
                          </div>
                        )}
                        {/* edit summary + chat reply: render in the panel */}
                        {(m.kind === "chat" || m.kind === "edit") && m.reply && (
                          <div className="whitespace-pre-wrap pt-1 text-[13px] leading-relaxed text-body">
                            {m.reply}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
          </SidePanel>
        </div>
      </div>
    </Shell>
  );
}
