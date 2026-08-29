from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.api.routes.snapshot import load_snapshot
from app.pipeline.snapshot.geo import COUNTRIES, countries_from_cards

router = APIRouter(tags=["map"])


@router.get("/api/map-signals")
async def map_signals(session: AsyncSession = Depends(get_session), redis=Depends(get_redis)):
    payload = await load_snapshot(session, redis)
    cards = payload.get("feed") or payload.get("clusters") or []
    countries = countries_from_cards(cards if isinstance(cards, list) else [])
    stored = payload.get("map") or []
    regions = countries or [row for row in stored if isinstance(row, dict) and row.get("code")]
    return {
        "regions": regions,
        "layers": sorted({card.get("category") for card in cards if isinstance(card, dict) and card.get("category")}),
        "source_of_truth": "snapshots,signals",
    }


@router.get("/api/map-country-news")
async def map_country_news(
    country: str = "",
    code: str = "",
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis),
):
    payload = await load_snapshot(session, redis)
    cards = payload.get("feed") or []
    needles = {(country or "").lower(), (code or "").lower()}
    for row in COUNTRIES:
        if row["code"].lower() == (code or "").lower() or row["name"].lower() == (country or "").lower():
            needles.update(row["keys"])
            needles.add(row["name"].lower())
    items = []
    for card in cards:
        hay = f"{card.get('title','')} {card.get('summary','')} {card.get('source_name','')}".lower()
        if any(n and n in hay for n in needles):
            items.append(card)
    return {"country": country, "code": code, "items": items[:8]}
