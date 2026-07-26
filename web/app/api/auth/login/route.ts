export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  canUseDevAuthFallback,
  createSessionToken,
  createDevSessionUser,
  normalizeUsername,
  validateUsername,
  verifyPassword,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { fail, ok } from "@/lib/types";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setSession(user: { id: string; username: string }) {
  cookies().set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function POST(req: Request) {
  let username = "";
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    username = normalizeUsername(String(body.username ?? ""));
    const password = String(body.password ?? "");
    const usernameError = validateUsername(username);
    if (usernameError) return fail("INVALID_USERNAME", usernameError, 400);
    if (!password) return fail("INVALID_PASSWORD", "Password is required.", 400);

    const rows = await query<{ id: string; username: string; password_hash: string }>(
      "SELECT id::text, username, password_hash FROM users WHERE username = $1 LIMIT 1",
      [username]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return fail("INVALID_LOGIN", "Username or password is incorrect.", 401);
    }

    setSession(user);

    return ok({ id: user.id, username: user.username, email: null });
  } catch (e: any) {
    if (username && canUseDevAuthFallback()) {
      const user = createDevSessionUser(username);
      setSession(user);
      return ok(user, { mode: "dev-fallback" });
    }
    return fail("LOGIN_FAILED", e.message ?? "Login failed.", 500);
  }
}
