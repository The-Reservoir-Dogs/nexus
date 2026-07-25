# NEXUS on Databricks — Platform Architecture

Goal: build the **entire** NEXUS stack on Databricks only — frontend hosting, transactional DB, LLM inference, one tool-calling agent, and evals. Verified against current Databricks docs (AWS docs, Nov 2025).

**MVP posture:** keep it lean. **Lakebase (Postgres) is the single data store**; a **single tool-calling agent** reads context straight from it and calls the LLM; **MLflow** traces + scores. **Vector DB (AI Search), lakehouse sync pipelines (DLT/CDC), and multi-agent orchestration are deliberately deferred** — context fits in the prompt. They're the "infinite universe" scale story, not MVP code.

---

## 1. Databricks Services (verified)

### MVP — services we actually build on

| Need | Databricks service | Notes from docs |
|---|---|---|
| Host the web app | **Databricks Apps** | Serverless hosting. Python (Streamlit, Dash, Gradio) **and Node.js (React, Angular, Svelte, Express)**. OAuth built in. Deploy from local or GitHub Actions CI/CD. |
| Single data store (users, episodes, timelines, comments, ratings, character memory) | **Lakebase** (managed serverless Postgres) | Fully managed Postgres. Autoscaling, **scale-to-zero**, instant branching, point-in-time restore. Connect via `psql` or any Postgres driver. |
| LLM inference | **Foundation Model APIs** + **Model Serving** | Pay-per-token endpoints for open + frontier models. **External Models** to proxy OpenAI/Anthropic (and optional TTS) under one gateway. |
| Agent | **Mosaic AI Agent Framework** | Author a **single tool-calling agent** (OpenAI Agents SDK / custom) + deploy on Databricks Apps. Built-in streaming chat UI, MLflow tracing. Template: `agent-openai-agents-sdk`. |
| Evals + observability | **MLflow 3 GenAI Evaluation** | Built-in + custom **LLM judges**, eval datasets, tracing, **Review App** for human feedback. `mlflow[databricks]>=3.1`. |

### Roadmap — verified to exist, deferred past MVP

| Need (at scale) | Service | Why deferred |
|---|---|---|
| Vector DB / RAG | **AI Search** (Vector Search) — Delta Sync index, HNSW, hybrid search, reranking | One-level forking keeps lineage shallow → context fits in prompt. Add when episodes/character bible outgrow the window. |
| Analytics pipelines | **Lakeflow / DLT** | Direct SQL over Postgres is enough at MVP scale. |
| Lakehouse governance | **Unity Catalog + Delta** | Not needed while Lakebase is the only store. |

**Bottom line:** Lakebase (serverless Postgres) + Databricks Apps (hosting) + Foundation Model APIs + one Mosaic AI agent + MLflow cover the whole MVP. AI Search / DLT / UC are real and available when you scale.

---

## 2. Target Architecture (MVP, Databricks-native)

```
┌───────────────────────────────────────────────────────────────┐
│  DATABRICKS APPS  (serverless hosting, OAuth)                  │
│                                                               │
│  ┌─────────────────────────┐   ┌──────────────────────────┐  │
│  │ Frontend App (React/     │   │ Agent App (OpenAI SDK)   │  │
│  │ Node or Streamlit)       │──▶│ single tool-calling loop │  │
│  │ • Netflix dashboard      │   │ • streaming HITL editor  │  │
│  │ • reader + split-view    │   │ • built-in chat UI       │  │
│  │ • timeline tree, ratings │   │ • MLflow tracing         │  │
│  └───────────┬──────────────┘   └───────────┬──────────────┘  │
└──────────────┼──────────────────────────────┼─────────────────┘
     Postgres  │                              │ tools:
     driver    │                              │  getEpisode/getComments
    ┌──────────▼──────────────┐   ┌───────────▼─────────────┐
    │ LAKEBASE (Postgres)     │   │ Model Serving / FM APIs │
    │ users, series,          │◀──│ LLM gen                 │
    │ episodes, timelines,    │   │ + External Models       │
    │ ratings, comments,      │   └───────────┬─────────────┘
    │ character_memory        │               │
    └─────────────────────────┘   ┌───────────▼─────────────┐
                                  │ MLflow 3: tracing +     │
                                  │ LLM-judge quality gate  │
                                  └─────────────────────────┘
                          (optional, good-to-have)
                    ┌────────────────────┐
                    │ TTS API (external) │  audio drama render
                    └────────────────────┘
```

Two Databricks Apps (frontend + agent), or a single app if simpler. **Lakebase is the only data store** — no Delta/UC/vector layer in the MVP. The agent reads context directly from Postgres via tools.

---

## 3. Data Layout (Lakebase / Postgres — single store)

All in Lakebase, read/written by the app for low latency and by the agent via tools:

