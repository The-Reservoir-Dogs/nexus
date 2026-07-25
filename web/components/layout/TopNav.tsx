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
    <header className="sticky top-0 z-40 border-b border-line bg-ink">
      <div className="flex h-12 items-center gap-4 px-4">
        {/* Brand → home */}
        <Link href="/" className="flex items-baseline gap-1">
          <span className="text-[15px] font-semibold tracking-tight text-text">nexus</span>
          <span className="h-1.5 w-1.5 rounded-full bg-fork" />
        </Link>

        {/* Global search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
          }}
          className="relative ml-1 hidden max-w-sm flex-1 sm:block"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            aria-label="Search series"
            className="h-7 w-full rounded-md border border-line-2 bg-panel pl-8 pr-3 text-[13px] text-text placeholder:text-muted focus:border-fork/60 focus:outline-none"
          />
        </form>

        {/* Account */}
        <div className="ml-auto flex items-center gap-2.5">
          {me && (
            <>
              <span className="hidden text-[12px] text-muted md:block">@{me.username}</span>
              <Avatar name={me.username} className="h-7 w-7 text-xs" />
              <button
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="grid h-7 w-7 place-items-center rounded-md border border-line-2 text-muted transition-colors hover:border-fork hover:text-fork"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
