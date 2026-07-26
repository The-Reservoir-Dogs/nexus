"""Thin Gemini TTS client (REST, stdlib only).

- scriptify(): prose -> speaker-tagged script (gemini text model)
- synth():     one line/turn -> PCM audio (gemini TTS model)
- write_wav(): wrap concatenated PCM (L16/24kHz/mono) into a playable .wav

Key resolution mirrors the agent: GEMINI_API_KEY env (local) or the Databricks
secret scope nexus/gemini_api_key at runtime. Never in git/CI.
"""
import base64
import json
import os
import urllib.request
import wave

GENAI = "https://generativelanguage.googleapis.com/v1beta/models"
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-2.5-flash-preview-tts")
TEXT_MODEL = os.environ.get("TTS_TEXT_MODEL", "gemini-2.5-flash")
RATE = 24000
_cache: dict[str, str] = {}


def _key() -> str:
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        return k
    if _cache.get("k"):
        return _cache["k"]
    from databricks.sdk import WorkspaceClient

    raw = WorkspaceClient().secrets.get_secret(
        scope=os.environ.get("SECRET_SCOPE", "nexus"), key="gemini_api_key"
    ).value
    _cache["k"] = base64.b64decode(raw).decode()
    return _cache["k"]


def _post(model: str, body: dict) -> dict:
    url = f"{GENAI}/{model}:generateContent?key={_key()}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def scriptify(text: str, names: list[str]) -> str:
    """Prose episode -> lines tagged [NARRATOR] / [CHARACTER]. Text kept verbatim."""
    names_s = ", ".join(names) if names else "(none)"
    prompt = (
        "Convert this episode into a cinematic TTS script. Tag EVERY line with a speaker in square "
        "brackets at the start of the line. Narration and description -> [NARRATOR]. Spoken "
        f"dialogue -> [CHARACTER_NAME] using ONLY these known names: {names_s}. Keep the story text "
        "verbatim; do NOT rewrite, summarize, or add plot. You may split long paragraphs into shorter "
        "speaker turns at natural sentence boundaries so the voice can breathe. Preserve punctuation "
        "because commas, em dashes, ellipses, and paragraph breaks create emotional pauses. Output only "
        "the tagged script.\n\n"
        f"EPISODE:\n{text}"
    )
    d = _post(TEXT_MODEL, {"contents": [{"parts": [{"text": prompt}]}]})
    return d["candidates"][0]["content"]["parts"][0]["text"]


def synth(text: str, voice: str = "Charon", style: str | None = None) -> bytes:
    """One turn -> raw PCM bytes (L16 mono 24kHz). `style` steers delivery in plain English."""
    delivery = (
        "Perform with natural emotion, cinematic pacing, and human pauses. "
        "Slow slightly for suspense, soften for grief, sharpen for danger, and leave tiny silences "
        "around commas, em dashes, ellipses, and scene turns."
    )
    prompt = f"Say {style}. {delivery}: {text}" if style else f"{delivery}: {text}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
            },
        },
    }
    d = _post(TTS_MODEL, body)
    data = d["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    return base64.b64decode(data)


def silence(ms: int) -> bytes:
    return b"\x00\x00" * int(RATE * ms / 1000)


def write_wav(pcm: bytes, path: str) -> int:
    """Write PCM to a .wav; return duration in ms."""
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return int(len(pcm) / 2 / RATE * 1000)
