import { headers } from "next/headers";
import { query } from "./db";

// Databricks Apps injects the authenticated user's identity as request headers.
// See: dev-tools/databricks-apps/auth. No token handling needed in the frontend.
export type CurrentUser = { id: string; username: string; email: string | null };

export async function getIdentity(): Promise<{ email: string | null; username: string }> {
  const h = headers();
  const email =
    h.get("x-forwarded-email") ?? h.get("x-forwarded-user") ?? null;
  const username = (email ? email.split("@")[0] : null) ?? "dev_user";
  return { email, username };
}

// Resolve (or lazily create) the app user row for the current identity.
export async function getCurrentUser(): Promise<CurrentUser> {
  const { email, username } = await getIdentity();
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
