"""Render an episode to cinematic multi-voice audio via Gemini TTS.

Runnable locally or as a Databricks Job. Pulls the episode + characters from Lakebase
(reusing the agent's read-only tools), scriptifies the prose into speaker turns, synthesizes
each turn with that character's persona voice, concatenates to a single .wav.

Usage:
  python tts/render.py --episode-id 1003 --outdir output [--limit 12]
  python tts/render.py --text-file scene.txt --outdir output
"""
import argparse
import os
import re
import sys

# reuse the agent's DB tools (read-only)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "agent"))
import tools  # noqa: E402

import gemini_tts as tts  # noqa: E402
import voices  # noqa: E402

_TAG = re.compile(r"^\s*\[([^\]]+)\]\s*(.*)$")


def parse_script(script: str) -> list[tuple[str, str]]:
    """Tagged script -> ordered [(speaker, text)] turns."""
    segs: list[tuple[str, str]] = []
    spk, buf = "NARRATOR", []
    for line in script.splitlines():
        m = _TAG.match(line)
        if m:
            if buf:
                segs.append((spk, " ".join(buf)))
                buf = []
            spk = m.group(1).strip().upper()
            if m.group(2).strip():
                buf.append(m.group(2).strip())
        elif line.strip():
            buf.append(line.strip())
    if buf:
        segs.append((spk, " ".join(buf)))
    return segs


def render(text: str, names: list[str], characters: list[dict], outdir: str,
           tag: str, limit: int = 0) -> tuple[str, int]:
    os.makedirs(outdir, exist_ok=True)
    vmap = voices.build_map(characters)

    # drop a leading 'TITLE: ...' line so it isn't narrated
    lines = text.lstrip().splitlines()
    if lines and lines[0].strip().upper().startswith("TITLE:"):
        text = "\n".join(lines[1:]).strip()

    print("scriptify ...")
    script = tts.scriptify(text, names)
    with open(os.path.join(outdir, f"{tag}_script.txt"), "w") as f:
        f.write(script)
    segs = parse_script(script)
    if limit:
        segs = segs[:limit]
    print(f"{len(segs)} segment(s)")

    pcm = b""
    for i, (spk, line) in enumerate(segs, 1):
        voice, style = voices.resolve(spk, vmap)
        print(f"  {i:>2}. [{spk}] {voice}: {line[:60]}...")
        try:
            pcm += tts.synth(line, voice=voice, style=style) + tts.silence(350)
        except Exception as e:  # noqa: BLE001
            print(f"      synth failed: {e}")
    out = os.path.join(outdir, f"{tag}.wav")
    dur = tts.write_wav(pcm, out)
    print(f"wrote {out}  ({dur/1000:.1f}s, {len(pcm)} PCM bytes)")
    return out, dur


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--episode-id")
    ap.add_argument("--text-file")
    ap.add_argument("--outdir", default="output")
    ap.add_argument("--limit", type=int, default=0, help="cap segments (0 = all) for quick tests")
    a = ap.parse_args()

    if a.episode_id:
        ep = tools.get_episode(a.episode_id)
        if not ep:
            print(f"episode {a.episode_id} not found")
            return 1
        chars = tools.get_characters(ep["series_id"])
        names = [c["name"] for c in chars]
        print(f"Episode: {ep['title']}  ({len(ep['content'])} chars, {len(chars)} characters)")
        render(ep["content"], names, chars, a.outdir, f"ep{a.episode_id}", a.limit)
    elif a.text_file:
        text = open(a.text_file).read()
        render(text, [], [], a.outdir, os.path.splitext(os.path.basename(a.text_file))[0], a.limit)
    else:
        print("provide --episode-id or --text-file")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
