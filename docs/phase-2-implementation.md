# NEXUS — Phase 2 Frontend Implementation (Master Prompts)

> **Owner:** Sriman · **Branch:** `frontend` · **Goal:** Build the ENTIRE Phase-2 frontend
> (see `ROADMAP.md` Phase 2) against **dummy JSON** matching `API_CONTRACT.md`, so the whole
> demo path is clickable before the backend is live.
>
> **How to use this doc:** each of the 10 sub-phases below is a **self-contained master
> prompt**. Paste one prompt at a time into your coding agent, let it finish, run the
> **RED → GREEN → REFACTOR** loop, verify the *Done-when*, commit, then move to the next.
> Never skip the test loop — that's how we ship a zero-error frontend.

---

## 0. Ground Rules (read once, applies to every phase)

### Stack (locked — matches `BOILERPLATE.md` + `API_CONTRACT.md`)
- **Next.js 14 (App Router) + TypeScript** — lives in `web/` (NOT Vite; the old `frontend/` is scrapped).
- **TailwindCSS** + **shadcn/ui** (Radix primitives) for accessible components.
- **framer-motion** for micro-interactions/transitions.
- **@monaco-editor/react** for the VS-Code-style co-author editor.
- **lucide-react** icons. **@tanstack/react-query** for data fetching (mock now, live later).
- **Testing:** **Vitest** + **React Testing Library** (unit/component), **Playwright** (e2e demo path).
- Node 18+. Strict TS (`"strict": true`). ESLint + Prettier. No `any` unless justified.

### The RED → GREEN → REFACTOR loop (do this EVERY phase)
1. **RED** — write the test(s) first from the *Done-when* list. Run them → they fail.
2. **GREEN** — write the minimum UI/logic to make tests pass. Run → green.
3. **REFACTOR** — clean up, extract components, polish animation/spacing, re-run tests → still green.
4. `npm run lint && npm run typecheck && npm test` must all pass before commit.
5. Commit with a clear message. Then next phase.

### Golden rules for a zero-error, top-notch UI
- **Typed everything.** All mock data + API client fully typed from `API_CONTRACT.md` shapes.
- **One API client** (`lib/api.ts`) reads mocks now, swaps to `fetch('/api/...')` later with **zero component changes**. Components never import JSON directly.
- **Loading / empty / error states** for every data view (skeletons, not spinners where possible).
- **Responsive** but **laptop-first** (1440×900 primary; the demo is on a laptop).
- **Accessible**: semantic HTML, keyboard nav, focus rings, `aria-*`, color-contrast AA.
- **No layout shift.** Reserve space for images (`next/image` with width/height), use skeletons.
- **Access model:** a user is **author** if `episode.authorId === me.id`, **co-author** if
  `episode.coAuthorId === me.id`, else reader. Show/hide Edit-Create + Verify with this check
  (matches the wireframe note: "Edit/Create visible only when the fetched userID owns the series").

---

## Design System — "MIDNIGHT MULTIVERSE" theme

A cinematic, Netflix-grade dark theme that says *living story universe*. Users should feel
they're browsing a premium streaming app, not a form.

### Color tokens (Tailwind `theme.extend.colors`)
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0A0A0F` | app background (near-black, blue-tinted) |
| `panel` | `#14141F` | cards, panels |
| `panel-2` | `#1C1C2A` | raised surfaces / hover |
| `line` | `#2A2A3C` | borders, dividers |
| `canon` | `#F5C518` | **gold** — canonical / verified (the "sacred timeline") |
| `fork` | `#8B5CF6` | **violet** — alternate timelines / forks |
| `fork-soft` | `#8B5CF6/12` | fork panel tint (split-view right side) |
| `text` | `#ECECF5` | primary text |
| `muted` | `#9A9AB0` | secondary text |
| `success` | `#34D399` | approve / green (HITL accept) |
| `danger` | `#F87171` | reject / errors |

### Type
- **Display / story titles:** a cinematic serif — `"Fraunces"` or `"Instrument Serif"` (via `next/font`).
- **UI / body:** `"Geist"` or `"Inter"`. Numbers/metadata: `"Geist Mono"`.
- Scale: hero 48/56, h1 32, h2 24, body 15–16, caption 13. Generous line-height (1.5–1.6).

### Motion (framer-motion)
- Page/route transitions: 200–250ms fade+rise (`y: 8 → 0`).
- Card hover: scale 1.03 + gold/violet glow ring. Stagger children on grids (40ms).
- Split-view reveal: right panel slides in + tokens stream character-by-character.
- Keep everything **snappy** (<250ms). No janky bounces.

