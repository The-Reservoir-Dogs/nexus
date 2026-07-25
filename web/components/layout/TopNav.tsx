"use client";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";

export function TopNav() {
  const { me, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        <Link href="/" className="font-display text-2xl tracking-tight text-text">
          NEXUS
        </Link>
        <div className="relative ml-4 hidden flex-1 items-center md:flex">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
          <input
            type="search"
            placeholder="Search the multiverse…"
            aria-label="Search series"
            className="h-9 w-full max-w-sm rounded-lg border border-line bg-panel pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fork"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {me && (
            <>
              <span className="hidden text-sm text-muted sm:block">{me.username}</span>
              <button onClick={logout} aria-label="Account">
                <Avatar name={me.username} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
