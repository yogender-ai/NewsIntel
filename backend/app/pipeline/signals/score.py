from __future__ import annotations

from datetime import datetime, timezone

from app.pipeline.fetch.sources import SOURCE_WEIGHT
from app.pipeline.types import EnrichedArticle


def _freshness(published_at) -> float:
    if not published_at:
        return 50
    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    hours = max(0.0, (now - published_at.astimezone(timezone.utc)).total_seconds() / 3600)
    if hours < 2:
        return 100
    if hours < 12:
        return 80
    if hours < 24:
        return 50
    if hours < 72:
        return 20
    return 0


def _sentiment_intensity(item: EnrichedArticle) -> float:
    pos = next((row["score"] for row in item.all_scores if row.get("label") == "positive"), None)
    neg = next((row["score"] for row in item.all_scores if row.get("label") == "negative"), None)
    if pos is not None and neg is not None:
        return 100 * abs(pos - neg)
    if item.sentiment_label == "neutral":
        return 40
    return 70


def importance_tier(pulse: float) -> str:
    if pulse >= 75:
        return "CRITICAL"
    if pulse >= 55:
        return "SIGNAL"
    if pulse >= 35:
        return "WATCH"
    return "NOISE"


def score_item(item: EnrichedArticle) -> dict:
    freshness = _freshness(item.article.published_at)
    source_weight = SOURCE_WEIGHT.get(item.article.source_id, 75)
    hf_intensity = _sentiment_intensity(item)
    entity_density = min(100, 20 * len(item.entities))
    llm_importance = item.llm_importance if item.llm_status == "ok" else 50
    pulse = max(
        0,
        min(
            100,
            0.30 * llm_importance
            + 0.25 * freshness
            + 0.20 * source_weight
            + 0.15 * hf_intensity
            + 0.10 * entity_density,
        ),
    )
    exposure = max(
        0,
        min(100, 0.40 * source_weight + 0.30 * freshness + 0.30 * 60),
    )
    return {
        "pulse": round(pulse, 2),
        "exposure": round(exposure, 2),
        "importance": importance_tier(pulse),
        "pulse_breakdown": {
            "freshness": freshness,
            "source_weight": source_weight,
            "hf_sentiment_intensity": round(hf_intensity, 2),
            "llm_importance": llm_importance,
            "entity_density": entity_density,
        },
    }
