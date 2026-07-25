# NEXUS — plan_v2 (Brainstorm + TTS Reference)

> Separate working doc. Does **not** replace `PRODUCT.md` / `TECH_DESIGN.md` / `DATABRICKS_ARCHITECTURE.md`.
> Captures (1) the alternate "Dream → Personalized Villain" brainstorm we explored, and
> (2) a full free-TTS implementation reference for the audio-drama layer.

---

## PART A — Alternate Pitch Brainstorm (kept for reference / roadmap)

We locked NEXUS (story multiverse) as the main build. This section preserves the
*other* strong angle we discussed with 30+ yrs experience input, in case we want it as a
Tier-3 wow feature or a v2 roadmap slide.

### A.1 The alternate concept
**Dream to Story + Personalized Villains** — a listener describes a real fear, dream, or
memory. AI builds a short cinematic **audio drama** with an antagonist **psychologically
tuned to that exact fear**. Next listener → different fear → completely different villain.

**Why it's strong:**
- Real-time personalization from the *judge's own input* (not a pre-baked video).
- Emotionally sticky — "wait, how did it know that" is the wow reaction.
- Plays directly to Pocket FM's audio-drama DNA.

### A.2 Persona — "The Sleepless Scroller"
| Field | Detail |
|---|---|
| Who | 24, metro city, doom-scrolls before bed, listens to audio dramas / true crime to fall asleep |
| Need | Content that feels *made for her* — but zero patience for a 10-question onboarding form |
| Trigger | Half-awake, mumbles a dream / worry into the app instead of typing |
| Payoff | 3–5 min personalized audio drama where the villain is shaped by what scares her → "how did it know that" |

### A.3 The "damn" delivery twist (stretch idea)
Every other team's demo ends with audio playing **on a screen**. The twist: the story
**leaves the screen** — e.g., the app "calls" the user (real phone call via Twilio, or an
in-app full-screen incoming-call UI) and the villain speaks their exact fear back. Optional,
high-risk, high-reward. **Not required.** Kept here only as a roadmap wow.

### A.4 Demo flow (if ever built)
1. **Hook (30s)** — ask a judge: "Tell me a dream or a worry." Type/speak it live.
2. **Generation (60–90s)** — visible "thinking / summoning" animation (silence feels broken).
3. **Reveal (30s)** — play audio; villain's motivation echoes the judge's exact words.
4. **Second run (30s)** — different input, prove it's not hardcoded (keep a backup output).
5. **Zoom out (30s)** — one slide: "imagine this at Pocket FM scale."

### A.5 3-stage prompt chain (tested, reusable)
Each stage feeds the next — that's what makes the villain feel *connected*, not bolted on.

**Stage 1 — Fear / Emotion Extraction**
```
System: You are a psychological story analyst. Given a user's description of a dream or
memory, extract:
1. The core emotion (fear, loss, guilt, helplessness, etc.)
2. The specific trigger/object within their description (extract a LITERAL concrete detail,
   e.g. "the phone", "the photos" — this exact detail is the wow callback)
3. An underlying anxiety this might represent (be tasteful, not clinical)
Output as JSON: {emotion, trigger, underlying_anxiety}
User input: "{user_input}"
```

**Stage 2 — Villain Generation (with tone control)**
```
System: You are a character designer for audio dramas. Using the extracted emotional
profile, create an antagonist whose methods and motivation directly exploit this specific
fear — not a generic villain, one custom-built for this exact anxiety.
Generate in the specified tone:
- "psychological": quiet, philosophical; unsettles through truth and implication.
- "visceral": immediate, physical, high-stakes; menace through action/pursuit.
- "eerie-whimsical": unsettling through wrongness — childlike logic, uncanny cheerfulness.
Output: {villain_name, appearance_essence, core_tactic, one_signature_line_of_dialogue, tone_used}
Emotional profile: {stage_1_output}
Tone: {tone_parameter}
```

**Tone auto-classifier (between Stage 1 and 2)**
```
System: Based on this emotional profile, pick the tone for the most compelling villain.
Output only one word: "psychological", "visceral", or "eerie-whimsical".
- Existential/identity fears -> psychological
- Physical danger, chase, entrapment fears -> visceral
- Confusion, uncanny, childhood, dream-logic fears -> eerie-whimsical
Emotional profile: {stage_1_output}
```

**Stage 3 — Story / Script Generation**
```
System: Write a 60–90 second audio drama script (narration + 1–2 lines of dialogue) that
places the listener's dream/memory into a short story featuring this villain. End on a
cliffhanger, not a resolution — this is a hook, not a full episode.
Format for TTS: [NARRATOR], [VILLAIN] tags for voice switching.
Original input: {user_input}
Emotional profile: {stage_1_output}
Villain: {stage_2_output}
```

