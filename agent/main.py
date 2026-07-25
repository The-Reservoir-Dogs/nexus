"""Agent HTTP surface. POST /generate streams the alternate-future draft as SSE."""
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


@app.get("/health")
def health():
    return {"ok": True}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/generate")
def generate(req: GenerateRequest):
    def stream():
        buf: list[str] = []
        try:
            for token in agent.generate_stream(
                req.sourceEpisodeId, req.decisionPoint, req.drivingReviewId, req.instructions
            ):
                buf.append(token)
                yield _sse("token", {"text": token})
            full = "".join(buf)
            title = "Untitled"
            content = full
            if full.startswith("TITLE:"):
                first, _, rest = full.partition("\n")
                title = first.replace("TITLE:", "").strip()
                content = rest.strip()
            yield _sse("done", {"draft": {"title": title, "content": content, "summary": ""}})
        except Exception as e:  # surface errors to the client stream
            yield _sse("error", {"message": str(e)})

    return StreamingResponse(stream(), media_type="text/event-stream")