### Signature visual language
- **Gold = canon, Violet = fork.** Use consistently everywhere (tags, borders, timeline nodes).
- **Timeline tree**: sacred line is gold/vertical; forks branch off in violet at decision points.
- Subtle **noise/grain overlay** + soft radial glows behind hero sections (Pocket-FM-cinematic vibe).
- Glassmorphism *sparingly* on top navigation only.

---

## Sub-Phase Map (10 phases → all of ROADMAP Phase 2)

| # | Phase | User stories | Signature? |
|---|---|---|---|
| 1 | Scaffold + design system + test harness | — | infra |
| 2 | Types + mock data + API client | contract | infra |
| 3 | App shell + nav + mock auth (`/api/me`) | US-1, US-7 | |
| 4 | Netflix dashboard | US-2 | |
| 5 | Series page + episode timeline + timeline tree | US-3, US-5 | |
| 6 | Episode reader + rate + comments | US-4, US-6 | |
| 7 | Fork a decision → context assembly | US-8 | |
| 8 | Co-author editor (Monaco + AI chat + streaming) | US-9 | |
| 9 | **Split-view (original vs regenerated)** | US-15 | ⭐ |
| 10 | HITL approve/reject + author verify/rerank + polish | US-10, US-14 | ⭐ |

---

## PHASE 1 — Scaffold + Design System + Test Harness

**Goal:** a running Next.js app in `web/` with the Midnight Multiverse theme wired and the
test loop working end-to-end.

### MASTER PROMPT
```
Create a Next.js 14 (App Router) + TypeScript project in the web/ directory of this repo.
Requirements:
- Install & configure: TailwindCSS, shadcn/ui (init, Radix), framer-motion, lucide-react,
  @tanstack/react-query, @monaco-editor/react, clsx + tailwind-merge (cn helper).
- Testing: Vitest + @testing-library/react + jsdom + @testing-library/jest-dom, and Playwright
  for e2e. Add npm scripts: dev, build, start (bind -p ${DATABRICKS_APP_PORT:-3000}),
  lint, typecheck (tsc --noEmit), test (vitest run), test:watch, e2e (playwright test).
- TypeScript strict mode on.
- Implement the "Midnight Multiverse" design system:
  * tailwind.config.ts colors: ink #0A0A0F, panel #14141F, panel-2 #1C1C2A, line #2A2A3C,
    canon #F5C518, fork #8B5CF6, text #ECECF5, muted #9A9AB0, success #34D399, danger #F87171.
  * next/font: Fraunces (display), Inter (body), Geist Mono (mono). Expose as CSS vars.
  * globals.css: dark theme base, subtle grain overlay utility, radial-glow utility.
  * A cn() util in lib/utils.ts.
- Build a small UI kit in components/ui using shadcn: Button (variants: primary=gold,
  fork=violet, ghost, success, danger), Card, Badge (canon=gold, fork=violet), Skeleton,
  Avatar, Input, Textarea, Dialog, Tabs, Tooltip. All accessible + keyboard-focusable.
- A root layout with the dark theme, font vars, react-query provider, and a Toaster.
- A /styleguide route rendering every UI component + color swatches + type scale (dev only).

RED→GREEN→REFACTOR:
- RED: write a Vitest test that renders <Button variant="fork">Fork</Button> and asserts it
  shows the text and has the fork color class; a test that the root layout renders children.
- GREEN: implement until tests pass.
- REFACTOR: extract tokens, ensure no console warnings, run lint+typecheck+test all green.
```
**Done-when:** `npm run dev` shows `/styleguide` with all components; `npm test`, `npm run lint`,
`npm run typecheck` all pass; theme colors + fonts visible.

---

## PHASE 2 — Types + Mock Data + API Client

**Goal:** fully-typed dummy data matching `API_CONTRACT.md`, behind one swappable API client.

