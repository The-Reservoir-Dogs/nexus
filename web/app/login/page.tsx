"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { login, signup } = useAuth();
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signup(username, password);
      else await login(username, password);
      router.replace("/");
    } catch (err: any) {
      setError(err.message ?? "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="paper-glow pointer-events-none absolute inset-0" aria-hidden />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-sm rounded-[14px] border border-line bg-panel p-8 shadow-card"
      >
        <p className="eyebrow mb-4 text-center">
          <span className="eyebrow-mark">// </span>{mode === "signup" ? "create account" : "sign in"}
        </p>
        <h1 className="text-center font-display text-5xl font-medium">
          nexus<span className="text-canon">.</span>
        </h1>
        <p className="mb-7 mt-2 text-center text-sm italic text-muted">
          Rewrite fate. Enter the multiverse.
        </p>

        <label className="eyebrow mb-1.5 block" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="mb-4 h-11 w-full rounded-[10px] border border-line-2 bg-ink px-3 text-sm text-text focus:border-canon focus:outline-none"
        />

        <label className="eyebrow mb-1.5 block" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 6 : undefined}
          className="mb-4 h-11 w-full rounded-[10px] border border-line-2 bg-ink px-3 text-sm text-text focus:border-canon focus:outline-none"
        />

        {error && (
          <p className="mb-4 rounded-[10px] border border-canon/30 bg-canon/10 px-3 py-2 text-sm text-canon">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode((current) => (current === "login" ? "signup" : "login"));
          }}
          className="mt-5 w-full text-center font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-canon"
        >
          {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}
