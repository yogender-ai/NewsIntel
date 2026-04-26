from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.news import Event, EventArticle
from app.services.event_enrichment import (
    AI_STATUS_ENRICHED,
    AI_STATUS_FAILED,
    AI_STATUS_PENDING,
    deterministic_base_score,
)


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def tier_from_event(event: Event) -> str:
    ai = ai_metadata(event)
    if ai.get("signal_tier"):
        return ai["signal_tier"]
    if event.confidence_score >= 0.82 and event.source_count >= 4:
        return "CRITICAL"
    if event.confidence_score >= 0.68 and event.source_count >= 2:
        return "SIGNAL"
    if event.confidence_score >= 0.45:
        return "WATCH"
    return "NOISE"


def pulse_from_event(event: Event) -> int:
    ai = ai_metadata(event)
    if isinstance(ai.get("pulse_score"), int | float):
        return max(1, min(100, round(ai["pulse_score"])))
    age_hours = max(
        0.0,
        (datetime.now(timezone.utc) - as_utc(event.last_seen_at)).total_seconds() / 3600,
    )
    freshness = max(0, 35 - int(age_hours * 2))
    source_weight = min(event.source_count * 12, 35)
    confidence_weight = int(event.confidence_score * 30)
    return max(1, min(100, freshness + source_weight + confidence_weight))


def ai_metadata(event: Event) -> dict:
    ai = (event.metadata_json or {}).get("ai")
    return ai if isinstance(ai, dict) else {"status": AI_STATUS_PENDING}


def ai_text(event: Event, key: str, pending: str, failed: str) -> str:
    ai = ai_metadata(event)
    status = ai.get("status")
    if status == AI_STATUS_ENRICHED and ai.get(key):
        return ai[key]
    if status == AI_STATUS_FAILED:
        return failed
    return pending


def risk_type_from_ai(ai: dict) -> str:
    if ai.get("status") != AI_STATUS_ENRICHED:
        return "neutral"
    if ai.get("risk_level") == "high":
        return "risk"
    if ai.get("opportunity_level") == "high":
        return "opportunity"
    return "neutral"


def sentiment_intensity_from_ai(ai: dict) -> float:
    if ai.get("status") != AI_STATUS_ENRICHED:
        return 0.0
    sentiment = ai.get("sentiment")
    risk = ai.get("risk_level")
    opportunity = ai.get("opportunity_level")
    if risk == "high" or opportunity == "high":
        return 0.85
    if sentiment in {"negative", "mixed"} or risk == "medium" or opportunity == "medium":
        return 0.55
    return 0.25


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

        ai = ai_metadata(event)
        pulse = pulse_from_event(event)
        tier = tier_from_event(event)
        base_score, default_breakdown = deterministic_base_score(event)
        pulse_breakdown = ai.get("pulse_breakdown") if isinstance(ai.get("pulse_breakdown"), dict) else default_breakdown
        if "deterministic_base" not in pulse_breakdown:
            pulse_breakdown = {**pulse_breakdown, "deterministic_base": base_score, "ai_importance": 0, "user_relevance": 70 if event.category in (topics or []) else 50}
        ai_status = ai.get("status") or AI_STATUS_PENDING
        entities = ai.get("entities") if ai_status == AI_STATUS_ENRICHED and isinstance(ai.get("entities"), list) else []
        story_graph = ai.get("story_graph_json") if ai_status == AI_STATUS_ENRICHED and isinstance(ai.get("story_graph_json"), dict) else None
        clusters.append(
            {
                "thread_id": str(event.id),
                "signal_id": str(event.id),
                "thread_title": event.title,
                "summary": ai_text(
                    event,
                    "summary",
                    "AI analysis pending",
                    "AI analysis unavailable",
                ),
                "article_ids": article_ids,
                "pulse_score": pulse,
                "pulse_breakdown": pulse_breakdown,
                "deterministic_base_score": base_score,
                "impact_line": ai_text(
                    event,
                    "impact_line",
                    "AI analysis pending",
                    "AI analysis unavailable",
                ),
                "why_it_matters": ai_text(
                    event,
                    "why_it_matters",
                    "Impact is still being confirmed across sources.",
                    "AI analysis unavailable",
                ),
                "risk_type": risk_type_from_ai(ai),
                "risk_level": ai.get("risk_level") if ai_status == AI_STATUS_ENRICHED else None,
                "opportunity_level": ai.get("opportunity_level") if ai_status == AI_STATUS_ENRICHED else None,
                "signal_tier": tier,
                "source_count": event.source_count,
                "source_diversity": min(1.0, event.source_count / max(len(article_ids), 1)),
                "sentiment": ai.get("sentiment") if ai_status == AI_STATUS_ENRICHED else None,
                "sentiment_intensity": sentiment_intensity_from_ai(ai),
                "confidence": event.confidence_score,
                "confidence_explanation": ai.get("confidence_explanation") if ai_status == AI_STATUS_ENRICHED else None,
                "uncertainty": ai.get("uncertainty") if ai_status == AI_STATUS_ENRICHED else None,
                "ai_status": ai_status,
                "ai_provider_used": ai.get("provider_used"),
                "ai_enriched_at": ai.get("enriched_at"),
                "entities": entities,
                "story_graph": story_graph,
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
            "synthesis": "event_ai_enrichment",
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