### A.6 Sample runs (sanity-checked — villains stay distinct)
| Input | Emotion | Villain | Signature line |
|---|---|---|---|
| "Lost my phone with all my photos, couldn't remember faces" | grief/loss | **The Archivist** — erases originals, forces dependence on her fragments | "You didn't lose them. You just never really remembered them yourself." |
| "Keep forgetting names at work meetings" | shame/inadequacy | **The Mirror Clerk** — shows you as others secretly see you | "They don't think you're forgetful. They think you never cared to remember." |
| "Childhood home, all doors led to unfamiliar rooms" | disorientation/nostalgia | **The Renovator** — rebuilds memories room by room | "I didn't change your home. I just finished what your memory started." |

**Risk flagged:** all three lean "quiet existential dread." Use the tone parameter to force
range (add one clearly *visceral* input, e.g. "chased down a hallway that kept getting longer").

### A.7 Deck skeleton (6–8 slides, judges skim)
| Slide | Content |
|---|---|
| 1. Hook | "What if the villain in your story was afraid of the same things you are?" |
| 2. Persona | The Sleepless Scroller |
| 3. Problem | Personalization stops at recommendations, never touches the story itself |
| 4. Solution | Dream/fear input → personalized audio drama with adaptive villain |
| 5. LIVE DEMO | Blank/branded holding slide — let the demo breathe |
| 6. How it works | input → emotion extraction → villain+story gen → TTS |
| 7. Why Pocket FM | Personalization *layer* on existing audio-drama catalog, not a rebuild |
| 8. What's next | Story Genome (v2) → Infinite Story Universe (v3) |

**Key safety note (matters for OpenAI/responsible-AI judges):** frame as *catharsis* not
exploitation — the villain is faced/understood, not just weaponizes trauma. Add a Stage-1
safety check: if input signals real trauma/self-harm, soften tone, never "visceral."

---

## PART B — TTS Implementation Reference (FREE)

The audio-drama / episode-to-audio layer. In NEXUS this is **optional / good-to-have**
(one pre-rendered clip behind a 🔊 button for MVP). This is the full toolkit when we build it.
**Constraint reminder:** Databricks has **no native TTS**, and Free-Edition Apps have
**restricted outbound internet** — run TTS from a Databricks job or a whitelisted domain.

### B.1 What we need
1. **Multiple distinct voices** (narrator, villain, hero) — so it's a *drama*, not one robot.
   Maps to `characters.speech_style` + `character_state` in the schema.
2. **Emotion / tone** (scared, menacing).
3. **Free.**

Two ways to run: **API (cloud, needs key, no GPU)** or **local open-source model (no key, needs compute)**.

### B.2 Free options — full comparison
| Tool | Free? | API key? | Multi-voice | Emotion | Quality | Setup |
|---|---|---|---|---|---|---|
| **edge-tts** | 100% free forever | none | 300+ voices | some (rate/pitch) | High | `pip install` — easiest |
| **Gemini TTS** | free tier | free key | multi-speaker in 1 call | prompt-controlled | High | AI Studio key |
| **Kokoro-82M** | free forever | none | ~50 voices | limited | High | local / Colab |
| **ElevenLabs** | 10k chars/mo | free key | yes | best | Best | signup |
| **Chatterbox** (Resemble) | free open-src | none | clone | emotion dial | High | needs GPU |
| **Piper** | free | none | yes | no | Medium | local |
| gTTS | free | none | one voice | no | Low/flat | easy (avoid) |

### B.3 Recommendation
- **edge-tts** = backbone (no key, never breaks, has Indian voices → Pocket FM / Bharat fit).
- **Gemini TTS** (free key) = multi-speaker in one call + emotion via plain English.
- **Kokoro** = offline backup (no internet dependency on stage).
- **ElevenLabs free tier** = pre-render 2–3 golden demo clips at max drama quality.
- **pydub** = stitch voices + free music bed (Pixabay/Freesound) → *cinematic*. This mixing
  step is what makes it "damn," not the raw TTS engine.
- **Total cost: ₹0.**

### B.4 Links (all real, all free)
| Tool | Link | Key |
|---|---|---|
| edge-tts | github.com/rany2/edge-tts | none — `pip install edge-tts` |
| Gemini TTS | aistudio.google.com | Google login → "Get API key" → free |
| Kokoro | huggingface.co/hexgrad/Kokoro-82M | none — `pip install kokoro` |
| ElevenLabs | elevenlabs.io | signup → Profile → API key (free tier) |
| Chatterbox | github.com/resemble-ai/chatterbox | none (local) |
| Piper | github.com/rhasspy/piper | none (local) |
| Hugging Face (host) | huggingface.co/settings/tokens | free token |

