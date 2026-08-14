from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.models.signal import Signal, SignalRelationship


def _card(signal: Signal, rank: int, rels: list[SignalRelationship]) -> dict:
    entities = signal.entities if isinstance(signal.entities, list) else []
    ai_status = "enriched"
    if signal.pulse_breakdown and signal.pulse_breakdown.get("llm_importance") == 50 and not signal.why_it_matters:
        ai_status = "rules_only"
    return {
        "id": str(signal.id),
        "signal_id": str(signal.id),
        "thread_id": str(signal.id),
        "article_ids": [str(signal.article_id)],
        "thread_title": signal.title,
        "title": signal.title,
        "summary": signal.summary,
        "impact_line": signal.why_it_matters,
        "why_it_matters": signal.why_it_matters,
        "category": signal.category,
        "image_url": signal.image_url,
        "entities": entities,
        "sentiment": signal.sentiment,
        "pulse_score": signal.pulse,
        "exposure_score": signal.exposure,
        "signal_tier": signal.importance,
        "importance_level": signal.importance,
        "source_url": signal.source_url,
        "source_name": signal.source_name,
        "sources": [{"id": str(signal.article_id), "title": signal.title, "source": signal.source_name, "url": signal.source_url}],
        "published_at": signal.published_at.isoformat() if signal.published_at else None,
        "updated_at": signal.enriched_at.isoformat() if signal.enriched_at else None,
        "ai_status": ai_status,
        "ai_enriched_at": signal.enriched_at.isoformat() if signal.enriched_at else None,
        "pulse_breakdown": signal.pulse_breakdown,
        "rank": rank,
        "relationships": [
            {"target": str(rel.target_id), "type": rel.rel_type, "reason": rel.reason}
            for rel in rels
            if rel.source_id == signal.id
        ],
    }


def build_snapshot_payload(
    *,
    run_id,
    signals: list[Signal],
    relationships: list[SignalRelationship],
    pipeline_status: dict,
    pulse_history: list[dict],
) -> dict:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    ranked = sorted(signals, key=lambda item: item.pulse, reverse=True)
    cards = [_card(signal, index + 1, relationships) for index, signal in enumerate(ranked)]
    categories = {category: [] for category in settings.mvp_categories}
    for card in cards:
        categories.setdefault(card["category"], []).append(card)
    top5 = cards[:5]
    if top5:
        weights = list(range(len(top5), 0, -1))
        world_pulse = round(sum(card["pulse_score"] * weight for card, weight in zip(top5, weights)) / sum(weights), 2)
    else:
        world_pulse = None
    if world_pulse is None:
        label = None
    elif world_pulse >= 76:
        label = "High Pressure"
    elif world_pulse >= 56:
        label = "Elevated"
    elif world_pulse >= 31:
        label = "Normal"
    else:
        label = "Calm"
    critical = sum(1 for card in cards if card["signal_tier"] == "CRITICAL")
    map_rows = []
    for category in settings.mvp_categories:
        values = [card["pulse_score"] for card in categories.get(category, [])]
        map_rows.append(
            {
                "id": f"global:{category}",
                "name": f"Global {category.title()}",
                "mode": "global_category",
                "category": category,
                "intensity": round(sum(values) / len(values), 2) if values else 0,
                "event_count": len(values),
            }
        )
    return {
        "lastUpdated": now.isoformat(),
        "cycleId": str(run_id) if run_id else "",
        "topStories": cards[:3],
        "feed": cards,
        "clusters": cards,
        "categories": categories,
        "pulse": pulse_history,
        "pulse_history": {"history": pulse_history},
        "exposure": [{"category": card["category"], "exposure_score": card["exposure_score"], "created_at": now.isoformat()} for card in cards],
        "graph": [{"id": card["id"], "title": card["title"], "category": card["category"], "pulse": card["pulse_score"]} for card in cards[:15]],
        "map": map_rows,
        "simulatorContext": [{"id": card["id"], "title": card["title"], "summary": card["summary"], "category": card["category"], "pulse_score": card["pulse_score"]} for card in cards[:10]],
        "topics_used": settings.mvp_categories,
        "regions_used": ["global"],
        "sources_count": len({card["source_name"] for card in cards}),
        "generated_at": now.isoformat(),
        "cached_at": now.isoformat(),
        "refresh_type": "cached_core_v2_snapshot",
        "pipeline_status": pipeline_status,
        "world_pulse": world_pulse,
        "global_pulse": world_pulse,
        "world_pulse_label": label,
        "exposure_score": round(sum(card["exposure_score"] for card in top5) / max(len(top5), 1), 2) if top5 else 50,
        "next_refresh_at": (now + timedelta(minutes=settings.newsintel_ingest_interval_minutes)).isoformat(),
        "quick_glance": [
            {"id": "signals", "label": "Signals Tracked", "value": len(cards), "delta": f"{len(cards)} live", "deltaColor": "#7ee7c4"},
            {"id": "alerts", "label": "High Impact Alerts", "value": critical, "delta": f"{critical} critical" if critical else None, "deltaColor": "#ff9ba9"},
            {"id": "sources", "label": "Sources Monitored", "value": len({card["source_name"] for card in cards}), "delta": "Live", "deltaColor": "#7ee7c4"},
            {"id": "countries", "label": "Countries in Focus", "value": 1, "delta": "1 live", "deltaColor": "#7ee7c4"},
        ],
        "daily_delta": [
            {
                "topic": category,
                "label": category.title(),
                "current": round(sum(card["pulse_score"] for card in categories.get(category, [])) / max(len(categories.get(category, [])), 1), 2) if categories.get(category) else None,
                "previous": None,
                "delta": None,
                "has_baseline": False,
                "direction": "Stable",
                "severity_label": "Stable",
                "reason": f"{len(categories.get(category, []))} live cards",
            }
            for category in settings.mvp_categories
        ],
    }
