# Deploy the web app on Vercel

Preferred public host for the **Next.js app** (no cold starts, native streaming). The
**database (Lakebase), the Python agent, and the LLM stay on Databricks** — Vercel reaches them
over the network. This can run **in parallel with the Databricks App** deploy; both serve the same
`web/` codebase.

```
  Browser ──▶ Vercel (Next.js: UI + /api serverless functions)
                 ├─ Lakebase Postgres     (Databricks) — mints creds via Databricks REST
                 ├─ /api/generate,/analyze ─▶ AGENT_URL (nexus-agent on Databricks Apps)
                 └─ LLM                    (Databricks / Gemini, via the agent)
```

## 1. Import the project
1. Vercel → **Add New → Project** → import this GitHub repo.
2. **Root Directory** → set to **`web`** (important — it's a monorepo).
3. Framework preset auto-detects **Next.js**. Build = `next build`, Install = `npm ci`.
   Leave the defaults (Vercel handles the build; `next.config.js` skips `output: standalone`
   when `VERCEL` is set).

## 2. Environment variables (Project → Settings → Environment Variables)
Add for **Production** (and Preview if you want branch deploys):

| Key | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `live` | use the real `/api` routes |
| `NEXT_PUBLIC_BASE_URL` | *(empty)* | same-origin |
| `PGHOST` | `ep-round-bar-….database.us-east-2.cloud.databricks.com` | Lakebase host |
| `PGPORT` | `5432` | |
| `PGDATABASE` | `databricks_postgres` | |
| `PGUSER` | `nexus_app` | app DB role |
| `PGSSLMODE` | `require` | Lakebase needs TLS |
| `LAKEBASE_INSTANCE` | `nexus-db` | must match your instance name |
| `DATABRICKS_HOST` | `https://dbc-….cloud.databricks.com` | mints Lakebase creds |
| `DATABRICKS_TOKEN` | `dapi…` | **secret** — SP token w/ Lakebase-credential + DB grants |
| `AGENT_URL` | `https://nexus-agent-….databricksapps.com` | SSE proxy target |
| `GENERATE_FALLBACK` | `1` while the LLM is rate-limited, else `0` | canned stream |
| `DEV_USER` | `sriman` | identity fallback (no OAuth off-platform) |

Do **not** set `PGPASSWORD` — leaving it empty is what makes `lib/db.ts` mint the short-lived
Lakebase token from `DATABRICKS_HOST`/`DATABRICKS_TOKEN`.

## 3. Deploy
Click **Deploy**. The public `*.vercel.app` URL is your shareable link (also gets automatic
preview deploys per PR).

## 4. Why it works on Vercel
- **Serverless Node functions** run the `/api` routes (`pg` needs Node — App Router route handlers
  are Node by default; we don't use the Edge runtime).
- **Streaming:** `/api/generate` and `/api/analyze` set `export const maxDuration = 60` so SSE isn't
  cut at Vercel's 10s default.
- **DB pool:** capped at 2 per instance on Vercel (`PG_POOL_MAX` to override) to avoid exhausting
  Lakebase connections across many warm instances.
- **Identity:** the login username is stored in a `nexus_user` cookie and resolved in
  `getIdentity()` (precedence: OAuth header → cookie → `DEV_USER`); users are lazily created.

## 5. Gotchas
- **Lakebase inbound access:** if the instance restricts IPs, allow Vercel's egress (Vercel IPs are
  dynamic; either open it to the workspace or use a static-IP/proxy) or DB calls time out.
- **`DATABRICKS_TOKEN` expiry:** a PAT expires; for a long-lived demo use a service-principal token.
- **Token grants:** DB 401/403 ⇒ the SP lacks Lakebase credential or table grants.
- **Long real-LLM generations** may exceed 60s on Hobby; bump `maxDuration` (Pro allows up to 300s)
  or keep `GENERATE_FALLBACK=1` for the demo.

## Deploying to both Vercel and Databricks
- **Databricks App** (`nexus-web`) continues via `.github/workflows/deploy.yml` (self-host,
  `output: standalone`, `next start`).
- **Vercel** builds the same `web/` with its own adapter (no standalone).
Nothing conflicts — the `VERCEL` env flag branches `next.config.js`, and both talk to the same
Lakebase + agent.
