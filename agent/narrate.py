"""Narration rendering for the agent service.

The web app is Node-only in production, so TTS (python + Gemini) runs HERE, in the
agent app. We synthesize the episode to a single in-memory .wav and hand the bytes
back to the web backend, which owns persistence (UC Volume / local) and the DB write.

Reuses the existing tts/ pipeline (scriptify -> per-turn synth -> concat) via render.py.
"""
import io
import os
import sys
import wave

# Make the sibling tts/ package importable (it in turn adds ../agent for `tools`).
_TTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tts")
if _TTS_DIR not in sys.path:
    sys.path.insert(0, _TTS_DIR)

import render  # noqa: E402  (tts/render.py: parse_script + tts/voices helpers)

tts = render.tts
voices = render.voices
import tools  # noqa: E402  (agent read-only DB tools)


def render_episode(episode_id: str, limit: int = 0) -> tuple[bytes, int]:
    """Render one episode to multi-voice narration.

    Returns (wav_bytes, duration_ms). Raises ValueError if the episode is missing.
    """
    ep = tools.get_episode(episode_id)
    if not ep:
        raise ValueError(f"episode {episode_id} not found")
    chars = tools.get_characters(ep["series_id"])
    names = [c["name"] for c in chars]

    text = (ep.get("content") or "").strip()
    if not text:
        raise ValueError(f"episode {episode_id} has no content to narrate")
    # Drop a leading 'TITLE: ...' line so it isn't narrated.
    lines = text.splitlines()
    if lines and lines[0].strip().upper().startswith("TITLE:"):
        text = "\n".join(lines[1:]).strip()

    script = tts.scriptify(text, names)
    segs = render.parse_script(script)
    if limit:
        segs = segs[:limit]

    vmap = voices.build_map(chars)
    pcm = b""
    for spk, line in segs:
        voice, style = voices.resolve(spk, vmap)
        try:
            pcm += tts.synth(line, voice=voice, style=style) + tts.silence(350)
        except Exception as e:  # noqa: BLE001 — skip a failed turn, keep the rest
            print(f"synth failed for [{spk}]: {e}", file=sys.stderr)

    if not pcm:
        raise RuntimeError("no audio produced (check GEMINI_API_KEY / TTS access)")

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(tts.RATE)
        w.writeframes(pcm)
    duration_ms = int(len(pcm) / 2 / tts.RATE * 1000)
    return buf.getvalue(), duration_ms
