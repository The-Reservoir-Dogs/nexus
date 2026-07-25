# NEXUS — High-Level Technical Design

**Narrative Engine for eXpanding Universe Storytelling**

A **living story multiverse**: readers rewind any decision point, an AI co-author regenerates a consistent alternate future (keeping every character true to their memory), and the original author verifies which branch becomes canon. Built **entirely on Databricks** — hosting (Apps), OLTP (Lakebase Postgres), LLM inference (Foundation Model APIs), a single tool-calling agent (Mosaic AI), and evals (MLflow 3). Only external hop is optional TTS. Chosen problem: **P1 — AI-Native Storytelling** (Story Time Machine + AI Co-Author + persistent character memory).

> Product + user stories: see `PRODUCT.md`. Deep platform details + Free-Edition limits: see `DATABRICKS_ARCHITECTURE.md`.

**Scope note:** Vector DB (AI Search), lakehouse sync pipelines (DLT/CDC), and multi-agent orchestration are **cut from the MVP** — context fits directly in the prompt, and a single tool-calling agent is enough. They remain roadmap items for the "infinite universe" scale story.

---

## 1. Product Summary

- **Sacred timeline → alternate timelines.** The original author writes the canonical episodes. A co-author picks a decision point in an episode and **forks one alternate timeline** from it (one level only — no sub-branches for MVP).
- **AI Co-Author editor.** VS Code + Copilot-style UX: manuscript (left) + agent chat (right). The agent regenerates the next episode from prior context + character memory + reader comments; the co-author edits/approves before anything is saved (human-in-the-loop).
- **Community loop.** Fans read, rate, and comment. Comments become the input that steers the next regeneration.
- **Split-view.** Original timeline vs regenerated timeline shown side by side — the signature moment.
- **Canon.** Top-rated timelines surface per decision point; the original author gives a verified tick to canonize one.
- **Audio (optional).** An episode can render to a TTS audio drama.

---

## 2. System Architecture (High Level)

```
┌───────────────────────────────────────────────────────────────┐
│  DATABRICKS APPS  (serverless hosting, OAuth)                  │
│  ┌─────────────────────────┐   ┌──────────────────────────┐   │
│  │ Frontend App (React/Node │──▶│ Agent App (Mosaic AI)    │   │
│  │ or Streamlit)            │   │ • single tool-calling    │   │
│  │ • Netflix dashboard      │   │   agent + HITL editor    │   │
│  │ • reader + split-view    │   │ • built-in chat UI       │   │
│  │ • timeline tree, ratings │   │ • MLflow tracing         │   │
│  └───────────┬──────────────┘   └───────┬──────────────────┘   │
└──────────────┼──────────────────────────┼─────────────────────┘
     Postgres  │                          │ tools:
     driver    │                          │  getEpisode / getComments
                │                          │  getCharacter / saveDraft
            ┌───▼──────────────┐   ┌───────▼─────────────────┐
            │ LAKEBASE (OLTP)  │   │ Foundation Model APIs / │
            │ users, series,   │◀──│ Model Serving (LLM gen) │
            │ episodes,        │   │ + External Models       │
            │ timelines,       │   └───────┬─────────────────┘
            │ ratings, comments│           │
            │ character_memory │   ┌───────▼─────────────────┐
            └──────────────────┘   │ MLflow 3: tracing +     │
                                   │ LLM-judge quality gate  │
                                   └─────────────────────────┘
                              (optional)
                    ┌───────────────────┐
                    │ TTS API (external)│  audio drama render
                    └───────────────────┘
```

**Design principle:** **Lakebase (serverless Postgres)** is the single source of truth for everything — users, episodes, timelines, comments, ratings, and character memory (plain text fields). The **agent** is one tool-calling loop that reads context straight from Postgres and calls the LLM. **MLflow** traces runs and scores quality. No separate lakehouse/vector layer in the MVP.

---

## 3. Databricks Usage (hackathon constraint)

| Capability | Databricks Component | Use in NEXUS (MVP) |
|---|---|---|
| App hosting | **Databricks Apps** (serverless) | Host frontend + agent app. Python (Streamlit/Dash/Gradio) or Node.js (React/Angular/Svelte/Express). OAuth built in. |
| Transactional DB | **Lakebase** (managed serverless Postgres) | Single store: users, series, episodes, timelines, ratings, comments, character_memory. Autoscale, scale-to-zero. |
| LLM inference | **Foundation Model APIs + Model Serving** | Generate/regenerate episode text. External Models to proxy a frontier LLM (and optional TTS). |
| Agent | **Mosaic AI Agent Framework** | One tool-calling agent (getEpisode, getComments, getCharacter, saveDraft). Deploy from `agent-openai-agents-sdk` App template. |
| Eval + tracing | **MLflow 3 GenAI Eval + Tracing** | LLM-judge continuity + character-fidelity + quality score; trace every generation. |
| *(roadmap)* Vector DB | *AI Search* | Only when lineage/character bible outgrows the prompt window. |
| *(roadmap)* Pipelines | *Lakeflow / DLT* | Only when analytics rollups need scale. |

Reference tutorials (provided): Databricks Fundamentals, Get Started with AI Agents, GenAI initial setup, Build a Data Pipeline. Full service verification + Free-Edition limits in `DATABRICKS_ARCHITECTURE.md`.

---

## 4. The Agent (single tool-calling loop)

One agent on Mosaic AI Agent Framework. Human-in-the-loop: nothing is saved until the co-author approves. Do **not** market this as "multi-agent" — it's one agent with tools, which is honest and enough.

