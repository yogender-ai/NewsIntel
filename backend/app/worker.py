from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.core.redis import redis_worker
from app.core.schema import ensure_core_v2_schema
from app.pipeline.runner import maybe_run_from_queue, run_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("newsintel-worker")


async def scheduled_tick():
    try:
        await maybe_run_from_queue(redis_worker)
    except RuntimeError as exc:
        logger.info("scheduled tick skipped: %s", exc)
    except Exception:
        logger.exception("scheduled tick failed")


async def drain_refresh():
    while True:
        try:
            requested = await redis_worker.get("newsintel:refresh:requested")
            lock = await redis_worker.get("newsintel:lock:ingest")
            cooldown = await redis_worker.get("newsintel:cooldown:ingest")
            if requested and not lock and not cooldown:
                await run_pipeline(redis_worker, trigger="user_refresh")
        except Exception:
            logger.exception("refresh drain failed")
        await asyncio.sleep(15)


async def main():
    settings = get_settings()
    await ensure_core_v2_schema()
    await redis_worker.connect()
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        scheduled_tick,
        "interval",
        minutes=max(60, settings.newsintel_ingest_interval_minutes),
        id="hourly-ingest",
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info("worker started interval=%sm", settings.newsintel_ingest_interval_minutes)
    await asyncio.sleep(2)
    try:
        await scheduled_tick()
    except Exception:
        logger.exception("boot tick failed")
    await drain_refresh()


if __name__ == "__main__":
    asyncio.run(main())
