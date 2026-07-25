# NEXUS — Infra Boilerplate Checklist

What we still need to scaffold to deploy on Databricks Apps. Derived from the Databricks Apps docs (app.yaml, resources, Lakebase, dependencies).

## Repo layout (monorepo)
```
nexus/
├── schema.sql, seed.sql            # DONE (applied to Lakebase)
├── web/                            # App 1 — Next.js (React + TS): UI + /api
│   ├── app.yaml                    # runtime: start command + env (valueFrom resources)
│   ├── package.json                # "start" must bind to $DATABRICKS_APP_PORT
│   ├── next.config.js
│   ├── lib/db.ts                   # pg Pool + runtime credential (token) refresh
│   ├── lib/auth.ts                 # read OAuth identity headers
│   ├── app/api/**/route.ts         # backend endpoints (per API_CONTRACT.md)
│   └── app/**                      # React UI
├── agent/                          # App 2 — Python agent
│   ├── app.yaml                    # runtime: uvicorn on $DATABRICKS_APP_PORT
│   ├── requirements.txt            # deps
│   ├── main.py                     # FastAPI: POST /generate (SSE)
│   ├── agent.py                    # OpenAI Agents SDK loop + MLflow tracing
│   └── tools.py                    # getEpisode/getComments/getCharacter (psycopg, read-only)
├── databricks.yml                  # (optional) Asset Bundle: define both apps + resources
└── .github/workflows/deploy.yml    # CI/CD
```

## App 1 — Web (Next.js) boilerplate

**`web/app.yaml`**
```yaml
command: ["npm", "run", "start"]
env:
  - name: "DATABRICKS_SERVING_ENDPOINT"
    value: "databricks-claude-sonnet-5"
  # Lakebase resource auto-injects PGHOST/PGPORT/PGDATABASE/PGUSER/PGSSLMODE
  # (no PGPASSWORD — fetched at runtime, see lib/db.ts)
```

**`web/package.json`** — start script must use the injected port:
```json
{ "scripts": { "build": "next build", "start": "next start -p ${DATABRICKS_APP_PORT:-3000}" } }
```

**`web/lib/db.ts`** — pg Pool; password = runtime Databricks credential token (refresh before ~1h expiry). Uses `PG*` env from the bound resource. For local dev, fall back to `.env` (`nexus_app`).

**Resources to bind (in the App UI or bundle):**
- **Database** (Lakebase `nexus-db` → key `postgres`) → grants the app's SP `CONNECT`+`CREATE`, injects `PG*`.
- **Model serving endpoint** (`databricks-claude-sonnet-5` → key `serving-endpoint`) — if the web app proxies `/api/generate` to the LLM directly; otherwise the agent app holds this.
- **Secret** (scope `nexus`) — only if you keep the native `nexus_app` password path.

**Auth (no server needed):** Databricks Apps injects OAuth identity as request headers — read `X-Forwarded-Email` / `X-Forwarded-User` (and `X-Forwarded-Access-Token` for on-behalf calls) in `lib/auth.ts` for `GET /api/me` and access checks.

## App 2 — Agent (Python) boilerplate

**`agent/app.yaml`**
```yaml
command: ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$DATABRICKS_APP_PORT"]
env:
  - name: "LLM_ENDPOINT"
    value: "databricks-claude-sonnet-5"
```

**`agent/requirements.txt`**
```
fastapi
uvicorn[standard]
psycopg[binary]
databricks-sdk
mlflow[databricks]>=3.1
openai            # or the agents SDK the template uses
```

**Resources to bind:** Database (`postgres`, read-only queries), Model serving endpoint (`serving-endpoint`), MLflow experiment (for tracing/eval).

## Cross-cutting

- **Runtime DB password:** deployed apps get `PG*` but no password — generate a credential token via the Databricks SDK at startup and on refresh. (`databricks.sdk.WorkspaceClient().database.generate_database_credential`). Local dev uses the stored `nexus_app` secret.
- **File size:** no single app file > 10 MB (don't commit `node_modules`/build artifacts).
- **App count:** 2 apps — within the Free-Edition limit of 3.
- **AppKit (optional):** Databricks AppKit is a Node/React SDK with type-safe Lakebase queries + prebuilt components — could replace hand-rolled `lib/db.ts`. Evaluate vs. plain `pg`.

## CI/CD (`.github/workflows/deploy.yml`)
- Auth via a Databricks **service principal** token stored as a GitHub secret (`DATABRICKS_TOKEN`, `DATABRICKS_HOST`).
- Deploy with either:
  - **Databricks Asset Bundle:** `databricks bundle deploy` (define both apps + resources in `databricks.yml`), or
  - **Direct:** `databricks apps deploy <app> --source-code-path <workspace-path>` after syncing files.
- Trigger on push to `main`.

## Provisioning still to do (CLI)
```bash
databricks apps create nexus-web
databricks apps create nexus-agent
# add resources (DB, serving endpoint, secret, experiment) via UI or bundle
# databricks sync ./web  <workspace-path>   &&  databricks apps deploy nexus-web ...
```

## Status
- [x] Lakebase provisioned + schema + seed
- [x] Secret scope `nexus`
- [x] LLM endpoints available (no key needed)
- [ ] `web/` scaffold (app.yaml, package.json, lib/db.ts, /api routes)
- [ ] `agent/` scaffold (app.yaml, requirements.txt, main.py, tools.py)
- [ ] Create + bind the two Apps
- [ ] `databricks.yml` bundle + GitHub Actions deploy
- [ ] Service principal + GitHub secrets for CI/CD
```
