import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import hf_client
from app.models.news import Event, EventArticle, EventRelationship, EventRelationshipCheck
from app.services.dashboard_read_model import ai_metadata, pulse_from_event
from app.services.event_enrichment import AI_STATUS_ENRICHED, clean_json_text

logger = logging.getLogger("news-intel-event-relationships")

RELATIONSHIP_TYPES = {
    "causes",
    "correlates",
    "amplifies",
    "reduces",
    "threatens",
    "benefits",
    "follows_up",
    "same_theme",
}


class RelationshipValidation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connected: bool
    relationship_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str
    reason: str

    @field_validator("relationship_type")
    @classmethod
    def known_relationship(cls, value: str) -> str:
        if value not in RELATIONSHIP_TYPES:
            raise ValueError("unknown relationship_type")
        return value


@dataclass(slots=True)
class CandidatePair:
    source: Event
    target: Event
    score: float
    evidence: dict[str, Any]

    @property
    def pair_hash(self) -> str:
        return pair_hash(self.source.id, self.target.id)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def pair_hash(source_id: Any, target_id: Any) -> str:
    ids = sorted([str(source_id), str(target_id)])
    return hashlib.sha256("|".join(ids).encode("utf-8")).hexdigest()


def token_set(value: str | None) -> set[str]:
    text = (value or "").lower()
    return {item for item in re.findall(r"[a-z0-9][a-z0-9\-]{2,}", text) if item not in {"the", "and", "for", "with", "from"}}


def ai_entities(event: Event) -> set[str]:
    ai = ai_metadata(event)
    entities = set()
    for item in ai.get("entities") or []:
        if isinstance(item, dict) and item.get("name"):
            entities.add(str(item["name"]).strip().lower())
    for item in event.entities or []:
        if item:
            entities.add(str(item).strip().lower())
    return {item for item in entities if item}


def story_graph_labels(event: Event) -> set[str]:
    ai = ai_metadata(event)
    graph = ai.get("story_graph_json") if isinstance(ai.get("story_graph_json"), dict) else {}
    labels = set()
    for node in graph.get("nodes") or []:
        if isinstance(node, dict):
            labels |= token_set(node.get("label"))
            if node.get("type"):
                labels.add(str(node["type"]).lower())
    for edge in graph.get("edges") or []:
        if isinstance(edge, dict):
            labels |= token_set(edge.get("label"))
    generic = {"event", "impact", "trigger", "signal", "global", "changes", "change"}
    return labels - generic


def source_fingerprints(event: Event) -> set[str]:
    fingerprints = set()
    for link in event.article_links or []:
        article = link.article
        if article.source:
            fingerprints.add(article.source.strip().lower())
        fingerprints |= {token for token in token_set(article.title) if len(token) >= 5}
    return fingerprints


def event_features(event: Event) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "title": event.title,
        "category": event.category,
        "region": event.region,
        "pulse": pulse_from_event(event),
        "entities": ai_entities(event),
        "story_tokens": story_graph_labels(event),
        "source_tokens": source_fingerprints(event),
        "title_tokens": token_set(event.title),
        "last_seen_at": as_utc(event.last_seen_at),
    }


