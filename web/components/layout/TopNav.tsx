"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";

export function TopNav() {
  const { me, logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = React.useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("q") ?? ""
      : ""
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5">
        {/* Brand → home */}
        <Link href="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-medium tracking-tight text-text">nexus</span>
          <span className="h-1.5 w-1.5 rounded-full bg-canon" />
        </Link>

        {/* Global search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
          }}
          className="relative ml-2 hidden max-w-md flex-1 sm:block"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the multiverse…"
            aria-label="Search series"
            className="h-10 w-full rounded-full border border-line-2 bg-panel pl-9 pr-4 text-sm text-text placeholder:text-muted focus:border-canon/60 focus:outline-none focus:ring-2 focus:ring-canon/30"
          />
        </form>

        {/* Account */}
        <div className="ml-auto flex items-center gap-3">
          {me && (
            <>
              <span className="hidden font-mono text-[12px] text-muted md:block">@{me.username}</span>
              <Avatar name={me.username} />
              <button
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="grid h-9 w-9 place-items-center rounded-full border border-line-2 text-muted transition-colors hover:border-canon hover:text-canon"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
