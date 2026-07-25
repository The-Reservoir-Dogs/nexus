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
      <div className="radial-glow pointer-events-none absolute inset-0" aria-hidden />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-panel/80 p-8 backdrop-blur"
      >
        <h1 className="text-center font-display text-5xl">
          NE<span className="text-aurora">X</span>US
        </h1>
        <p className="mb-6 mt-1 text-center text-sm italic text-muted">
          Rewrite fate. Enter the multiverse.
        </p>

        <label className="mb-1 block text-xs text-muted" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 h-10 w-full rounded-lg border border-line bg-ink px-3 text-sm focus:outline-none focus:ring-2 focus:ring-fork"
        />

        <label className="mb-1 block text-xs text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 h-10 w-full rounded-lg border border-line bg-ink px-3 text-sm focus:outline-none focus:ring-2 focus:ring-fork"
        />

        <Button type="submit" variant="aurora" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </Button>
        <p className="mt-4 text-center text-xs text-muted">
          New here? <span className="text-fork">Create an account</span>
        </p>
      </form>
    </div>
  );
}
