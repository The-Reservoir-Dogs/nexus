# NEXUS — TTS Plan (Gemini)

Turn an approved episode into **cinematic multi-voice audio** with a distinct voice per
character. Based on `plan_v2.md` Part B, narrowed to **Gemini TTS** (your paid key).

**Verified on this workspace's key:** `gemini-2.5-flash-preview-tts` and
`gemini-2.5-pro-preview-tts` both return audio (`audio/L16; pcm; rate=24000`, mono). Use flash
(faster/cheaper), pro for the golden demo clip.

---

## Hard constraints (from plan_v2 + our architecture)
1. **Databricks has no native TTS** → external Gemini call (the one allowed external dep).
2. **Free-Edition Apps have restricted outbound internet** → the web App process may not reach
   Google. So the render runs in a **Databricks Job** (jobs have outbound), not in the App.
   The web backend **triggers the job**; it does not call Gemini directly.
3. **Gemini multi-speaker caps at 2 speakers per call** → for a scene with >2 voices, render
   each speaker turn as a **single-speaker** call and **stitch**.
4. **Key never in git/CI/app config** — fetched at runtime from the `nexus` secret scope
   (`gemini_api_key`), same pattern the agent already uses. Local dev uses `.env`.
5. **Agent stays read-only.** TTS is a separate render component; only the web backend writes
   `episodes.audio_url`.

---

## Voice personas (per character)
A fixed voice + style per character = consistency across timelines.

- **Source:** `characters.speech_style` / `personality`; narrator from `style_guide.narrative_voice`.
- **Gemini prebuilt voices** (~30): Kore, Charon, Puck, Fenrir, Zephyr, Orus, Leda, Aoede…
- **Emotion/tone** is steered by plain-English direction in the prompt ("read in a menacing whisper").

**Schema (proposed, additive):** add to `characters`
```
tts_voice VARCHAR(30)   -- e.g. 'Charon'
tts_style TEXT          -- e.g. 'cold, precise, dangerous calm'
```
Until applied, the render service keeps a **static voice map keyed by character name** +
a default narrator. (Voice map lives in `agent/`-independent render code.)

Example map:
```
Narrator      -> Charon | grave, cinematic storyteller; measured pace
Aldric (king) -> Orus   | commanding, weary authority
Lady Corvin   -> Kore   | cold, precise, dangerous calm
```

---

## Pipeline (episode → mp3)
```
approved episode text (plain prose)
  1. SCRIPTIFY   gemini-2.5-flash (text) -> tagged script:
                 [NARRATOR] ...  [ALDRIC] "..."  [CORVIN] "..."
                 (assign each dialogue line to a known character; rest = NARRATOR)
  2. SEGMENT     split by tag into ordered turns
  3. SYNTHESIZE  per turn -> Gemini TTS single-speaker with that persona's voice+style
                 (or group <=2 speakers into one multi-speaker call where adjacent)
                 -> PCM L16 24kHz
  4. ENCODE      PCM -> wav -> mp3 (pydub/ffmpeg)
  5. MIX (opt)   pydub: dramatic pause before villain line + quiet royalty-free music bed
  6. STORE       upload mp3 -> Databricks UC Volume  (demo: web/public/audio/)
  7. PERSIST     web backend sets episodes.audio_url + audio_duration_ms
                 (capture per-segment timing -> later feeds retention buckets)
```

**Scriptify prompt (step 1):**
```
Convert this episode into a TTS script. Tag every line with a speaker in brackets.
Narration and description -> [NARRATOR]. Dialogue -> [CHARACTER_NAME] using ONLY these
known characters: {names}. Keep the text verbatim; do not rewrite. Output only the tagged script.
```

**PCM → wav:** Gemini returns headerless L16/24kHz mono; wrap with a WAV header (or
`wave` module) before pydub. mp3 via ffmpeg.

---

## Where it runs
| Stage | Runs in | Why |
|---|---|---|
| Trigger | web backend `POST /api/episodes/:id/narrate` | user action; App can reach Databricks API |
| Render (steps 1–6) | **Databricks Job** (`tts/render.py`) | Job has outbound internet to Google |
| Persist audio_url | web backend (or job writes, web reads) | web owns writes |
| Serve audio | UC Volume URL / web static | player streams |

**MVP shortcut (per roadmap Phase 4):** pre-render **2–3 golden clips locally** into
`web/public/audio/`, set `audio_url` in seed. One 🔊 button that always works on stage.
Build the live job path second.

---

## Components to build
- `tts/render.py` — the render (scriptify → synth → encode → mix → store). Runnable locally
  and as a Databricks Job. Key via secret scope (reuse the agent's fetch pattern).
- `tts/voices.py` — persona voice map + defaults.
- `tts/gemini_tts.py` — thin Gemini TTS client (REST or `google-genai`), PCM→wav helper.
- web `POST /api/episodes/:id/narrate` — triggers the job (or, if App outbound is allowed,
  calls render directly), returns audio_url when ready.
- (later) `characters.tts_voice/tts_style` columns + seed values.

## Dependencies
`google-genai` (or plain REST via urllib), `pydub`, `ffmpeg`. No new Databricks-side infra
beyond a Job + a UC Volume for output.

## Build order
1. `tts/gemini_tts.py`: one line -> saved mp3 (single voice). Verify audio plays.
2. `tts/voices.py` + scriptify: full episode -> tagged script -> per-voice segments.
3. pydub stitch (+ optional music bed) -> one episode.mp3.
4. Pre-render 2–3 golden clips into `web/public/audio/`; wire the 🔊 button.
5. Wrap as a Databricks Job + `POST /narrate` trigger for the live path.

## Risks
- **App outbound block** — confirm early; if the App genuinely can't reach Google, the Job
  path is mandatory (keep the pre-rendered clips as the demo fallback either way).
- **2-speaker cap** — stitch single-speaker turns; don't rely on many-voice single calls.
- **Latency** — full-episode render is slow; pre-render for demo, async for live.
