from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline_run import PipelineRun


async def get_run(session: AsyncSession, run_id: UUID) -> PipelineRun | None:
    return await session.get(PipelineRun, run_id)


async def latest_run(session: AsyncSession) -> PipelineRun | None:
    return await session.scalar(select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(1))


async def recent_runs(session: AsyncSession, limit: int = 20) -> list[PipelineRun]:
    result = await session.scalars(select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(limit))
    return list(result)
