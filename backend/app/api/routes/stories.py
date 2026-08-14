from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.repositories.signals import get_by_id

router = APIRouter(tags=["stories"])


@router.get("/api/story/{story_id}")
async def story_detail(story_id: str, session: AsyncSession = Depends(get_session)):
    try:
        signal_id = UUID(story_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Story not found") from exc
    signal = await get_by_id(session, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Story not found")
    card = {
        "id": str(signal.id),
        "signal_id": str(signal.id),
        "title": signal.title,
        "summary": signal.summary,
        "why_it_matters": signal.why_it_matters,
        "image_url": signal.image_url,
        "category": signal.category,
        "entities": signal.entities,
        "sentiment": signal.sentiment,
        "pulse_score": signal.pulse,
        "exposure_score": signal.exposure,
        "signal_tier": signal.importance,
        "source_url": signal.source_url,
        "sources": [{"title": signal.title, "source": signal.source_name, "url": signal.source_url}],
        "published_at": signal.published_at.isoformat() if signal.published_at else None,
        "ai_status": "enriched" if signal.why_it_matters else "rules_only",
        "pulse_breakdown": signal.pulse_breakdown,
    }
    return {"story": card, "source_url": signal.source_url, "sources": card["sources"]}
