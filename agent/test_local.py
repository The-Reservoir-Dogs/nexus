"""LOCAL integration test for nexus-agent (no deploy, no OAuth).

Runs the agent in-process against the real seeded Lakebase and the Databricks LLM.
Three layers, cheapest first:
  1. tools -> Lakebase        (no LLM tokens; fast sanity)
  2. agent.generate_stream    (full tool-calling loop + streamed prose)
  3. FastAPI /generate SSE     (in-process via TestClient — exercises main.py too)

Run:
  # provide DB + LLM creds (start.sh exports these); then:
  pytest agent/test_local.py -v         # auto-skips layers whose creds are missing
  python agent/test_local.py            # CLI report

Required env:
  DB:  PGHOST, PGUSER, PGDATABASE, and PGPASSWORD  (or DATABRICKS_HOST+TOKEN to mint one)
  LLM: DATABRICKS_HOST, DATABRICKS_TOKEN, LLM_ENDPOINT (default databricks-claude-sonnet-5)
  SMOKE_EPISODE_ID (default 1003), SMOKE_REVIEW_ID (default 5001)
"""
import os
import sys

EPISODE_ID = os.environ.get("SMOKE_EPISODE_ID", "1003")
REVIEW_ID = os.environ.get("SMOKE_REVIEW_ID", "5001")

_HAS_DB = bool(os.environ.get("PGHOST") and os.environ.get("PGUSER"))
_HAS_LLM = bool(os.environ.get("DATABRICKS_HOST") and os.environ.get("DATABRICKS_TOKEN"))


def _need(cond, why):
    """Skip under pytest, or signal 'skip' to the CLI runner."""
    if cond:
        return
    try:
        import pytest
        pytest.skip(why)
    except ImportError:
        raise _Skip(why)


class _Skip(Exception):
    pass


# ------------------------- Layer 1: tools -> Lakebase -------------------------
def test_tools_reach_lakebase():
    _need(_HAS_DB, "set PGHOST/PGUSER (+ PGPASSWORD) to test Lakebase tools")
    import tools

    ep = tools.get_episode(EPISODE_ID)
    assert ep and ep["title"], "get_episode returned nothing"
    assert ep.get("decision_point"), "source episode should have a decision_point"

    chars = tools.get_characters(ep["series_id"])
    assert len(chars) > 0, "expected seeded characters"

    # style guide + threads should exist for the seeded series
    assert tools.get_style_guide(ep["series_id"]), "expected a style guide"
    # retention view may be empty until playback events are seeded — just must not error
    assert isinstance(tools.get_retention(EPISODE_ID), list)


# ------------------------- Layer 2: agent tool-calling loop -------------------
def test_generate_stream_local():
    _need(_HAS_DB and _HAS_LLM, "set DB + DATABRICKS_HOST/TOKEN to test the LLM loop")
    import agent

    events = list(
        agent.generate_stream(
            EPISODE_ID,
            "The knight spares the blade and kneels instead.",
            driving_review_id=REVIEW_ID,
        )
    )
    kinds = [e["type"] for e in events]
    assert "error" not in kinds, f"agent errored: {events[-1]}"
    assert "tool_call" in kinds, "agent should call at least one tool"
    assert "token" in kinds, "agent should stream prose tokens"
    assert kinds[-1] == "done", "stream should end with done"
    prose = "".join(e["delta"] for e in events if e["type"] == "token")
    assert len(prose) > 200, "expected a substantial episode draft"


# ------------------------- Layer 3: FastAPI /generate SSE ---------------------
def test_generate_endpoint_sse():
    _need(_HAS_DB and _HAS_LLM, "set DB + LLM creds to test the /generate endpoint")
    try:
        from fastapi.testclient import TestClient
    except ImportError:
        _need(False, "install fastapi[all]/httpx to test the endpoint in-process")
    import main

    client = TestClient(main.app)
    assert client.get("/health").json() == {"ok": True}

    body = {
        "sourceEpisodeId": EPISODE_ID,
        "decisionPoint": "The knight spares the blade and kneels instead.",
        "drivingReviewId": REVIEW_ID,
    }
    with client.stream("POST", "/generate", json=body) as r:
        assert r.status_code == 200
        seen = set()
        for line in r.iter_lines():
            if line.startswith("event:"):
                seen.add(line.split(":", 1)[1].strip())
    assert "error" not in seen, "endpoint streamed an error"
    assert {"tool_call", "token", "done"} <= seen, f"missing SSE events, got {seen}"


# ------------------------------ CLI runner -----------------------------------
def _run(name, fn):
    try:
        fn()
        print(f"  PASS  {name}")
        return True
    except _Skip as e:
        print(f"  SKIP  {name}: {e}")
        return True
    except AssertionError as e:
        print(f"  FAIL  {name}: {e}")
    except Exception as e:
        print(f"  FAIL  {name}: {type(e).__name__}: {e}")
    return False


def main_cli() -> int:
    print("Local agent integration test")
    print(f"  DB creds:  {'yes' if _HAS_DB else 'NO'}   LLM creds: {'yes' if _HAS_LLM else 'NO'}")
    ok = True
    ok &= _run("tools -> Lakebase", test_tools_reach_lakebase)
    ok &= _run("agent.generate_stream loop", test_generate_stream_local)
    ok &= _run("/generate SSE endpoint", test_generate_endpoint_sse)
    print("RESULT:", "OK" if ok else "FAILURES")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main_cli())
