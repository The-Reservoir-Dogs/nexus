# NEXUS — Product Definition

**Narrative Engine for eXpanding Universe Storytelling**

---

## 1. The Idea

NEXUS is a **living story multiverse**. A series starts with a canonical "sacred timeline" written by the original author. At any decision point in any episode, readers and co-authors can **rewind and change one decision** — and an AI co-author regenerates a consistent alternate future from that moment, keeping every character true to their established personality and memory.

Readers steer stories by commenting and rating; those signals feed the AI. Co-authors act as directors who shape alternate timelines with a human-in-the-loop editor (nothing is written until they approve). The original author is the **showrunner** who can verify a branch and canonize it.

**One-line pitch:** *What if every reader could rewrite fate, and an AI kept the whole universe consistent — while the author decides what becomes canon?*

This directly delivers three of the P1 "AI-Native Storytelling" themes at once:
- **Story Time Machine** — jump into any moment, change one decision, AI regenerates the future consistently.
- **AI Co-Author** — the crowd collectively influences a live, evolving story while AI maintains quality.
- **Persistent character memory** — side characters keep their personality/memory across every timeline.

---

## 2. Personas

- **Fan / Reader** — consumes series, reacts (rate/comment), explores alternate timelines. Their feedback steers the story.
- **Co-Author (Director)** — forks a decision point, works with the AI editor to write an alternate future, publishes a branch.
- **Original Author (Showrunner)** — owns the sacred timeline, reviews branches, verifies/canonizes the best ones.
- **System / AI Co-Author** — assembles context, regenerates consistent futures, enforces continuity + character fidelity, gates on quality evals.

---

## 3. User Stories

Format: **As a [persona], I can [action] so that [value].**

### Fan / Reader
- **US-1 — Login:** As a fan, I can log in with a simple account so that I have a profile and can participate.
- **US-2 — Discover:** As a fan, I can see a Netflix-style dashboard of series with metadata (contributors, episodes, timelines) so that I can find and follow stories I care about.
- **US-3 — Browse episodes:** As a fan, I can open a series and see its episode list along the sacred timeline so that I can navigate the story.
- **US-4 — Read canonical episode:** As a fan, I can read an episode authored by the original author so that I can enjoy the canonical story.
- **US-5 — Explore alternate timelines:** As a fan, I can see the top-rated alternate timelines forked from a decision point so that I can read how the story could have gone differently.
- **US-6 — Rate & comment:** As a fan, I can rate and comment on any episode (canonical or alternate) so that I can express my view and influence how the story evolves next.

### Co-Author (Director)
- **US-7 — Access as co-author:** As a co-author, I can log in and browse series, episodes, and others' alternate timelines so that I can see the whole multiverse before contributing.
- **US-8 — Rewind a decision:** As a co-author, I can pick a decision point in an episode and fork an alternate timeline from it so that I can explore "what if this decision changed."
- **US-9 — Co-write with the AI editor:** As a co-author, I can use a VS Code-style editor with an AI chat panel so that the AI drafts the next episode using prior context, character memory, and reader comments.
- **US-10 — Human-in-the-loop approval:** As a co-author, I can review, edit, and approve (or reject) the AI's draft before anything is saved so that I stay in creative control and nothing is published without my sign-off.
- **US-11 — Continue a timeline:** As a co-author, I can write episode N+1 within a timeline I own so that I can extend the alternate future I created.
- **US-12 — See what readers want:** As a co-author, I can view the comments and ratings on the episodes in my timeline so that I can shape the next episode around audience feedback.

### Original Author (Showrunner)
- **US-13 — Review branches:** As an original author, I can view the alternate timelines forked from my story so that I can see how the community is extending it.
- **US-14 — Verify / canonize:** As an original author, I can give a verified tick to a branch I like so that readers know it's endorsed and it is boosted in ranking.

