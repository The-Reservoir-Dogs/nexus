"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createCanonicalEpisode } from "@/lib/api";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";

const field = "w-full rounded-md border border-line-2 bg-ink px-3 py-2 text-sm text-text focus:border-canon focus:outline-none";

// Author writes the next canonical episode on the sacred timeline.
export default function NewEpisodePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [f, setF] = React.useState({ title: "", content: "", summary: "", decisionPoint: "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.content.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const ep = await createCanonicalEpisode(id, {
        title: f.title,
        content: f.content,
        summary: f.summary || undefined,
        decisionPoint: f.decisionPoint || undefined,
      });
      router.push(`/episodes/${ep.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create episode");
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Link href={`/series/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-canon">
          <ArrowLeft className="h-3.5 w-3.5" /> Series
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-text">New canonical episode</h1>
        <p className="mb-5 text-[13px] text-muted">Adds the next episode on the sacred timeline.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className={field} placeholder="Episode title" aria-label="Episode title" value={f.title} onChange={set("title")} />
          <textarea className={field} placeholder="Episode script…" aria-label="Episode content" rows={12} value={f.content} onChange={set("content")} />
          <textarea className={field} placeholder="Summary (optional)" aria-label="Summary" rows={2} value={f.summary} onChange={set("summary")} />
          <input className={field} placeholder="Decision point (optional — enables forking here)" aria-label="Decision point" value={f.decisionPoint} onChange={set("decisionPoint")} />
          <Button type="submit" variant="primary" size="sm" disabled={busy || !f.title.trim() || !f.content.trim()}>
            {busy ? "Publishing…" : "Publish episode →"}
          </Button>
          {err && <span className="ml-2 text-[12px] text-danger">{err}</span>}
        </form>
      </div>
    </Shell>
  );
}
