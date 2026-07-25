"use client";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export function TopNav() {
  const { me, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        {/* Brand */}
        <Link href="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-medium tracking-tight text-text">
            nexus
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-canon" />
        </Link>

        {/* Account + CTA */}
        <div className="ml-auto flex items-center gap-4">
          {me && (
            <>
              <span className="hidden font-mono text-[12px] text-muted sm:block">
                @{me.username}
              </span>
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
          <Button asChild variant="primary" size="sm" className="hidden sm:inline-flex">
            <Link href="/series/10/branches">Start writing →</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
