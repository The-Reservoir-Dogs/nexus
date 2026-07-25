"""Per-character voice personas. A fixed voice per character = consistency across timelines.

Sourced from characters.speech_style until characters.tts_voice/tts_style columns exist.
Gemini prebuilt voices: Charon, Orus, Kore, Fenrir, Puck, Aoede, Leda, Zephyr, Enceladus...
"""

DEFAULT_NARRATOR = ("Charon", "in a grave, cinematic storyteller's voice, measured and ominous")

# Voices handed out to characters in order of appearance.
VOICE_POOL = ["Orus", "Kore", "Fenrir", "Puck", "Aoede", "Leda", "Zephyr", "Enceladus", "Iapetus"]


def _style_from(character: dict) -> str:
    style = character.get("tts_style") or character.get("speech_style") or "in character"
    return style if style.startswith("in ") or style.startswith("with ") else f"in a {style} manner"


def build_map(characters: list[dict]) -> dict[str, tuple[str, str]]:
    """Return {ALIAS -> (voice, style)} incl. NARRATOR. Aliases = full name + each word,
    so a script tag like [ALDRIC] or [KING ALDRIC] both resolve."""
    m: dict[str, tuple[str, str]] = {"NARRATOR": DEFAULT_NARRATOR}
    for i, c in enumerate(characters):
        voice = c.get("tts_voice") or VOICE_POOL[i % len(VOICE_POOL)]
        persona = (voice, _style_from(c))
        name = (c.get("name") or "").strip()
        if not name:
            continue
        m[name.upper()] = persona
        for word in name.upper().split():
            m.setdefault(word, persona)
    return m


def resolve(tag: str, vmap: dict[str, tuple[str, str]]) -> tuple[str, str]:
    """Map a script speaker tag to a persona; fall back to narrator."""
    key = tag.strip().upper()
    if key in vmap:
        return vmap[key]
    for word in key.split():
        if word in vmap:
            return vmap[word]
    return DEFAULT_NARRATOR
