"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { TopNav } from "./TopNav";
import { Footer } from "./Footer";

/** Authenticated app shell: guards session, renders nav + animated page. */
export function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
      >
        {children}
      </motion.main>
      <Footer />
    </div>
  );
}