def pair_candidate(source: Event, target: Event) -> CandidatePair | None:
    left = event_features(source)
    right = event_features(target)
    reasons: list[str] = []
    score = 0.0

    shared_entities = sorted(left["entities"] & right["entities"])
    if shared_entities:
        score += min(len(shared_entities) * 3.0, 6.0)
        reasons.append(f"shared entities: {', '.join(shared_entities[:5])}")
    if left["category"] and left["category"] == right["category"]:
        score += 2.0
        reasons.append(f"shared category: {left['category']}")
    if left["region"] and right["region"] and left["region"] == right["region"] and left["region"] != "global":
        score += 1.0
        reasons.append(f"shared geography: {left['region']}")

    story_overlap = sorted(left["story_tokens"] & right["story_tokens"])
    if story_overlap:
        score += min(len(story_overlap) * 0.7, 3.0)
        reasons.append(f"story graph overlap: {', '.join(story_overlap[:6])}")

    source_overlap = sorted(left["source_tokens"] & right["source_tokens"])
    if source_overlap:
        score += min(len(source_overlap) * 0.35, 2.0)
        reasons.append(f"source/title evidence overlap: {', '.join(source_overlap[:6])}")

    title_overlap = sorted(left["title_tokens"] & right["title_tokens"])
    if len(title_overlap) >= 2:
        score += min(len(title_overlap) * 0.35, 1.5)
        reasons.append(f"title overlap: {', '.join(title_overlap[:6])}")

    left_time = left["last_seen_at"]
    right_time = right["last_seen_at"]
    if left_time and right_time:
        hours_apart = abs((left_time - right_time).total_seconds()) / 3600
        if hours_apart <= 72:
            score += 1.0
            reasons.append(f"time sequence within {round(hours_apart)}h")

    strong_overlap = bool(shared_entities or (left["category"] and left["category"] == right["category"] and (story_overlap or source_overlap or len(title_overlap) >= 2)))
    if score < 3.0 or not strong_overlap:
        return None

    evidence = {
        "candidate_score": round(score, 2),
        "reasons": reasons,
        "source": compact_event_for_relationship(source),
        "target": compact_event_for_relationship(target),
    }
    return CandidatePair(source=source, target=target, score=score, evidence=evidence)


def compact_event_for_relationship(event: Event) -> dict[str, Any]:
    ai = ai_metadata(event)
    articles = []
    for link in sorted(event.article_links or [], key=lambda item: item.article.published_at or item.article.first_seen_at, reverse=True):
        article = link.article
        articles.append(
            {
                "title": article.title,
                "source": article.source,
                "snippet": (article.text_preview or "")[:280],
                "published_at": article.published_at.isoformat() if article.published_at else None,
            }
        )
    return {
        "id": str(event.id),
        "title": event.title,
        "category": event.category,
        "region": event.region,
        "pulse_score": pulse_from_event(event),
        "summary": ai.get("summary") or event.summary,
        "why_it_matters": ai.get("why_it_matters"),
        "entities": ai.get("entities") or event.entities or [],
        "story_graph": ai.get("story_graph_json"),
        "articles": articles[:4],
    }


def build_relationship_prompt(candidate: CandidatePair) -> str:
    return f"""You are NewsIntel's cross-event relationship validator.

Question: Are these events meaningfully connected?

Return ONLY strict JSON. No markdown, no comments, no extra keys.

CANDIDATE EVIDENCE:
{json.dumps(candidate.evidence, ensure_ascii=True, separators=(",", ":"))}

JSON schema:
{{
  "connected": true,
  "relationship_type": "causes|correlates|amplifies|reduces|threatens|benefits|follows_up|same_theme",
  "confidence": 0.0,
  "evidence": "short source-grounded explanation",
  "reason": "short validation rationale"
}}

Rules:
- Use only the supplied evidence.
- Return connected=false if the connection is weak, generic, or only shares a broad topic.
- Do not invent causal links.
- Confidence above 0.75 requires direct shared entities plus source/story evidence.
"""


def parse_relationship_validation(raw: str) -> RelationshipValidation:
    return RelationshipValidation.model_validate(json.loads(clean_json_text(raw)))


def is_user_relevant(event: Event, topics: list[str] | None = None, pulse_threshold: int = 58) -> bool:
    if pulse_from_event(event) >= pulse_threshold:
        return True
    return bool(topics and event.category in topics)


