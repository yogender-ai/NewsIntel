from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dashboard_read_model import build_dashboard_payload


async def build_legacy_dashboard_payload(
    session: AsyncSession,
    *,
    topics: list[str] | None = None,
    regions: list[str] | None = None,
    limit: int = 30,
) -> dict:
    """Temporary compatibility wrapper. Use dashboard_read_model directly."""
    return await build_dashboard_payload(session, topics=topics, regions=regions, limit=limit)
