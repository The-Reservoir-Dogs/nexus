"""Run NEXUS generation evals with MLflow GenAI (Databricks LLM judges).

Wraps each streaming generation entrypoint into a plain predict_fn (consume the SSE-style
event stream, return the final text), then scores it with domain judges + code checks.

Surfaces: regen | edit | analyze | chat | all

Run (needs DB + LLM creds, same as test_local.py; start.sh exports them):
  cd agent
  .venv/bin/python -m evals.run_evals all
  .venv/bin/python -m evals.run_evals regen        # one surface

Config:
  MLFLOW_EXPERIMENT   experiment name (default /Shared/nexus-evals or ./mlruns locally)
  JUDGE_MODEL         override judge model, e.g. endpoints:/databricks-claude-sonnet-5
"""
import os
import sys

# allow both `python -m evals.run_evals` and `python evals/run_evals.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_HAS_DB = bool(os.environ.get("PGHOST") and os.environ.get("PGUSER"))
_HAS_LLM = bool(os.environ.get("DATABRICKS_HOST") and os.environ.get("DATABRICKS_TOKEN"))


# --------------------------- stream -> text adapters -------------------------
def _collect_tokens(events) -> str:
    return "".join(e["delta"] for e in events if e.get("type") == "token")


def regen_predict(source_episode_id, decision_point, driving_review_id=None, instructions=None) -> str:
    import agent
    return _collect_tokens(
        agent.generate_stream(source_episode_id, decision_point, driving_review_id, instructions)
    )


def edit_predict(episode_id, instruction, manuscript=None) -> str:
    import agent
    import tools
    if manuscript is None:
        ep = tools.get_episode(episode_id) or {}
        manuscript = ep.get("content") or ""
    return _collect_tokens(agent.edit_stream(episode_id, manuscript, instruction))


def analyze_predict(episode_id) -> str:
    import agent
    return _collect_tokens(agent.analyze_stream(episode_id))


def chat_predict(episode_id, message, history=None) -> str:
    import agent
    return _collect_tokens(agent.chat_stream(episode_id, message, history or []))


# ------------------------------- eval driver ---------------------------------
def _judge_model():
    return os.environ.get("JUDGE_MODEL")  # None -> MLflow default Databricks judge


def _run_surface(name, data, predict_fn, scorers):
    import mlflow.genai as genai

    print(f"\n=== eval: {name}  ({len(data)} cases) ===")
    model = _judge_model()
    if model:
        scorers = [s.with_config(model=model) if hasattr(s, "with_config") else s for s in scorers]
    res = genai.evaluate(data=data, predict_fn=predict_fn, scorers=scorers)
    try:
        print(res.metrics)
    except Exception:  # noqa: BLE001
        print("(metrics logged to MLflow run)")
    return res


def main(argv):
    surface = (argv[0] if argv else "all").lower()
    if not (_HAS_DB and _HAS_LLM):
        print("SKIP: evals need DB + LLM creds (PGHOST/PGUSER + DATABRICKS_HOST/TOKEN).")
        print("      Run inside the same env as `python test_local.py` (start.sh).")
        return 0

    import mlflow
    from evals import datasets as ds
    from evals import scorers as sc

    mlflow.set_experiment(os.environ.get("MLFLOW_EXPERIMENT", "nexus-evals"))

    # fill EDIT manuscripts from the real seeded text
    import tools
    edit_data = []
    for c in ds.EDIT_CASES:
        row = {"inputs": dict(c["inputs"]), "expectations": c.get("expectations", {})}
        ep = tools.get_episode(row["inputs"]["episode_id"]) or {}
        row["inputs"]["manuscript"] = ep.get("content") or ""
        edit_data.append(row)

    surfaces = {
        "regen": (ds.REGEN_CASES, regen_predict, sc.REGEN_SCORERS),
        "edit": (edit_data, edit_predict, sc.EDIT_SCORERS),
        "analyze": (ds.ANALYZE_CASES, analyze_predict, sc.ANALYZE_SCORERS),
        "chat": (ds.CHAT_CASES, chat_predict, sc.CHAT_SCORERS),
    }
    if surface != "all" and surface not in surfaces:
        print(f"unknown surface {surface!r}; choose one of {list(surfaces)} or 'all'")
        return 2

    targets = surfaces if surface == "all" else {surface: surfaces[surface]}
    for name, (data, fn, scorers) in targets.items():
        _run_surface(name, data, fn, scorers)
    print("\nDone. Open the MLflow experiment to inspect per-case judge rationales.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