class EventRelationshipService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def select_active_events(self, topics: list[str] | None = None, limit: int = 80) -> list[Event]:
        cutoff = utcnow() - timedelta(days=14)
        stmt = (
            select(Event)
            .options(selectinload(Event.article_links).selectinload(EventArticle.article))
            .where(Event.status == "active")
            .where(Event.last_seen_at >= cutoff)
            .order_by(Event.last_seen_at.desc(), Event.source_count.desc())
            .limit(limit)
        )
        events = (await self.session.scalars(stmt)).unique().all()
        return [event for event in events if is_user_relevant(event, topics)]

    async def already_checked_hashes(self, hashes: set[str]) -> set[str]:
        if not hashes:
            return set()
        check_rows = await self.session.scalars(
            select(EventRelationshipCheck.pair_hash).where(EventRelationshipCheck.pair_hash.in_(hashes))
        )
        relationship_rows = await self.session.scalars(
            select(EventRelationship.pair_hash).where(EventRelationship.pair_hash.in_(hashes))
        )
        return set(check_rows.all()) | set(relationship_rows.all())

    async def select_candidate_pairs(
        self,
        topics: list[str] | None = None,
        max_checks: int = 20,
    ) -> list[CandidatePair]:
        events = await self.select_active_events(topics)
        candidates = [candidate for left, right in combinations(events, 2) if (candidate := pair_candidate(left, right))]
        candidates.sort(key=lambda item: (item.score, pulse_from_event(item.source) + pulse_from_event(item.target)), reverse=True)
        hashes = {item.pair_hash for item in candidates}
        checked = await self.already_checked_hashes(hashes)
        return [item for item in candidates if item.pair_hash not in checked][:max_checks]

    async def build_relationships(
        self,
        topics: list[str] | None = None,
        max_checks: int = 20,
    ) -> dict[str, Any]:
        candidates = await self.select_candidate_pairs(topics=topics, max_checks=max_checks)
        connected = 0
        disconnected = 0
        failed = 0
        for candidate in candidates:
            status = await self.validate_candidate(candidate)
            if status == "connected":
                connected += 1
            elif status == "disconnected":
                disconnected += 1
            else:
                failed += 1
        await self.session.commit()
        return {
            "selected": len(candidates),
            "connected": connected,
            "disconnected": disconnected,
            "failed": failed,
            "max_per_run": max_checks,
        }

    async def validate_candidate(self, candidate: CandidatePair) -> str:
        validation: RelationshipValidation | None = None
        raw_text = ""
        prompt = build_relationship_prompt(candidate)
        try:
            raw_text = await hf_client._call_openrouter(prompt, model="openrouter/auto")
            if not raw_text:
                raw_text = await hf_client._call_gemini(prompt)
            validation = parse_relationship_validation(raw_text)
        except (json.JSONDecodeError, ValidationError, TypeError) as exc:
            logger.warning("invalid relationship JSON pair=%s error=%s", candidate.pair_hash, exc)
            await self.record_check(candidate, "failed", "invalid_ai_json")
            return "failed"

        if not validation.connected or validation.confidence < 0.35:
            await self.record_check(candidate, "disconnected", validation.reason[:500])
            return "disconnected"

        await self.upsert_relationship(candidate, validation)
        await self.record_check(candidate, "connected", validation.reason[:500])
        return "connected"

    async def record_check(self, candidate: CandidatePair, status: str, reason: str | None = None) -> None:
        existing = await self.session.scalar(
            select(EventRelationshipCheck).where(EventRelationshipCheck.pair_hash == candidate.pair_hash)
        )
        if existing:
            existing.status = status
            existing.candidate_score = candidate.score
            existing.reason = reason
            return
        self.session.add(
            EventRelationshipCheck(
                pair_hash=candidate.pair_hash,
                source_event_id=candidate.source.id,
                target_event_id=candidate.target.id,
                candidate_score=candidate.score,
                status=status,
                reason=reason,
            )
        )

    async def upsert_relationship(self, candidate: CandidatePair, validation: RelationshipValidation) -> None:
        existing = await self.session.scalar(
            select(EventRelationship).where(EventRelationship.pair_hash == candidate.pair_hash)
        )
        source, target = ordered_relationship_events(candidate.source, candidate.target, validation.relationship_type)
        evidence = validation.evidence.strip()[:1200]
        if existing:
            existing.source_event_id = source.id
            existing.target_event_id = target.id
            existing.relationship_type = validation.relationship_type
            existing.confidence = validation.confidence
            existing.evidence = evidence
            return
        self.session.add(
            EventRelationship(
                pair_hash=candidate.pair_hash,
                source_event_id=source.id,
                target_event_id=target.id,
                relationship_type=validation.relationship_type,
                confidence=validation.confidence,
                evidence=evidence,
            )
        )