### MASTER PROMPT
```
In web/, create the data layer for NEXUS matching docs/API_CONTRACT.md exactly.

1. lib/types.ts — TypeScript interfaces for: User, Series, Season, Episode, Review, Character,
   plus response envelopes { data, meta } and the error shape. IDs are strings, timestamps ISO.
2. src/mocks/*.json — dummy data for the demo path:
   - 1 User (me): { id:"1", username:"sriman" }, and 2-3 other users (readers/co-authors).
   - 1 Series id:"10" "The Hollow Crown" (Fantasy), authorId:"1", episodeCount 4,
     contributorCount 3, avgRating 4.3, coverUrl a placehold.co image.
   - 1 Season id:"100".
   - 4 canonical Episodes (orderIndex 1..4). Episode 3 (id:"1003") has decisionPoint
     "The hero spares the villain" and real multi-paragraph content.
   - 2 alternate-timeline Episodes forked from "1003": isCanonical:false, coAuthorId set,
     forkedFromEpisodeId:"1003", different avgRating; ONE has verifiedByAuthor:true.
   - ~5 Reviews on episode 1003; one is the driving comment
     ("What if she killed him instead?").
   - 4 Characters incl. "Lady Corvin" (antagonist) with personality + speechStyle.
3. lib/api.ts — a typed API client with functions mapped to the contract endpoints:
   getMe(), getSeries(params), getSeriesById(id), getSeriesCharacters(id),
   getEpisodes(seriesId), getEpisode(id), getEpisodeTimelines(id), getReviews(id),
   postRating(id, score), postReview(id, body), forkEpisode(id, drivingReviewId?),
   generate(body) [returns an async iterator / callback stream], approveEpisode(body),
   verifyEpisode(id, verified).
   - A MODE flag (env NEXT_PUBLIC_API_MODE = "mock" | "live"). In "mock" it resolves from the
     JSON with a small artificial delay; in "live" it calls fetch('/api/...'). Same signatures.
   - generate() in mock mode must SIMULATE a token stream (yield the hard-coded alternate
     episode text word-by-word with ~30ms gaps), then a final draft object — so the split-view
     streaming works before the agent exists.
4. Wrap reads with @tanstack/react-query hooks in lib/hooks.ts (useSeries, useEpisode, etc.).

RED→GREEN→REFACTOR:
- RED: Vitest tests: getSeries() returns the seeded series; getEpisode("1003") has a
  decisionPoint; getEpisodeTimelines("1003") returns 2 forks with the verified one first
  (sorted by avgRating desc); generate() yields tokens then a final draft.
- GREEN: implement.
- REFACTOR: ensure switching NEXT_PUBLIC_API_MODE requires no component change (client only).
```
**Done-when:** all client functions typed + tested; flipping the MODE flag is the only change
needed for live integration; `generate()` streams in mock mode.

---

## PHASE 3 — App Shell + Navigation + Mock Auth

**Goal:** the persistent layout + top nav + a mocked current user (US-1, US-7).

### MASTER PROMPT
```
Build the NEXUS app shell in web/.
- components/layout/TopNav.tsx: glassy sticky top bar — NEXUS wordmark (Fraunces) left,
  a center search input (non-functional filter is fine), right = avatar + username + a small
  role hint. Uses getMe(). On mobile collapses gracefully.
- A LOGIN screen at /login matching wireframe #1: centered card on ink background with subtle
  radial glow — NEXUS logo, "Sign in", username + password inputs, a gold "Log in" button,
  "create account" link. It's a MOCK: submitting sets a fake session (localStorage) and routes
  to /dashboard. No real auth (Databricks OAuth handles it in prod; here we simulate).
- Route protection: if no mock session, redirect to /login; else show the shell with children.
- An AuthProvider/context exposing { me } from getMe(); expose an isOwner(series) helper
  (me.id === series.authorId) reused by dashboard/reader/editor to gate Edit-Create + Verify.
- Page transition wrapper (framer-motion fade+rise) around routed content.

RED→GREEN→REFACTOR:
- RED: test that visiting /dashboard with no session redirects to /login; that TopNav renders
  the mocked username; that isOwner returns true for series authored by me.
- GREEN: implement.
- REFACTOR: extract layout primitives; verify keyboard focus order + aria labels.
```
**Done-when:** login → dashboard flow works on mock session; nav shows current user; owner
gating helper available app-wide.

---

## PHASE 4 — Netflix Dashboard (US-2)

