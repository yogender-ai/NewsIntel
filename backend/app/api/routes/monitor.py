from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.repositories.runs import latest_run, recent_runs

router = APIRouter(tags=["monitor"])


@router.get("/api/pipeline/monitor")
async def pipeline_monitor(session: AsyncSession = Depends(get_session), redis=Depends(get_redis)):
    latest = await latest_run(session)
    recent = await recent_runs(session, 12)
    return {
        "lock": bool(await redis.get("newsintel:lock:ingest")),
        "cooldown": bool(await redis.get("newsintel:cooldown:ingest")),
        "circuit_ai": bool(await redis.get("newsintel:circuit:ai")),
        "latest": {
            "id": str(latest.id),
            "status": latest.status,
            "trigger": latest.trigger,
            "stats": latest.stats,
            "stages": latest.stages,
            "error": latest.error,
            "started_at": latest.started_at.isoformat() if latest.started_at else None,
            "finished_at": latest.finished_at.isoformat() if latest.finished_at else None,
        }
        if latest
        else None,
        "recent": [
            {
                "id": str(run.id),
                "status": run.status,
                "trigger": run.trigger,
                "stats": run.stats,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "elapsed_ms": int((run.finished_at - run.started_at).total_seconds() * 1000)
                if run.finished_at and run.started_at
                else None,
            }
            for run in recent
        ],
        "stages": [
            {"id": "fetch", "label": "INGEST FEEDS"},
            {"id": "images", "label": "IMAGE GATE"},
            {"id": "dedupe", "label": "DEDUPE"},
            {"id": "hf", "label": "NER + SENTIMENT"},
            {"id": "llm", "label": "LLM INTEL"},
            {"id": "signals", "label": "SIGNAL SCORE"},
            {"id": "rag_index", "label": "RAG INDEX"},
            {"id": "snapshot", "label": "SNAPSHOT"},
        ],
    }
