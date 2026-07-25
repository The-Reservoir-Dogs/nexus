"""Integration smoke test for the DEPLOYED nexus-agent.

Hits the live Databricks App: /health, then /generate and /analyze (SSE), asserting
the agent streams real tool_call / token / done events end-to-end.

Stdlib only (no pip installs). Runs two ways:
  pytest:  pytest agent/test_integration.py      (auto-skips if AGENT_URL unset)
  script:  python agent/test_integration.py       (prints a report, exits non-zero on fail)

Config via env:
  AGENT_URL         default: deployed nexus-agent URL below
  DATABRICKS_TOKEN  bearer token for the App's OAuth front door (required for a real call)
  SMOKE_EPISODE_ID  seeded source episode (default 1003 — "The Spared Blade")
  SMOKE_REVIEW_ID   driving review (default 5001)
"""
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_URL = "https://nexus-agent-7474644774817152.aws.databricksapps.com"
AGENT_URL = os.environ.get("AGENT_URL", DEFAULT_URL).rstrip("/")
TOKEN = os.environ.get("DATABRICKS_TOKEN")
EPISODE_ID = os.environ.get("SMOKE_EPISODE_ID", "1003")
REVIEW_ID = os.environ.get("SMOKE_REVIEW_ID", "5001")
TIMEOUT = float(os.environ.get("SMOKE_TIMEOUT", "120"))


def _headers() -> dict:
    h = {"Content-Type": "application/json", "Accept": "text/event-stream"}
    if TOKEN:
        h["Authorization"] = f"Bearer {TOKEN}"
    return h


def get_health() -> dict:
    req = urllib.request.Request(f"{AGENT_URL}/health", headers=_headers())
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def stream_sse(path: str, payload: dict) -> list[dict]:
    """POST payload, parse the SSE response into a list of {'event','data'} dicts."""
    body = json.dumps(payload).encode()
    req = urllib.request.Request(f"{AGENT_URL}{path}", data=body, headers=_headers(), method="POST")
    events: list[dict] = []
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        event = None
        for raw in r:
            line = raw.decode("utf-8").rstrip("\n")
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    pass
                events.append({"event": event, "data": data})
            elif line == "":
                event = None
    return events


# --------------------------- assertions ---------------------------
def _assert_generate(events: list[dict]) -> None:
    kinds = {e["event"] for e in events}
    assert "error" not in kinds, f"agent returned error: {events[-1]['data']}"
    assert "tool_call" in kinds, "expected the agent to call at least one tool"
    assert "token" in kinds, "expected streamed prose tokens"
    done = [e for e in events if e["event"] == "done"]
    assert done, "expected a done event"
    draft = done[-1]["data"].get("draft", {})
    assert draft.get("content"), "done event carried no draft content"


def _assert_analyze(events: list[dict]) -> None:
    kinds = {e["event"] for e in events}
    assert "error" not in kinds, f"agent returned error: {events[-1]['data']}"
    assert "token" in kinds, "expected streamed analysis tokens"
    assert any(e["event"] == "done" for e in events), "expected a done event"


# --------------------------- pytest hooks ---------------------------
def _skip_if_unconfigured():
    try:
        import pytest
    except ImportError:
        return
    if not os.environ.get("AGENT_URL") and not TOKEN:
        pytest.skip("set AGENT_URL and DATABRICKS_TOKEN to run the deployed-agent smoke test")


def test_health():
    _skip_if_unconfigured()
    assert get_health().get("ok") is True


def test_generate_stream():
    _skip_if_unconfigured()
    events = stream_sse(
        "/generate",
        {
            "sourceEpisodeId": EPISODE_ID,
            "decisionPoint": "The knight spares the blade and kneels instead.",
            "drivingReviewId": REVIEW_ID,
        },
    )
    _assert_generate(events)


def test_analyze_stream():
    _skip_if_unconfigured()
    _assert_analyze(stream_sse("/analyze", {"episodeId": EPISODE_ID}))


# --------------------------- CLI runner ---------------------------
def _run(name, fn):
    try:
        fn()
        print(f"  PASS  {name}")
        return True
    except AssertionError as e:
        print(f"  FAIL  {name}: {e}")
    except urllib.error.HTTPError as e:
        print(f"  FAIL  {name}: HTTP {e.code} {e.reason} — {e.read()[:200]!r}")
    except Exception as e:
        print(f"  FAIL  {name}: {type(e).__name__}: {e}")
    return False


def main() -> int:
    print(f"Smoke-testing deployed agent: {AGENT_URL}")
    if not TOKEN:
        print("  WARN  DATABRICKS_TOKEN not set — the App OAuth front door will likely 401/redirect.")
    ok = True
    ok &= _run("health", lambda: (get_health().get("ok") is True) or (_ for _ in ()).throw(AssertionError("health not ok")))
    ok &= _run("generate SSE", lambda: _assert_generate(stream_sse("/generate", {
        "sourceEpisodeId": EPISODE_ID,
        "decisionPoint": "The knight spares the blade and kneels instead.",
        "drivingReviewId": REVIEW_ID,
    })))
    ok &= _run("analyze SSE", lambda: _assert_analyze(stream_sse("/analyze", {"episodeId": EPISODE_ID})))
    print("RESULT:", "OK" if ok else "FAILURES")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
