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


async def replace_relationships(session: AsyncSession, source_id: UUID, edges: list[SignalRelationship]) -> None:
    await session.execute(delete(SignalRelationship).where(SignalRelationship.source_id == source_id))
    for edge in edges:
        session.add(edge)
