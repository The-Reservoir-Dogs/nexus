# NEXUS — Phase 3 Implementation: Evals as the Wow Factor

> **Branch:** `implementation-phase` · **Scope:** build the evaluation system that proves NEXUS's
> core claim — *"an AI maintains narrative quality and consistency across every timeline."*
>
> **How to use:** each sub-phase below is a self-contained **master prompt** for a coding agent.
> Run one at a time, follow **RED → GREEN → REFACTOR**, verify *Done-when*, commit, next.
>
> **Where it lives:** mostly `agent/` (Python, the LLM judges + orchestration + MLflow) plus a thin
> surfacing layer in `web/` (score chip, evidence, gate, self-heal animation). Reuses the existing
> agent tools (`get_prior_episodes`, `get_characters`, `get_style_guide`, `get_open_threads`,
> `get_comments`) as the judges' ground truth.

---

## 0. The Big Idea (read first)

Most teams will say "our AI is consistent." We **prove it with a number, show the evidence, and —
the part nobody else does — make the AI catch and repair its own mistake live, on stage.**

Three layers, escalating in wow:

1. **Score + evidence** — every regeneration is graded by judge-AIs on continuity, character
   fidelity, and reader-intent, each returning a 1–5 **plus a one-line quoted reason**.
   ("Continuity 3.1 — Corvin says she has never met Aldric, but they dueled in Ep2.")
2. **The gate (HITL)** — if a score is below threshold, the app **refuses to auto-save** and forces
   human review. Eval + human-in-the-loop become one story.
3. ⭐ **Eval-driven self-correction (the signature)** — when a judge fails, we feed the *exact
   violation back to the writer AI*, it **regenerates only to fix that break**, we **re-score**, and
   the UI shows: `⚠ caught a continuity break → repairing → ✓ resolved (3.1 → 4.7)`.
   The AI polices itself and heals itself, with receipts. **This is the moment the jury remembers.**

Plus, for credibility off-stage:

4. **Ablation** — run the same generation *with* vs *without* character memory; scores visibly drop
   without it. This **quantifies that the memory engine is what creates consistency.**
5. **MLflow benchmark** — a small golden dataset scored + logged in MLflow (Databricks partner
   points) = the "here is our evidence" table.

**Design principle:** evals are a *product feature and a demo weapon*, not a hidden test suite.
Everything a judge does must be **visible and explainable** — score, reason, quote.

---

## 1. Architecture

```
                          ┌─────────────────────────── agent/ (Python) ───────────────────────────┐
web/ (Next.js)            │                                                                        │
  split-view / editor     │   agent.py            judges.py             evals.py                    │
  ── POST /api/generate ─▶│   generate_stream ──▶ run_judge(dimension) ▶ evaluate(draft, ctx)       │
      (proxy to agent)    │        │                (LLM-as-judge,        │  - assemble ground truth │
  ◀─ SSE events ──────────│        │                 rubric + evidence)   │  - run all judges        │
      token / reasoning   │        ▼                                      │  - gate + self-heal loop │
      tool_call/result    │   self-correction ◀───────────────────────────  - MLflow log            │
      eval_start          │   (regenerate to fix the failed axis)                                   │
      eval_score  ◀────────────────────────────────────────────────────── per-dimension score+why   │
      regen_retry         │                                                                          │
      eval_final / done   │   tools.py (existing) = ground-truth reads from Lakebase                 │
                          └──────────────────────────────────────────────────────────────────────────┘
                                          MLflow 3 GenAI Eval  ◀── benchmark + traces (Databricks)
```

- **Judges read the same context the writer read** (prior episodes, character memory, style, threads,
  driving comment) so they never grade blind.
- **The web layer never changes shape** — new SSE events are additive; the FE ignores unknown events
  until Phase 8 wires them.

---

## 2. The Judges (dimensions + rubric design)

Four judges. The first three are our differentiators (nobody else scores *consistency*).

