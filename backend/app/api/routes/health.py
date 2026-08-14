from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import AsyncSessionLocal, engine
from app.core.redis import redis_api
from app.repositories.runs import latest_run

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    db_ok = True
    last_run = None
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        async with AsyncSessionLocal() as session:
            run = await latest_run(session)
            if run:
                last_run = {
                    "id": str(run.id),
                    "status": run.status,
                    "started_at": run.started_at.isoformat() if run.started_at else None,
                    "finished_at": run.finished_at.isoformat() if run.finished_at else None,
                }
    except Exception:
        db_ok = False
    redis_ok = redis_api.available
    status = "online" if db_ok else "down"
    if db_ok and not redis_ok:
        status = "degraded"
    return {
        "status": status,
        "version": "core-v2",
        "db": db_ok,
        "redis": redis_ok,
        "last_run": last_run,
        "source_of_truth": "snapshots,signals",
        "scheduler": "worker",
    }
