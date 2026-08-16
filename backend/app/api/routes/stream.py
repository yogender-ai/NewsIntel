from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.events import iter_sse

router = APIRouter(tags=["stream"])


@router.get("/api/pipeline/stream")
async def pipeline_stream():
    return StreamingResponse(iter_sse(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
