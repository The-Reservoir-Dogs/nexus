# NEXUS — UX Plan

Redesign the frontend around the hand-drawn mockups in `mock_ux/`. Goal: one coherent,
cinematic, audio-first product — not a generic dashboard. This doc is the source of truth for
Sriman's rebuild. It reuses the existing component scaffold (`web/components/*`) but restyles
and re-composes it.

Source mockups:
- `00-53-41` login
- `00-53-53` home (series card grid)
- `00-54-17` reader (sidebar / script + player / comments)
- `00-54-39` author reader (adds analytics + edit, author-only)
- `00-54-49` editor (split view vs main + agent chat in the reused side panel)

---

## 1. Design vision
NEXUS is a **living story multiverse** you *listen to*. Every screen should feel like a
premium audio-drama app crossed with a version-control graph — dark, filmic, focused on the
words and the voice. Three ideas drive every screen:

1. **Story first.** The script text and the audio player are the hero. Chrome recedes.
2. **The multiverse is visible.** Branching/timelines are a first-class visual (a tree/graph),
   not a hidden list. "Create branches" is an inviting action, not a form.
3. **The AI is a co-author you watch think.** The agent's tool-calling stream lives in a
   panel, reusing the same shell as comments — collaboration, human or AI, looks the same.

### Anti-goals (what we're moving away from)
- Generic light SaaS cards, cramped tables, form-heavy flows.
- Separate one-off pages per action. Everything happens inside **one persistent app shell**.

---

## 2. Visual language (concrete — since current UI is rejected)
A dark, cinematic theme themed to "The Hollow Crown" (royalty / candlelit).

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0B0F` (near-black ink) | app background |
| `surface` | `#15151C` | panels, cards |
| `surface-2` | `#1E1E28` | raised elements, hover |
| `border` | `#2A2A36` | hairline separators |
| `text` | `#ECEAE4` (warm off-white) | body |
| `text-dim` | `#9A968C` | meta, captions |
| `accent` | `#D9A441` (antique gold) | primary actions, active state, branch nodes |
| `accent-2` | `#7C5CFF` (arcane violet) | AI / agent surfaces, "generating" |
| `canonical` | `#D9A441` | the sacred timeline |
| `fork` | `#5B8DEF` | alternate timelines |
| `danger` | `#E5484D` | destructive / errors |

- **Type:** UI in a clean grotesk (Inter / Geist). **Story body in a serif** (Newsreader /
  Source Serif) at ~19px/1.7 for long-form reading — this alone separates us from generic apps.
- **Radius:** 14px cards, 10px controls, pill buttons. **Elevation:** soft, low, dark shadows.
- **Motion:** 150–200ms ease; the audio waveform and the agent "thinking" dots are the only
  lively motion. Respect `prefers-reduced-motion`.
- **Density:** generous. Reading is the job.

Ship these as CSS variables + Tailwind theme (`tailwind.config.ts`) so restyle = tokens, not
per-component rewrites.

---

## 3. App shell (global chrome)
Every authenticated screen shares one **Shell** (`components/layout/Shell.tsx`):

- **TopNav** (`components/layout/TopNav.tsx`): left = NEXUS wordmark → `home`; center/right =
  global **search**; far right = **user avatar** menu (from `GET /api/me`). Slim, dark, sticky.
- **Persistent audio player** (new `components/player/AudioPlayer.tsx`): docked bottom of the
  reader/editor content column (per mockups). Prev-episode / play / next + scrubber.
  Keeps playing across in-shell navigation. Fed by `episode.audioUrl`.

The reader/editor screens are a **3-column layout inside the shell**:
```
┌───────────────────────────────────────────────────────────┐
│ TopNav (wordmark · search · avatar)                        │
├──────────┬───────────────────────────────┬────────────────┤
│ Left rail│  Center: EpisodePane          │  Right: SidePanel
│ season ▾ │  (script text OR editor)      │  (comments OR   │
│ ep 1 ●   │  ─────────────────────────    │   agent chat)   │
│ ep 2     │  [ create branches ] etc      │                 │
│ ep 3     │                               │                 │
│          │  ◁  ▷  ▷   ──●────────  player │                 │
└──────────┴───────────────────────────────┴────────────────┘
```

