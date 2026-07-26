export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  canUseDevAuthFallback,
  createSessionToken,
  createDevSessionUser,
  hashPassword,
  normalizeUsername,
  validateUsername,
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
    if (password.length < 6) {
      return fail("INVALID_PASSWORD", "Password must be at least 6 characters.", 400);
    }

    const created = await query<{ id: string; username: string }>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id::text, username",
      [username, hashPassword(password)]
    );
    const user = created[0];

    setSession(user);

    return ok({ id: user.id, username: user.username, email: null }, { created: true });
  } catch (e: any) {
    if (e?.code === "23505") {
      return fail("USERNAME_TAKEN", "That username is already taken.", 409);
    }
    if (username && canUseDevAuthFallback()) {
      const user = createDevSessionUser(username);
      setSession(user);
      return ok(user, { created: true, mode: "dev-fallback" });
    }
    return fail("SIGNUP_FAILED", e.message ?? "Could not create account.", 500);
  }
}
