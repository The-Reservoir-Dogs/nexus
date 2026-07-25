"use client";
import * as React from "react";
import Link from "next/link";
import { Globe, Mail, MessageCircle } from "lucide-react";
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
    <footer className="relative mt-28 border-t border-line bg-panel-2/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* eyebrow */}
        <p className="eyebrow mb-4">
          <span className="eyebrow-mark">// </span>for storytellers
        </p>

        {/* Big call to write */}
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-5xl font-medium leading-[1.06] md:text-6xl">
            Every story has{" "}
            <span className="accent-word underline-sketch">infinite endings.</span>
            <br />
            Write yours.
          </h2>

          {/* Newsletter */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) setJoined(true);
            }}
            className="w-full max-w-sm"
          >
            <label className="eyebrow mb-2 block">join the writers’ circle</label>
            {joined ? (
              <p className="border border-fork/30 bg-fork/10 px-4 py-3 text-sm text-fork">
                You’re in. Welcome to the multiverse.
              </p>
            ) : (
              <div className="flex border border-line-2 bg-panel focus-within:border-canon">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@story.com"
                  aria-label="Email"
                  className="h-12 flex-1 bg-transparent px-4 text-sm text-text placeholder:text-muted focus:outline-none"
                />
                <Button type="submit" variant="primary" className="rounded-none">
                  Join →
                </Button>
              </div>
            )}
          </form>
        </div>

        <div className="rule-warm my-14" />

        {/* Columns */}
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-baseline gap-1">
              <span className="font-display text-2xl text-text">nexus</span>
              <span className="h-1.5 w-1.5 rounded-full bg-canon" />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted">
              A living story multiverse where AI keeps every timeline true to canon.
            </p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h3 className="eyebrow">
                <span className="eyebrow-mark">// </span>
                {c.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="/"
                      className="text-sm text-body transition-colors hover:text-canon"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <p className="font-mono text-xs text-muted">© 2026 nexus · crafted for storytellers</p>
          <div className="flex items-center gap-3">
            {[Globe, Mail, MessageCircle].map((Icon, i) => (
              <Link
                key={i}
                href="/"
                aria-label="social"
                className="grid h-9 w-9 place-items-center rounded-full border border-line-2 text-muted transition-colors hover:border-canon hover:text-canon"
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