Two components are **reused across modes** (this is the core architectural bet from mockup 5):
- **`EpisodePane`** — renders script **read-only** (reader) or **editable** (editor); in split
  mode shows two panes side-by-side (this branch vs the canonical/main branch).
- **`SidePanel`** — same shell (header + scrollable list + footer input) renders either the
  **comment thread** (reader) or the **agent chat / tool-call stream** (editor).

---

## 4. Screens

### 4.1 Login — `app/login/page.tsx` (mockup 00-53-41)
Centered card on the dark bg. Two fields + one primary button. In production auth is Databricks
Apps OAuth (frontend just calls `/api/me`), so this is a minimal branded gateway: wordmark,
tagline ("Rewrite the story. Hear it change."), one **Enter** button, optional dev email field.
Keep it a single quiet focal card — no split hero, no clutter.

### 4.2 Home — `app/page.tsx` (mockup 00-53-53)
"Simple UI, cards-based page, renders all the series."
- TopNav with working search.
- Responsive **grid of `SeriesCard`** (4-up desktop → 1-up mobile). Each card: cover art,
  title, genre `Badge`, author, episode count, avg rating, a small **branch-count** stat
  (how alive is this multiverse). Hover raises + shows a play affordance.
- Data: `GET /api/series?page&genre&q`. Loading = `Skeleton` grid; empty = friendly CTA.
- Click → reader for that series' first/most-recent episode.

### 4.3 Reader — `app/episodes/[id]/page.tsx` (mockup 00-54-17)
The core screen. 3-column shell:
- **Left rail:** `season ▾` dropdown + episode list; current episode highlighted (●).
  Data: `GET /api/series/:id/episodes` (canonical, ordered). "home" back-link top of column.
- **Center `EpisodePane` (read):** episode **script text** in the serif reading style. Above it,
  a **`create branches`** button → opens the branch/fork flow (see 4.6). Below, the **audio
  player** bound to `episode.audioUrl` (🔊 if present; "Generate narration" affordance if not).
  Data: `GET /api/episodes/:id`.
- **Right `SidePanel` (comments):** threaded reviews; footer input to post. Data:
  `GET/POST /api/episodes/:id/reviews`, plus `RatingStars` (`POST /api/episodes/:id/ratings`).
- If the episode is a decision point, surface a **"branches" ribbon** (timeline chips) linking
  to alternate timelines (`GET /api/episodes/:id/timelines`, top-rated first).

### 4.4 Author reader — same route, author-only controls (mockup 00-54-39)
Identical layout; when the viewer is the series author/co-author, TopNav center shows two extra
pills:
- **`analytics`** → opens the **retention view** (drawer/modal over the reader): audience
  retention curve (`GET /api/episodes/:id/retention` → `episode_retention`) + the **LLM insight
  narration** (`POST /api/analyze`, streamed). Author-only.
- **`edit`** → switches the center pane into **editor mode** (4.5).
Authorship is derived from `episodes.author_id / co_author_id` (no role column) — gate with
`GET /api/me` vs the series author. Non-authors never see these pills.

### 4.5 Editor + Split view — `app/episodes/[id]/editor` & `/split` (mockup 00-54-49)
Same shell, two changes:
- Center `EpisodePane` becomes **editable** (the manuscript, `components/editor/Manuscript.tsx`).
- TopNav center shows a **`split view`** toggle → center splits into **two panes**: left = this
  branch (editable), right = the **canonical/main branch** (read-only) for side-by-side compare
  ("compare with the og main branch"). Reuse `components/SplitView.tsx`.
- **Right `SidePanel` becomes the agent chat** — the *same reused component* as comments, now
  streaming the co-author. This is where the tool-calling loop is shown live: `reasoning` /
  `tool_call` / `tool_result` events as collapsible steps, then `token`s streaming the draft
  into the editor. Source: `POST /api/generate` (SSE proxy to the agent). Footer input = the
  writer's prompt/decision to the agent.
