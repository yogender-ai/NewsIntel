import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

import hf_client
from app.core.config import get_settings
from app.models.news import Event, EventArticle
from app.services.intensity_scoring import dynamic_event_intensity, remember_intensity

logger = logging.getLogger("news-intel-event-enrichment")

AI_STATUS_PENDING = "pending"
AI_STATUS_ENRICHED = "enriched"
AI_STATUS_FAILED = "failed"


class AIEntity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    type: Literal["company", "country", "person", "sector", "asset"]


class StoryNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    type: str = Field(min_length=1)


class StoryEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_: str = Field(alias="from", min_length=1)
    to: str = Field(min_length=1)
    label: str = Field(min_length=1)


class StoryGraph(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[StoryNode]
    edges: list[StoryEdge]


class EventEnrichmentPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1)
    impact_line: str = Field(min_length=1)
    why_it_matters: str = Field(min_length=1)
    sentiment: Literal["positive", "neutral", "negative", "mixed"]
    entities: list[AIEntity]
    risk_level: Literal["low", "medium", "high"]
    opportunity_level: Literal["low", "medium", "high"]
    story_graph: StoryGraph
    confidence_explanation: str = Field(min_length=1)
    uncertainty: str = Field(min_length=1)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def event_ai_metadata(event: Event) -> dict[str, Any]:
    metadata = event.metadata_json or {}
    ai = metadata.get("ai")
    if not isinstance(ai, dict):
        ai = {"status": AI_STATUS_PENDING}
        metadata["ai"] = ai
    return ai


def set_event_ai_metadata(event: Event, ai: dict[str, Any]) -> None:
    metadata = dict(event.metadata_json or {})
    metadata["ai"] = ai
    event.metadata_json = metadata
    flag_modified(event, "metadata_json")


def mark_event_pending(event: Event, reason: str = "event_created_or_updated") -> None:
    ai = dict(event_ai_metadata(event))
    ai["status"] = AI_STATUS_PENDING
    ai["pending_reason"] = reason
    set_event_ai_metadata(event, ai)


def compact_event_evidence(event: Event) -> dict[str, Any]:
    articles = []
    for link in sorted(event.article_links, key=lambda item: item.article.published_at or item.article.first_seen_at, reverse=True):
        article = link.article
        articles.append(
            {
                "title": article.title,
                "source": article.source,
                "published_at": article.published_at.isoformat() if article.published_at else None,
                "snippet": (article.text_preview or "")[:500],
                "url": article.canonical_url,
            }
        )
    return {
        "event_title": event.title,
        "category": event.category,
        "region": event.region,
        "source_count": event.source_count,
        "articles": articles[:8],
    }


