"""Explicit reset helper for the controlled MVP pipeline.

This script is intentionally inert unless NEWSINTEL_RESET_CONFIRM is set to
RESET_NEWSINTEL_MVP. It tries to export a pg_dump backup first, then truncates
MVP/heavy ingestion tables so the next scheduler cycle starts from a clean DB.
"""

import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import text

from app.core.database import engine
from app.core.config import get_settings


RESET_VALUE = "RESET_NEWSINTEL_MVP"
TABLES = [
    "home_snapshots",
    "event_metrics",
    "stories",
    "enrichment_queue",
    "ranked_stories",
    "news_cycles",
    "raw_articles",
    "event_relationship_checks",
    "event_relationships",
    "event_articles",
    "events",
    "articles",
    "ingestion_locks",
]


def _sync_database_url(url: str) -> str:
    url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.pop("ssl", None)
    query["sslmode"] = query.get("sslmode") or "require"
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def backup_if_possible() -> str | None:
    backup_dir = Path(os.getenv("NEWSINTEL_BACKUP_DIR", "backups"))
    backup_dir.mkdir(parents=True, exist_ok=True)
    target = backup_dir / f"newsintel-pre-mvp-reset-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.dump"
    command = ["pg_dump", "--format=custom", "--file", str(target), _sync_database_url(get_settings().database_url)]
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _stdout, stderr = await process.communicate()
        if process.returncode == 0:
            return str(target)
        print(f"pg_dump backup skipped/failed: {stderr.decode(errors='ignore')[:500]}")
    except FileNotFoundError:
        print("pg_dump not found; continuing only because explicit reset confirmation was supplied.")
    return None


async def main() -> None:
    if os.getenv("NEWSINTEL_RESET_CONFIRM") != RESET_VALUE:
        print(f"Refusing to reset. Set NEWSINTEL_RESET_CONFIRM={RESET_VALUE} to proceed.")
        return

    backup_path = await backup_if_possible()
    async with engine.begin() as connection:
        existing = {
            row[0]
            for row in (
                await connection.execute(
                    text("select tablename from pg_tables where schemaname = 'public'")
                )
            ).all()
        }
        tables = [table for table in TABLES if table in existing]
        if tables:
            await connection.execute(text(f"TRUNCATE TABLE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    await engine.dispose()
    print({"status": "reset_complete", "backup": backup_path, "tables": tables})


if __name__ == "__main__":
    asyncio.run(main())
