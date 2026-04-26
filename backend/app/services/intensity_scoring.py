from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm.attributes import flag_modified

from app.models.news import Event


def clamp(value: float, low: float = 0, high: float = 100) -> int:
    return round(max(low, min(high, value)))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def event_articles(event: Event):
    return [link.article for link in event.article_links or []]


def velocity_score(event: Event) -> int:
    articles = event_articles(event)
    now = utcnow()
    recent = [article for article in articles if article.first_seen_at and as_utc(article.first_seen_at) >= now - timedelta(hours=6)]
    return clamp((len(recent) / max(len(articles), 1)) * 65 + min(len(articles) * 8, 35))


def source_acceleration_score(event: Event) -> int:
    articles = event_articles(event)
    now = utcnow()
    last_6h = {article.source for article in articles if article.source and article.first_seen_at and as_utc(article.first_seen_at) >= now - timedelta(hours=6)}
    prev_18h = {
        article.source
        for article in articles
        if article.source and article.first_seen_at and now - timedelta(hours=24) <= as_utc(article.first_seen_at) < now - timedelta(hours=6)
    }
    if not last_6h and not prev_18h:
        return 20
    acceleration = len(last_6h) - len(prev_18h)
    return clamp(45 + acceleration * 18 + len(last_6h) * 6)


def novelty_score(event: Event) -> int:
    articles = event_articles(event)
    if not articles:
        return 50
    seen_values = [as_utc(article.first_seen_at) for article in articles if article.first_seen_at]
    if not seen_values:
        return 50
    first_seen = min(seen_values)
    age_hours = max(0, (utcnow() - first_seen).total_seconds() / 3600)
    return clamp(100 - age_hours * 3)


def entity_emergence_score(event: Event, payload: Any | None) -> int:
    metadata = event.metadata_json or {}
    phase6 = metadata.get("phase6") if isinstance(metadata.get("phase6"), dict) else {}
    previous = set(phase6.get("known_entities") or [])
    current = {entity.name.lower() for entity in payload.entities} if payload else set()
    new_entities = current - previous
    return clamp(35 + len(new_entities) * 18 + min(len(current) * 5, 20))


def historical_anomaly_score(event: Event, preliminary: int) -> int:
    metadata = event.metadata_json or {}
    phase6 = metadata.get("phase6") if isinstance(metadata.get("phase6"), dict) else {}
    history = [float(item.get("score", 0)) for item in phase6.get("intensity_history") or [] if isinstance(item, dict)]
    if len(history) < 3:
        return 50
    average = statistics.mean(history[-12:])
    stdev = statistics.pstdev(history[-12:]) or 1
    z_score = (preliminary - average) / stdev
    return clamp(50 + z_score * 18)


def ai_pressure_score(payload: Any | None) -> int:
    if not payload:
        return 45
    level = {"low": 30, "medium": 62, "high": 88}
    sentiment = {"positive": 4, "neutral": 0, "mixed": 6, "negative": 10}[payload.sentiment]
    return clamp(max(level[payload.risk_level], level[payload.opportunity_level]) + sentiment)


def dynamic_event_intensity(event: Event, payload: Any | None) -> tuple[int, dict[str, Any]]:
    velocity = velocity_score(event)
    acceleration = source_acceleration_score(event)
    novelty = novelty_score(event)
    emergence = entity_emergence_score(event, payload)
    preliminary = clamp(velocity * 0.28 + acceleration * 0.22 + novelty * 0.18 + emergence * 0.16 + ai_pressure_score(payload) * 0.16)
    anomaly = historical_anomaly_score(event, preliminary)
    final = clamp(preliminary * 0.78 + anomaly * 0.22)
    breakdown = {
        "model": "phase6_dynamic_event_intensity_v1",
        "velocity": velocity,
        "source_acceleration": acceleration,
        "novelty": novelty,
        "entity_emergence": emergence,
        "historical_anomaly": anomaly,
        "ai_pressure": ai_pressure_score(payload),
    }
    return final, breakdown


def remember_intensity(event: Event, score: int, payload: Any | None = None) -> None:
    metadata = dict(event.metadata_json or {})
    phase6 = metadata.get("phase6") if isinstance(metadata.get("phase6"), dict) else {}
    history = [item for item in phase6.get("intensity_history") or [] if isinstance(item, dict)]
    history.append({"score": score, "at": datetime.now(timezone.utc).isoformat()})
    phase6["intensity_history"] = history[-30:]
    if payload:
        phase6["known_entities"] = sorted({entity.name.lower() for entity in payload.entities})
    metadata["phase6"] = phase6
    event.metadata_json = metadata
    flag_modified(event, "metadata_json")
