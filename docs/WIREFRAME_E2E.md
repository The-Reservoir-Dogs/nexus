# NEXUS — End-to-End Wireframe

The full product wireframe: **login → discover → read → react → create → update → branch →
sub-branch → verify**. This is the authoritative screen + flow spec. Retention/analytics detail
lives in `WIREFRAME_PLAN.md §4`; this doc covers everything else and the write flows.

Legend: `[ button ]` · `▾` dropdown · `●` active/selected · `✎` editable · `SSE` streamed ·
**(gap)** = UI/endpoint not built yet (see §9).

---

## 1. Personas × journey (what each screen serves)

```
 FAN            login ─▶ home ─▶ reader ─▶ rate/comment ─▶ explore branches
 CO-AUTHOR      login ─▶ home ─▶ reader ─▶ create branch ─▶ editor(agent) ─▶ approve
                                        └▶ continue my timeline (N+1) ─▶ editor ─▶ approve
                                        └▶ sub-branch a branch (N+2)  ─▶ editor ─▶ approve
 AUTHOR         login ─▶ home ─▶ reader(author) ─▶ analytics ─▶ edit/update ─▶ verify/canonize
                              └▶ new series / season / episode / characters   (gap)
```

---

## 2. Route / information architecture

Everything lives inside one persistent **Shell** (TopNav + docked AudioPlayer). Navigation keeps
nav + player mounted.

```
EXISTING
/login                          gateway
/                               home — series grid
/series/:id                     → redirect to first/most-recent episode reader
/series/:id/branches            multiverse map (TimelineTree)
/episodes/:id                   reader (author sees analytics/edit pills)
/episodes/:id/editor            editor — agent chat side panel (create branch)
/episodes/:id/split             editor split vs canonical
/episodes/:id/analytics         retention (drawer over reader; see WIREFRAME_PLAN §4)
/styleguide                     dev token/component gallery

PROPOSED (close the write-flow gaps, §9)
/episodes/:id/editor?mode=continue   continue this timeline → next episode (N+1)
/episodes/:id/editor?mode=fork       fork this episode (works from canon OR a branch = sub-branch)
/episodes/:id/edit                   in-place update of an existing episode (author/co-author)
/series/new · /series/:id/season/new · /series/:id/episode/new   author authoring (canonical)
/series/:id/characters                context authoring (characters/world/style/threads)
```

---

## 3. API ↔ screen binding (data flow)

| Screen | Reads | Writes |
|---|---|---|
| Login | `GET /api/me` | — (session flag client-side) |
| Home | `GET /api/series?q&genre` | — |
| Series redirect | `GET /api/series/:id` → firstEpisodeId | — |
| Reader | `GET /api/episodes/:id`, `/series/:id/episodes`, `/episodes/:id/timelines`, `/episodes/:id/reviews` | `POST /episodes/:id/ratings`, `/episodes/:id/reviews` |
| Reader (author) | + `GET /api/episodes/:id/retention` | — |
| Editor (create branch) | `POST /episodes/:id/fork` (context), `POST /generate` `SSE` | `POST /episodes` (approve) |
| Split view | `GET /api/episodes/:id` (this) + canonical (main) | same as editor |
| Continue timeline (N+1) | `GET /api/episodes/:id`, `/generate` `SSE` | `POST /episodes` w/ `prevEpisodeId` **(gap: UI)** |
| Sub-branch (N+2) | `POST /episodes/:id/fork` from a branch ep, `/generate` | `POST /episodes` w/ `forkedFromEpisodeId`=branch ep **(partial)** |
| Update episode | `GET /api/episodes/:id` | `PUT /api/episodes/:id` **(gap: endpoint)** |
| Branches map | `GET /api/series/:id/episodes` + per-ep `/timelines` | `POST /episodes/:id/verify` |
| Author authoring | `GET /series/:id/characters` | `POST /series`, `/seasons`, `/episodes`, `/characters` **(gap)** |

---

## 4. Global shell

