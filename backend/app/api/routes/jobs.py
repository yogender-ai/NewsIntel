from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.api.routes.snapshot import load_snapshot
from app.core.redis import RedisClient
from app.pipeline.runner import enqueue_run
from app.repositories.runs import get_run

router = APIRouter(tags=["jobs"])


def _envelope(status: str, run, snapshot: dict, message: str) -> dict:
    job_status = status if status in {"already_running", "skipped", "error", "queued"} else run.status
    return {
        "accepted": status != "error",
        "status": status,
        "message": message,
        "job": {
            "id": str(run.id),
            "status": job_status,
            "trigger": getattr(run, "trigger", "user_refresh"),
        },
        "manual_refresh": {
            "requested_at": run.started_at.isoformat() if getattr(run, "started_at", None) else datetime.now(timezone.utc).isoformat(),
            "status": status,
            "message": message,
        },
        "snapshot": snapshot,
    }


@router.post("/api/pipeline/kick")
async def kick_pipeline(
    session: AsyncSession = Depends(get_session),
    redis: RedisClient = Depends(get_redis),
):
    """Oil-pipeline control room. No secret — the site is the valve."""
    snapshot = await load_snapshot(session, redis)
    try:
        run, status = await enqueue_run(session, redis, "oil_force", force=True)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return JSONResponse(
        status_code=202,
        content=_envelope(status, run, snapshot, "Force run accepted" if status == "queued" else status),
    )


@router.post("/api/dashboard")
async def enqueue_refresh(
    force: bool = False,
    session: AsyncSession = Depends(get_session),
    redis: RedisClient = Depends(get_redis),
):
    snapshot = await load_snapshot(session, redis)
    try:
        run, status = await enqueue_run(session, redis, "user_refresh", force=force)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    messages = {
        "queued": "Refresh queued. Showing last snapshot.",
        "already_running": "A run is already in progress.",
        "skipped": "Ran within the last hour.",
    }
    return JSONResponse(status_code=202, content=_envelope(status, run, snapshot, messages.get(status, status)))


@router.get("/api/jobs/{job_id}")
async def get_job(job_id: str, session: AsyncSession = Depends(get_session), redis: RedisClient = Depends(get_redis)):
    cached = await redis.get_json(f"newsintel:job:{job_id}")
    if cached:
        return cached
    try:
        run = await get_run(session, UUID(job_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc
    if not run:
        raise HTTPException(status_code=404, detail="Job not found")
    from app.pipeline.runner import _job_payload

    return _job_payload(run)
