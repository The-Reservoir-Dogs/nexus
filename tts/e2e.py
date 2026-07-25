"""End-to-end: decision point -> agent writes the alternate episode -> TTS narrates it.

Exercises the full NEXUS pipeline in one run:
  1. agent.generate_stream  (tool-calling loop over Lakebase, streams reasoning+tools+prose)
  2. tts.render             (scriptify -> per-character voices -> stitched wav)

Writes artifacts to output/ for review:
  e2e_ep<sid>_draft.txt, e2e_ep<sid>_script.txt, e2e_ep<sid>.wav

Run inside agent/.venv with DB + LLM + SECRET_SCOPE env set (see repo start.sh).
  python tts/e2e.py --source-episode-id 1003 --review-id 5001
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "agent"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent  # noqa: E402
import tools  # noqa: E402
import render  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-episode-id", default="1003")
    ap.add_argument("--review-id", default="5001")
    ap.add_argument("--decision", default="Aldric refuses to lower his sword and strikes Lady Corvin down.")
    ap.add_argument("--outdir", default="output")
    ap.add_argument("--limit", type=int, default=0, help="cap TTS segments (0 = all)")
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    sid = a.source_episode_id

    # ---- Stage 1: agent writes the alternate episode ------------------------
    print("=" * 60)
    print("STAGE 1  —  AGENT SCRIPT WRITING (tool-calling, Gemini)")
    print("=" * 60)
    t0 = time.time()
    tool_calls, reasoning, draft = [], 0, []
    for ev in agent.generate_stream(
        sid, a.decision, driving_review_id=a.review_id,
        instructions="Write vivid, dramatic scenes with real spoken DIALOGUE between the "
        "characters (use quotation marks and attribute lines), not just narration.",
    ):
        t = ev["type"]
        if t == "tool_call":
            tool_calls.append((ev["name"], ev.get("args", {})))
            print(f"  tool_call   -> {ev['name']}({ev.get('args', {})})")
        elif t == "tool_result":
            print(f"  tool_result <- {ev['name']}: {ev.get('summary')}")
        elif t == "reasoning":
            reasoning += len(ev["delta"])
        elif t == "token":
            draft.append(ev["delta"])
        elif t == "error":
            print("  ERROR:", ev["message"])
            return 1
    draft_text = "".join(draft)
    gen_s = time.time() - t0
    print(f"\n  tools used: {len(tool_calls)}   reasoning chars: {reasoning}")
    print(f"  draft: {len(draft_text)} chars in {gen_s:.1f}s")
    draft_path = os.path.join(a.outdir, f"e2e_ep{sid}_draft.txt")
    with open(draft_path, "w") as f:
        f.write(draft_text)
    print(f"  saved {draft_path}")

    if len(draft_text) < 200:
        print("draft too short to narrate; aborting")
        return 1

    # ---- Stage 2: TTS narration --------------------------------------------
    print("\n" + "=" * 60)
    print("STAGE 2  —  TTS NARRATION (Gemini multi-voice)")
    print("=" * 60)
    ep = tools.get_episode(sid)
    chars = tools.get_characters(ep["series_id"])
    names = [c["name"] for c in chars]
    print(f"  cast: {names}")
    t1 = time.time()
    wav, dur = render.render(draft_text, names, chars, a.outdir, f"e2e_ep{sid}", limit=a.limit)
    tts_s = time.time() - t1

    # ---- Report -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("E2E RESULT")
    print("=" * 60)
    print(f"  generation: {gen_s:5.1f}s, {len(tool_calls)} tool calls, {len(draft_text)} chars")
    print(f"  narration : {tts_s:5.1f}s, {dur/1000:.1f}s audio")
    print(f"  artifacts : {draft_path}")
    print(f"              {os.path.join(a.outdir, f'e2e_ep{sid}_script.txt')}")
    print(f"              {wav}")
    ok = os.path.exists(wav) and dur > 3000 and len(tool_calls) >= 1
    print("  STATUS    :", "PASS" if ok else "CHECK")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