| Judge | Question | Ground truth it is given | Fail = ? |
|---|---|---|---|
| **Continuity** | Does the draft contradict established canon (except the changed decision)? | prior episodes + open plot threads + world/lore | a stated contradiction |
| **Character fidelity** | Do characters keep personality, voice, goals, and *knowledge limits*? | `characters` + `character_state.memory_snapshot` | out-of-character act / impossible knowledge |
| **Reader intent** | Did the branch genuinely follow the driving "what-if"? | the driving comment + `decision_point` | snapped back to original / ignored the ask |
| **Safety** | Toxicity / exceeds content rating? | `style_guide.content_rating` | policy breach |

### Rubric design rules (bake into every judge prompt)
- Output **strict JSON**: `{ "score": 1-5, "verdict": "pass"|"fail", "evidence": "<one quoted sentence>", "fix_hint": "<what to change>" }`.
- **Evidence must quote or cite the exact offending line** — no vague "feels off". This is what makes
  it believable on stage.
- "**Judge consistency, not prose length or beauty.** Ignore style unless asked."
- Give the judge the **reference context inline**; forbid it from assuming facts not provided.
- **Deterministic-ish:** temperature 0, short max tokens. A judge is a classifier, not a writer.
- **Threshold:** `pass` if score ≥ 4 AND no hard contradiction; continuity + safety are **blocking**.

---

## 3. Sub-Phase Map

| # | Phase | Where | Signature? |
|---|---|---|---|
| 1 | Judge runner + 4 rubrics (JSON score + evidence) | agent | |
| 2 | Ground-truth context assembly for judges | agent | |
| 3 | Golden dataset (seed decision points + expected constraints) | agent | |
| 4 | Eval orchestrator + MLflow tracing/logging | agent | |
| 5 | ⭐ Eval-driven self-correction loop | agent | ⭐ |
| 6 | Wire eval into `/generate` SSE + `/evaluate` endpoint (+ API contract) | agent + web | |
| 7 | The gate — block auto-save below threshold (HITL) | web (+contract) | |
| 8 | FE surfacing — real score chip, evidence, gate UI, self-heal animation | web | ⭐ |
| 9 | Ablation harness (memory on/off) + comparison view | agent + web | ⭐ |
| 10 | MLflow benchmark notebook + demo script + hardening | agent | |

---

## PHASE 1 — Judge Runner + 4 Rubrics

**Goal:** a reusable `run_judge(dimension, draft, context)` that returns a strict, evidence-bearing
JSON verdict, plus the four rubric prompts.

### MASTER PROMPT
```
Create agent/judges.py for NEXUS.

- Reuse the existing OpenAI-compatible client factory pattern from agent/agent.py (_client(),
  LLM_ENDPOINT, Gemini/Databricks aware). Judges use temperature=0, small max_tokens.
- Define a JudgeResult dataclass/TypedDict: { dimension, score:int(1-5), verdict:"pass"|"fail",
  evidence:str, fix_hint:str }.
- Implement run_judge(dimension: str, draft: dict, context: dict) -> JudgeResult:
  * builds a rubric-specific system prompt (see RUBRICS below),
  * passes the draft (title+content) AND the relevant ground-truth context inline,
  * requests STRICT JSON only, parses it defensively (never crash on a bad judge reply →
    fall back to verdict="fail", score=1, evidence="unpar-seable judge output").
- RUBRICS (4 constants), each: role="you are a strict story {X} auditor", the exact question,
  the ground truth it may rely on, the output JSON schema, and the rule "quote the exact offending
  line as evidence; judge {X} only, ignore prose beauty; do not assume facts not given."
  Dimensions: "continuity", "character_fidelity", "reader_intent", "safety".
- A helper score_all(draft, context) -> list[JudgeResult] that runs the four judges (sequential is
  fine; parallel optional later) and returns results.
- A pure helper aggregate(results) -> { overall: float, passed: bool, blocking_fails: list[str] }:
  overall = mean score; passed = all blocking dims (continuity, safety) verdict==pass AND overall>=4.

RED→GREEN→REFACTOR (agent/ uses pytest, mirror test_local.py style):
- RED: unit tests with a FAKE judge client (monkeypatch _client) that returns canned JSON — assert
  run_judge parses score+evidence; assert a malformed reply degrades to a fail (not a crash);
  assert aggregate() marks passed=False when continuity fails even if others pass.
- GREEN: implement.
- REFACTOR: extract JSON parsing; keep rubric text in one place.
```
**Done-when:** `run_judge` returns structured score+evidence for each dimension; malformed judge
output never crashes; `aggregate()` enforces blocking dimensions.

