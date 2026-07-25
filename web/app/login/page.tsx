"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = React.useState("sriman");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await login(username);
    router.replace("/");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="paper-glow pointer-events-none absolute inset-0" aria-hidden />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-sm rounded-[14px] border border-line bg-panel p-8 shadow-card"
      >
        <p className="eyebrow mb-4 text-center">
          <span className="eyebrow-mark">// </span>sign in
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
          className="mb-7 h-11 w-full rounded-[10px] border border-line-2 bg-ink px-3 text-sm text-text focus:border-canon focus:outline-none"
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Log in →"}
        </Button>
        <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
          new here? <span className="text-canon">create an account</span>
        </p>
      </form>
    </div>
  );
}