- Actions: **Approve** (persist via `POST /api/episodes` — agent never writes), **Discard**,
  and later **Generate narration** (`POST /api/episodes/:id/narrate` → audio).

### 4.6 Branch / fork flow (mockup 00-54-17 "create branches")
From the reader, **"create branches"** on a decision-point episode opens the fork action:
pick the **driving comment/review** (a reader's "what if…"), then `POST /api/episodes/:id/fork`
→ lands in the **editor** (4.5) with the agent already streaming the alternate episode. Visualize
the resulting multiverse with **`TimelineTree`** (canonical spine in gold, forks in blue).

---

## 5. Reusable component contract
| Component | Reader mode | Editor mode |
|---|---|---|
| `EpisodePane` | read-only serif script | editable manuscript; split = 2 panes vs main |
| `SidePanel` | comment thread + post box | agent chat + tool-call stream + prompt box |
| `AudioPlayer` | plays `audioUrl` | same (preview generated narration) |
| `LeftRail` | season ▾ + episode list | same |
| `TimelineTree` | branch ribbon / multiverse map | same |

Building these two dual-mode components (`EpisodePane`, `SidePanel`) is the whole redesign's
leverage — everything else is styling + composition.

---

## 6. Routes / information architecture
```
/login                         gateway
/                              home — series grid
/series/:id                    (redirects to latest/first episode reader)
/series/:id/branches           multiverse map (TimelineTree) for a series
/episodes/:id                  reader (author sees analytics/edit pills)
/episodes/:id/editor           editor (agent chat side panel)
/episodes/:id/split            editor split vs canonical
/episodes/:id/fork             fork entry → editor
/styleguide                    dev-only token/component gallery (keep)
```
All live **inside the Shell**; navigating between them keeps TopNav + player mounted.

---

## 7. States & edge cases (every data view needs these)
- **Loading:** `Skeleton` matching final layout (grid, script lines, comment rows).
- **Empty:** series with no episodes; episode with no comments; no branches yet; **no audio yet**
  (show "Generate narration"); **no retention data** (analytics honestly says "not enough plays").
- **Streaming:** agent chat shows `reasoning`/`tool_call` steps + a typing indicator; draft
  tokens stream into the editor. Handle `error` events with a retry.
- **Auth:** non-author never sees analytics/edit; `POST` actions 401 → prompt sign-in; 403 on
  verify unless original author.
- **Audio:** long episodes render slowly → player shows "generating…"; pre-rendered clips play
  instantly.

---

## 8. Build order (for Sriman)
1. **Design tokens** in `tailwind.config.ts` + `globals.css`; restyle `ui/*` (Button, Card,
   Badge, Avatar, Skeleton) and `Shell`/`TopNav` to the dark cinematic system. Verify on
   `/styleguide`.
2. **Home** grid with real `SeriesCard` + search + skeletons.
3. **Reader shell**: LeftRail + `EpisodePane` (read) + `SidePanel` (comments) + `AudioPlayer`.
4. **Author controls**: analytics drawer (retention curve + streamed insight) + edit toggle,
   gated by `/api/me`.
5. **Editor + agent chat**: `SidePanel` agent mode consuming `/api/generate` SSE; approve flow.
6. **Split view** vs canonical; **TimelineTree** multiverse map + fork entry.
7. Polish: motion, waveform, empty/loading states, mobile (rail → drawer, side panel → tab).

Keep everything wired through the thin API client (`lib/api.ts`) — mock now
(`web/mocks/data.ts`), swap to `fetch('/api/...')` at integration, no component changes.

---

## 9. Migration from current frontend
- **Keep & restyle:** `layout/Shell`, `layout/TopNav`, `SeriesCard`, `reader/Comments`,
  `editor/Manuscript`, `SplitView`, `TimelineTree`, `ui/*` — the scaffold is fine; the *look*
  and *composition* are what change.
- **Introduce:** `SidePanel` (unify Comments + agent chat), `EpisodePane` (unify read/edit),
  `player/AudioPlayer`, analytics drawer.
- **Remove/fold:** standalone action pages that break the persistent shell — fold fork/generate
  into the in-shell editor flow.
