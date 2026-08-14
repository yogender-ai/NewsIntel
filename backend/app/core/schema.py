from __future__ import annotations

import logging

from sqlalchemy import inspect, text

from app.core.database import engine
from app.models.base import Base
from app.models import pipeline_run as _pipeline_run  # noqa: F401
from app.models import signal as _signal  # noqa: F401
from app.models import snapshot as _snapshot  # noqa: F401
from app.models import news as _news  # noqa: F401

logger = logging.getLogger("newsintel-schema")

_ARTICLE_COLUMNS = [
    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT",
    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_id VARCHAR(80)",
    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_name VARCHAR(160)",
    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS hf_json JSONB DEFAULT '{}'::jsonb",
    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS llm_json JSONB",
    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS llm_status VARCHAR(32)",
]


def _create_v2_tables(sync_conn) -> None:
    from app.models.news import Article
    from app.models.pipeline_run import PipelineRun
    from app.models.signal import Signal, SignalRelationship
    from app.models.snapshot import PulseSample, Snapshot

    tables = [
        Article.__table__,
        PipelineRun.__table__,
        Signal.__table__,
        SignalRelationship.__table__,
        Snapshot.__table__,
        PulseSample.__table__,
    ]
    Base.metadata.create_all(sync_conn, tables=tables)


async def ensure_core_v2_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(_create_v2_tables)
        inspector = await conn.run_sync(inspect)
        tables = set(inspector.get_table_names())
        if "articles" in tables:
            for stmt in _ARTICLE_COLUMNS:
                try:
                    await conn.execute(text(stmt))
                except Exception as exc:
                    logger.warning("article column migrate skipped: %s (%s)", stmt, exc)
    logger.info("core-v2 schema ready")
