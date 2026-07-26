# NEXUS — Wireframing Plan

Source of truth for the wireframe pass. Reconciles the hand-drawn mockups (`mock_ux/`),
`UX_PLAN.md`, `API_CONTRACT.md`, `PRODUCT.md`, and the **current DB schema** (`schema.sql`).
Focus of this pass: lock the screen inventory + the **analytics / retention** surface that the
schema now supports.

---

## 0. Schema review — what changed (analytics / retention)

The DB already carries the retention machinery. Wireframes must be built against these, not
invented fields.

**New / relevant tables + columns**
- `episodes.audio_url` — TTS render bound to the player.
- `episodes.audio_duration_ms` — denominator for completion + retention buckets.
- `playback_events` — raw event log (source of truth). Cols: `episode_id`, `user_id` (nullable =
  anon), `session_id` (UUID = one listen), `event_type`
  (`play_start|heartbeat|pause|resume|seek|skip|complete`), `position_ms`, `seek_to_ms`,
  `duration_ms`, `speed`, `device`, `autoplay`.
- `episode_retention` VIEW — derived 10s-bucket curve: `(episode_id, bucket_10s, active_sessions,
  starters, retention)`. **All retention math is deterministic SQL, not the LLM.**

**Consequence for wireframes**
- Retention is *per-episode* and *per-branch*. Every episode (canonical or fork) can have its own
  curve. Co-author sees analytics only for the branch they own (`plan.md` US-8); author sees it
  for canonical + owned. Gate identical to edit: `authorId`/`coAuthorId` vs `me.id`.
- Two distinct data sources on the analytics surface:
  1. **Deterministic metrics** (SQL: view + aggregates) — curve, plays, completion, avg listen.
  2. **LLM insight** (streamed narration) — interprets the curve. Separate visual treatment
     (arcane-violet `accent-2` = AI), never mixed with the hard numbers.

**Gaps to close (not yet in frontend/contract) — flag, don't block wireframe**
- No `GET /api/episodes/:id/retention` route (missing from `web/app/api/...`). Contract lists it
  in UX_PLAN but not API_CONTRACT — **add it**.
- No `Retention` type in `web/lib/types.ts`, no `getRetention()` in `web/lib/api.ts`.
- No playback/retention rows in `web/mocks/data.ts` (only a hard-coded array inside the analytics
  page). Wireframe should assume a mock feed matching the view shape.
- Current analytics is a **standalone page** (`/episodes/[id]/analytics`); UX_PLAN wants a
  **drawer over the reader**. Wireframe resolves this below (§4.4).

---

## 1. Global frame (applies to every screen)

One persistent **Shell**: `TopNav` (wordmark → home · search · avatar) + a docked, always-mounted
`AudioPlayer` at the bottom of the content column. Navigation never unmounts nav/player.

Reader/editor = **3-column layout inside the Shell**:
```
┌───────────────────────────────────────────────────────────┐
│ TopNav: NEXUS · [ search ] · (avatar)                      │
├──────────┬───────────────────────────────┬────────────────┤
│ LeftRail │  Center: EpisodePane          │  Right: SidePanel│
│ season ▾ │  (script read | editor | split)│ (comments|agent)│
│ ep 1 ●   │                               │                 │
│ ep 2     │                               │                 │
│ ep 3     │                               │                 │
│ ← home   │  ◁ ▷ ▷  ──●──────  AudioPlayer │                 │
└──────────┴───────────────────────────────┴────────────────┘
```
Dual-mode components carry the whole redesign: **`EpisodePane`** (read / edit / split) and
**`SidePanel`** (comments / agent chat). Everything else = styling + composition.

---

## 2. Screen inventory + wireframe checklist

| # | Screen | Route | Mockup | Status | Wireframe notes |
|---|---|---|---|---|---|
| 1 | Login | `/login` | 00-53-41 | scaffolded | one quiet card: wordmark, tagline, dev field + Enter. No split hero. |
| 2 | Home | `/` | 00-53-53 | scaffolded | `SeriesCard` grid (4-up→1-up), search, skeletons. Card stats: episodes, avg rating, **branch count**. |
| 3 | Reader | `/episodes/:id` | 00-54-17 | scaffolded | 3-col: LeftRail · EpisodePane(read, serif) + `create branches` · SidePanel(comments)+rating. Branch ribbon if decision point. |
| 4 | Author reader | same route | 00-54-39 | scaffolded | +TopNav pills `analytics` `edit`, author/co-author only. |
| 5 | Editor | `/episodes/:id/editor` | 00-54-49 | scaffolded | EpisodePane editable · SidePanel = agent chat (tool-call stream). Approve/Discard. |
| 6 | Split view | `/episodes/:id/split` | 00-54-49 | scaffolded | EpisodePane splits: this branch (edit) vs canonical (read). |
| 7 | Fork entry | `/episodes/:id/fork` | 00-54-17 | scaffolded | pick driving comment → editor with agent pre-streaming. |
| 8 | Branches / multiverse | `/series/:id/branches` | — | scaffolded | `TimelineTree`: gold canonical spine, blue forks. |
| 9 | **Analytics / retention** | drawer over `/episodes/:id` (fold `/analytics`) | 00-54-39 | **rework** | see §4. |
| 10 | Styleguide | `/styleguide` | — | keep | token/component gallery. |

---

## 3. Reader wireframe detail (screen 3/4)

