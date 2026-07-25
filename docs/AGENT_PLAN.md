# NEXUS — Agent Plan

The single **tool-calling, read-only** co-author agent. Two jobs:

1. **Regeneration** — write the next episode of an *alternate timeline* that branches from a decision point, consistent with canon.
2. **Analytics insight** — turn exact retention numbers (from SQL) into a readable explanation + suggestions for the author.
3. **Cinematic narration (TTS)** — render the approved episode to audio with per-character voices via Gemini TTS (see below).

The agent runs a **tool-calling loop with a streamed reasoning trace**, so the demo shows the LLM *thinking* and *choosing tools live* — a core wow moment.

**Honest framing:** one agent, one LLM, a small set of read-only tools. Not multi-agent. The agent **never writes to the DB** — the web backend owns every write (episodes persist only on HITL approval; ratings/verify via API).

**LLM:** Databricks-hosted `databricks-claude-sonnet-5` (OpenAI-compatible serving endpoint; no API key). **Tracing:** MLflow wraps every run.

---

## Execution model: tool-calling loop with streamed reasoning

The agent runs a **true tool-calling loop**. The LLM decides which tools to call, in what order, and we **stream every step to the UI** so the audience watches it reason:

```
loop:
  model emits reasoning + (optional) tool calls
  → stream `reasoning` deltas          ("I need the character roster to keep voices consistent…")
  → for each tool call: stream `tool_call` {name,args}
  → execute tool (read-only Lakebase)
  → stream `tool_result` {name, summary}
  → feed results back to the model
until model stops calling tools and streams the final episode
  → stream `token` deltas (the prose)
  → `done`
```

**Reasoning trace:** if the serving model exposes reasoning/extended-thinking, we stream those deltas as `reasoning` events. If not (OpenAI-compat endpoints may hide chain-of-thought), the **tool_call / tool_result events are the visible reasoning** — the UI renders them as live steps ("🔎 fetching characters…", "📖 reading prior episodes…"). Either way the demo shows real, honest agent activity, not a fake spinner.

Same tools power all three modes. Regeneration and analytics both go through this loop.

---

## Tools (all read-only; source of truth = Lakebase)

| # | Tool | Input | Returns | SQL source |
|---|---|---|---|---|
| 1 | `get_episode` | `episode_id` | id, series_id, title, content, summary, prev_episode_summary, order_index, decision_point, is_canonical | `episodes` |
| 2 | `get_prior_episodes` | `series_id`, `before_order` | canonical episodes up to the fork point (id, title, summary, order_index) | `episodes` (is_canonical, order_index ≤) |
| 3 | `get_characters` | `series_id` | name, role, personality, backstory, goals, speech_style, status | `characters` |
| 4 | `get_style_guide` | `series_id` | pov, tense, tone, pacing, content_rating, narrative_voice | `style_guide` |
| 5 | `get_open_threads` | `series_id` | open plot threads to honor/advance | `plot_threads` (status='open') |
| 6 | `get_comments` | `episode_id` | reader reviews (author, text) — incl. the driving comment | `reviews` ⟕ `users` |
| 7 | `get_retention` | `episode_id` | 10s-bucket retention curve + starters; drop-offs derived | `episode_retention` view + `playback_events` |

Tools 1–6 feed **regeneration**. Tool 7 feeds **analytics insight**. No `saveDraft` — writes go through `POST /api/episodes` after approval.

### Context assembled for regeneration
prior canon summaries + character roster/state + style guide + open threads + source episode (the decision point) + changed decision + driving reader comment + optional author instructions.

---

## System prompt — Regeneration mode

```
You are the AI co-author of a serialized story. Write the NEXT episode of an
ALTERNATE TIMELINE that branches from a single changed decision.

Non-negotiable rules:
1. CHARACTER CONSISTENCY — every character must match their established
   personality, voice (speech_style), goals, and current status. A character
   must not know things they could not know in this timeline.
2. CONTINUITY — honor all prior canon EXCEPT the one changed decision and its
   downstream consequences. Do not contradict established world facts.
3. DIVERGENCE — the changed decision must produce a genuinely different, causal
   outcome. Show consequences; don't snap back to the original path.
4. STYLE — obey the series style guide exactly: POV, tense, tone, pacing,
   narrative voice, and content rating. Never exceed the content rating.
5. THREADS — advance or acknowledge open plot threads where natural; do not
   resolve threads the author hasn't set up.
6. READER INTENT — if a driving reader comment is provided, let it steer the
   branch, but never at the cost of rules 1–4.

Output format:
  TITLE: <episode title>
  <prose of the episode>

Write only the episode. No commentary, no meta-notes, no spoilers of future
canon. Length: a complete episode beat (~800–1500 words).
```

**User message** carries: source episode title + content, the CHANGED DECISION, the DRIVING READER COMMENT, EXTRA INSTRUCTIONS, plus the assembled STYLE / CHARACTERS / PRIOR EPISODES / OPEN THREADS blocks.

---

## System prompt — Analytics insight mode

