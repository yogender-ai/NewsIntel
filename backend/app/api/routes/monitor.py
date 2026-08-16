import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.core.config import get_settings
from app.repositories.runs import latest_run, recent_runs

router = APIRouter(tags=["monitor"])

HF_SPACE = "YAsh213kadian/News-Intel"
CLOUD_COMMAND = "https://cloud-command.onrender.com"


async def probe_dependencies() -> dict:
    settings = get_settings()
    hf = {"ok": False, "space": settings.hf_space_id or HF_SPACE, "stage": "unknown"}
    gateway = {"ok": False, "url": settings.gateway_root}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            space = await client.get(f"https://huggingface.co/api/spaces/{HF_SPACE}")
            if space.status_code == 200:
                payload = space.json()
                runtime = payload.get("runtime") or {}
                hf = {
                    "ok": True,
                    "space": payload.get("id") or HF_SPACE,
                    "stage": runtime.get("stage") or "UNKNOWN",
                    "host": payload.get("host"),
                    "hardware": ((runtime.get("hardware") or {}).get("requested")),
                }
                host = payload.get("host")
                if host:
                    try:
                        await client.get(host, timeout=3.0)
                    except Exception:
                        pass
            health = await client.get(f"{CLOUD_COMMAND}/api/gateway/health")
            gateway = {
                "ok": health.status_code in {200, 401},
                "status_code": health.status_code,
                "url": settings.gateway_root,
                "detail": "up" if health.status_code in {200, 401} else health.text[:120],
            }
    except Exception as exc:
        gateway["error"] = str(exc)[:160]
    return {"huggingface": hf, "cloud_command": gateway}


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
            {"id": "snapshot", "label": "SNAPSHOT"},
        ],
        "deps": await probe_dependencies(),
    }
