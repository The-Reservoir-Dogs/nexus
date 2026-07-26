# nexus

Living story multiverse — listen to a canonical timeline, fork any decision point, and an
AI co-author regenerates a consistent alternate future. See `docs/` for product, UX,
schema, and wireframe plans.

## Local dev (live mode against local Postgres)

The web app runs in two modes via `NEXT_PUBLIC_API_MODE`:
- `mock` — dummy JSON in `web/mocks/` (no DB).
- `live` — real `/api` routes → local Postgres (see `web/.env`).

### 1. Provision the DB (one-time)
```bash
# Postgres running locally on :5432
psql -p 5432 -d postgres -c "CREATE DATABASE nexus;" \
  -c "CREATE ROLE nexus_app LOGIN PASSWORD 'nexus_local_pw';"
psql -p 5432 -d nexus -f schema.sql
psql -p 5432 -d nexus -f seed.sql
psql -p 5432 -d nexus -c "GRANT USAGE ON SCHEMA public TO nexus_app; \
  GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO nexus_app; \
  GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO nexus_app;"
```
`web/.env` is preconfigured for this (`NEXT_PUBLIC_API_MODE=live`, `PG*`, `DEV_USER=sriman`).

### 2. Run the web app
```bash
cd web && npm install && npm run dev   # http://localhost:3000
```
`DEV_USER` (or the `x-nexus-dev-user` header) impersonates a seeded user locally since there
is no Databricks OAuth. Production wiring lives in `start.sh`.

### Generation
`/api/generate` proxies the Python agent (SSE). When the agent/LLM is unreachable locally, a
**dev-only canned SSE fallback** streams a draft so the fork→generate→approve loop works
end-to-end. Disabled in production.

## Tests

```bash
cd web
npm run test        # vitest unit/component suite (mock mode)
npm run test:e2e    # Playwright end-to-end against the REAL backend + local Postgres
```

The Playwright suite (`web/e2e/`) reseeds the local `nexus` DB (globalSetup), boots `next dev`
in live mode with `AGENT_URL=""` (forces the generate fallback), and drives the full demo path:
**login → home → reader → rate + comment → analytics/retention → create branch → agent
generates → approve & publish** (which writes a real chained episode row).

## Branch continuity (N, N+1, N+2)

Evolving state is stored as **episode-keyed snapshots**, resolved by walking a timeline's
lineage:
- `episodes.prev_episode_id` chains each episode to the previous one in *its own* timeline.
- `episode_ancestry` view walks that chain (canonical spine + fork).
- `character_state` / `char_relationship_state` / `plot_thread_state` hold per-timeline
  snapshots; the nearest ancestor wins (e.g. a character killed on a branch stays dead into
  N+2 while remaining alive on the sacred timeline). See `schema.sql`.
