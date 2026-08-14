from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.api.routes.snapshot import load_snapshot
from app.core.redis import RedisClient
from app.core.security import require_ingest_secret
from app.pipeline.runner import enqueue_run
from app.repositories.runs import latest_run, recent_runs

router = APIRouter(tags=["admin"])


@router.post("/api/admin/ingest-now", dependencies=[Depends(require_ingest_secret)])
async def ingest_now(
    force: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
    redis: RedisClient = Depends(get_redis),
):
    snapshot = await load_snapshot(session, redis)
    run, status = await enqueue_run(session, redis, "admin", force=force)
    return JSONResponse(
        status_code=202,
        content={
            "status": status,
            "message": "Ingestion enqueued" if status == "queued" else status,
            "job": {"id": str(run.id), "status": run.status, "trigger": run.trigger},
            "snapshot": snapshot,
        },
    )


@router.post("/api/admin/enrich-batch", dependencies=[Depends(require_ingest_secret)])
async def enrich_batch_gone():
    return JSONResponse(
        status_code=410,
        content={
            "status": "gone",
            "message": "Enrichment is inside the hourly worker run. Disable the Cloud Command enrich-batch job. Use POST /api/admin/ingest-now to enqueue.",
        },
    )


@router.get("/api/admin/ingestion-status", dependencies=[Depends(require_ingest_secret)])
async def ingestion_status(session: AsyncSession = Depends(get_session), redis: RedisClient = Depends(get_redis)):
    run = await latest_run(session)
    return {
        "latest": {
            "id": str(run.id),
            "status": run.status,
            "stats": run.stats,
            "stages": run.stages,
            "started_at": run.started_at.isoformat() if run and run.started_at else None,
        }
        if run
        else None,
        "cooldown": bool(await redis.get("newsintel:cooldown:ingest")),
        "lock": bool(await redis.get("newsintel:lock:ingest")),
        "recent": [
            {"id": str(item.id), "status": item.status, "trigger": item.trigger, "stats": item.stats}
            for item in await recent_runs(session, 8)
        ],
    }


@router.post("/api/admin/reset-ai-circuit", dependencies=[Depends(require_ingest_secret)])
async def reset_circuit(redis: RedisClient = Depends(get_redis)):
    await redis.delete("newsintel:circuit:ai")
    await redis.delete("newsintel:circuit:hf")
    return {"status": "success"}
