from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.core.redis import RedisClient
from app.pipeline.runner import SNAPSHOT_KEY
from app.repositories.snapshots import latest_active

router = APIRouter(tags=["snapshot"])


async def load_snapshot(session: AsyncSession, redis: RedisClient) -> dict:
    cached = await redis.get_json(SNAPSHOT_KEY)
    if isinstance(cached, dict) and cached.get("feed") is not None:
        return cached
    row = await latest_active(session)
    if row and isinstance(row.payload_json, dict):
        await redis.set_json(SNAPSHOT_KEY, row.payload_json, ttl_seconds=90 * 60)
        return row.payload_json
    return {
        "feed": [],
        "clusters": [],
        "topStories": [],
        "pipeline_status": {"news": "empty", "source_of_truth": "snapshots,signals"},
        "refresh_type": "empty",
    }


@router.get("/api/home-snapshot")
@router.get("/api/dashboard")
async def home_snapshot(session: AsyncSession = Depends(get_session), redis: RedisClient = Depends(get_redis)):
    return await load_snapshot(session, redis)


@router.get("/api/feed")
async def feed(
    cursor: int = 0,
    limit: int = 3,
    session: AsyncSession = Depends(get_session),
    redis: RedisClient = Depends(get_redis),
):
    payload = await load_snapshot(session, redis)
    items = payload.get("feed") if isinstance(payload.get("feed"), list) else []
    start = max(0, cursor)
    end = start + max(1, min(limit, 20))
    return {"items": items[start:end], "cursor": start, "next_cursor": end if end < len(items) else None}