### System / AI Co-Author
- **US-15 — Context-aware regeneration:** As the system, I can regenerate a consistent alternate future from a chosen decision point using prior episodes, character memory, and reader feedback so that new timelines stay coherent with the original.
- **US-16 — Continuity & character fidelity:** As the system, I can keep every character true to their persistent personality/memory across timelines so that the universe never breaks continuity.
- **US-17 — Quality gate (evals):** As the system, I can score each generated episode for continuity, character fidelity, and quality, and block auto-publish on failure so that only high-quality, consistent content reaches readers.

---

## 4. MVP Scope (to win the hackathon)

Priority = demo impact. Spectacle first, frame second, credibility third.

### Tier 0 — The Spectacle (build for real — this wins)
| Story | Feature | Must-have detail |
|---|---|---|
| US-8 | Fork a decision point = "rewind / alternate timeline" | UI framed as time travel, not "git branch". Visual. |
| US-15 | Regenerate the alternate future | Uses prior episode + character memory + the reader comment as context. |
| — | **Split-view: original timeline vs regenerated timeline** | Side-by-side. This is the gasp moment. Highest-payoff pixel. |
| US-6→US-15 | Comment → decision → regeneration causality | The driving reader comment is visibly highlighted as the input. |
| US-16 | Character consistency, shown | Character memory is a Postgres text field; point at consistent behavior in the demo. |
| US-14, US-5 | Verify → canonize → rerank | Author endorses a branch; ranking reshuffles. Satisfying final beat. |

### Tier 1 — The Frame (make it feel alive)
| Story | Feature | Notes |
|---|---|---|
| — | **Pre-seeded living universe** | Non-negotiable. 1 rich series, 4+ episodes deep, with branches/ratings/comments. Empty app = loss. |
| US-2, US-3, US-4 | Dashboard → series → episode reader | Clean, pretty, mostly static. |
| US-1, US-7 | Login + roles (fan / author) | Databricks Apps OAuth + role flag. |
| US-6 | Rate + comment | Real — it feeds the fork. |
| US-9, US-10, US-15 | AI editor + HITL approve | Single agent with tool calls (getEpisode, getComments, getCharacter). The approve/reject/edit UI must be obvious and satisfying. |

### Tier 2 — Credibility
| Story | Feature | Notes |
|---|---|---|
| US-17 | One MLflow eval score on the regenerated episode | Proves "AI maintains quality/consistency" — the literal P1 claim. |
| — | Databricks-native story slide | Apps + Lakebase + Foundation Model APIs + MLflow, all real. |

### Tier 3 — Cut / fake
| Item | Verdict |
|---|---|
| US-5 ranking math | Simple `ORDER BY avg_rating`. No Bayesian. |
| Audio / TTS | Good-to-have. One pre-rendered clip behind a 🔊 button, or skip. |
| Co-author analytics dashboard | Faked number or skipped. |
| Author comment inbox | Covered by US-12; no separate build. |
| Sub-branches / deep lineage | Cut. One level of forking from the sacred timeline only. |
| Vector DB / RAG / sync pipeline | Cut for MVP — context fits directly in the prompt. Roadmap slide only. |
| Real-time multi-user influence | Seed data. |

---

## 5. The Demo Path (rehearse this)

1. Open series — the multiverse **breathes**: multiple timelines, ratings, activity.
2. Open canonical episode 3, ending on a decision ("the hero spares the villain").
3. Reader comment highlighted: *"what if she killed him instead?"*
4. Click the decision point → **Rewind / change decision.**
5. AI regenerates episode 4 in the new timeline → **split-view**: original vs alternate.
6. Point out a character reacting **consistently** with their established memory.
7. Author hits **Verify** → new branch becomes canon → ranking reshuffles.

Under 2 minutes. Every beat visible and causal. Pitch the multiverse metaphor first; the tech slide last.

---

## 6. Success Criteria
- Judges can **retell** the demo afterward (memorable wow moment).
- The demo **runs live** without cold-start failure (pre-warm everything; keep a backup video).
- Clear, honest **Databricks-native** story.
- One tangible **eval score** proving AI quality/consistency.
