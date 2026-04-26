import asyncio
import logging
import os
import hashlib
import json

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.cache import cache
from app.core.database import AsyncSessionLocal
from app.services.ingestion_pipeline import IngestionPipeline


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("news-intel-ingestion-worker")


HOT_TOPICS = ["ai", "tech", "markets", "crypto"]
MEDIUM_TOPICS = ["politics", "defense", "trade", "auto", "telecom"]
SLOW_TOPICS = ["space", "climate", "healthcare", "real-estate", "media", "education", "legal"]


async def run_ingestion(topics: list[str], regions: list[str] | None = None, max_articles: int = 40) -> dict:
    lock_payload = json.dumps({"topics": sorted(topics), "regions": sorted(regions or ["global"])}, separators=(",", ":"))
    lock_key = f"ingestion-lock:{hashlib.sha256(lock_payload.encode('utf-8')).hexdigest()[:24]}"
    async with cache.lock(lock_key, ttl_seconds=900) as acquired:
        if not acquired:
            logger.info("skipping duplicate ingestion job topics=%s regions=%s", topics, regions or ["global"])
            return {
                "status": "skipped",
                "reason": "duplicate_ingestion_job",
                "topics": topics,
                "regions": regions or ["global"],
                "total": 0,
                "new_articles": 0,
            }

        return await _run_ingestion_unlocked(topics, regions, max_articles)


async def _run_ingestion_unlocked(topics: list[str], regions: list[str] | None = None, max_articles: int = 40) -> dict:
    async with AsyncSessionLocal() as session:
        pipeline = IngestionPipeline(session)
        results = await pipeline.ingest_topics(topics, regions or ["global"], max_articles=max_articles)
        created = sum(1 for result in results if result.created_article)
        logger.info("ingested topics=%s total=%s new_articles=%s", topics, len(results), created)
        return {
            "status": "completed",
            "topics": topics,
            "regions": regions or ["global"],
            "total": len(results),
            "new_articles": created,
        }


async def run_once_from_env() -> None:
    topics = [item.strip() for item in os.getenv("INGEST_TOPICS", "ai,tech,markets").split(",") if item.strip()]
    regions = [item.strip() for item in os.getenv("INGEST_REGIONS", "global").split(",") if item.strip()]
    await run_ingestion(topics, regions, max_articles=int(os.getenv("INGEST_MAX_ARTICLES", "40")))


async def serve_scheduler() -> None:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(run_ingestion, "interval", minutes=15, args=[HOT_TOPICS, ["global"], 60], id="hot-topics")
    scheduler.add_job(run_ingestion, "interval", hours=1, args=[MEDIUM_TOPICS, ["global"], 60], id="medium-topics")
    scheduler.add_job(run_ingestion, "interval", hours=6, args=[SLOW_TOPICS, ["global"], 60], id="slow-topics")
    scheduler.start()
    logger.info("external ingestion scheduler started")
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    mode = os.getenv("WORKER_MODE", "scheduler")
    if mode == "once":
        asyncio.run(run_once_from_env())
    else:
        asyncio.run(serve_scheduler())
