# NEXUS — Pitch Script (matches nexus_pitch.pptx, 15 slides)

**Total: ~5–6 min talk + demo.** Speak slowly. Pause after the wow. One person narrates, one drives the demo.
Tip: don't read slides — the slides are for the *jury's* eyes; these lines are for *your mouth*.

---

### Slide 1 — Title (15s)
> "Hi, we're The Reservoir Dogs, and this is **NEXUS** — a living story multiverse.
> In one line: rewind any story, change a single decision, and an AI rewrites the future —
> keeping every character and every fact consistent, and playing it back as audio drama.
> Built for Pocket FM, on Databricks."

### Slide 2 — The Problem (25s)
> "Today a Pocket FM story is one fixed path — written once, and you just press play.
> Personalization stops at recommendations: AI picks *what* you hear next, but never touches
> the story itself. So the most human question a listener asks — *'what if it went
> differently?'* — has no answer. That's the gap."

### Slide 3 — The Insight (25s)
> "So we didn't build 'an AI that writes stories' — everyone builds that.
> We asked the prompt's real question: what storytelling is possible **only because AI exists**?
> The answer: a universe of infinite branching timelines that a single AI keeps perfectly
> consistent — something no human writers' room could ever maintain by hand."

### Slide 4 — The Solution (30s)
> "That's NEXUS — a story time machine.
> You rewind to any decision — say, 'the hero spared the villain' — and change it.
> The AI regenerates the alternate future, remembering each character's personality, voice,
> and crucially, what they're even *allowed* to know in this timeline.
> It plays back as cinematic multi-voice audio — Pocket FM's native format.
> Then the community rates branches, and the author verifies which become canon."

### Slide 5 — How It Works (25s)
> "Under the hood it's six steps: rewind a decision → the AI gathers canon and character memory →
> it regenerates the timeline → it **checks its own consistency** → it narrates the result as audio →
> and the community canonizes the best branch. Let me show you what makes step four special."

### Slide 6 — Feature 1: Time Machine + Memory (25s)
> "First: the Story Time Machine with persistent memory. Change one decision, and every future
> event regenerates — that's the core P1 challenge, solved.
> Characters keep their personality and voice, and respect knowledge limits — a character can
> never reference something that didn't happen in *this* timeline. Every side character carries
> their own memory across branches, so the universe grows without ever breaking."

### Slide 7 — Feature 2: Self-proving consistency (THE WOW — 40s, slow down)
> "And here's the part we're proud of.
> Every regeneration is graded by AI judges — continuity, character fidelity, reader intent —
> each with the **exact quoted evidence**, not a vague 'looks good.'
> And if it catches a contradiction, it **repairs itself, live** —
> *(point at screen)* '⚠ caught a continuity break → repairing → resolved, 3.1 to 4.7.'
> Nothing inconsistent or unsafe auto-publishes — a human makes the final call.
> **Every team here will *claim* their AI is consistent. Ours proves it — and fixes itself when
> it's wrong.**" *(pause — let it land.)*

### Slide 8 — Feature 3: Cinematic audio (20s)
> "Third: it's audio, not text. Each branch is narrated in distinct multi-voice audio —
> narrator and characters, each with a consistent voice — with a music bed and a beat of
> silence before the moment that matters. This isn't a rebuild of Pocket FM; it's a
> personalization layer on the thing they already do best."

### Slide 9 — Feature 4: Co-Author + community (20s)
> "Fourth: it's collaborative. Readers steer the story with comments and ratings — those become
> the input for the next branch. Co-authors write with an AI editor in a VS-Code-style studio,
> but a human approves every line — nothing saves until they sign off. And the original author
> verifies which branches become canon. The crowd builds it; the AI keeps it coherent."

### Slide 10 — LIVE DEMO (2–3 min)
> "Enough talking — let's rewrite a fate."
**Demo beats (say each as you click):**
1. Open the series — "here's The Hollow Crown, four canonical episodes."
2. Open episode 3 — "it ends on a decision: the hero spares the villain. And a reader asked:
   *what if she killed him instead?*"
3. Click **Rewind** → **Generate** — "watch it gather the canon, then write the new future, live."
4. **The wow:** when the eval flags a break — "see that? It caught its *own* contradiction and is
   repairing it. Now watch the score climb." *(let it resolve.)*
5. Split-view — "original on the left, the new timeline on the right — and notice this line: it
   carried the exact debt from episode two. That's the consistency, made visible."
6. Play the **audio** of the branch — "and here it is as an audio drama."
7. (If time) Author hits **Verify** → "the author canonizes it; the ranking reshuffles."
> *Backup:* if anything lags, "let me show the recorded run" — play the video, keep talking.

### Slide 11 — Architecture (20s)
> "It's entirely Databricks-native: Apps host it, Lakebase is the single store for episodes and
> character memory, Foundation Model APIs power the tool-calling co-author, MLflow runs the
> consistency judges, and multi-voice TTS renders the audio. One honest, integrated stack."

### Slide 12 — Differentiation (20s)
> "To be clear why this is different: most teams do one prompt, one story, generic voice, a
> one-shot demo. NEXUS is a universe of consistent timelines that **proves and repairs** its own
> consistency, in cinematic audio — a platform Pocket FM could actually ship."

### Slide 13 — Impact (20s)
> "For Pocket FM the impact is direct: infinite timelines from one story means more catalogue
> with no extra writers' rooms; 'my story' beats 'a story,' so people finish what feels made for
> them; and it's a genuinely new, AI-native audio format — on brand."

### Slide 14 — Roadmap (15s)
> "Today you saw the core: rewind, consistent regeneration, self-correcting evals, and audio.
> Next we scale the memory for deep lineage, then integrate as a layer over Pocket FM's catalogue,
> toward the vision — where every side character can become the hero of their own timeline."

### Slide 15 — Closing (15s)
> "NEXUS — every story has infinite endings, and we keep them true.
> Other teams' AI *claims* to be consistent. Ours **proves it, and fixes itself when it's wrong.**
> Thank you." *(smile, invite questions.)*

---

## Delivery checklist
- **Rehearse the opener (Slides 1–4) until it's muscle memory.** First 60s decides attention.
- **Slow down on Slide 7 and the demo wow** — that's the memory you're planting.
- **Never click a broken button.** Demo only what works; say "here's how it works" for the rest.
- **Pre-warm** the app + endpoints; keep the **backup video** one click away.
- If asked *"how is this different from ChatGPT writing a story?"* →
  "ChatGPT writes *a* story and forgets it. NEXUS maintains a whole universe's canon across every
  branch, **measures** its own consistency, and **repairs** itself — that memory + self-correction
  is the hard part, and it's what we built."
- If asked about completion → "We built the hard part first — the consistency engine and the
  co-author loop. What you saw is live; the remaining polish is scoped, and here's exactly how it
  works." *(Confidence, not apology.)*
```

## Files
- Deck: `pitch/nexus_pitch.pptx` (regenerate with `python3 pitch/generate_ppt.py`)
- This script: `pitch/script.md`
```
