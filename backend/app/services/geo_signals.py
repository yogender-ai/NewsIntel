from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.core.cache import cache
from app.models.news import Event, EventArticle
from app.services.dashboard_read_model import ai_metadata, event_source_payloads, pulse_from_event, tier_from_event


COUNTRIES = {
    "IN": {"name": "India", "lat": 20.59, "lng": 78.96, "aliases": ["india", "indian", "delhi", "mumbai", "bengaluru"]},
    "US": {"name": "United States", "lat": 39.83, "lng": -98.58, "aliases": ["united states", "u.s.", "us ", "america", "washington", "new york"]},
    "CN": {"name": "China", "lat": 35.86, "lng": 104.19, "aliases": ["china", "chinese", "beijing", "shanghai", "taiwan"]},
    "TW": {"name": "Taiwan", "lat": 23.7, "lng": 121.0, "aliases": ["taiwan", "taipei"]},
    "JP": {"name": "Japan", "lat": 36.2, "lng": 138.25, "aliases": ["japan", "japanese", "tokyo"]},
    "KR": {"name": "South Korea", "lat": 35.91, "lng": 127.77, "aliases": ["south korea", "korean", "seoul", "samsung"]},
    "GB": {"name": "United Kingdom", "lat": 55.38, "lng": -3.44, "aliases": ["united kingdom", "uk", "britain", "london"]},
    "DE": {"name": "Germany", "lat": 51.17, "lng": 10.45, "aliases": ["germany", "german", "berlin"]},
    "FR": {"name": "France", "lat": 46.23, "lng": 2.21, "aliases": ["france", "french", "paris"]},
    "RU": {"name": "Russia", "lat": 61.52, "lng": 105.32, "aliases": ["russia", "russian", "moscow", "kremlin"]},
    "UA": {"name": "Ukraine", "lat": 48.38, "lng": 31.17, "aliases": ["ukraine", "ukrainian", "kyiv"]},
    "IL": {"name": "Israel", "lat": 31.05, "lng": 34.85, "aliases": ["israel", "israeli", "tel aviv", "gaza"]},
    "SA": {"name": "Saudi Arabia", "lat": 23.89, "lng": 45.08, "aliases": ["saudi", "riyadh"]},
    "BR": {"name": "Brazil", "lat": -14.24, "lng": -51.93, "aliases": ["brazil", "brazilian", "brasilia"]},
}

LAYER_BY_CATEGORY = {
    "politics": "geopolitics",
    "defense": "geopolitics",
    "trade": "geopolitics",
    "markets": "markets",
    "crypto": "markets",
    "tech": "technology",
    "ai": "technology",
    "telecom": "technology",
    "climate": "climate",
    "energy": "energy",
}

