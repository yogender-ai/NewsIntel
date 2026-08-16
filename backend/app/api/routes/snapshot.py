from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.core.redis import RedisClient
from app.pipeline.runner import SNAPSHOT_KEY
from app.pipeline.snapshot.builder import build_snapshot_payload
from app.repositories.signals import list_live_imaged, relationships_for
from app.repositories.snapshots import latest_active

router = APIRouter(tags=["snapshot"])


def _has_image(card: dict) -> bool:
    url = card.get("image_url") or card.get("thumbnail_url")
    return bool(url) and "news.google.com" not in str(url)


def only_imaged(payload: dict) -> dict:
    """Never send a card without a real image to the dashboard."""
    cleaned = dict(payload)
    for key in ("feed", "clusters", "topStories"):
        rows = cleaned.get(key)
        if isinstance(rows, list):
            cleaned[key] = [card for card in rows if isinstance(card, dict) and _has_image(card)]
    return cleaned


def _empty() -> dict:
    return {
        "feed": [],
        "clusters": [],
        "topStories": [],
        "pipeline_status": {"news": "empty", "source_of_truth": "snapshots,signals"},
        "refresh_type": "empty",
    }


async def rebuild_from_signals(session: AsyncSession) -> dict:
    signals = await list_live_imaged(session, 40)
    if not signals:
        return _empty()
    edges = await relationships_for(session, [item.id for item in signals])
    return only_imaged(
        build_snapshot_payload(
            run_id=None,
            signals=signals,
            relationships=edges,
            pipeline_status={"news": "live", "source_of_truth": "snapshots,signals"},
            pulse_history=[],
        )
    )


async def load_snapshot(session: AsyncSession, redis: RedisClient) -> dict:
    cached = await redis.get_json(SNAPSHOT_KEY)
    if isinstance(cached, dict) and cached.get("feed") is not None:
        payload = only_imaged(cached)
        if payload.get("clusters") or payload.get("feed"):
            return payload
    row = await latest_active(session)
    if row and isinstance(row.payload_json, dict):
        payload = only_imaged(row.payload_json)
        if payload.get("clusters") or payload.get("feed"):
            await redis.set_json(SNAPSHOT_KEY, payload, ttl_seconds=90 * 60)
            return payload
    payload = await rebuild_from_signals(session)
    if payload.get("clusters") or payload.get("feed"):
        await redis.set_json(SNAPSHOT_KEY, payload, ttl_seconds=90 * 60)
    return payload


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
