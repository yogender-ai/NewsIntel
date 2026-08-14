from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis, get_session
from app.api.routes.snapshot import load_snapshot

router = APIRouter(tags=["orbit"])


@router.get("/api/orbit")
async def orbit(session: AsyncSession = Depends(get_session), redis=Depends(get_redis)):
    payload = await load_snapshot(session, redis)
    cards = payload.get("feed") or []
    nodes = []
    edges = []
    for card in cards[:20]:
        pulse = float(card.get("pulse_score") or 50)
        tier = card.get("signal_tier") or "WATCH"
        distance = 0.2 if tier == "CRITICAL" else 0.45 if tier == "SIGNAL" else 0.7 if tier == "WATCH" else 0.9
        nodes.append(
            {
                "id": card.get("id"),
                "title": card.get("title"),
                "category": card.get("category"),
                "pulse": pulse,
                "size": 70 + pulse * 0.5,
                "distance": distance,
                "status": "rising" if pulse >= 70 else "stable",
                "image_url": card.get("image_url"),
                "tier": tier,
            }
        )
        for rel in card.get("relationships") or []:
            edges.append(
                {
                    "from": card.get("id"),
                    "to": rel.get("target"),
                    "type": rel.get("type") or "related",
                    "confidence": 0.7,
                    "label": rel.get("reason") or "",
                }
            )
    return {"nodes": nodes, "edges": edges, "source_of_truth": "snapshots,signals"}
