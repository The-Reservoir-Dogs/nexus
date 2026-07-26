"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { TopNav } from "./TopNav";

/** Authenticated app shell: guards session, renders nav + animated page. */
export function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading || !me) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <span className="animate-pulse font-display text-3xl">NEXUS</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
