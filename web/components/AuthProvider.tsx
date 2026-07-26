"use client";
import * as React from "react";
import type { Series } from "@/lib/types";
import type { User } from "@/mocks/data";
import { getMe, loginUser, logoutUser, signupUser } from "@/lib/api";

type AuthCtx = {
  me: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isOwner: (s: Pick<Series, "authorId">) => boolean;
};

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (username: string, password: string) => {
    const user = await loginUser(username, password);
    setMe(user);
  }, []);

  const signup = React.useCallback(async (username: string, password: string) => {
    const user = await signupUser(username, password);
    setMe(user);
  }, []);

  const logout = React.useCallback(async () => {
    await logoutUser().catch(() => undefined);
    setMe(null);
  }, []);

  const isOwner = React.useCallback(
    (s: Pick<Series, "authorId">) => !!me && me.id === s.authorId,
    [me]
  );

  return (
    <Ctx.Provider value={{ me, loading, login, signup, logout, isOwner }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
