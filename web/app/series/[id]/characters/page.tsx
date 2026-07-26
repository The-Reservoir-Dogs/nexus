"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { getSeriesCharacters, createCharacter } from "@/lib/api";
import type { Character } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const field = "w-full rounded-md border border-line-2 bg-ink px-3 py-2 text-sm text-text focus:border-canon focus:outline-none";
const empty = { name: "", role: "", personality: "", backstory: "", goals: "", speechStyle: "", status: "alive" };

// Context authoring — the character bible that feeds the AI co-author.
export default function CharactersPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data } = useAsync(() => getSeriesCharacters(id), [id]);
  const [chars, setChars] = React.useState<Character[]>([]);
  const [f, setF] = React.useState({ ...empty });
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (data) setChars(data); }, [data]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    const c = await createCharacter(id, f as any);
    setChars((cs) => [...cs, c]);
    setF({ ...empty });
    setBusy(false);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <Link href={`/series/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-canon">
          <ArrowLeft className="h-3.5 w-3.5" /> Series
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-text">Characters</h1>
        <p className="mb-5 text-[13px] text-muted">The cast the AI keeps consistent across every timeline.</p>

        <div className="grid gap-3 sm:grid-cols-2" data-testid="character-list">
          {chars.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text">{c.name}</span>
                {c.role && <Badge variant="fork">{c.role}</Badge>}
                <span className="ml-auto font-mono text-[10px] uppercase text-muted">{c.status}</span>
              </div>
              {c.personality && <p className="mt-1 text-[13px] text-muted">{c.personality}</p>}
            </Card>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <h2 className="text-[13px] font-semibold text-text">Add character</h2>
          <input className={field} placeholder="Name" aria-label="Name" value={f.name} onChange={set("name")} />
          <input className={field} placeholder="Role (protagonist / antagonist / side)" aria-label="Role" value={f.role} onChange={set("role")} />
          <textarea className={field} placeholder="Personality" aria-label="Personality" rows={2} value={f.personality} onChange={set("personality")} />
          <textarea className={field} placeholder="Backstory" aria-label="Backstory" rows={2} value={f.backstory} onChange={set("backstory")} />
          <input className={field} placeholder="Goals" aria-label="Goals" value={f.goals} onChange={set("goals")} />
          <input className={field} placeholder="Speech style" aria-label="Speech style" value={f.speechStyle} onChange={set("speechStyle")} />
          <Button type="submit" variant="primary" size="sm" disabled={busy || !f.name.trim()}>
            <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Add character"}
          </Button>
        </form>
      </div>
    </Shell>
  );
}
