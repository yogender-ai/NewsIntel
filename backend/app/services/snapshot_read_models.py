from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from itertools import combinations
from typing import Any


GEO_LOCATIONS = {
    "IN": {
        "name": "India",
        "lat": 20.59,
        "lng": 78.96,
        "aliases": ["india", "indian", "delhi", "mumbai", "bengaluru", "vizag", "visakhapatnam"],
    },
    "US": {
        "name": "United States",
        "lat": 39.83,
        "lng": -98.58,
        "aliases": ["united states", "u.s.", "us", "america", "washington", "new york"],
    },
    "EU": {
        "name": "Europe",
        "lat": 54.52,
        "lng": 15.26,
        "aliases": ["europe", "european", "eu"],
    },
    "CN": {"name": "China", "lat": 35.86, "lng": 104.19, "aliases": ["china", "chinese", "beijing", "shanghai"]},
    "TW": {"name": "Taiwan", "lat": 23.7, "lng": 121.0, "aliases": ["taiwan", "taipei"]},
    "JP": {"name": "Japan", "lat": 36.2, "lng": 138.25, "aliases": ["japan", "japanese", "tokyo"]},
    "VN": {"name": "Vietnam", "lat": 14.06, "lng": 108.28, "aliases": ["vietnam", "vietnamese", "hanoi"]},
    "KR": {"name": "South Korea", "lat": 35.91, "lng": 127.77, "aliases": ["south korea", "korean", "seoul", "samsung"]},
    "GB": {"name": "United Kingdom", "lat": 55.38, "lng": -3.44, "aliases": ["united kingdom", "uk", "britain", "london"]},
    "DE": {"name": "Germany", "lat": 51.17, "lng": 10.45, "aliases": ["germany", "german", "berlin"]},
    "FR": {"name": "France", "lat": 46.23, "lng": 2.21, "aliases": ["france", "french", "paris"]},
    "RU": {"name": "Russia", "lat": 61.52, "lng": 105.32, "aliases": ["russia", "russian", "moscow", "kremlin"]},
    "UA": {"name": "Ukraine", "lat": 48.38, "lng": 31.17, "aliases": ["ukraine", "ukrainian", "kyiv"]},
    "IL": {"name": "Israel", "lat": 31.05, "lng": 34.85, "aliases": ["israel", "israeli", "tel aviv", "gaza"]},
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
    "education": "technology",
    "entertainment": "technology",
    "climate": "climate",
    "energy": "energy",
}

