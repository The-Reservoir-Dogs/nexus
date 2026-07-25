# NEXUS — Delivery Roadmap

Execution plan for the hackathon MVP. Four phases, parallelized where possible. See `PRODUCT.md` for scope/user stories, `TECH_DESIGN.md` + `DATABRICKS_ARCHITECTURE.md` for architecture.

**Guiding rule:** frontend (dummy JSON) and agent build run **in parallel** against a shared API contract, then integrate. Seed the living universe early — an empty app loses.

---

## Phase 1 — Infrastructure Ready

Goal: everything provisioned so app + agent have somewhere to run and something to talk to.

| Task | Detail | Done when |
|---|---|---|
| Create Databricks project/workspace | Free Edition workspace; enable Databricks Apps + Lakebase in previews | Workspace reachable, Apps + Lakebase enabled |
| Provision Lakebase (Postgres) | 1 project (scale-to-zero). Apply `schema.sql`. | `\dt` shows all 13 tables; connection string in secrets |
| Seed the living universe | 1 rich series, 4+ canonical episodes, characters + state + relationships, world/style, 2 forks, ratings + comments | `SELECT` returns a populated, believable series |
| Host the application | Create Databricks App(s): frontend + agent (or single app). Confirm OAuth login. | App URL loads a placeholder; auth works |
| LLM access | External Model endpoint (own API key) or Foundation Model API; verify a test completion | Test call returns text |
| Dev infra / CI-CD | Git repo (done), branch strategy, GitHub Actions → deploy to Databricks Apps, secrets/env config, `.env.example` | Push to main auto-deploys; env documented |
| **API contract** | Agree request/response JSON for episodes, series, comments, fork, generate. Publish as `docs/API_CONTRACT.md`. | Both FE + agent devs sign off |

**Dependencies:** schema → seed. LLM access → agent phase. API contract unblocks Phase 2 + 3 in parallel.
**Owner:** infra lead.

---

## Phase 2 — Frontend (dummy JSON) — *Sriman*

Goal: full UX built against dummy JSON matching the API contract, so it works before the backend is live.

| Task | User story | Notes |
|---|---|---|
| Auth + shell | US-1, US-7 | Databricks Apps OAuth; app layout |
| Netflix dashboard | US-2 | Series cards + metadata; dummy data |
| Series → episode list | US-3 | Timeline view, canonical vs forks |
| Episode reader | US-4 | Content render; 🔊 button placeholder |
| Rate + comment | US-6 | Post/read; feeds the fork |
| Timeline tree / alternate timelines | US-5 | Show forks per decision point, top-rated first |
| **Fork a decision → editor** | US-8, US-9 | Monaco/VS Code-style; chat panel on right |
| **Split-view (original vs regenerated)** | US-15 | The signature component — build this well |
| HITL approve / reject / edit | US-10 | Obvious, satisfying control |
| Verify tick (author view) | US-14 | Badge + rerank |

**Dependencies:** API contract (Phase 1). Swap dummy JSON → live API during integration.
**Acceptance:** whole demo path clickable on dummy data, incl. split-view.
**Owner:** Sriman.

---

## Phase 3 — Agent + Evals (Databricks)

Goal: single tool-calling agent that regenerates a consistent alternate future, plus eval benchmarks for the judges.

| Task | Detail | Done when |
|---|---|---|
| Scaffold agent | Deploy from `agent-openai-agents-sdk` App template; wire LLM endpoint | Chat UI responds |
| Tools (query Lakebase) | `getEpisode`, `getComments`, `getCharacter`, `saveDraft` | Each tool returns real seeded data |
| Context assembly | prior episode + character state + world/style + open threads + driving comment + decision premise | Prompt logs show full context |
| Regeneration + streaming | Generate next episode in the NEW timeline; stream tokens | Coherent episode produced |
| HITL commit | `saveDraft` only after approval → new fork episode in Postgres | Approved draft persists; rejected does not |
| MLflow tracing | Wrap every run | Traces visible in MLflow |
| **Evals (dev + judge benchmark)** | LLM-judge scorers: continuity, character fidelity, quality, safety. Run in Databricks, **not** stored in app DB. | Benchmark table/notebook to show judges |

**Dependencies:** Lakebase seed + LLM access (Phase 1). API contract for FE integration.
**Acceptance:** given a decision point + comment, agent returns a consistent alternate episode; eval scores exist for the demo.
**Owner:** agent lead.

---

## Phase 4 — Good-to-have Features

Goal: polish + optional wow, only after the core loop is solid.

| Task | Priority | Notes |
|---|---|---|
| TTS audio clip | Med | One pre-rendered mp3 behind 🔊. Do NOT build a live pipeline. External Model endpoint or offline render. |
| Character-consistency showpiece | High | Explicitly surface a character behaving consistently across timelines in the demo |
| Ranking polish | Low | avg_rating sort; verified boost |
| Analytics number (faked) | Low | Cosmetic co-author stat if asked |
| Demo hardening | **High** | Pre-warm Lakebase + endpoints; record backup video; rehearse pitch 10x |

**Owner:** whole team, day 2 PM.

---

## Timeline (≈2 days)

| When | Focus |
|---|---|
| Day 1 AM | Phase 1: infra, Lakebase + schema, **seed universe**, API contract |
| Day 1 PM | Phase 2 (FE on dummy JSON) + Phase 3 (agent + tools) in parallel |
| Day 2 AM | Fork UX + **split-view**; agent regeneration end-to-end; integrate FE ↔ live API |
| Day 2 midday | Verify/rerank; MLflow eval benchmark; character-consistency showpiece |
| Day 2 PM | Phase 4 polish, TTS clip, **pre-warm + backup video + rehearse** |

---

## Critical path
`schema → seed → agent tools → regeneration → split-view integration → verify/rerank → rehearse`

Anything not on this path is optional. Protect it.

## Risks
- **Cold starts** (Lakebase scale-to-zero, endpoints, Apps 24h auto-stop) → pre-warm before demo; keep backup video.
- **FE/agent drift** → the shared API contract is the guardrail; agree it in Phase 1.
- **Scope creep** → Phase 4 items never block Phase 1–3.
