"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";

export function TopNav() {
  const { me, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const atHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
        {/* Back button — fixes forward/back navigation */}
        {!atHome && (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors hover:border-fork hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-aurora text-ink shadow-glow-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-2xl leading-none tracking-tight">
            NE<span className="text-aurora">X</span>US
          </span>
        </Link>

        {/* Nav links */}
        <nav className="ml-6 hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/" className="transition-colors hover:text-text">
            Discover
          </Link>
          <Link href="/#trending" className="transition-colors hover:text-text">
            Trending
          </Link>
          <Link href="/styleguide" className="transition-colors hover:text-text">
            Studio
          </Link>
        </nav>

        {/* Account */}
        <div className="ml-auto flex items-center gap-3">
          {me && (
            <>
              <span className="hidden text-sm text-muted sm:block">@{me.username}</span>
              <Avatar name={me.username} />
              <button
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors hover:border-danger hover:text-danger"
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