---

## PHASE 2 — Ground-Truth Context Assembly

**Goal:** give each judge exactly the canon it needs — reuse the agent's tools, don't re-query ad hoc.

### MASTER PROMPT
```
In agent/, add context assembly for evaluation (agent/evals.py, function assemble_context).

- assemble_context(source_episode_id, series_id, order_index, driving_review_id) -> dict with:
  { prior_episodes: [...], characters: [...], character_state: [...], style_guide: {...},
    open_threads: [...], driving_comment: {...}, decision_point: str }
  using the EXISTING tools in tools.py (get_prior_episodes, get_characters, get_style_guide,
  get_open_threads, get_comments, get_episode). No new SQL unless a needed field is missing.
- Trim each context slice to what a judge needs (e.g. character name+personality+voice+status+
  latest memory_snapshot; prior episodes as summaries + last full episode) so prompts stay small.
- Map dimension -> which context slices it receives (continuity: prior+threads+world;
  character_fidelity: characters+character_state; reader_intent: driving_comment+decision_point;
  safety: style_guide.content_rating). Expose context_for(dimension, full_context).

RED→GREEN→REFACTOR:
- RED: with a fake tools layer returning seeded rows, assert assemble_context returns all slices and
  context_for("character_fidelity", ctx) contains characters but not the retention curve.
- GREEN/REFACTOR: implement; keep trimming pure + testable.
```
**Done-when:** judges receive only their relevant, trimmed ground truth; assembled from existing tools.

---

## PHASE 3 — Golden Dataset

**Goal:** a tiny, hand-curated benchmark so scores are meaningful and the MLflow table is real.

### MASTER PROMPT
```
Create agent/golden/ with a small evaluation dataset for NEXUS (JSON).

- 6-8 cases from the SEEDED universe (The Hollow Crown etc). Each case:
  { id, source_episode_id, decision_point, driving_review_id,
    must_hold: ["<canon fact that MUST remain true>", ...],
    must_change: ["<consequence that MUST differ from original>", ...],
    characters_in_scope: ["Lady Corvin", ...] }
- Include at least: 2 "clean" cases, 2 "continuity-trap" cases (easy to contradict), 1 "character
  knowledge" trap (a character must NOT know a timeline-impossible fact), 1 reader-intent case.
- Add a loader golden.load_cases(). These are expectations for the judges/benchmark, NOT stored in
  the app DB (matches schema.sql note: eval data is dev/benchmark only).

RED→GREEN→REFACTOR:
- RED: test that load_cases() returns >=6 cases and each has must_hold + must_change non-empty.
- GREEN/REFACTOR: author the cases from the seed data.
```
**Done-when:** 6–8 realistic cases with explicit must-hold / must-change constraints load cleanly.

---

## PHASE 4 — Eval Orchestrator + MLflow

**Goal:** one entry point that evaluates a draft end-to-end and logs to MLflow (traces + scores).

