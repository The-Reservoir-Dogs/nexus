# Deploy the web app on Render

Databricks Apps aren't publicly shareable, so the **Next.js web app** is deployed on
[Render](https://render.com) while the **database (Lakebase), the Python agent, and the LLM
stay on Databricks**. The Render service talks to them over the network.

```
  Browser ──▶ Render (Next.js: UI + /api routes)
                 │  ├─ Lakebase Postgres   (Databricks)  — mints creds via Databricks REST
                 │  ├─ /api/generate,/analyze ─▶ AGENT_URL (nexus-agent on Databricks Apps)
                 │  └─ LLM                 (Databricks / Gemini, via the agent)
```

## 1. One-time: prerequisites on Databricks
- Lakebase instance running, schema + seed loaded (`schema.sql`, `seed.sql`), and `nexus_app`
  granted (see `README.md`).
- A **service-principal token** whose SP can (a) mint a Lakebase credential and (b) read/write the
  DB. This is `DATABRICKS_TOKEN`.
- The **agent** deployed as a Databricks App (`nexus-agent`) with a public URL → `AGENT_URL`.
  (If the agent/LLM is rate-limited or unreachable, set `GENERATE_FALLBACK=1` to stream canned
  output so the fork→generate→approve loop still demos.)

## 2. Create the Render service (Blueprint)
1. Push this repo to GitHub (branch is fine).
2. Render → **New → Blueprint** → pick the repo. It reads [`render.yaml`](../render.yaml) and
   provisions **nexus-web** (`rootDir: web`, `npm ci && npm run build`, `npm run start`).
3. Fill the secrets marked `sync: false` (Dashboard → the service → Environment):

| Var | Example | Notes |
|---|---|---|
| `PGHOST` | `ep-round-bar-….database.us-east-2.cloud.databricks.com` | Lakebase host |
| `PGUSER` | `nexus_app` | app DB role |
| `DATABRICKS_HOST` | `https://dbc-….cloud.databricks.com` | mints Lakebase creds |
| `DATABRICKS_TOKEN` | `dapi…` | SP token (keep secret) |
| `AGENT_URL` | `https://nexus-agent-….databricksapps.com` | SSE proxy target |

Pre-set in the blueprint (override if needed): `PGPORT=5432`, `PGDATABASE=databricks_postgres`,
`PGSSLMODE=require`, `LAKEBASE_INSTANCE=nexus-db`, `NEXT_PUBLIC_API_MODE=live`,
`GENERATE_FALLBACK=0`, `DEV_USER=sriman`.

4. **Create** → Render builds and deploys. Health check: `/login`.

## 3. How it wires up (no code changes needed)
- **DB:** `lib/db.ts` uses `PGPASSWORD` if present, else **mints a short-lived token** from
  `${DATABRICKS_HOST}/api/2.0/database/credentials` using `DATABRICKS_TOKEN` (cached ~50 min).
  SSL is on unless `PGSSLMODE=disable`.
- **Agent:** `/api/generate` and `/api/analyze` proxy `AGENT_URL` (SSE). With `GENERATE_FALLBACK=1`
  or an unreachable agent, they stream a canned draft/insight instead of hanging.
- **Port:** `npm run start` binds `$PORT` (Render) → falls back to `$DATABRICKS_APP_PORT` → `3000`.
- **Identity (off-platform):** no Databricks OAuth on Render, so the login screen's username is
  stored in a `nexus_user` cookie and resolved server-side in `getIdentity()`
  (precedence: OAuth header → cookie → `DEV_USER`). Users are lazily created in the DB.

## 4. Gotchas
- **Lakebase network access:** if the instance restricts inbound IPs, allow Render egress or the
  connection will time out. Managed Postgres open to the workspace usually works.
- **Free plan cold starts:** the service sleeps when idle; first request wakes it (~30s). Use a
  paid plan / a pinger for a live demo.
- **Token scope:** if DB calls 401/403, the SP token lacks Lakebase credential or table grants.
- **CORS:** none needed — the browser only calls the same-origin Render `/api`.

## 5. Local parity
`NEXT_PUBLIC_API_MODE=mock` runs with dummy JSON (no DB). Live mode + a local Postgres is in
`README.md`. The same `/api` routes serve both, so nothing changes between local, Render, and
Databricks.
