"use client";
import * as React from "react";
import type { Series } from "@/lib/types";
import type { User } from "@/mocks/data";
import { getMe } from "@/lib/api";

const SESSION_KEY = "nexus_session";

type AuthCtx = {
  me: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isOwner: (s: Pick<Series, "authorId">) => boolean;
};

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const hasSession =
      typeof window !== "undefined" && !!localStorage.getItem(SESSION_KEY);
    if (!hasSession) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setMe)
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (username: string) => {
    localStorage.setItem(SESSION_KEY, "1");
    // Off-platform (e.g. Render) there's no Databricks OAuth, so the chosen
    // username is carried as a cookie and resolved server-side in getIdentity().
    const clean = username.trim().replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 40);
    if (clean) {
      document.cookie = `nexus_user=${encodeURIComponent(clean)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
    const user = await getMe();
    setMe(user);
  }, []);

  const logout = React.useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = "nexus_user=; path=/; max-age=0; samesite=lax";
    setMe(null);
  }, []);

  const isOwner = React.useCallback(
    (s: Pick<Series, "authorId">) => !!me && me.id === s.authorId,
    [me]
  );

  return (
    <Ctx.Provider value={{ me, loading, login, logout, isOwner }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