```
You are a story analytics assistant for the author. You are given EXACT audience
retention numbers computed from playback data, aligned to moments in the episode.
Your job is to explain, in plain language, what the data shows and what to do
about it.

Rules:
1. TRUST THE NUMBERS — never invent or alter figures. Only interpret the data
   you are given. If data is sparse, say so.
2. LOCATE — tie each notable drop-off or retention peak to the specific scene or
   beat at that timestamp.
3. EXPLAIN — give the most likely narrative reason (pacing, a slow scene, a
   character absence, a confusing turn, a satisfying hook).
4. ADVISE — offer 2–3 concrete, actionable suggestions for the next episode.
5. BE HONEST about sample size and that early-stage numbers may be noisy.

Output: a short readable summary (3–5 sentences) followed by a bullet list of
suggestions. No fabricated statistics.
```

**User message** carries: the retention curve (buckets + retention + starters), computed drop-off points mapped to scene text/timestamps, and the episode text.

> Retention is computed by **SQL**, not the LLM. The model only narrates the numbers it is handed. No training/fine-tuning is used for analytics.

---

## Flows

**Regenerate (HITL):**
```
POST /api/episodes/:id/fork   (web assembles fork context, no write)
  → POST /generate            (agent: tool-calling loop → stream reasoning + tools + prose)
  → author approves in split-view
  → POST /api/episodes        (web persists the new fork episode)   ← only write
  → POST /api/episodes/:id/narrate  (web → Gemini TTS render → audio_url)
```

**SSE event schema (`/generate`):**
```
event: reasoning     data: {"delta": "…"}                # thinking trace (if available)
event: tool_call     data: {"name":"get_characters","args":{…}}
event: tool_result   data: {"name":"get_characters","summary":"7 characters"}
event: token         data: {"delta": "…"}                # final prose
event: done          data: {"title":"…"}
event: error         data: {"message":"…"}
```

**Analytics insight:**
```
GET  /api/episodes/:id/retention   (web: SQL → exact curve + drop-offs)
  → POST /analyze                  (agent: narrate numbers → summary + suggestions)
  → UI shows chart (SQL) + written insight (LLM)
```

---

## Guardrails
- **Read-only** DB role for the agent; no write path exists in agent code.
- **Content rating** enforced in the system prompt; never exceeded.
- **No hallucinated facts/numbers** — analytics only interprets supplied data.
- **Continuity/character** rules are prompt-level; evals below verify them.

## Observability & Evals
- **MLflow tracing** on every generation and analysis run (inputs, prompt, tokens, latency).
- **LLM-judge evals** (dev + judge benchmark, run in Databricks — NOT stored in app DB):
  continuity, character fidelity, prose quality, safety/content-rating.

---

## Cinematic narration (TTS) — Gemini

After an episode is approved, render it to **cinematic audio** with **per-character voices**. External to Databricks (paid **Gemini API key**); everything else stays on Databricks.

**Model:** Gemini 2.5 TTS (`gemini-2.5-flash-preview-tts`; `gemini-2.5-pro-preview-tts` for higher quality). Supports **single-speaker** and **multi-speaker** synthesis, with **natural-language style control** ("read cinematically, tense and hushed").

### Character personas = voice + style
Each character gets a **persona**: a prebuilt Gemini voice + a style instruction derived from the character's `speech_style`/`personality`, plus a dedicated **Narrator** voice from the series `style_guide.narrative_voice`.

Proposed persona map (Gemini prebuilt voices — e.g. Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede):
```
Narrator      -> Charon   | "grave, cinematic storyteller; measured pace"
Aldric (king) -> Orus     | "commanding, weary authority"
Lady Corvin   -> Kore     | "cold, precise, dangerous calm"
...
```

**Schema:** episodes already have `audio_url` + `audio_duration_ms`. To store personas, add two columns to `characters` (proposed):
`tts_voice VARCHAR(30)` and `tts_style TEXT`. Until then, keep a static voice map in the render service keyed by character name.

### Render pipeline (backend render step, not an agent tool)
```
approved episode text
  → segment into speaker turns (narration vs each character's dialogue)
  → for each turn: Gemini TTS with that persona's voice + style prompt
  → concatenate segments -> one mp3
  → upload -> set episodes.audio_url + audio_duration_ms
  → (capture per-segment timing -> feeds retention buckets later)
```

**Honest constraints:**
- Gemini **multi-speaker TTS caps at 2 speakers per request**. Full cast = render per-speaker turns single-speaker and stitch, OR pick a scene with narrator + ≤2 characters for the multi-speaker path.
- TTS runs **offline/async**, not on the demo critical path. Per Phase 4, **one pre-rendered cinematic clip** behind the 🔊 button is enough to wow; batch-render the rest if time allows.
- Ownership: **web backend** calls Gemini and writes `audio_url`. The agent stays read-only and Databricks-only.

---

## Endpoints (agent service)
- `GET /health`
- `POST /generate` — SSE stream (reasoning + tool_call + tool_result + token + done); body: `source_episode_id`, `decision_point`, `driving_review_id?`, `instructions?`
- `POST /analyze` — retention insight; body: `episode_id` (+ retention payload)

> Narration lives in the **web backend** (`POST /api/episodes/:id/narrate` → Gemini), not the agent, to keep the agent read-only and free of external keys.