**Goal:** the premium series-browsing home (wireframe #2).

### MASTER PROMPT
```
Build /dashboard for NEXUS — a Netflix-grade browse page.
- Data via useSeries(). Sections: "Continue" and "Trending Multiverses" — horizontal,
  scroll-snapping rows of SeriesCard.
- components/SeriesCard.tsx: poster (next/image, gold/violet glow ring on hover, framer-motion
  scale 1.03), title (Fraunces), and a mono metadata line:
  "{episodeCount} episodes · {contributorCount} contributors · {avgRating}★".
  Canonical/featured series get a small gold "Canon" badge; heavily-forked ones a violet
  "{n} timelines" badge. Whole card links to /series/[id].
- A featured HERO banner at top for the primary series (id:"10"): large cover, title,
  genre tag, short description, "Enter the Multiverse" gold CTA.
- Loading = skeleton cards (no layout shift). Empty state = friendly message.
- Search box filters the visible cards by title/genre client-side.
- Fully responsive; laptop-first grid.

RED→GREEN→REFACTOR:
- RED: test the dashboard renders the seeded series title, the metadata line, and that a card
  links to /series/10; typing in search filters the list.
- GREEN: implement.
- REFACTOR: stagger card entrance; ensure images reserve space; a11y roles on the grid.
```
**Done-when:** dashboard shows series with correct metadata, hover motion, working search,
cards route to the series page; skeletons on load.

---

## PHASE 5 — Series Page + Episode Timeline + Timeline Tree (US-3, US-5)

**Goal:** the series detail with the sacred timeline and its forks (wireframe #3).

### MASTER PROMPT
```
Build /series/[id] for NEXUS.
- Header/hero: cover, title (Fraunces), genre + tags, author name, avgRating, "Follow" button,
  and an "Edit / Create" gold button that is VISIBLE ONLY when isOwner(series) is true
  (matches the wireframe note). Non-owners never see it.
- Season accordion (from wireframe #3): "Season 1" expandable; inside, the EPISODE LIST along
  the sacred timeline — each row: order number in a gold node, title, star rating, comment
  count. Canonical episodes get a gold "Canon" tag. Clicking a row → /episodes/[id].
- TIMELINE TREE component (components/TimelineTree.tsx): a vertical gold "sacred timeline"
  with numbered nodes; at each episode that has a decisionPoint, render violet branch lines
  to its alternate timelines (from getEpisodeTimelines). Top-rated fork shown first; the
  verified fork gets a gold ✓. Hovering a node highlights its branches. This is a key visual.
- "Top Rated Branch" panel (wireframe #3 right side) listing top alternate timelines with
  co-author name + rating + a violet "Alternate" tag.
- Loading skeletons; graceful empty (no forks yet) state.

RED→GREEN→REFACTOR:
- RED: test the series page shows 4 canonical episodes in order; the Edit/Create button is
  hidden for a non-owner and shown for the owner; the timeline tree renders 2 forks under
  episode 3 with the verified one flagged.
- GREEN: implement.
- REFACTOR: make TimelineTree pure/testable (pass data as props); animate branch draw-in.
```
**Done-when:** series page lists the sacred timeline + branching tree; owner-only Edit/Create
gating works; forks render top-rated-first with the verified badge.

---

## PHASE 6 — Episode Reader + Rate + Comments (US-4, US-6)

**Goal:** read an episode, rate it, comment — the signals that drive forks (wireframe #4).

### MASTER PROMPT
```
Build /episodes/[id] — the NEXUS reader.
- Two-column laptop layout. LEFT (main): a 🔊 audio bar at top (Text | Audio tabs from
  wireframe; Audio shows a disabled "coming soon" player unless audioUrl exists → then play it),
  episode title (Fraunces), and beautifully typeset long-form content (max-width ~68ch,
  serif-ish body, comfortable line-height). Reading progress bar at very top.
- Inline DECISION POINT: if episode.decisionPoint is set, render a highlighted violet chip
  near the relevant passage with a "⤺ Rewind / change this decision" button. This button is
  the entry to the fork flow (Phase 7). (Show it to any logged-in user; the editor is where
  authorship is enforced.)
- Under content: a star RATING widget (1–5, optimistic update via postRating) showing
  avgRating + count, and a COMMENT composer (Textarea + "Post" button, postReview) plus a
  threaded comment list (top-level + nested replies). One comment is the "driving" comment;
  give it a subtle violet left-border so it's spottable in the demo.
- RIGHT sidebar: "Comments" count + "Alternate Timelines (top rated)" — violet cards linking
  to the fork episodes.
- Optimistic UI for rating + posting a comment; rollback on error.

RED→GREEN→REFACTOR:
- RED: test reader renders episode 1003 content + decisionPoint chip; posting a rating updates
  the average optimistically; posting a comment appends it to the list.
- GREEN: implement.
- REFACTOR: extract RatingStars, CommentThread, CommentComposer; ensure a11y on the widgets.
```
**Done-when:** reader shows content + rating + threaded comments; rate/comment update
optimistically; the Rewind button appears at the decision point.

---

## PHASE 7 — Fork a Decision → Context Assembly (US-8)

**Goal:** clicking "Rewind" assembles fork context and opens the editor (wireframe → editor).

### MASTER PROMPT
```
Implement the FORK flow in web/.
- From the reader's "⤺ Rewind / change this decision" button, call forkEpisode(episodeId,
  drivingReviewId?) which returns { sourceEpisode, decisionPoint, drivingComment, characters }.
- Show a short "time-machine" transition (framer-motion): a brief overlay
  "Rewinding to the decision point…" then route to /episodes/[id]/fork (the editor).
- On the fork route, present a compact CONTEXT header the co-author sees before writing:
  the decision point premise, an editable "What if…" input (the new decisionPoint, e.g.
  "What if she killed him instead?"), an optional dropdown to pick a DRIVING COMMENT from the
  episode's reviews (defaults to the highlighted one), and a CHARACTERS strip (chips showing
  name + role + speechStyle tooltip) so it's clear the AI will honor character memory.
- A prominent violet "Generate Alternate Future" button → goes to Phase 8/9 (editor + split).
- No DB write happens here (context only) — make that explicit in a small helper note.

RED→GREEN→REFACTOR:
- RED: test that clicking Rewind on episode 1003 routes to the fork editor with the decision
  point text shown, the driving comment preselected, and the character chips rendered.
- GREEN: implement.
- REFACTOR: keep fork context in a small store/context so editor + split-view read it.
```
**Done-when:** Rewind → fork editor with decision premise, editable "what if", chosen driving
comment, and character chips; Generate button ready.

---

## PHASE 8 — Co-Author Editor: Monaco + AI Chat + Streaming (US-9)

**Goal:** the VS-Code-+-Copilot editing surface (wireframe #6).

### MASTER PROMPT
```
Build the CO-AUTHOR EDITOR at /episodes/[id]/fork.
- Layout (wireframe #6): a top file tab "Episode N — Alternate". LEFT (~65%) = MANUSCRIPT
  using @monaco-editor/react (markdown/plaintext, line numbers, dark theme matching Midnight
  Multiverse, wrap on). RIGHT (~35%) = AI CHAT panel: a scrollable message list (user prompt
  bubbles + AI draft bubbles), an input box at the bottom, and a row of 3 actions:
  "Approve" (success/green), "Edit" (ghost), "Reject" (danger). A small note: "nothing saved
  until Approve (human-in-the-loop)".
- Clicking "Generate Alternate Future" (from Phase 7) calls generate({ sourceEpisodeId,
  decisionPoint, drivingReviewId, instructions }). Stream tokens live into the AI chat bubble
  AND into the Monaco manuscript (so the co-author watches the episode being written).
- The co-author can then edit the manuscript freely, or type an instruction in the chat
  ("make it darker") to re-generate — mock mode just re-streams a variant.
- A "Compare with Original" button opens the Split-View (Phase 9).
- Persist nothing yet; Approve is wired in Phase 10.

RED→GREEN→REFACTOR:
- RED: test that Generate streams tokens into the manuscript (final content contains the
  hard-coded alternate text) and the chat shows an AI draft bubble; the 3 HITL buttons render.
- GREEN: implement (mock the Monaco editor in tests via a lightweight stub if needed).
- REFACTOR: debounce editor changes; keep draft state in the fork store for split-view/approve.
```
**Done-when:** editor streams a generated draft into Monaco + chat; co-author can edit + re-ask;
HITL buttons present; draft held in state.

---

## PHASE 9 — ⭐ Split-View (Original vs Regenerated) (US-15)

**Goal:** THE signature screen — the gasp moment (wireframe #5).

### MASTER PROMPT
```
Build the SPLIT-VIEW component + route for NEXUS (the signature moment).
- Top banner: "Timeline regenerated" + the DRIVING COMMENT shown in a highlighted violet pill
  (e.g. "what if she killed him instead?").
- Body: TWO synchronized panels side by side with a center divider:
  LEFT "Original Timeline" — the source episode content (neutral/grey text).
  RIGHT "Alternate Timeline" — the regenerated content (violet-tinted panel, fork color).
  If arriving fresh (not from editor), the RIGHT side STREAMS in token-by-token via generate()
  with a visible cursor — this is the live wow. Panels scroll in sync (optional but nice).
- A CALLOUT: an arrow/annotation pointing to a line on the right labeled
  "character stays consistent" — wire this to a character whose behavior matches their
  speechStyle/personality (pull the character from context). This literally demonstrates
  persistent memory to the judges.
- Bottom bar: an MLflow-style score chip ("Continuity 4.6/5 · Character 4.8/5") [dummy for now,
  real in Phase 3 backend] and an "Edit in Co-Author Editor" button (back to Phase 8) plus
  "Approve this timeline" (green → Phase 10).
- Smooth entrance: right panel slides in from the right; tokens stream; callout fades in last.

RED→GREEN→REFACTOR:
- RED: test the split-view renders both panels, the driving-comment pill text, the streamed
  alternate content (final text present), the consistency callout, and the score chip.
- GREEN: implement.
- REFACTOR: make panels reusable + the streaming hook shared with the editor; test sync scroll.
```
**Done-when:** split-view shows original vs streamed alternate side-by-side, the driving
comment, the character-consistency callout, and a score chip; entrance animation lands.

---

## PHASE 10 — HITL Approve/Reject + Author Verify/Rerank + Polish (US-10, US-14)

**Goal:** close the loop + author showrunner controls + a final polish pass (wireframe #7).

### MASTER PROMPT
```
Finish the NEXUS Phase-2 loop and polish.

A) HITL (US-10) in editor + split-view:
   - "Approve" → approveEpisode(body) creates the new alternate-timeline Episode
     (isCanonical:false, coAuthorId = me.id) in mock state, toasts success, and routes to the
     new episode's reader where it now appears under the timeline tree as a fresh violet fork.
   - "Reject" → discard draft, toast, back to reader (nothing persisted).
   - "Edit" → stay in Monaco.

B) Author / Showrunner view (US-14) at /series/[id]/branches (wireframe #7):
   - Visible only when isOwner(series). Grid of forked timelines (violet cards) each with
     title, co-author name, avgRating, and a gold "✓ Verify" button; an already-verified card
     shows a gold "Canonized" badge. Clicking Verify → verifyEpisode(id,true), sets the badge,
     and RE-RANKS: the verified branch jumps to the top of the timeline tree / top-rated list
     (visible reshuffle — the satisfying final demo beat). Small note: "verifying reshuffles
     dashboard ranking".

C) Polish pass (make it top-notch):
   - Consistent loading skeletons + empty + error states on every route.
   - framer-motion page transitions + list stagger everywhere.
   - Keyboard nav + focus rings + aria across all interactive elements; run an a11y check.
   - Zero console errors/warnings; fix all lint + TS issues.
   - A Playwright e2e test covering the FULL DEMO PATH:
     login → dashboard → series → episode 3 → highlighted comment → Rewind → generate →
     split-view → Approve → new fork appears → author Verify → rerank.

RED→GREEN→REFACTOR:
- RED: unit tests for approve (adds fork), reject (adds nothing), verify (sets badge + reranks
  so verified fork is first). Plus the Playwright e2e demo-path spec.
- GREEN: implement until unit + e2e are green.
- REFACTOR: final cleanup; ensure MODE flag flip is the only thing needed to go live.
```
**Done-when:** Approve creates a visible new fork; Reject discards; author Verify canonizes +
reranks; the **full demo path passes as a Playwright e2e**; lint/typecheck/test all green,
zero console errors.

---

## Definition of Done (whole Phase 2)
- [ ] Entire demo path clickable on **dummy JSON**, including the ⭐ split-view.
- [ ] Every route has loading / empty / error states; no layout shift.
- [ ] Owner-only controls (Edit/Create, Verify) gated by `isOwner`.
- [ ] `generate()` streams in mock mode; split-view + editor consume the same stream hook.
- [ ] One API client; flipping `NEXT_PUBLIC_API_MODE` to `live` needs **no component changes**.
- [ ] `npm run lint && npm run typecheck && npm test && npm run e2e` all pass.
- [ ] Zero console errors/warnings; AA color contrast; keyboard-navigable.
- [ ] Matches wireframes (7 screens) + Midnight Multiverse theme.

## Integration handoff (to Phase 1/3)
- Frontend consumes exactly the shapes in `API_CONTRACT.md`. At integration, set
  `NEXT_PUBLIC_API_MODE=live`; the `/api/*` routes + agent `/generate` SSE replace the mocks.
- Keep `src/mocks/*.json` as fixtures for tests even after going live.

## Commit / branch discipline
- Work on branch `frontend`. One commit per sub-phase (`feat(fe): phase N — <thing>`).
- Pull `main` before pushing; open a PR `frontend → main` after the demo path is green.
- Do **not** commit `node_modules` or build output.
