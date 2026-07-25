import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle, CardMeta } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";

const swatches: [string, string][] = [
  ["ink", "bg-ink"],
  ["panel", "bg-panel"],
  ["panel-2", "bg-panel-2"],
  ["line", "bg-line"],
  ["canon", "bg-canon"],
  ["fork", "bg-fork"],
  ["success", "bg-success"],
  ["danger", "bg-danger"],
];

export default function StyleGuide() {
  return (
    <main className="mx-auto max-w-4xl space-y-12 p-10">
      <header className="radial-glow -m-10 mb-0 rounded-b-2xl p-10">
        <h1 className="font-display text-5xl">Midnight Multiverse</h1>
        <p className="mt-2 text-muted">NEXUS design system — dev styleguide.</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Colors</h2>
        <div className="grid grid-cols-4 gap-3">
          {swatches.map(([name, bg]) => (
            <div key={name} className="space-y-1">
              <div className={`${bg} h-14 rounded-lg border border-line`} />
              <span className="font-mono text-xs text-muted">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Type</h2>
        <p className="font-display text-4xl">Display / Fraunces 48</p>
        <p className="text-base">Body / Inter — a living story multiverse.</p>
        <p className="font-mono text-sm text-muted">Mono / 12 episodes · 3 contributors · 4.3★</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="aurora">Enter the Multiverse</Button>
          <Button variant="primary">Canonize</Button>
          <Button variant="fork">Fork timeline</Button>
          <Button variant="success">Approve</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="outline">Follow</Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Badges</h2>
        <div className="flex gap-3">
          <Badge variant="canon">Canon</Badge>
          <Badge variant="fork">Alternate</Badge>
          <Badge variant="success">Verified</Badge>
          <Badge variant="neutral">3 timelines</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Card + Skeleton + Avatar</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card className="hover:shadow-glow-fork">
            <CardTitle>The Hollow Crown</CardTitle>
            <CardMeta className="mt-1">4 episodes · 3 contributors · 4.3★</CardMeta>
          </Card>
          <Card className="space-y-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
          <Card className="flex items-center gap-3">
            <Avatar name="Sriman" />
            <span className="text-sm">sriman</span>
          </Card>
        </div>
      </section>
    </main>
  );
}