LAYERS = ["geopolitics", "markets", "technology", "energy", "climate"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def compact_label(value: str | None) -> str:
    return str(value or "").strip().lower()


def source_rows(card: dict[str, Any]) -> list[dict[str, Any]]:
    rows = card.get("sources") if isinstance(card.get("sources"), list) else []
    return [row for row in rows if isinstance(row, dict)]


def card_id(card: dict[str, Any], index: int = 0) -> str:
    return str(card.get("signal_id") or card.get("thread_id") or card.get("id") or f"snapshot-card-{index}")


def snapshot_cards(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("clusters", "feed", "topStories"):
        rows = snapshot.get(key)
        if isinstance(rows, list) and rows:
            return [row for row in rows if isinstance(row, dict)]
    return []


def pulse(card: dict[str, Any]) -> float:
    value = card.get("pulse_score") or card.get("pulse") or 0
    try:
        return max(0.0, min(100.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def exposure(card: dict[str, Any], topics: list[str] | None = None, regions: list[str] | None = None) -> int:
    score = float(card.get("exposure_score") or card.get("relevance_score") or 50)
    category = compact_label(card.get("category"))
    if topics and category in {compact_label(item) for item in topics}:
        score += 10
    if regions and "global" in {compact_label(item) for item in regions}:
        score += 5
    return max(1, min(100, round(score)))


def entities(card: dict[str, Any]) -> set[str]:
    values: set[str] = set()
    for item in card.get("entities") or []:
        if isinstance(item, dict):
            item = item.get("name")
        text = compact_label(item)
        if text:
            values.add(text)
    return values


def title_tokens(card: dict[str, Any]) -> set[str]:
    text = f"{card.get('thread_title') or card.get('title') or ''} {card.get('summary') or ''}".lower()
    stop = {"the", "and", "for", "with", "from", "into", "that", "this", "are", "its", "will"}
    return {item for item in re.findall(r"[a-z0-9][a-z0-9\-]{2,}", text) if item not in stop}


def risk_level(card: dict[str, Any]) -> str:
    risk = compact_label(card.get("risk_level"))
    tier = compact_label(card.get("signal_tier"))
    if risk in {"high", "critical"} or tier == "critical" or pulse(card) >= 75:
        return "high"
    if risk == "medium" or tier == "signal" or pulse(card) >= 55:
        return "medium"
    return "low"


def opportunity_level(card: dict[str, Any]) -> str:
    level = compact_label(card.get("opportunity_level"))
    if level in {"high", "medium", "low"}:
        return level
    sentiment = compact_label(card.get("sentiment"))
    if sentiment in {"positive", "mixed"} and pulse(card) >= 55:
        return "medium"
    return "low"


def build_snapshot_orbit_payload(
    snapshot: dict[str, Any],
    *,
    user_id: str,
    display_name: str = "You",
    topics: list[str] | None = None,
    regions: list[str] | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    cards = snapshot_cards(snapshot)
    ranked = sorted(cards, key=lambda card: (exposure(card, topics, regions), pulse(card)), reverse=True)[:limit]
    nodes = [orbit_node(card, index, topics, regions) for index, card in enumerate(ranked)]
    node_ids = {node["id"] for node in nodes}
    cards_by_id = {card_id(card, index): card for index, card in enumerate(ranked)}
    edges = [
        edge
        for left, right in combinations(nodes, 2)
        if (edge := orbit_edge(cards_by_id.get(left["id"], {}), cards_by_id.get(right["id"], {}), left["id"], right["id"]))
    ]
    return {
        "center": {"id": user_id, "label": display_name or "You", "topics": topics or [], "regions": regions or []},
        "nodes": [node for node in nodes if node["id"] in node_ids],
        "edges": sorted(edges, key=lambda item: item["confidence"], reverse=True)[: max(0, limit * 2)],
        "generated_at": utcnow().isoformat(),
        "source_of_truth": "home_snapshots,stories,event_metrics",
    }


def orbit_node(card: dict[str, Any], index: int, topics: list[str] | None, regions: list[str] | None) -> dict[str, Any]:
    exp = exposure(card, topics, regions)
    value = pulse(card)
    sources = source_rows(card)
    return {
        "id": card_id(card, index),
        "label": card.get("thread_title") or card.get("title") or "Live signal",
        "title": card.get("thread_title") or card.get("title") or "Live signal",
        "summary": card.get("summary") or "",
        "category": compact_label(card.get("category")) or "general",
        "pulse": round(value),
        "exposure": exp,
        "distance": round(1 - (exp / 100), 3),
        "size": max(24, min(76, round(42 + value * 0.28))),
        "status": status_from_card(card),
        "ai_status": card.get("ai_status") or "enriched",
        "signal_tier": card.get("signal_tier"),
        "sentiment": card.get("sentiment"),
        "risk_level": card.get("risk_level"),
        "opportunity_level": card.get("opportunity_level"),
        "entities": sorted(entities(card)),
        "sources": sources,
        "source_url": sources[0].get("url") if sources else card.get("source_url"),
        "source": sources[0].get("source") if sources else card.get("source"),
        "why_it_matters": card.get("why_it_matters") or card.get("impact_line") or "",
        "updated_at": card.get("updated_at") or card.get("last_seen_at") or snapshot_time(card),
    }


def status_from_card(card: dict[str, Any]) -> str:
    breakdown = card.get("pulse_breakdown") if isinstance(card.get("pulse_breakdown"), dict) else {}
    delta = breakdown.get("delta")
    if isinstance(delta, (int, float)):
        if delta > 0:
            return "rising"
        if delta < 0:
            return "cooling"
    tier = compact_label(card.get("signal_tier"))
    if tier in {"critical", "signal"}:
        return "rising"
    return "stable"


def snapshot_time(card: dict[str, Any]) -> str:
    return card.get("generated_at") or utcnow().isoformat()


def orbit_edge(left: dict[str, Any], right: dict[str, Any], left_id: str, right_id: str) -> dict[str, Any] | None:
    reasons: list[str] = []
    confidence = 0.0
    left_category = compact_label(left.get("category"))
    right_category = compact_label(right.get("category"))
    shared_entities = sorted(entities(left) & entities(right))
    shared_tokens = sorted(title_tokens(left) & title_tokens(right))
    shared_sources = {
        compact_label(source.get("source"))
        for source in source_rows(left)
        if source.get("source")
    } & {
        compact_label(source.get("source"))
        for source in source_rows(right)
        if source.get("source")
    }

    if shared_entities:
        confidence += min(0.28 + len(shared_entities) * 0.08, 0.58)
        reasons.append(f"shared entities: {', '.join(shared_entities[:3])}")
    if left_category and left_category == right_category:
        confidence += 0.24
        reasons.append(f"same category: {left_category}")
    if len(shared_tokens) >= 2:
        confidence += min(0.12 + len(shared_tokens) * 0.03, 0.24)
        reasons.append(f"title overlap: {', '.join(shared_tokens[:4])}")
    if shared_sources:
        confidence += 0.08
        reasons.append(f"shared source: {', '.join(sorted(shared_sources)[:2])}")

    if confidence < 0.35 or not reasons:
        return None
    relation = "same_theme"
    if shared_entities and left_category == right_category:
        relation = "correlates"
    return {
        "from": left_id,
        "to": right_id,
        "type": relation,
        "confidence": round(min(confidence, 0.92), 3),
        "evidence": "; ".join(reasons),
    }


def build_snapshot_map_signals(snapshot: dict[str, Any], *, layer: str | None = None, time_window: str = "7d") -> dict[str, Any]:
    selected_layer = layer if layer in LAYERS else None
    buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {"cards": [], "pulses": []})
    for card in snapshot_cards(snapshot):
        card_layer = LAYER_BY_CATEGORY.get(compact_label(card.get("category")), "geopolitics")
        if selected_layer and card_layer != selected_layer:
            continue
        for code in locate_card(card):
            buckets[code]["cards"].append(card)
            buckets[code]["pulses"].append(pulse(card))

    regions = []
    for code, bucket in buckets.items():
        info = GEO_LOCATIONS[code]
        pulses = bucket["pulses"]
        avg_pulse = sum(pulses) / max(len(pulses), 1)
        top_cards = sorted(bucket["cards"], key=pulse, reverse=True)[:5]
        intensity = min(100, round(avg_pulse * 0.72 + min(len(pulses) * 8, 28)))
        regions.append(
            {
                "id": code,
                "name": info["name"],
                "lat": info["lat"],
                "lng": info["lng"],
                "intensity": intensity,
                "risk": risk_label(max(pulses) if pulses else 0),
                "opportunity": opportunity_label(top_cards),
                "delta": 0,
                "event_count": len(pulses),
                "avg_pulse": round(avg_pulse, 1),
                "high_impact_count": sum(1 for value in pulses if value >= 75),
                "risk_count": sum(1 for item in top_cards if risk_level(item) in {"medium", "high"}),
                "opportunity_count": sum(1 for item in top_cards if opportunity_level(item) in {"medium", "high"}),
                "top_events": [map_event_payload(card, index) for index, card in enumerate(top_cards)],
            }
        )
    return {
        "updated_at": utcnow().isoformat(),
        "time_window": time_window,
        "layers": LAYERS,
        "regions": sorted(regions, key=lambda item: item["intensity"], reverse=True),
        "source_of_truth": "home_snapshots,stories,event_metrics",
    }


def locate_card(card: dict[str, Any]) -> list[str]:
    text_parts = [
        card.get("thread_title") or card.get("title") or "",
        card.get("summary") or "",
        card.get("why_it_matters") or card.get("impact_line") or "",
        " ".join(entities(card)),
    ]
    for source in source_rows(card):
        text_parts.extend([source.get("title") or "", source.get("source") or ""])
    text = f" {' '.join(text_parts).lower()} "
    matches = []
    for code, info in GEO_LOCATIONS.items():
        for alias in info["aliases"]:
            pattern = rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])"
            if re.search(pattern, text):
                matches.append(code)
                break
    return list(dict.fromkeys(matches))


def risk_label(value: float) -> str:
    if value >= 75:
        return "high"
    if value >= 45:
        return "medium"
    return "low"


def opportunity_label(cards: list[dict[str, Any]]) -> str:
    if any(opportunity_level(card) == "high" for card in cards):
        return "high"
    if any(opportunity_level(card) == "medium" for card in cards) or len(cards) >= 2:
        return "medium"
    return "low"


def map_event_payload(card: dict[str, Any], index: int) -> dict[str, Any]:
    sources = source_rows(card)
    return {
        "id": card_id(card, index),
        "title": card.get("thread_title") or card.get("title") or "Live signal",
        "pulse": round(pulse(card)),
        "category": compact_label(card.get("category")),
        "signal_tier": card.get("signal_tier"),
        "sentiment": card.get("sentiment"),
        "why_it_matters": card.get("why_it_matters") or card.get("impact_line") or "",
        "summary": card.get("summary") or "",
        "sources": sources,
        "source_url": sources[0].get("url") if sources else card.get("source_url"),
        "updated_at": card.get("updated_at") or card.get("last_seen_at") or utcnow().isoformat(),
    }