### MASTER PROMPT
```
In agent/evals.py add the orchestrator + MLflow logging.

- evaluate(draft, source_episode_id, series_id, order_index, driving_review_id) -> EvalReport:
  { results: [JudgeResult...], overall: float, passed: bool, blocking_fails: [str] }.
  Steps: assemble_context -> score_all (Phase 1) -> aggregate.
- MLflow (mlflow[databricks], already a dep): wrap each evaluate() in an MLflow run/trace; log
  per-dimension score, verdict, evidence as metrics/params/artifacts. Guard MLflow behind a flag
  (EVAL_MLFLOW=1) so local dev without a tracking server still works (no-op logger fallback).
- A batch runner evaluate_golden() that runs evaluate() over the golden dataset and returns a
  summary table (per-case + per-dimension scores) for the benchmark notebook.

RED→GREEN→REFACTOR:
- RED: with fake judges, assert evaluate() returns an EvalReport with 4 results + correct passed
  flag; assert MLflow logging is skipped cleanly when EVAL_MLFLOW is unset (no crash, no server).
- GREEN/REFACTOR: implement; keep MLflow calls isolated behind a small logger wrapper.
```
**Done-when:** `evaluate()` produces a full report; MLflow logging works when enabled and no-ops when
not; `evaluate_golden()` yields a benchmark table.

---

## PHASE 5 — ⭐ Eval-Driven Self-Correction Loop (the signature)

**Goal:** when a judge fails, feed the exact violation back to the writer, regenerate to fix *only
that*, re-score, and emit the whole visible arc.

### MASTER PROMPT
```
In agent/evals.py add generate_with_self_correction() and wire it to yield visible events.

- Signature mirrors agent.generate_stream(source_episode_id, decision_point, driving_review_id,
  instructions) but yields ADDITIONAL event dicts around the write:
    {"type":"eval_start"}                                   (judging begins)
    {"type":"eval_score","dimension":..,"score":..,"verdict":..,"evidence":..}   (per judge)
    {"type":"regen_retry","reason":<failed dimension>,"fix_hint":..,"attempt":n} (a fix begins)
    {"type":"eval_final","overall":..,"passed":..,"before":<overall1>,"after":<overall2>}
- Loop:
  1. Generate draft via existing agent.generate_stream (reuse it; collect tokens into the draft).
  2. evaluate(draft). Emit eval_start + one eval_score per dimension.
  3. If NOT passed and attempts < MAX_FIX (e.g. 1-2): build a targeted fix instruction from the
     failed judges' evidence + fix_hint ("Revise ONLY to resolve: <evidence>. Keep everything else.")
     and regenerate. Emit regen_retry. Re-evaluate.
  4. Stop when passed OR attempts exhausted; emit eval_final with before/after overall.
- Keep it honest: if it still fails after MAX_FIX, mark passed=false and let the gate/HITL handle it
  (do NOT fake a pass).

RED→GREEN→REFACTOR:
- RED: with a fake writer that returns a CONTRADICTORY draft first then a CLEAN draft, and fake
  judges that fail-then-pass, assert the event sequence contains eval_start -> a failing eval_score
  -> regen_retry -> eval_final with after>before and passed=true. Assert it stops after MAX_FIX and
  reports passed=false if never fixed.
- GREEN/REFACTOR: implement; make the loop bound + deterministic under test.
```
**Done-when:** a failing draft triggers a visible retry that quotes the violation, regenerates,
and re-scores higher; the loop is bounded and never fakes a pass.

---

## PHASE 6 — Wire into `/generate` SSE + `/evaluate` Endpoint

**Goal:** expose the eval + self-correction over HTTP without breaking the existing stream.

### MASTER PROMPT
```
In agent/main.py:
- Add a flag on POST /generate (e.g. body field `selfCorrect: bool = true`). When true, route through
  generate_with_self_correction so the SSE stream now ALSO carries eval_start / eval_score /
  regen_retry / eval_final events (pass them through _pump unchanged; add cases for the new types).
- Add POST /evaluate (body: draft + source ids) -> returns a single JSON EvalReport (non-streamed) for
  re-scoring an edited draft on demand.
- Keep the `done` event exactly as-is (draft) so the existing FE keeps working; eval events are
  additive.

Update docs/API_CONTRACT.md:
- Document the new SSE events (eval_start, eval_score, regen_retry, eval_final) and the /evaluate
  endpoint + EvalReport shape. Note the score chip + gate consume these. Bump nothing that breaks v1.

RED→GREEN→REFACTOR:
- RED: an httpx/starlette TestClient test hitting /generate (with fakes) asserts the SSE body contains
  eval_score and eval_final lines; /evaluate returns a well-formed EvalReport.
- GREEN/REFACTOR: implement; ensure old clients ignoring new events still get token+done.
```
**Done-when:** `/generate` streams eval events additively; `/evaluate` returns a report; contract
updated; old FE path unaffected.

