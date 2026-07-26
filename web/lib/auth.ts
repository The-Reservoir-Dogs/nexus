import { randomBytes, timingSafeEqual, pbkdf2Sync, createHmac } from "crypto";
import { cookies, headers } from "next/headers";
import { query } from "./db";

export type CurrentUser = { id: string; username: string; email: string | null };

export const SESSION_COOKIE = "nexus_session";

const HASH_PREFIX = "pbkdf2_sha256";
const HASH_ITERATIONS = 210_000;
const HASH_KEYLEN = 32;
const DEV_AUTH_PREFIX = "dev:";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.PGPASSWORD ??
    "nexus-local-dev-session-secret"
  );
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return "Username must be 3-32 characters and use only lowercase letters, numbers, and underscores.";
  }
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, "sha256").toString(
    "base64url"
  );
  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [prefix, iterationsText, salt, expected] = stored.split("$");
  if (prefix !== HASH_PREFIX || !iterationsText || !salt || !expected) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const actual = pbkdf2Sync(password, salt, iterations, HASH_KEYLEN, "sha256");
  const expectedBuffer = fromBase64url(expected);
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function createSessionToken(user: Pick<CurrentUser, "id" | "username">): string {
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      username: user.username,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function createDevSessionUser(username: string): CurrentUser {
  return { id: `${DEV_AUTH_PREFIX}${username}`, username, email: null };
}

export function canUseDevAuthFallback(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.DATABRICKS_HOST;
}

function readSessionToken(): { id: string; username: string } | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== sign(payload)) return null;
  try {
    const parsed = JSON.parse(fromBase64url(payload).toString("utf8")) as {
      sub?: unknown;
      username?: unknown;
    };
    if (typeof parsed.sub !== "string" || typeof parsed.username !== "string") return null;
    return { id: parsed.sub, username: parsed.username };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<CurrentUser | null> {
  const session = readSessionToken();
  if (!session) return null;
  if (session.id.startsWith(DEV_AUTH_PREFIX) && canUseDevAuthFallback()) {
    return { id: session.id, username: session.username, email: null };
  }
  const rows = await query<{ id: string; username: string }>(
    "SELECT id::text, username FROM users WHERE id = $1 LIMIT 1",
    [session.id]
  );
  return rows[0] ? { ...rows[0], email: null } : null;
}

// Databricks Apps may inject the authenticated user's identity as request headers.
// Keep that path for deployed SSO, but prefer the Nexus session cookie when present.
export async function getIdentity(): Promise<{ email: string | null; username: string } | null> {
  const h = headers();
  // Identity precedence:
  //  1) Databricks Apps OAuth headers (on-platform),
  //  2) `nexus_user` cookie set by older login flows (off-platform),
  //  3) x-nexus-dev-user header / DEV_USER env (dev + e2e),
  //  4) "dev_user" fallback outside production.
  const email = h.get("x-forwarded-email") ?? h.get("x-forwarded-user") ?? null;
  const cookieUser = cookies().get("nexus_user")?.value ?? null;
  const devUser = h.get("x-nexus-dev-user") ?? process.env.DEV_USER ?? null;
  const username =
    (email ? email.split("@")[0] : null) ??
    cookieUser ??
    devUser ??
    (process.env.NODE_ENV !== "production" ? "dev_user" : null);
  if (!username) return null;
  return { email, username };
}

// Resolve (or lazily create) the app user row for the current identity.
export async function getCurrentUser(): Promise<CurrentUser> {
  const sessionUser = await getSessionUser();
  if (sessionUser) return sessionUser;

  const identity = await getIdentity();
  if (!identity) throw new Error("Not logged in");
  const { email, username } = identity;
  const rows = await query<{ id: string; username: string }>(
    "SELECT id::text, username FROM users WHERE username = $1 LIMIT 1",
    [username]
  );
  if (rows.length) return { ...rows[0], email };
  const created = await query<{ id: string; username: string }>(
    "INSERT INTO users (username, password_hash) VALUES ($1, 'oauth') RETURNING id::text, username",
    [username]
  );
  return { ...created[0], email };
}

// Access checks derived from episode ownership (no role column).
export function isEpisodeAuthor(userId: string, ep: { authorId: string }): boolean {
  return ep.authorId === userId;
}
export function isEpisodeCoAuthor(userId: string, ep: { coAuthorId: string | null }): boolean {
  return ep.coAuthorId === userId;
}