**Tools (read context straight from Lakebase):**
- `getEpisode(episode_id)` — the decision-point episode + prior episodes on the timeline.
- `getComments(episode_id)` — reader comments/ratings that steer the regeneration.
- `getCharacter(series_id)` — persistent character memory (personality, arcs) as text.
- `saveDraft(...)` — persist an approved episode version (called only after HITL approval).

**Context assembled per generation:** prior episode text + character memory + the driving reader comment(s). All fits in the prompt window (one-level forking keeps lineage shallow). LLM call routes through Foundation Model APIs; the run is wrapped in MLflow tracing.

### HITL / regeneration flow
```
Co-author picks decision point + (optional) driving comment
   → agent gathers context via tools (getEpisode/getComments/getCharacter)
   → regenerates next episode in the NEW timeline (streamed)
   → split-view: original vs regenerated
   → co-author edits / accepts / rejects
   → on accept: saveDraft → new timeline episode in Lakebase → (optional) queue TTS
```

---

## 5. Data Model (Lakebase / Postgres — single store)

- **users** (id, name, role: fan|coauthor|author)
- **series** (id, title, cover, og_author_id, contributor_count, episode_count)
- **episodes** (id, series_id, number, timeline_id, author_id, parent_episode_id, content, is_canonical, verified_by_author, decision_point, audio_url?)
- **timelines** (id, series_id, forked_from_episode_id, owner_id, driving_comment_id?, created_at) — an alternate timeline = one fork from the sacred timeline
- **ratings** (id, episode_id, user_id, score)
- **comments** (id, episode_id, user_id, body, created_at)
- **character_memory** (id, series_id, name, profile) — plain text; passed to the prompt

**Timeline model:** `parent_episode_id` links an episode to the decision point it forked from. One level only — a timeline forks from the sacred timeline, not from another fork. `decision_point` on an episode marks where a rewind is offered.

---

## 6. Ranking & Verification (US-5, US-14)

- **Top timelines** per decision point: simple `ORDER BY avg_rating DESC` for MVP (no Bayesian math).
- **Verify tick:** original author sets `verified_by_author` → badge + rank boost. Reranking on the dashboard is a visible demo beat.

---

## 7. Evals (unblock #3)

**MLflow 3 GenAI Evaluation** with LLM-as-judge. Show at least one live score on the regenerated episode — this is the tangible proof of "AI maintains quality/consistency."

| Dimension | Method |
|---|---|
| Continuity / canon consistency | LLM judge comparing draft vs. prior episode + character memory; contradiction count |
| Character fidelity | Judge scores voice/personality match vs. character memory |
| Narrative quality | Rubric judge: coherence, pacing, engagement (1–5) |
| Safety | Toxicity / policy classifier |

Trace every generation in MLflow. Gate: block auto-save if continuity/safety below threshold → force human review (reinforces the HITL story). For the demo, surfacing one score inline is enough.

---

## 8. TTS / Audio (good-to-have, unblock #4)

- **MVP:** one pre-rendered clip behind a 🔊 button, or skip. Do **not** build the pipeline under time pressure.
- **If built:** on episode accept → TTS via a **Databricks External Model serving endpoint** (proxy ElevenLabs / OpenAI TTS) or a Databricks job → store audio in object storage → path in Lakebase → player streams. Per-character voice map from `character_memory`, SSML for pacing.
- Free-Edition Apps have restricted outbound internet — whitelist the TTS domain or run TTS from a job.

---

## 9. Idea Validation (unblock #2)

- **Hits three P1 themes in one demo:** Story Time Machine (rewind a decision, regenerate the future), AI Co-Author (crowd comments steer the story), persistent character memory (characters stay consistent across timelines).
- **Differentiator:** the multiverse/time-machine framing + **split-view** of original vs alternate future + human-in-the-loop author-as-showrunner. Visible and emotional, not just a chatbot.
- **Databricks-native:** everything runs on Apps + Lakebase + Foundation Model APIs + MLflow — an honest, strong sponsor-fit story.

---

## 10. MVP Scope vs. Stretch

**MVP (to win):** pre-seeded living universe, dashboard/series/reader, auth + roles, rate/comment, **fork a decision point (timeline)**, single tool-calling agent regenerates the alternate future with context, **split-view original vs alternate**, HITL approve, top-rated timelines, verify/canonize + rerank, one MLflow eval score. (Full tiered scope in `PRODUCT.md §4`.)

**Stretch / roadmap:** AI Search for infinite-lineage RAG, multi-agent split, DLT analytics at scale, per-character TTS voice casting, personalized villains, real-time multi-user influence, deeper multi-level branching.

---

## 11. Suggested Stack

- **Hosting:** Databricks Apps (serverless) — frontend app + agent app (or a single app).
- **Frontend:** React/Node on Apps (Monaco editor for VS Code feel) or Streamlit for speed. Split-view is the priority component.
- **Transactional DB:** Lakebase (managed serverless Postgres) via standard Postgres driver — single store.
- **AI:** Foundation Model APIs / Model Serving + one Mosaic AI tool-calling agent + MLflow 3 evals/tracing.
- **Audio (optional):** external TTS via External Model endpoint + object storage.
- **Auth:** Databricks Apps OAuth (hackathon-grade).

**Free-Edition constraints (verified):** up to 3 Apps (auto-stop after 24h idle), 1 Lakebase project (scale-to-zero cold start), no GPU serving / no provisioned throughput, restricted outbound internet. **Pre-warm Lakebase + serving endpoints before the demo; keep a backup recorded video.** See `DATABRICKS_ARCHITECTURE.md §7`.
