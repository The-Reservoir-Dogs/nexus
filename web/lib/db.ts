import { Pool, PoolClient } from "pg";

// ---------------------------------------------------------------------------
// Lakebase (Postgres) connection.
// - Local dev: set PGPASSWORD in web/.env (the `nexus_app` role).
// - Deployed on Databricks Apps with a bound Database resource: PGHOST/PGPORT/
//   PGDATABASE/PGUSER/PGSSLMODE are injected, but NOT a password. We fetch a
//   short-lived credential token via the Databricks REST API and refresh it.
// ---------------------------------------------------------------------------

let pool: Pool | null = null;
let cachedPassword: { value: string; expiresAt: number } | null = null;

const INSTANCE_NAME = process.env.LAKEBASE_INSTANCE ?? "nexus-db";

async function fetchCredentialToken(): Promise<string> {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN; // app SP token (or PAT locally)
  if (!host || !token) {
    throw new Error(
      "No PGPASSWORD and no DATABRICKS_HOST/DATABRICKS_TOKEN to mint a Lakebase credential."
    );
  }
  const res = await fetch(`${host}/api/2.0/database/credentials`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ instance_names: [INSTANCE_NAME] }),
  });
  if (!res.ok) {
    throw new Error(`Lakebase credential request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { token: string; expiration_time?: string };
  return json.token;
}

async function getPassword(): Promise<string> {
  // Local dev / secret-based path.
  if (process.env.PGPASSWORD) return process.env.PGPASSWORD;

  // Runtime token path (deployed). Cache ~50 min (tokens last ~1h).
  const now = Date.now();
  if (cachedPassword && now < cachedPassword.expiresAt) return cachedPassword.value;
  const value = await fetchCredentialToken();
  cachedPassword = { value, expiresAt: now + 50 * 60 * 1000 };
  return value;
}

async function getPool(): Promise<Pool> {
  if (pool) return pool;
  pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? "databricks_postgres",
    user: process.env.PGUSER,
    password: await getPassword(),
    ssl: { rejectUnauthorized: false }, // PGSSLMODE=require
    max: 5,
  });
  return pool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = await getPool();
  const res = await p.query(text, params);
  return res.rows as T[];
}

export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
