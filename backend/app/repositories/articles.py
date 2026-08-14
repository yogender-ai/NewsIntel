from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news import Article


async def recent_for_dedupe(session: AsyncSession, days: int = 7, limit: int = 500) -> list[tuple[str, str]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await session.execute(
            select(Article.url_hash, Article.title)
            .where(Article.last_seen_at >= cutoff)
            .order_by(Article.last_seen_at.desc())
            .limit(limit)
        )
    ).all()
    return [(row.url_hash, row.title or "") for row in rows]


async def get_by_url_hash(session: AsyncSession, url_hash: str) -> Article | None:
    return await session.scalar(select(Article).where(Article.url_hash == url_hash))


async def get_by_id(session: AsyncSession, article_id: UUID) -> Article | None:
    return await session.get(Article, article_id)
