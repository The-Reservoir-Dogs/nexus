"use client";
import * as React from "react";
import Link from "next/link";
import { Sparkles, Globe, Mail, MessageCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

const columns: { title: string; links: string[] }[] = [
  { title: "Create", links: ["Start a series", "Fork a timeline", "Co-author studio", "AI editor"] },
  { title: "Explore", links: ["Discover", "Trending multiverses", "Top branches", "Verified canon"] },
  { title: "Company", links: ["About", "Manifesto", "Careers", "Press"] },
];

export function Footer() {
  const [email, setEmail] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line/70">
      <div className="rule-aurora" />
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[60rem] -translate-x-1/2 rounded-full bg-aurora-soft blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        {/* Big call-to-write banner */}
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-fork">
              For storytellers
            </p>
            <h2 className="mt-3 font-display text-5xl leading-[1.05] md:text-6xl">
              Every story has{" "}
              <span className="text-aurora italic">infinite endings.</span>
              <br />
              Write yours.
            </h2>
          </div>

          {/* Newsletter */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) setJoined(true);
            }}
            className="w-full max-w-sm"
          >
            <label className="mb-2 block text-sm text-muted">
              Join the writers’ circle
            </label>
            {joined ? (
              <p className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
                You’re in. Welcome to the multiverse ✨
              </p>
            ) : (
              <div className="flex overflow-hidden rounded-xl border border-line bg-panel focus-within:border-fork">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@story.com"
                  aria-label="Email"
                  className="h-11 flex-1 bg-transparent px-4 text-sm placeholder:text-muted focus:outline-none"
                />
                <Button type="submit" variant="primary" className="rounded-none">
                  Join <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* Link columns */}
        <div className="mt-16 grid grid-cols-2 gap-8 border-t border-line/60 pt-10 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-aurora text-ink">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="font-display text-xl">NEXUS</span>
            </Link>
            <p className="mt-3 text-sm text-muted">
              A living story multiverse where AI keeps every timeline true to canon.
            </p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
                {c.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="/"
                      className="text-sm text-text/80 transition-colors hover:text-aurora"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-6 text-sm text-muted sm:flex-row">
          <p>© 2026 NEXUS. Crafted for storytellers.</p>
          <div className="flex items-center gap-4">
            {[Globe, Mail, MessageCircle].map((Icon, i) => (
              <Link
                key={i}
                href="/"
                aria-label="social"
                className="grid h-9 w-9 place-items-center rounded-full border border-line transition-colors hover:border-fork hover:text-text"
              >
                <Icon className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