- `users` (id, name, role: fan|coauthor|author)
- `series` (id, title, cover, og_author_id, contributor_count, episode_count)
- `episodes` (id, series_id, number, timeline_id, author_id, parent_episode_id, content, is_canonical, verified_by_author, decision_point, audio_url?)
- `timelines` (id, series_id, forked_from_episode_id, owner_id, driving_comment_id?, created_at)
- `ratings` (id, episode_id, user_id, score)
- `comments` (id, episode_id, user_id, body, created_at)
- `character_memory` (id, series_id, name, profile) — plain text, passed to the prompt

**No sync pipeline, no vector index, no embeddings for MVP.** Context = prior episode text + character memory + driving comment, pulled by `SELECT` and put in the prompt.

---

## 4. Agent (single tool-calling loop, Mosaic AI)

Deploy from the `agent-openai-agents-sdk` App template (includes REST API + chat UI + MLflow eval code). One agent, not a multi-agent orchestration — honest and sufficient.

**Tools (query Lakebase):**
- `getEpisode(episode_id)` — decision-point episode + prior episodes on the timeline.
- `getComments(episode_id)` — reader comments/ratings driving the regeneration.
- `getCharacter(series_id)` — persistent character memory as text.
- `saveDraft(...)` — persist approved episode version (called only after HITL approval).

All LLM calls route through Foundation Model APIs / Model Serving. MLflow tracing wraps every run.

**HITL / regeneration flow:**
```
Co-author picks decision point (+ driving comment)
  → agent gathers context via tools
  → regenerates next episode in the NEW timeline (streamed)
  → split-view: original vs regenerated
  → co-author edits / accepts / rejects
  → on accept: saveDraft → new timeline episode in Lakebase → (optional) TTS
```

---

## 5. Evals (MLflow 3 GenAI)

- Custom **LLM judges**: continuity/canon, character fidelity, narrative quality (rubric), safety.
- Trace every generation; surface **at least one score inline** on the regenerated episode (the tangible P1 "quality/consistency" proof).
- Gate: block auto-save when continuity/safety below threshold → force human review (reinforces HITL).
- **Review App** (optional) collects human feedback → eval data.

---

## 6. TTS / Audio (good-to-have)

Databricks has **no native TTS**.
- **MVP:** one pre-rendered clip behind a 🔊 button, or skip.
- **If built:** proxy ElevenLabs / OpenAI TTS via a **Databricks External Model serving endpoint** (unified auth/logging) or a Databricks job → store audio in object storage → path in Lakebase → player streams. Per-character voice map from `character_memory`, SSML pacing.
- Free-Edition Apps have restricted outbound internet — whitelist the TTS domain or run TTS from a job.

---

## 7. Hackathon Constraints (Free Edition limits — verified)

| Resource | Free Edition limit | Impact on NEXUS |
|---|---|---|
| Databricks Apps | **Up to 3 apps**; auto-stops after 24h idle, restartable | Frontend + agent app fits. Restart + pre-warm before demo. |
| Lakebase | **1 project**, scale-to-zero | One Postgres project = whole data layer. First query after idle has cold start — pre-warm it. |
| Model Serving | limited endpoints, **no GPU, no provisioned throughput**, some models gated | Use pay-per-token FM APIs / External Models, not self-hosted GPU. |
| Compute | serverless only; **restricted outbound internet** | Any external call (TTS) must hit trusted domains — verify or use a job. |
| *(if used later)* AI Search | 1 endpoint / 1 unit; no Direct Vector Access | Deferred; use Delta Sync when needed. |
| *(if used later)* Lakeflow | 1 active pipeline per type | Deferred. |

**Mitigations:** one frontend + one agent app; **pre-warm Lakebase + serving endpoints before demo; keep a backup recorded video**; centralize any egress through External Models. LinkedIn verification unlocks higher limits + limited serverless GPU if needed.

---

## 8. Build Order (hackathon)

1. Create Lakebase project; schema for users/series/episodes/timelines/ratings/comments/character_memory.
2. **Seed a rich living universe** — 1 series, 4+ episodes deep, with timelines, ratings, comments, character memory. (Do this first — empty app = loss.)
3. Frontend Databricks App (React/Node or Streamlit): auth + roles, dashboard, series/episode reader, ratings/comments → Lakebase.
4. Agent App from `agent-openai-agents-sdk`: single tool-calling agent (getEpisode/getComments/getCharacter/saveDraft) + FM API calls; streaming HITL editor; MLflow tracing.
5. **Fork-a-decision (timeline) UX + split-view** original vs regenerated — the signature moment.
6. Verify/canonize + rerank; one MLflow eval judge scoring the regenerated episode inline.
7. (Optional) TTS clip behind a button.
8. Pre-warm everything + rehearse the demo; record a backup video.

---

## Source docs
- Lakebase: docs.databricks.com/aws/en/oltp/
- Databricks Apps: docs.databricks.com/aws/en/dev-tools/databricks-apps/
- Agent Framework (author + deploy on Apps): docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent
- MLflow GenAI eval: docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/
- Free Edition limits: docs.databricks.com/aws/en/getting-started/free-edition-limitations
- AI Search (roadmap): docs.databricks.com/en/generative-ai/vector-search.html
