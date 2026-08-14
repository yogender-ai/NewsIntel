from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.api.routes.snapshot import load_snapshot

router = APIRouter(tags=["map"])


@router.get("/api/map-signals")
async def map_signals(session: AsyncSession = Depends(get_session), redis=Depends(get_redis)):
    payload = await load_snapshot(session, redis)
    return {
        "regions": payload.get("map") or [],
        "source_of_truth": "snapshots,signals",
    }


@router.get("/api/map-country-news")
async def map_country_news(
    country: str = "",
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
):
    payload = await load_snapshot(session, redis)
    cards = payload.get("feed") or []
    needle = (country or "").lower()
    items = [
        card
        for card in cards
        if needle
        and needle in f"{card.get('title','')} {card.get('summary','')} {card.get('source_name','')}".lower()
    ][:8]
    return {"country": country, "items": items or cards[:4]}
