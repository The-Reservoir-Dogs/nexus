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

  const login = React.useCallback(async (_username: string) => {
    localStorage.setItem(SESSION_KEY, "1");
    const user = await getMe();
    setMe(user);
  }, []);

  const logout = React.useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
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
