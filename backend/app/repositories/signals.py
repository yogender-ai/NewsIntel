from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signal import Signal, SignalRelationship


async def get_by_article(session: AsyncSession, article_id: UUID) -> Signal | None:
    return await session.scalar(select(Signal).where(Signal.article_id == article_id))


async def get_by_id(session: AsyncSession, signal_id: UUID) -> Signal | None:
    return await session.get(Signal, signal_id)


async def list_for_run(session: AsyncSession, run_id: UUID) -> list[Signal]:
    result = await session.scalars(select(Signal).where(Signal.run_id == run_id).order_by(Signal.pulse.desc()))
    return list(result)


async def list_live_imaged(session: AsyncSession, limit: int = 40) -> list[Signal]:
    result = await session.scalars(
        select(Signal)
        .where(Signal.image_url.is_not(None), Signal.image_url != "")
        .order_by(Signal.published_at.desc().nullslast(), Signal.pulse.desc())
        .limit(limit)
    )
    return [row for row in result if row.image_url and "news.google.com" not in row.image_url]


async def relationships_for(session: AsyncSession, signal_ids: list[UUID]) -> list[SignalRelationship]:
    if not signal_ids:
        return []
    result = await session.scalars(select(SignalRelationship).where(SignalRelationship.source_id.in_(signal_ids)))
    return list(result)


async def replace_relationships(session: AsyncSession, source_id: UUID, edges: list[SignalRelationship]) -> None:
    await session.execute(delete(SignalRelationship).where(SignalRelationship.source_id == source_id))
    for edge in edges:
        session.add(edge)