---

## PHASE 7 — The Gate (HITL tied to Evals)

**Goal:** the web backend refuses to auto-persist a draft that fails blocking dimensions.

### MASTER PROMPT
```
In web/ (app/api) + the API contract:
- On approve (POST /api/episodes), the backend attaches/reads the latest EvalReport for the draft.
  If passed=false on a blocking dimension (continuity/safety), respond 409 CONFLICT with the failing
  evidence UNLESS an explicit override flag (humanOverride:true) is sent — reinforcing "a human may
  overrule, but must do so deliberately."
- Document the gate + override in docs/API_CONTRACT.md.

RED→GREEN→REFACTOR:
- RED: test that approving a failing draft without override returns 409 + evidence; with
  humanOverride:true it persists and records that a human overrode.
- GREEN/REFACTOR: implement.
```
**Done-when:** failing drafts can't be auto-saved; a human can consciously override; both paths tested.

---

## PHASE 8 — ⭐ FE Surfacing (make the eval the wow on screen)

**Goal:** turn the eval stream into the visible, jaw-drop moment in split-view/editor.

### MASTER PROMPT
```
In web/, consume the new eval SSE events in the fork editor + split-view.

- Replace the DUMMY score chip in components/SplitView.tsx with a REAL EvalPanel fed by eval events:
  * one row per dimension: label, animated 1-5 bar, pass/fail dot, and the QUOTED evidence line.
  * overall score badge.
- Self-correction animation (the signature): when a regen_retry event arrives, show a banner
  "⚠ Caught a {dimension} break — repairing…" with the quoted evidence, a subtle progress state,
  then on eval_final flip to "✓ Resolved  {before} → {after}" with a satisfying transition. The
  alternate panel visibly re-streams the fixed passage.
- Gate UI: if final passed=false, the Approve button shows "Blocked — needs review" with the evidence;
  an explicit "Override & save" secondary action (calls approve with humanOverride:true).
- Keep the mock API client (NEXT_PUBLIC_API_MODE=mock) able to SIMULATE this whole arc (fake a
  failing-then-fixed sequence) so it demos without the backend, matching phase-2's mock pattern.

RED→GREEN→REFACTOR (web/tests):
- RED: feed a scripted event sequence (fail -> retry -> pass) to EvalPanel; assert it renders the
  failing evidence, the "repairing" banner, then "Resolved before→after"; assert a blocked final
  disables Approve and shows Override.
- GREEN/REFACTOR: implement; reuse the streaming hook from the editor/split-view.
```
**Done-when:** the eval scores + evidence render live; the self-correction arc animates
(caught → repairing → resolved); the gate blocks with an override; all demoable on mock data.

---

## PHASE 9 — ⭐ Ablation Harness (prove the engine)

**Goal:** quantify that character memory / context is what creates consistency.

### MASTER PROMPT
```
In agent/ add an ablation runner + a small FE view.

- evals.ablate(case) runs evaluate() TWICE for a golden case: (a) FULL context, (b) context with
  character_state/character memory REMOVED (and optionally prior episodes trimmed). Return both
  EvalReports so scores can be compared.
- A batch ablate_golden() over the dataset returns a table: per-case continuity+fidelity WITH vs
  WITHOUT memory, plus the mean delta.
- FE: a simple, striking comparison view (a route or a slide-ready component) showing two bars per
  dimension (with memory vs without) and the delta — "memory raises continuity +1.6 on average."

RED→GREEN→REFACTOR:
- RED: with fakes where the no-memory run scores lower, assert ablate() returns two reports and the
  with-memory overall > without-memory overall; assert the table computes a positive mean delta.
- GREEN/REFACTOR: implement.
```
**Done-when:** the ablation shows a measurable consistency drop without memory; a comparison view
renders the deltas.