- **LeftRail:** `season ▾` dropdown → episode list, current `●` highlighted, `← home` top.
- **Center EpisodePane (read):** `create branches` button top; serif script body (~19px/1.7);
  `AudioPlayer` docked below (🔊 if `audioUrl`, else "Generate narration").
- **Right SidePanel (comments):** threaded reviews + footer post box + `RatingStars`.
- **Branch ribbon:** if `decisionPoint` set, show timeline chips → alternate timelines
  (top-rated first).
- **Author overlay:** when `me` is author/co-author, TopNav center shows `analytics` + `edit`
  pills. Non-authors never see them.

---

## 4. Analytics / retention wireframe (the new work) — screen 9

Change from current standalone page → **right-side drawer / overlay over the reader** (mockup
00-54-39 shows it invoked from the reader; UX_PLAN §4.4 specifies drawer). Player + reader stay
mounted underneath.

```
┌ reader (dimmed) ─────────────┬───── Analytics drawer ─────────┐
│                              │  Audience retention · <title>  │
│                              │  ┌ Plays ┐ ┌ Avg listen ┐ ┌Compl┐│
│                              │  │ 1,284 │ │   2:41     │ │ 33% ││
│                              │  └───────┘ └────────────┘ └─────┘│
│                              │  Retention curve  (10s buckets) │
│                              │   100%┐                         │
│                              │       └──╲___  ⋮ drop-off (red) │
│                              │            ╲______              │
│                              │   0% └───────────────── time →  │
│                              │  ─────────────────────────────  │
│                              │  ✦ AI insight (violet, streamed)│
│                              │  "61% drop at 2:10, right after │
│                              │   the mentor's death reveal…"   │
└──────────────────────────────┴────────────────────────────────┘
```

**Data contract (build against this):**
- `GET /api/episodes/:id/retention` →
  ```json
  { "data": {
      "episodeId": "1003",
      "durationMs": 174000,
      "plays": 1284,
      "avgListenMs": 161000,
      "completionRate": 0.33,
      "curve": [ { "bucket10s": 0, "retention": 1.0, "activeSessions": 1284 },
                 { "bucket10s": 1, "retention": 0.98 } ],
      "dropoff": { "bucket10s": 9, "from": 0.61, "to": 0.44 }
  }}
  ```
  Maps 1:1 to `episode_retention` view (`curve`) + aggregates over `playback_events`
  (`plays`=distinct `session_id` with `play_start`; `completionRate`=`complete`/`starters`;
  `avgListenMs`=avg max `position_ms`).
- `POST /api/analyze` → **SSE** stream of the LLM insight narration (same event style as
  `/api/generate`). Text-only; interprets `dropoff` + surrounding script beat.

**Visual rules:**
- Curve = gold (`canonical`) area+line; drop-off marker = dashed `danger` red vertical.
- Headline stat cards: Plays (`Users`), Avg listen (`Clock`), Completion (`TrendingDown`).
- AI insight block = `accent-2` violet border/tint + `Sparkles`; streams token-by-token; typing
  indicator while generating.

**States:**
- **No audio / no plays:** honest empty — "Not enough plays yet to chart retention." Hide curve,
  keep the shell.
- **Loading:** skeleton for stat row + curve.
- **Not author:** drawer not reachable (pill hidden); direct route → "author only" message.

---

## 5. Access matrix (drives conditional wireframe elements)

| Viewer | Reader | Comments/rate | `edit`/`analytics` pill | Verify/canonize |
|---|---|---|---|---|
| Anonymous / fan | ✓ | rate+comment (401→sign-in) | ✗ | ✗ |
| Co-author (owns branch) | ✓ | ✓ | ✓ **on owned branch only** | ✗ |
| Original author | ✓ | ✓ | ✓ (canonical + owned) | ✓ |

Derived from `episode.authorId` / `coAuthorId` vs `me.id`. No role column.

---

## 6. Wireframe build order

1. **Reconfirm tokens** on `/styleguide` (dark cinematic system already in `tailwind.config.ts`).
2. Reader shell composition (screens 3/4) — LeftRail + EpisodePane(read) + SidePanel(comments) +
   AudioPlayer + author pills.
3. **Analytics drawer (screen 9)** — refactor standalone page into a drawer; add `Retention`
   type + `getRetention()` + mock feed shaped like the view; wire stat cards + curve + AI insight
   stream. **Add `GET /api/episodes/:id/retention` + `POST /api/analyze` to API_CONTRACT.**
4. Editor + agent SidePanel (screen 5) → Split (6) → Fork entry (7) → Branches TimelineTree (8).
5. Polish: empty/loading/streaming/auth states; mobile (rail → drawer, side panel → tab,
   analytics → full-screen sheet); motion (waveform + agent thinking dots only).

---

## 7. Open items to confirm before coding

- **Analytics as drawer vs page:** plan says drawer; a standalone page already exists. Recommend
  drawer (keeps player mounted), keep `/analytics` route as deep-link fallback that opens the
  reader with the drawer open.
- **Add missing contract entries:** `retention` + `analyze` endpoints, `Retention` type, mock
  playback data. (§0 gaps.)
- **Per-branch analytics scope:** confirm co-author sees only their branch's curve (plan.md #8).
- **Anon listens:** `playback_events.user_id` nullable — plays count includes anonymous; confirm
  that's desired in the "Plays" stat.
