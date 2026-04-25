from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.news import Event, EventArticle


def tier_from_event(event: Event) -> str:
    if event.confidence_score >= 0.82 and event.source_count >= 4:
        return "CRITICAL"
    if event.confidence_score >= 0.68 and event.source_count >= 2:
        return "SIGNAL"
    if event.confidence_score >= 0.45:
        return "WATCH"
    return "NOISE"


def pulse_from_event(event: Event) -> int:
    age_hours = max(
        0.0,
        (datetime.now(timezone.utc) - event.last_seen_at).total_seconds() / 3600,
    )
    freshness = max(0, 35 - int(age_hours * 2))
    source_weight = min(event.source_count * 12, 35)
    confidence_weight = int(event.confidence_score * 30)
    return max(1, min(100, freshness + source_weight + confidence_weight))


async def build_dashboard_payload(
    session: AsyncSession,
    *,
    topics: list[str] | None = None,
    regions: list[str] | None = None,
    limit: int = 30,
) -> dict:
    """Build the existing dashboard payload shape from production events.

    System of record: `events` and `event_articles`.
    This is the only read model the migrated dashboard endpoints should use.
    """
    stmt = (
        select(Event)
        .options(selectinload(Event.article_links).selectinload(EventArticle.article))
        .order_by(Event.last_seen_at.desc())
        .limit(limit)
    )
    if topics:
        stmt = stmt.where(Event.category.in_(topics))
    if regions and "global" not in regions:
        stmt = stmt.where(Event.region.in_(regions))

    events = (await session.scalars(stmt)).unique().all()
    articles = []
    clusters = []

    for event in events:
        article_ids = []
        for link in event.article_links:
            article = link.article
            article_id = str(article.id)
            article_ids.append(article_id)
            articles.append(
                {
                    "id": article_id,
                    "title": article.title,
                    "source": article.source,
                    "url": article.canonical_url,
                    "published": article.published_at.isoformat() if article.published_at else None,
                    "text_preview": article.text_preview or "",
                    "entities": [],
                    "sentiment": {"label": "NEUTRAL", "confidence": 0.5},
                }
            )

        pulse = pulse_from_event(event)
        tier = tier_from_event(event)
        clusters.append(
            {
                "thread_id": str(event.id),
                "signal_id": str(event.id),
                "thread_title": event.title,
                "summary": event.summary or event.title,
                "article_ids": article_ids,
                "pulse_score": pulse,
                "impact_line": event.summary or "Impact is still being confirmed across sources.",
                "why_it_matters": "This signal is based on production event memory and linked source coverage.",
                "risk_type": "neutral",
                "signal_tier": tier,
                "source_count": event.source_count,
                "source_diversity": min(1.0, event.source_count / max(len(article_ids), 1)),
                "sentiment_intensity": 0.0,
                "confidence": event.confidence_score,
                "updated_at": event.last_seen_at.isoformat(),
                "matched_preferences": [{"id": event.category, "label": event.category.title()}] if event.category else [],
                "exposure_score": 70 if event.category in (topics or []) else 50,
            }
        )

    signal_clusters = [cluster for cluster in clusters if cluster["signal_tier"] in ("CRITICAL", "SIGNAL")]
    exposure_score = (
        round(sum(cluster["exposure_score"] for cluster in signal_clusters) / len(signal_clusters))
        if signal_clusters
        else 50
    )
    now = datetime.now(timezone.utc)
    return {
        "status": "success",
        "version": "2.0.0-event-backed",
        "daily_brief": "",
        "articles": articles,
        "clusters": clusters,
        "impact": {},
        "tension_index": {},
        "daily_delta": [],
        "exposure_score": exposure_score,
        "opportunity_radar": {},
        "monitoring_queue": [cluster for cluster in clusters if cluster["signal_tier"] == "WATCH"],
        "sources_count": len(articles),
        "topics_used": topics or [],
        "regions_used": regions or [],
        "generated_at": now.isoformat(),
        "refresh_type": "event_backed",
        "pipeline_status": {
            "news": "postgres_events",
            "source_of_truth": "events,event_articles",
            "synthesis": "read_model_only",
            "cache": "external",
        },
        "next_refresh_at": None,
    }


def compare_dashboard_payloads(legacy: dict, event_backed: dict) -> dict:
    legacy_clusters = legacy.get("clusters", []) or []
    event_clusters = event_backed.get("clusters", []) or []
    legacy_ids = {str(item.get("signal_id") or item.get("thread_id") or item.get("thread_title")) for item in legacy_clusters}
    event_ids = {str(item.get("signal_id") or item.get("thread_id") or item.get("thread_title")) for item in event_clusters}

    legacy_pulse = {str(item.get("thread_title")): item.get("pulse_score", 0) for item in legacy_clusters}
    event_pulse = {str(item.get("thread_title")): item.get("pulse_score", 0) for item in event_clusters}
    shared_titles = set(legacy_pulse) & set(event_pulse)
    pulse_diffs = {
        title: event_pulse[title] - legacy_pulse[title]
        for title in shared_titles
    }

    return {
        "legacy_signal_count": len(legacy_clusters),
        "event_signal_count": len(event_clusters),
        "signals_added_by_event_store": sorted(event_ids - legacy_ids),
        "signals_missing_from_event_store": sorted(legacy_ids - event_ids),
        "shared_signal_count": len(legacy_ids & event_ids),
        "clustering_difference": len(event_clusters) - len(legacy_clusters),
        "pulse_differences_by_title": pulse_diffs,
        "delta_difference_note": "Event-backed delta should be computed from event pulse snapshots; legacy topic deltas are not authoritative after migration.",
    }

