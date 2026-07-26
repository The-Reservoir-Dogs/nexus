"use client";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";

export function TopNav() {
  const { me, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink">
      <div className="mx-auto flex h-12 w-full max-w-[1500px] items-center justify-between gap-4 px-5">
        <Link href="/" className="inline-flex items-baseline gap-1">
          <span className="font-display text-[17px] font-semibold tracking-tight text-text">
            nexus
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-canon" aria-hidden />
        </Link>

        {me && (
          <div className="flex items-center gap-2.5">
            <span className="hidden text-[12px] text-muted sm:block">@{me.username}</span>
            <Avatar name={me.username} className="h-7 w-7 text-xs" />
            <button
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="grid h-7 w-7 place-items-center rounded-md border border-line-2 text-muted transition-colors hover:border-canon hover:text-canon"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