LAYERS = ["geopolitics", "markets", "technology", "energy", "climate"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def event_text(event: Event) -> str:
    ai = ai_metadata(event)
    parts = [event.title or "", event.summary or "", ai.get("summary") or "", ai.get("why_it_matters") or ""]
    for entity in ai.get("entities") or []:
        if isinstance(entity, dict):
            parts.append(str(entity.get("name") or ""))
    for link in event.article_links or []:
        parts.extend([link.article.title or "", link.article.text_preview or "", link.article.source or ""])
    return " ".join(parts).lower()


def extract_geo(event: Event) -> dict[str, Any]:
    text = f" {event_text(event)} "
    matches = []
    for code, info in COUNTRIES.items():
        if any(f" {alias.lower()} " in text for alias in info["aliases"]):
            matches.append(code)
    if not matches:
        return {"countries": [], "regions": [], "primary_location": "", "confidence": 0.0}
    confidence = min(0.95, 0.45 + len(matches) * 0.18)
    primary = matches[0]
    return {
        "countries": matches,
        "regions": [COUNTRIES[code]["name"] for code in matches],
        "primary_location": COUNTRIES[primary]["name"],
        "confidence": round(confidence, 2),
    }


def ensure_event_geo(event: Event) -> dict[str, Any]:
    metadata = dict(event.metadata_json or {})
    geo = metadata.get("geo")
    if isinstance(geo, dict) and "countries" in geo:
        return geo
    geo = extract_geo(event)
    metadata["geo"] = geo
    event.metadata_json = metadata
    flag_modified(event, "metadata_json")
    return geo


def risk_label(value: int) -> str:
    if value >= 75:
        return "high"
    if value >= 45:
        return "medium"
    return "low"


def opportunity_label(count: int, avg_pulse: float) -> str:
    if count >= 2 and avg_pulse >= 65:
        return "high"
    if count or avg_pulse >= 45:
        return "medium"
    return "low"


async def build_map_signals(session: AsyncSession, *, layer: str | None = None, time_window: str = "7d") -> dict[str, Any]:
    if layer and layer not in LAYERS:
        layer = None
    hours = {"24h": 24, "7d": 24 * 7, "30d": 24 * 30}.get(time_window, 24 * 7)
    cache_key = f"map-signals:{layer or 'all'}:{time_window}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    cutoff = utcnow() - timedelta(hours=hours)
    stmt = (
        select(Event)
        .options(selectinload(Event.article_links).selectinload(EventArticle.article))
        .where(Event.status == "active")
        .where(Event.last_seen_at >= cutoff)
        .order_by(Event.last_seen_at.desc())
        .limit(120)
    )
    events = (await session.scalars(stmt)).unique().all()
    buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {"events": [], "pulses": [], "risk_count": 0, "opportunity_count": 0})

    for event in events:
        event_layer = LAYER_BY_CATEGORY.get(event.category or "", "geopolitics")
        if layer and event_layer != layer:
            continue
        geo = ensure_event_geo(event)
        countries = geo.get("countries") or []
        if not countries:
            continue
        ai = ai_metadata(event)
        pulse = pulse_from_event(event)
        for code in dict.fromkeys(countries):
            buckets[code]["events"].append(event)
            buckets[code]["pulses"].append(pulse)
            buckets[code]["risk_count"] += 1 if ai.get("risk_level") in {"medium", "high"} else 0
            buckets[code]["opportunity_count"] += 1 if ai.get("opportunity_level") in {"medium", "high"} else 0

    regions = []
    for code, bucket in buckets.items():
        info = COUNTRIES[code]
        pulses = bucket["pulses"]
        avg_pulse = sum(pulses) / max(len(pulses), 1)
        high_impact = sum(1 for pulse in pulses if pulse >= 75)
        top_events = sorted(bucket["events"], key=pulse_from_event, reverse=True)[:5]
        top_event_payloads = []
        for event in top_events:
            ai = ai_metadata(event)
            sources = event_source_payloads(event)
            top_event_payloads.append(
                {
                    "id": str(event.id),
                    "title": event.title,
                    "pulse": pulse_from_event(event),
                    "category": event.category,
                    "signal_tier": tier_from_event(event),
                    "sentiment": ai.get("sentiment"),
                    "why_it_matters": ai.get("why_it_matters"),
                    "summary": ai.get("summary") or event.summary,
                    "sources": sources,
                    "source_url": sources[0]["url"] if sources else None,
                    "updated_at": event.last_seen_at.isoformat(),
                }
            )
        intensity = min(100, round(avg_pulse * 0.7 + min(len(pulses) * 8, 30)))
        regions.append(
            {
                "id": code,
                "name": info["name"],
                "lat": info["lat"],
                "lng": info["lng"],
                "intensity": intensity,
                "risk": risk_label(max(pulses) if pulses else 0),
                "opportunity": opportunity_label(bucket["opportunity_count"], avg_pulse),
                "delta": 0,
                "event_count": len(pulses),
                "avg_pulse": round(avg_pulse, 1),
                "high_impact_count": high_impact,
                "risk_count": bucket["risk_count"],
                "opportunity_count": bucket["opportunity_count"],
                "top_events": top_event_payloads,
            }
        )
    payload = {"updated_at": utcnow().isoformat(), "layers": LAYERS, "regions": sorted(regions, key=lambda item: item["intensity"], reverse=True)}
    await session.commit()
    await cache.set_json(cache_key, payload, ttl_seconds=600)
    return payload
