from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import cache
from app.core.config import get_settings
from app.core.database import get_session
from app.models.news import Article, Event, EventArticle
from app.services.dashboard_read_model import build_dashboard_payload


router = APIRouter(prefix="/api/v2", tags=["v2"])
settings = get_settings()


def _event_payload(event: Event) -> dict:
    articles = []
    for link in event.article_links:
        article = link.article
        articles.append(
            {
                "id": str(article.id),
                "title": article.title,
                "source": article.source,
                "canonical_url": article.canonical_url,
                "published_at": article.published_at.isoformat() if article.published_at else None,
                "role": link.role,
                "confidence_score": link.confidence_score,
            }
        )
    return {
        "id": str(event.id),
        "title": event.title,
        "summary": event.summary,
        "category": event.category,
        "region": event.region,
        "confidence_score": event.confidence_score,
        "source_count": event.source_count,
        "first_seen_at": event.first_seen_at.isoformat(),
        "last_seen_at": event.last_seen_at.isoformat(),
        "last_meaningful_update_at": event.last_meaningful_update_at.isoformat()
        if event.last_meaningful_update_at
        else None,
        "status": event.status,
        "entities": event.entities,
        "articles": articles,
    }


@router.get("/events")
async def list_events(
    category: str | None = Query(default=None),
    region: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    cache_key = f"events:v2:{category or 'all'}:{region or 'all'}:{limit}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    stmt = (
        select(Event)
        .options(selectinload(Event.article_links).selectinload(EventArticle.article))
        .order_by(Event.last_seen_at.desc())
        .limit(limit)
    )
    if category:
        stmt = stmt.where(Event.category == category)
    if region:
        stmt = stmt.where(Event.region == region)

    events = (await session.scalars(stmt)).unique().all()
    payload = {
        "status": "success",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "events": [_event_payload(event) for event in events],
    }
    await cache.set_json(cache_key, payload, ttl_seconds=settings.dashboard_cache_ttl_seconds)
    return payload


@router.get("/articles/{article_id}")
async def get_article(article_id: str, session: AsyncSession = Depends(get_session)):
    try:
        article_uuid = UUID(article_id)
    except ValueError:
        return {"status": "not_found", "article": None}

    stmt = select(Article).where(Article.id == article_uuid)
    article = await session.scalar(stmt)
    if not article:
        return {"status": "not_found", "article": None}
    return {
        "status": "success",
        "article": {
            "id": str(article.id),
            "canonical_url": article.canonical_url,
            "title": article.title,
            "source": article.source,
            "published_at": article.published_at.isoformat() if article.published_at else None,
            "first_seen_at": article.first_seen_at.isoformat(),
            "last_seen_at": article.last_seen_at.isoformat(),
            "dedupe_reason": article.dedupe_reason,
            "text_preview": article.text_preview,
        },
    }


@router.get("/dashboard-compatible")
async def dashboard_compatible(
    category: list[str] | None = Query(default=None),
    region: list[str] | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    cache_key = f"dashboard-compatible:v2:{','.join(sorted(category or []))}:{','.join(sorted(region or []))}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached
    payload = await build_dashboard_payload(session, topics=category or [], regions=region or [])
    await cache.set_json(cache_key, payload, ttl_seconds=settings.dashboard_cache_ttl_seconds)
    return payload
