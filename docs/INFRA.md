# NEXUS — Infrastructure (provisioned)

Live state of the Databricks infra. Managed via the Databricks CLI.

## Workspace
- Host: `https://dbc-60b5b94b-8e3e.cloud.databricks.com`
- Auth: `databricks auth login --host <host>` (OAuth, cached in `~/.databrickscfg`)

## Lakebase (serverless Postgres) — `nexus-db`
- Status: AVAILABLE · PG 16 · capacity CU_1 · pg-native-login enabled
- Read/write host: `ep-round-bar-d8cmwzqy.database.us-east-2.cloud.databricks.com`
- Read-only host: `ep-round-bar-d8cmwzqy-ro.database.us-east-2.cloud.databricks.com`
- Port: `5432` · Database: `databricks_postgres` · SSL: `require`
- Tables: 12 (from `schema.sql`), seeded with `seed.sql`.

### Connecting
**App role (stable, use this in apps):** `nexus_app` — read/write on all `public` tables. Password is in the `nexus` secret scope (below). NOT in git.

**Admin (interactive, token — expires ~1h):**
```bash
export PGPASSWORD=$(databricks database generate-database-credential \
  --json '{"instance_names":["nexus-db"]}' -o json | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
psql "host=ep-round-bar-d8cmwzqy.database.us-east-2.cloud.databricks.com port=5432 \
  user=abrahamjeron40@gmail.com dbname=databricks_postgres sslmode=require"
```

## Secrets — scope `nexus`
| Key | Value |
|---|---|
| `pg_host` | Lakebase r/w host |
| `pg_port` | 5432 |
| `pg_db` | databricks_postgres |
| `pg_user` | nexus_app |
| `pg_password` | (secret) |

Read in an app: `databricks secrets get-secret nexus pg_password`, or reference from a Databricks App resource. Locally, copy `.env.example` → `.env`.

## LLM endpoints (Databricks-hosted Foundation Models — no API key needed)
Chat: `databricks-claude-sonnet-5` (recommended for the writer), `databricks-claude-opus-5`, `databricks-gpt-5-6-*`, `databricks-llama-4-maverick`, `databricks-qwen*`, `databricks-glm-5-2`.
Embeddings (roadmap): `databricks-gte-large-en`, `databricks-bge-large-en`.

Query example:
```bash
curl -s https://dbc-60b5b94b-8e3e.cloud.databricks.com/serving-endpoints/databricks-claude-sonnet-5/invocations \
  -H "Authorization: Bearer $(databricks auth token -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}],"max_tokens":50}'
```

## Not yet provisioned
- Databricks Apps (web + agent) — `databricks apps create ...`
- CI/CD (GitHub Actions → Apps deploy)

## Seeded demo universe
Series **The Hollow Crown** (id 10): 4 canonical episodes; episode 3 "The Spared Blade" has a decision point; 2 alternate timelines forked from it — **"The Fallen Blade"** (verified, avg 5.0) and "A Bargain in Blood" (avg 3.5). Driving comment = review 5001 by reader_amy.