def evidence_hash(evidence: dict[str, Any]) -> str:
    raw = json.dumps(evidence, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def deterministic_base_score(event: Event) -> tuple[int, dict[str, int]]:
    age_hours = max(0.0, (utcnow() - as_utc(event.last_seen_at)).total_seconds() / 3600)
    freshness = max(0, 35 - int(age_hours * 2))
    source_count = min(event.source_count * 12, 35)
    confidence = int(event.confidence_score * 30)
    base = max(1, min(100, freshness + source_count + confidence))
    return base, {
        "freshness": freshness,
        "source_count": source_count,
        "confidence": confidence,
    }


def ai_importance_score(payload: EventEnrichmentPayload | None) -> int:
    if payload is None:
        return 0
    level_score = {"low": 25, "medium": 58, "high": 90}
    sentiment_adjustment = {
        "negative": 8,
        "mixed": 5,
        "positive": 4,
        "neutral": 0,
    }[payload.sentiment]
    entity_adjustment = min(len(payload.entities) * 2, 8)
    return max(
        1,
        min(
            100,
            max(level_score[payload.risk_level], level_score[payload.opportunity_level])
            + sentiment_adjustment
            + entity_adjustment,
        ),
    )


def hybrid_pulse_score(event: Event, payload: EventEnrichmentPayload | None, user_relevance: int = 50) -> tuple[int, dict[str, int]]:
    score, breakdown = dynamic_event_intensity(event, payload)
    breakdown["user_relevance"] = user_relevance
    return score, breakdown


def hybrid_signal_tier(event: Event, payload: EventEnrichmentPayload | None, pulse: int) -> str:
    high_ai_pressure = bool(payload and (payload.risk_level == "high" or payload.opportunity_level == "high"))
    medium_ai_pressure = bool(payload and (payload.risk_level == "medium" or payload.opportunity_level == "medium"))
    if pulse >= 78 and event.confidence_score >= 0.68 and event.source_count >= 3 and high_ai_pressure:
        return "CRITICAL"
    if pulse >= 58 and (event.source_count >= 2 or medium_ai_pressure or high_ai_pressure):
        return "SIGNAL"
    if event.confidence_score < 0.55 or event.source_count <= 1:
        return "WATCH"
    return "NOISE"


def should_enrich_event(event: Event, topics: list[str] | None = None) -> bool:
    ai = event_ai_metadata(event)
    current_hash = evidence_hash(compact_event_evidence(event))
    if ai.get("evidence_hash") == current_hash:
        return False

    status = ai.get("status") or AI_STATUS_PENDING
    enriched_at = as_utc(parse_datetime(ai.get("enriched_at")))
    stale_cutoff = utcnow() - timedelta(hours=get_settings().ai_enrichment_stale_hours)
    high_source_count = event.source_count >= 3
    high_user_relevance = bool(topics and event.category in topics)
    return (
        status in {AI_STATUS_PENDING, AI_STATUS_FAILED}
        or not ai.get("evidence_hash")
        or (enriched_at is not None and enriched_at <= stale_cutoff)
        or high_source_count
        or high_user_relevance
    )


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def build_prompt(evidence: dict[str, Any]) -> str:
    return f"""You are NewsIntel's event enrichment engine. Analyze only the supplied event evidence.

Return ONLY strict JSON. No markdown, no comments, no extra keys.

EVENT EVIDENCE:
{json.dumps(evidence, ensure_ascii=True, separators=(",", ":"))}

JSON schema:
{{
  "summary": "...",
  "impact_line": "...",
  "why_it_matters": "...",
  "sentiment": "positive|neutral|negative|mixed",
  "entities": [
    {{"name": "...", "type": "company|country|person|sector|asset"}}
  ],
  "risk_level": "low|medium|high",
  "opportunity_level": "low|medium|high",
  "story_graph": {{
    "nodes": [
      {{"id": "event", "label": "...", "type": "trigger"}},
      {{"id": "impact", "label": "...", "type": "impact"}},
      {{"id": "exposure", "label": "...", "type": "user_exposure"}}
    ],
    "edges": [
      {{"from": "event", "to": "impact", "label": "causes"}}
    ]
  }},
  "confidence_explanation": "...",
  "uncertainty": "..."
}}

Rules:
- Use only evidence provided.
- Do not invent source names, article titles, numbers, or facts.
- Keep each text field concise and decision-useful.
- If evidence is weak, say that in uncertainty and use low risk/opportunity.
"""


def clean_json_text(raw: str) -> str:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    return text.strip()


def parse_ai_payload(raw: str) -> EventEnrichmentPayload:
    parsed = json.loads(clean_json_text(raw))
    return EventEnrichmentPayload.model_validate(parsed)


class EventEnrichmentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()

    async def select_candidates(
        self,
        event_ids: list[Any] | None = None,
        topics: list[str] | None = None,
        limit: int | None = None,
    ) -> list[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.article_links).selectinload(EventArticle.article))
            .where(Event.status == "active")
            .order_by(Event.source_count.desc(), Event.last_seen_at.desc())
            .limit(max(limit or self.settings.ai_enrichment_max_events_per_run, 1) * 3)
        )
        if event_ids:
            stmt = stmt.where(Event.id.in_(event_ids))
        events = (await self.session.scalars(stmt)).unique().all()
        candidates = [event for event in events if should_enrich_event(event, topics)]
        return candidates[: limit or self.settings.ai_enrichment_max_events_per_run]

    async def enrich_candidates(
        self,
        event_ids: list[Any] | None = None,
        topics: list[str] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        candidates = await self.select_candidates(event_ids=event_ids, topics=topics, limit=limit)
        enriched = 0
        failed = 0
        skipped = 0
        for event in candidates:
            result = await self.enrich_event(event, topics=topics)
            enriched += 1 if result == AI_STATUS_ENRICHED else 0
            failed += 1 if result == AI_STATUS_FAILED else 0
            skipped += 1 if result == "skipped" else 0
        await self.session.commit()
        return {
            "selected": len(candidates),
            "enriched": enriched,
            "failed": failed,
            "skipped": skipped,
            "max_per_run": limit or self.settings.ai_enrichment_max_events_per_run,
        }

    async def enrich_event(self, event: Event, topics: list[str] | None = None) -> str:
        evidence = compact_event_evidence(event)
        current_hash = evidence_hash(evidence)
        ai = dict(event_ai_metadata(event))
        if ai.get("evidence_hash") == current_hash:
            return "skipped"

        ai.update(
            {
                "status": AI_STATUS_PENDING,
                "evidence_hash": current_hash,
                "provider_used": "cloud-command-gateway/openrouter",
            }
        )
        set_event_ai_metadata(event, ai)
        await self.session.flush()

        raw_text = ""
        provider_used = "cloud-command-gateway/openrouter"
        prompt = build_prompt(evidence)
        for attempt in range(2):
            raw_text = await hf_client._call_openrouter(prompt, model="openrouter/auto")
            if not raw_text:
                provider_used = "cloud-command-gateway/gemini"
                raw_text = await hf_client._call_gemini(prompt)
            try:
                payload = parse_ai_payload(raw_text)
                pulse, breakdown = hybrid_pulse_score(
                    event,
                    payload,
                    user_relevance=70 if topics and event.category in topics else 50,
                )
                tier = hybrid_signal_tier(event, payload, pulse)
                enriched_at = utcnow().isoformat()
                ai = {
                    "status": AI_STATUS_ENRICHED,
                    "summary": payload.summary,
                    "impact_line": payload.impact_line,
                    "why_it_matters": payload.why_it_matters,
                    "sentiment": payload.sentiment,
                    "entities": [entity.model_dump() for entity in payload.entities],
                    "risk_level": payload.risk_level,
                    "opportunity_level": payload.opportunity_level,
                    "story_graph_json": payload.story_graph.model_dump(by_alias=True),
                    "confidence_explanation": payload.confidence_explanation,
                    "uncertainty": payload.uncertainty,
                    "enriched_at": enriched_at,
                    "provider_used": provider_used,
                    "evidence_hash": current_hash,
                    "pulse_score": pulse,
                    "pulse_breakdown": breakdown,
                    "signal_tier": tier,
                }
                set_event_ai_metadata(event, ai)
                remember_intensity(event, pulse, payload)
                from app.services.geo_signals import ensure_event_geo
                ensure_event_geo(event)
                return AI_STATUS_ENRICHED
            except (json.JSONDecodeError, ValidationError, TypeError) as exc:
                logger.warning("invalid AI enrichment JSON event_id=%s attempt=%s error=%s", event.id, attempt + 1, exc)
                if attempt == 0:
                    prompt = f"{build_prompt(evidence)}\n\nPrevious response was invalid JSON. Return ONLY valid JSON matching the schema."
                    continue

        base_pulse, breakdown = hybrid_pulse_score(event, None)
        ai = {
            "status": AI_STATUS_FAILED,
            "evidence_hash": current_hash,
            "provider_used": provider_used,
            "failed_at": utcnow().isoformat(),
            "failure_reason": "invalid_or_empty_ai_json",
            "pulse_score": base_pulse,
            "pulse_breakdown": breakdown,
            "signal_tier": hybrid_signal_tier(event, None, base_pulse),
        }
        set_event_ai_metadata(event, ai)
        remember_intensity(event, base_pulse, None)
        return AI_STATUS_FAILED
