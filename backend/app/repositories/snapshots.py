from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.snapshot import Snapshot


async def latest_active(session: AsyncSession) -> Snapshot | None:
    return await session.scalar(
        select(Snapshot).where(Snapshot.active.is_(True)).order_by(Snapshot.created_at.desc()).limit(1)
    )


async def deactivate_all(session: AsyncSession) -> None:
    await session.execute(update(Snapshot).where(Snapshot.active.is_(True)).values(active=False))
