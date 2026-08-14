"""Drop old News-Intel tables and leftover rows. Keep only core-v2 tables.

Usage (from backend/):

    NEWSINTEL_RESET_CONFIRM=RESET_NEWSINTEL_CORE python scripts/reset_core_v2.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from app.core.schema import ensure_core_v2_schema

OLD_TABLES = [
    "digest_delivery_logs",
    "daily_digests",
    "alerts",
    "alert_rules",
    "preferences",
    "users",
    "scenario_runs",
    "event_relationship_checks",
    "event_relationships",
    "event_articles",
    "event_metrics",
    "home_snapshots",
    "stories",
    "enrichment_queue",
    "ranked_stories",
    "news_cycles",
    "raw_articles",
    "events",
    "ingestion_locks",
    "searches",
    "sentiment_trends",
    "entities",
    "feedback",
    "pulse_snapshots",
    "saved_threads",
    "watched_signals",
    "tracked_entities",
    "dismissed_signals",
    "user_interactions",
    "user_preferences",
]

V2_TRUNCATE = [
    "pulse_samples",
    "signal_relationships",
    "snapshots",
    "signals",
    "pipeline_runs",
]


async def main() -> None:
    if os.getenv("NEWSINTEL_RESET_CONFIRM") != "RESET_NEWSINTEL_CORE":
        raise SystemExit("Refusing to wipe. Set NEWSINTEL_RESET_CONFIRM=RESET_NEWSINTEL_CORE")

    await ensure_core_v2_schema()
    async with engine.begin() as conn:
        for table in OLD_TABLES:
            await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
        for table in V2_TRUNCATE:
            await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        await conn.execute(text("TRUNCATE TABLE articles CASCADE"))
    print("Old tables dropped. Core v2 tables emptied. Ready for a fresh ingest.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