def ordered_relationship_events(source: Event, target: Event, relationship_type: str) -> tuple[Event, Event]:
    directional = {"causes", "amplifies", "reduces", "threatens", "benefits", "follows_up"}
    if relationship_type not in directional:
        return source, target
    source_time = as_utc(source.first_seen_at) or as_utc(source.last_seen_at) or utcnow()
    target_time = as_utc(target.first_seen_at) or as_utc(target.last_seen_at) or utcnow()
    if relationship_type == "follows_up":
        return (target, source) if source_time >= target_time else (source, target)
    return (source, target) if source_time <= target_time else (target, source)


async def load_orbit_payload(
    session: AsyncSession,
    *,
    user_id: str,
    display_name: str | None = None,
    topics: list[str] | None = None,
    regions: list[str] | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    cutoff = utcnow() - timedelta(days=14)
    stmt = (
        select(Event)
        .options(selectinload(Event.article_links).selectinload(EventArticle.article))
        .where(Event.status == "active")
        .where(Event.last_seen_at >= cutoff)
        .order_by(Event.last_seen_at.desc())
        .limit(80)
    )
    events = (await session.scalars(stmt)).unique().all()
    ranked = sorted(events, key=lambda event: (exposure_for_event(event, topics, regions), pulse_from_event(event)), reverse=True)[:limit]
    event_ids = {event.id for event in ranked}

    relationship_stmt = (
        select(EventRelationship)
        .where(or_(EventRelationship.source_event_id.in_(event_ids), EventRelationship.target_event_id.in_(event_ids)))
        .where(EventRelationship.confidence >= 0.35)
        .order_by(EventRelationship.confidence.desc())
    )
    relationships = (await session.scalars(relationship_stmt)).all() if event_ids else []
    nodes = [orbit_node(event, topics, regions) for event in ranked]
    node_ids = {node["id"] for node in nodes}
    edges = [
        {
            "from": str(edge.source_event_id),
            "to": str(edge.target_event_id),
            "type": edge.relationship_type,
            "confidence": round(edge.confidence, 3),
            "evidence": edge.evidence,
        }
        for edge in relationships
        if str(edge.source_event_id) in node_ids and str(edge.target_event_id) in node_ids
    ]
    return {
        "center": {
            "id": user_id,
            "label": display_name or "You",
            "topics": topics or [],
            "regions": regions or [],
        },
        "nodes": nodes,
        "edges": edges,
        "generated_at": utcnow().isoformat(),
    }


def exposure_for_event(event: Event, topics: list[str] | None = None, regions: list[str] | None = None) -> int:
    score = 50
    if topics and event.category in topics:
        score += 25
    if regions:
        if "global" in regions:
            score += 10
        elif event.region in regions:
            score += 15
    score += min(len(ai_entities(event)) * 2, 10)
    return max(1, min(100, score))


def orbit_node(event: Event, topics: list[str] | None = None, regions: list[str] | None = None) -> dict[str, Any]:
    ai = ai_metadata(event)
    pulse = pulse_from_event(event)
    exposure = exposure_for_event(event, topics, regions)
    distance = round(1 - (exposure / 100), 3)
    delta = 0
    breakdown = ai.get("pulse_breakdown") if isinstance(ai.get("pulse_breakdown"), dict) else {}
    if isinstance(breakdown.get("delta"), int | float):
        delta = breakdown["delta"]
    status = "rising" if delta > 0 else "cooling" if delta < 0 else "stable"
    return {
        "id": str(event.id),
        "label": event.title,
        "category": event.category or "general",
        "pulse": pulse,
        "exposure": exposure,
        "distance": distance,
        "size": max(10, min(34, round(10 + pulse * 0.24))),
        "status": status,
        "ai_status": ai.get("status") or "pending",
        "why_it_matters": ai.get("why_it_matters") or "Impact is still being confirmed across sources.",
        "updated_at": event.last_seen_at.isoformat(),
    }