### B.5 How to get keys
**Gemini (free, recommended):** aistudio.google.com → sign in → "Get API key" → "Create API key" → copy.
**edge-tts:** no key. `pip install edge-tts`.
**ElevenLabs:** elevenlabs.io → sign up → profile → API Keys → copy (10k chars/month free).

### B.6 Per-character voice map (persona voices)
A fixed voice per character = consistency. Sourced from `characters.speech_style`.

edge-tts voices (Indian included for Pocket FM):
- Indian English: `en-IN-NeerjaNeural` (F), `en-IN-PrabhatNeural` (M)
- Tamil: `ta-IN-PallaviNeural`, `ta-IN-ValluvarNeural`
- Hindi: `hi-IN-SwaraNeural`, `hi-IN-MadhurNeural`
- Deep/dramatic English: `en-US-GuyNeural`, `en-GB-RyanNeural`
- List all: `edge-tts --list-voices`

### B.7 edge-tts multi-voice code
```python
import edge_tts, asyncio

VOICES = {
    "NARRATOR": ("en-IN-NeerjaNeural", "+0%",  "+0Hz"),
    "VILLAIN":  ("en-US-GuyNeural",    "-10%", "-40Hz"),  # slow + deep = scary
    "HERO":     ("en-IN-PrabhatNeural","+0%",  "+0Hz"),
}

async def speak(character, text, out):
    voice, rate, pitch = VOICES[character]
    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(out)

# script from the LLM tagged [VILLAIN], [NARRATOR]...
asyncio.run(speak("VILLAIN", "You never really remembered them.", "v1.mp3"))
asyncio.run(speak("NARRATOR", "The room fell silent.", "n1.mp3"))
```

### B.8 Cinematic mixing (pydub) — the part that wins
```python
from pydub import AudioSegment

narr    = AudioSegment.from_mp3("narrator.mp3")
villain = AudioSegment.from_mp3("villain.mp3")
music   = AudioSegment.from_mp3("ambient_dark.mp3") - 18   # royalty-free bed, quieter

drama = narr + AudioSegment.silent(800) + villain          # dramatic pause before villain
final = music.overlay(drama)                               # music under whole thing
final.export("episode.mp3", format="mp3")
```
- Free ambient/SFX loops: Pixabay, Freesound (royalty-free).
- Add 1 SFX (heartbeat/static) at villain entrance + a pause + music sting before the
  signature line. ~20% effort = ~80% of the "cinematic" feeling.

### B.9 Gemini TTS multi-speaker (2 voices in one call + emotion)
```python
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_FREE_KEY")
resp = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents="""Read as a tense audio drama.
NARRATOR: The lights flickered.
VILLAIN: You didn't lose your photos... you never remembered them.""",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(speaker="NARRATOR",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore"))),
                    types.SpeakerVoiceConfig(speaker="VILLAIN",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Charon"))),
                ]))))
# resp -> raw PCM audio -> save as wav
```
Gemini has ~30 prebuilt voices (Kore, Puck, Charon, Fenrir...). Steer emotion by writing it:
"Read in a menacing whisper."

### B.10 Full pipeline (episode → audio)
```
episode content (or Stage-3 script, tagged [NARRATOR]/[VILLAIN]/[HERO])
  → split by tag
  → edge-tts (or Gemini) per segment, voice from characters.speech_style
  → pydub: stitch + music bed + SFX → episode.mp3
  → store in object storage → path in Lakebase episodes.audio_url
  → player streams  (or Twilio <Play> if the phone-call twist is built)
```
On Databricks Free Edition: run this as a **job** (outbound-internet restriction on Apps).

### B.11 Build order (when we do audio)
1. `pip install edge-tts pydub`; get one villain line speaking.
2. Add voice map (narrator/villain/hero from `characters.speech_style`).
3. Stitch + music bed with pydub.
4. Try Gemini for better villain emotion.
5. Pre-render 2–3 backup clips (golden demo).

---

## Decision Log
- **Main build = NEXUS multiverse** (Story Time Machine + AI Co-Author + persistent memory), on Databricks.
- **Dream→Villain (Part A)** = roadmap / stretch wow only. Not MVP.
- **TTS (Part B)** = optional layer; MVP ships one pre-rendered clip behind a 🔊 button.
- **Ask organizers for OpenAI API credits** (partner hackathon) — unlocks GPT + tts-1 free.
