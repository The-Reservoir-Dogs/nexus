"""Agent HTTP surface.

POST /generate streams the alternate-timeline draft as SSE, including the agent's
reasoning and tool calls so the UI can show it thinking live.
POST /analyze streams retention insight for the author.
"""
import json

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import agent

app = FastAPI(title="nexus-agent")


class GenerateRequest(BaseModel):
    sourceEpisodeId: str
    decisionPoint: str
    drivingReviewId: str | None = None
    instructions: str | None = None


class AnalyzeRequest(BaseModel):
    episodeId: str


@app.get("/health")
def health():
    return {"ok": True}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _strip_title(full: str) -> tuple[str, str]:
    """Split 'TITLE: x\\n<prose>' into (title, content)."""
    if "TITLE:" in full:
        _, _, after = full.partition("TITLE:")
        first, _, rest = after.partition("\n")
        return first.strip(), rest.strip()
    return "Untitled", full.strip()


def _pump(events):
    """Translate agent event dicts -> SSE lines. Accumulates prose for the done event."""
    buf: list[str] = []
    try:
        for ev in events:
            etype = ev.get("type")
            if etype == "token":
                buf.append(ev["delta"])
                yield _sse("token", {"delta": ev["delta"]})
            elif etype == "reasoning":
                yield _sse("reasoning", {"delta": ev["delta"]})
            elif etype == "tool_call":
                yield _sse("tool_call", {"name": ev["name"], "args": ev.get("args", {})})
            elif etype == "tool_result":
                yield _sse("tool_result", {"name": ev["name"], "summary": ev.get("summary", "")})
            elif etype == "done":
                title, content = _strip_title("".join(buf))
                title = ev.get("title") or title
                yield _sse("done", {"draft": {"title": title, "content": content, "summary": ""}})
            elif etype == "error":
                yield _sse("error", {"message": ev.get("message", "error")})
    except Exception as e:  # surface any error into the stream
        yield _sse("error", {"message": str(e)})


@app.post("/generate")
def generate(req: GenerateRequest):
    events = agent.generate_stream(
        req.sourceEpisodeId, req.decisionPoint, req.drivingReviewId, req.instructions
    )
    return StreamingResponse(_pump(events), media_type="text/event-stream")


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    return StreamingResponse(_pump(agent.analyze_stream(req.episodeId)), media_type="text/event-stream")