```
┌───────────────────────────────────────────────────────────┐
│ nexus.   [ search…                    ]           ( avatar ▾)│  TopNav (sticky)
├──────────┬───────────────────────────────┬────────────────┤
│ LeftRail │  Center: EpisodePane          │  Right: SidePanel│
│ season ▾ │  (read | edit | split)        │  (comments|agent)│
│ ep 1 ●   │                               │                 │
│ ep 2     │                               │                 │
│  └branch │  ◁ ▷ ▷  ──●──────  AudioPlayer │                 │
└──────────┴───────────────────────────────┴────────────────┘
```
Two dual-mode components carry the app: **EpisodePane** (read / edit / split) and **SidePanel**
(comment thread / agent chat). LeftRail = SeasonTree showing canonical spine + nested branches.

---

## 5. Screen wireframes

### 5.1 Login  `/login`
```
            ┌──────────────────────┐
            │        nexus.        │
            │  Rewrite fate.       │
            │  ┌────────────────┐  │  #username (prefill dev user)
            │  │ username       │  │
            │  ├────────────────┤  │  #password (dev: optional)
            │  │ password       │  │
            │  └────────────────┘  │
            │     [  Log in →  ]   │
            └──────────────────────┘
```
- Submit → set session → `GET /api/me` → redirect `/`.
- Prod: Databricks OAuth (headers). Local: `DEV_USER` / `x-nexus-dev-user`.
- States: idle · submitting (`Signing in…`) · error (bad identity → inline).

### 5.2 Home  `/`  (data rendering)
```
 Series                                     [ filter title/genre… ]
 12 multiverses · fork any timeline, hear it change
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ cover    │ │ cover    │ │ cover    │   SeriesCard:
 │ Title    │ │ Title    │ │ Title    │   title · genre Badge · author
 │ Fantasy  │ │ …        │ │ …        │   · N episodes · ★avg · ⑂branches
 │ ★4.5 ⑂3  │ │          │ │          │
 └──────────┘ └──────────┘ └──────────┘
```
- `GET /api/series` → grid (3-up→1-up). Card click → `/episodes/:firstEpisodeId`.
- States: loading = Skeleton grid · empty = "No series match" · error = retry.

### 5.3 Reader — fan  `/episodes/:id`
```
 ┌ LeftRail ─┬ EpisodePane (read) ─────────────┬ Comments ────┐
 │ ← Series  │ [canon]  [⑂ Create branch]       │ Comments     │
 │ season 1 ▾│ ── The Spared Blade ──           │ ┌──────────┐ │
 │ ep1       │ Canonical timeline  ★4.5·12      │ │ amy: what│ │ ← driving
 │ ep2       │                                  │ │ if she…  │ │   comment
 │ ep3 ●     │ <serif script body, 19px/1.7>    │ └──────────┘ │
 │  ├2001⑂   │                                  │ ┌──────────┐ │
 │  └2002⑂   │ ┌ decision point ────────────┐   │ │ …replies │ │
 │ ep4       │ │ "hero spares the villain"  │   │ └──────────┘ │
 │           │ └────────────────────────────┘   │ ─────────────│
 │           │ ⑂ Top branches:                   │ [ write…   ] │
 │           │  • The Fallen Blade ✓ ★5 →        │ [Post comment]│
 │           │  • A Bargain in Blood ★3.5 →      │              │
 │           │ ★★★★★ rate                        │              │
 │           │ ◁ ▷ ▷ ──●──── audio               │              │
 └───────────┴──────────────────────────────────┴──────────────┘
```
- Reads: episode, sibling episodes (spine), timelines (top-K branches), reviews.
- `[Create branch]` shows only when `episode.decisionPoint` is set (canon **or** branch → sub-branch).
- Writes: rate (optimistic → `POST ratings`), comment (optimistic → `POST reviews`).
- States: loading skeleton lines · no audio → "Generate narration" · no branches → hide list ·
  no comments → empty prompt.

### 5.4 Reader — author/co-author (same route)
Adds toolbar pills (gated by `authorId`/`coAuthorId` vs `me.id`):
```
 [canon] [⑂ Create branch]              [ 📊 Analytics ]  [ ✎ Edit ]
```
- `Analytics` → retention view (`WIREFRAME_PLAN §4`).
- `Edit` → editor. **Decide (gap §9):** Edit should offer *update in place* vs *fork* — today it
  always lands in fork/editor.