---

## PHASE 10 — MLflow Benchmark + Demo Script + Hardening

**Goal:** the judge-facing evidence artifact + a rehearsed, un-crashable demo.

### MASTER PROMPT
```
Finalize Phase 3.

- agent/benchmark.py (or a notebook): runs evaluate_golden() + ablate_golden(), logs to MLflow, and
  prints/saves a clean results table (per-case, per-dimension, with/without memory, means). This is
  the "here is our evidence" table for judges.
- Add a short docs/eval-demo.md: the exact on-stage sequence (below) + backup: a pre-recorded
  eval-fail→fix clip and a cached golden run, in case of network.
- Hardening: judges use a cheap fast model; scoring runs async so it never blocks the token stream;
  cache golden results; MLflow behind the flag; every judge failure degrades gracefully.

Definition of done for Phase 3:
- Live: generate -> per-dimension scores + evidence -> (if needed) caught→repairing→resolved -> gate.
- Ablation table proves memory matters.
- MLflow benchmark table exists.
- All agent pytest + web vitest green; typecheck/build clean.
```
**Done-when:** benchmark table logged in MLflow; demo script + backups ready; everything green.

---

## The Demo Script (rehearse — this wins)
1. Reader comment highlighted → Rewind → generate the alternate future (streams).
2. **EvalPanel lights up**: Continuity 4.6, Character 4.8, Reader-intent 4.5 — each with a quoted
   reason. "The AI graded its own work, and here's *why*."
3. Run the **trap case**: the draft breaks continuity → **"⚠ Caught a continuity break — Corvin
   references a death that never happened in this timeline"** → **repairing…** → the passage
   re-streams → **"✓ Resolved 3.1 → 4.7."** *(Let this land. This is the moment.)*
4. Try to **Approve a still-failing draft** → **blocked, needs review** → human overrides
   deliberately. "The AI writes and grades; the human decides."
5. One slide: the **ablation chart** — memory on vs off. "This number is the proof our engine works."

## Pitfalls (respect these)
- **Never judge blind** — always pass the reference context; otherwise the judge hallucinates scores.
- **Evidence must quote** — a number without a quoted reason reads as fake.
- **Don't fake a pass** — if self-correction fails, say so and let the gate/human handle it. Honesty
  reads as competence.
- **Latency** — judges + retries add seconds; use a cheap model, run async, cache golden, keep a
  backup clip.
- **Judge bias to length/flowery prose** — rubric says "judge consistency only."
- **Small + real beats big + shallow** — 6–8 golden cases scored well > 100 noisy ones.

## Definition of Done (whole Phase 3)
- [ ] 4 evidence-bearing judges (continuity, character fidelity, reader intent, safety).
- [ ] Judges grounded in real canon via existing tools; never judge blind.
- [ ] Golden dataset (6–8 cases incl. traps).
- [ ] `evaluate()` + MLflow logging (flagged).
- [ ] ⭐ Self-correction loop — caught → repair → resolved, bounded, never fakes a pass.
- [ ] Eval events over `/generate` SSE + `/evaluate` endpoint; contract updated; old FE unaffected.
- [ ] Gate blocks failing auto-saves; human override recorded.
- [ ] ⭐ FE EvalPanel: live scores + evidence + self-heal animation + gate; demoable on mock.
- [ ] ⭐ Ablation table + comparison view (memory on vs off).
- [ ] MLflow benchmark + demo script + backups.
- [ ] All agent pytest + web vitest green; typecheck/build clean.

## Commit / branch discipline
- Work on `implementation-phase`. One commit per sub-phase (`feat(eval): phase N — <thing>`).
- Pull `main` before pushing; open a PR when the self-correction arc is demoable.
- Eval/benchmark data stays out of the app DB (dev/benchmark only, per schema.sql).
