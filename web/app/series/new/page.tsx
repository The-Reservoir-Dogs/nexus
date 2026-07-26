"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSeries } from "@/lib/api";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";

const field = "w-full rounded-md border border-line-2 bg-ink px-3 py-2 text-sm text-text focus:border-canon focus:outline-none";

export default function NewSeriesPage() {
  const router = useRouter();
  const [f, setF] = React.useState({ title: "", genre: "", summary: "", description: "", tag: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true);
    const s = await createSeries(f);
    router.push(`/series/${s.id}/episode/new`);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-lg px-5 py-6">
        <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-canon">
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-text">New series</h1>
        <p className="mb-5 text-[13px] text-muted">Start a universe. You become its showrunner.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className={field} placeholder="Title" aria-label="Title" value={f.title} onChange={set("title")} />
          <input className={field} placeholder="Genre (e.g. Fantasy)" aria-label="Genre" value={f.genre} onChange={set("genre")} />
          <input className={field} placeholder="Tags (comma separated)" aria-label="Tags" value={f.tag} onChange={set("tag")} />
          <textarea className={field} placeholder="Summary" aria-label="Summary" rows={2} value={f.summary} onChange={set("summary")} />
          <textarea className={field} placeholder="Description" aria-label="Description" rows={3} value={f.description} onChange={set("description")} />
          <Button type="submit" variant="primary" size="sm" disabled={busy || !f.title.trim()}>
            {busy ? "Creating…" : "Create series →"}
          </Button>
        </form>
      </div>
    </Shell>
  );
}