### 5.5 Editor — create branch  `/episodes/:id/editor`
```
 ┌ Tree ─┬ EpisodePane (✎ manuscript) ───────┬ SidePanel = AGENT CHAT ─┐
 │ …     │ [branch] what-if: "she killed…"    │ AI Co-Author  ✦        │
 │       │  [ ⇆ Split view ]                  │ ┌ user: generate ────┐ │
 │       │                                    │ │ ⋯ reasoning        │ │  collapsible
 │       │  ✎ <draft streams here>            │ │ ▸ tool_call get_…  │ │  tool steps
 │       │                                    │ │ ▸ tool_result 3 rows│ │
 │       │                                    │ │ draft: "The blade…"│ │  SSE tokens
 │       │                                    │ └────────────────────┘ │
 │       │ [✓ Approve & publish] [✕ Discard]  │ [ direct the co-author ]│
 │       │  nothing saved until approve       │ [Send]                 │
 └───────┴────────────────────────────────────┴────────────────────────┘
```
- Enter: `POST /fork` assembles context (source ep, decision point, driving comment, characters).
- Agent: `POST /generate` `SSE` — `reasoning`/`tool_call`/`tool_result` steps then `token`s stream
  into manuscript + chat. Prompt box = writer's steering ("make it darker").
- Approve: `POST /episodes` (`forkedFromEpisodeId` = source, `prevEpisodeId` defaults to source,
  optional `characterStates` snapshots) → new alt episode → redirect to its reader.
- States: forking · generating (typing dots, Approve disabled) · error event → retry · approved.

### 5.6 Split view  `/episodes/:id/split`
```
 ┌ this branch (✎) ───────────┬ canonical / og main (read) ┐
 │ The blade fell without…     │ Aldric hesitated — and     │
 │ hesitation. Corvin's eyes…  │ lowered his sword…         │
 └─────────────────────────────┴────────────────────────────┘
```
Side-by-side compare — the "gasp" moment. Same approve/discard footer + agent panel.

### 5.7 Continue timeline — N+1  *(gap: needs UI)*
From a **branch episode you own**, write the next episode *in that same timeline*.
```
 reader(branch 2001) ─▶ [ ▷ Continue this timeline ] ─▶ editor?mode=continue
   └ approve → POST /episodes { prevEpisodeId: 2001, forkedFromEpisodeId: <branch origin> }
```
- Agent context walks `episode_ancestry` (prior branch eps + evolved character_state).
- Result chains `prev_episode_id = 2001`; `order_index = parent+1`. Backend already supports the
  body; **missing = the reader button + `?mode=continue` wiring.**

### 5.8 Sub-branch — fork from a branch (N+2 lineage)
Fork a **branch** episode (not just canon): "what if, within this alternate, X changed".
```
 reader(branch 2001, has decisionPoint) ─▶ [⑂ Create branch] ─▶ editor
   └ approve → POST /episodes { forkedFromEpisodeId: 2001, prevEpisodeId: 2001 }
```
- Deep lineage: `episode_ancestry` resolves nearest snapshots so a character killed at 2001 stays
  dead downstream. Continuity verified in backend.
- **UI note:** works today only if the branch episode has `decisionPoint` set; ensure branch
  episodes created with a decision point expose `[Create branch]`. TimelineTree must render depth
  > 1 (nested nodes).

### 5.9 Update an existing episode  *(gap: endpoint + route)*
```
 reader(author) ─▶ [✎ Edit] ─▶ /episodes/:id/edit  (EpisodePane editable, no agent required)
   └ [Save] → PUT /api/episodes/:id { title, content, summary }
```
- Distinct from fork: mutates the *same* row (canonical fix-ups, co-author polishing their branch).
- Gate: author for canonical, co-author for their branch. **Needs `PUT /api/episodes/:id`.**

### 5.10 Branches / multiverse map  `/series/:id/branches`
```
        ● ep1 ─ ● ep2 ─ ● ep3 ───┬── ● ep4         (gold = canonical spine)
                                 ├── ◆ 2001 ✓ ─ ◆ 2003   (blue = fork; ✓ canonized)
                                 └── ◆ 2002              (nested = sub-branch/N+2)
   [ Verify ] on a fork → POST /verify → canonize → ranking reshuffles
```
- TimelineTree: canonical gold, forks blue, verified ✓. Author-only `[Verify]`.

### 5.11 Author authoring (context + canonical)  *(gap)*
```
 new series ─▶ add season ─▶ add characters/world/style/threads ─▶ write ep1..N (canonical)
```
- Needed for a non-seeded universe. POST endpoints for series/seasons/episodes(canonical)/
  characters do not exist yet. MVP relies on seed; flag as roadmap.

---

## 6. Write-flow state machines

**Create branch / sub-branch**
```
idle → [Create branch] → forking(POST /fork) → editor:generating(SSE)
     → draft ready(Approve enabled) → [Approve](POST /episodes) → new reader
                                    → [Discard] → back to source reader
     error(SSE error) → retry
```

**Continue timeline (N+1)** — same as above but `mode=continue`, `prevEpisodeId=current`,
`forkedFromEpisodeId=branch origin`, no new decision point required.

**Update episode** — `edit → dirty → [Save](PUT) → saved | conflict(409) | 403`.

**Verify/canonize** — `unverified → [Verify](POST /verify) → verified ✓ → list reranks`.

---

## 7. States every data view must handle
- **Loading:** skeletons matching final layout (grid, script lines, comment rows, curve).
- **Empty:** no series · no episodes · no branches · no comments · no audio ("Generate
  narration") · no retention ("not enough plays").
- **Streaming:** agent reasoning/tool steps + typing dots; tokens into editor; `error`→retry.
- **Auth:** non-author hides analytics/edit/verify; `POST` 401→sign-in; 403 on others' content.
- **Optimistic + rollback:** ratings, comments.

---

## 8. Access matrix
| Viewer | Read | Rate/comment | Create branch | Continue/Update | Analytics | Verify |
|---|---|---|---|---|---|---|
| Fan | ✓ | ✓ (401→login) | ✓ (starts a fork) | ✗ | ✗ | ✗ |
| Co-author (owns branch) | ✓ | ✓ | ✓ | ✓ own branch | ✓ own branch | ✗ |
| Author | ✓ | ✓ | ✓ | ✓ canon + own | ✓ | ✓ |
Derived from `episodes.author_id` / `co_author_id` vs `me.id` — no role column.

---

## 9. Gap status (all core flows now implemented)

| # | Gap | Status |
|---|---|---|
| 1 | Continue timeline (N+1) | **Done** — reader `[Continue timeline]` + `editor?mode=continue` sends `prevEpisodeId`; chains lineage. e2e covered. |
| 2 | Sub-branch depth in UI | **Done** — nested branch fetch (reader+editor), recursive `SeasonTree`, fork-from-branch sets `forkedFromEpisodeId`=branch ep. e2e covered. |
| 3 | Update episode in place | **Done** — `PUT /api/episodes/:id` + `/episodes/:id/edit`; reader `Edit`=update, `Create branch`=fork. e2e covered. |
| 4 | Analytics as drawer | **Done** — `AnalyticsPanel` + `AnalyticsDrawer` over reader; `/analytics` route reuses the panel. |
| 5 | AI insight streaming | **Done** — `POST /api/analyze` `SSE` (proxy + dev fallback synthesizing from the real retention drop-off); streamed into the insight block. |
| 6 | Author authoring | **Done** — `POST /series` (auto Season 1), `POST /series/:id/episodes` (canonical), `POST /series/:id/characters`; screens `/series/new`, `/series/:id/episode/new`, `/series/:id/characters`. e2e covered. |
| 7 | Narration generation | Open — `POST /api/episodes/:id/narrate` → audio; player "generating…" state. (TTS exists in `tts/`; not yet wired to a route.) |

---

## 10. Build order (wireframe → implementation)
1. Reader flows solid (read + rate + comment + branch ribbon) — **done**.
2. Editor create-branch + approve + split — **done**.
3. Analytics retention (drawer) + AI insight stream — retention **done**, insight = gap #5.
4. **Continue-timeline (N+1)** button + wiring — gap #1.
5. **Sub-branch** UI depth + TimelineTree nesting — gap #2.
6. **Update episode** (`PUT`) + edit route — gap #3.
7. Author authoring (series/season/episode/characters) — gap #6.
8. Polish: motion, waveform, mobile (rail→drawer, side panel→tab, analytics→sheet), narration.

Wire everything through `lib/api.ts` (mock ↔ live parity) so screens never change when swapping
data sources.
