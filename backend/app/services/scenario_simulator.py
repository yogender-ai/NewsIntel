import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import hf_client
from app.models.news import Event, EventArticle, EventRelationship, ScenarioRun
from app.services.event_enrichment import clean_json_text


DISCLAIMER = "Scenario analysis, not prediction."


class ImpactArea(BaseModel):
    model_config = ConfigDict(extra="forbid")
    area: str
    score: int = Field(ge=0, le=100)
    direction: str
    explanation: str


class ChainStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int
    title: str
    description: str


class Outcome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str
    probability: int = Field(ge=0, le=100)
    description: str


class ScenarioResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str
    impact_score: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    impact_areas: list[ImpactArea]
    chain_reaction: list[ChainStep]
    possible_outcomes: list[Outcome]
    recommended_actions: list[str]
    disclaimer: str


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def scenario_hash(user_id: str, scenario: str, base_event_id: str | None, assumptions: dict[str, Any]) -> str:
    raw = json.dumps(
        {
            "user_id": user_id,
            "scenario": scenario.strip().lower(),
            "base_event_id": base_event_id,
            "assumptions": assumptions or {},
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_scenario_result(raw: str) -> ScenarioResult:
    result = ScenarioResult.model_validate(json.loads(clean_json_text(raw)))
    if result.disclaimer != DISCLAIMER:
        data = result.model_dump()
        data["disclaimer"] = DISCLAIMER
        result = ScenarioResult.model_validate(data)
    total = sum(item.probability for item in result.possible_outcomes)
    if result.possible_outcomes and not 90 <= total <= 110:
        raise ValueError("scenario probabilities must sum close to 100")
    forbidden = "financial advice"
    text = json.dumps(result.model_dump(), ensure_ascii=True).lower()
    if forbidden in text or "guaranteed" in text or "certainly will" in text:
        raise ValueError("scenario uses prohibited certainty/advice language")
    return result


async def scenario_context(session: AsyncSession, base_event_id: str | None = None) -> dict[str, Any]:
    base_event = None
    related = []
    if base_event_id:
        try:
            event_uuid = UUID(base_event_id)
            base_event = await session.scalar(
                select(Event)
                .options(selectinload(Event.article_links).selectinload(EventArticle.article))
                .where(Event.id == event_uuid)
            )
            if base_event:
                edges = (await session.scalars(
                    select(EventRelationship).where(
                        or_(
                            EventRelationship.source_event_id == event_uuid,
                            EventRelationship.target_event_id == event_uuid,
                        )
                    ).limit(8)
                )).all()
                ids = {edge.source_event_id if edge.target_event_id == event_uuid else edge.target_event_id for edge in edges}
                if ids:
                    related = (await session.scalars(select(Event).where(Event.id.in_(ids)).limit(8))).all()
        except ValueError:
            pass
    if not base_event:
        related = (await session.scalars(select(Event).where(Event.status == "active").order_by(Event.last_seen_at.desc()).limit(8))).all()
    def event_payload(event: Event) -> dict[str, Any]:
        ai = (event.metadata_json or {}).get("ai") if isinstance(event.metadata_json, dict) else {}
        geo = (event.metadata_json or {}).get("geo") if isinstance(event.metadata_json, dict) else {}
        return {
            "id": str(event.id),
            "title": event.title,
            "category": event.category,
            "region": event.region,
            "ai_summary": ai.get("summary") if isinstance(ai, dict) else None,
            "story_graph": ai.get("story_graph_json") if isinstance(ai, dict) else None,
            "geo": geo if isinstance(geo, dict) else {},
        }
    return {
        "base_event": event_payload(base_event) if base_event else None,
        "related_events": [event_payload(event) for event in related],
    }


def build_prompt(scenario: str, assumptions: dict[str, Any], context: dict[str, Any]) -> str:
    return f"""You are NewsIntel's scenario-analysis engine.

Return ONLY strict JSON. No markdown, no comments, no extra keys.

USER SCENARIO:
{scenario}

ASSUMPTIONS:
{json.dumps(assumptions or {}, ensure_ascii=True, separators=(",", ":"))}

EVENT CONTEXT:
{json.dumps(context, ensure_ascii=True, separators=(",", ":"))}

JSON schema:
{{
  "summary": "...",
  "impact_score": 0,
  "confidence": 0,
  "impact_areas": [
    {{"area": "markets", "score": 85, "direction": "negative", "explanation": "..."}}
  ],
  "chain_reaction": [
    {{"step": 1, "title": "Trigger", "description": "..."}}
  ],
  "possible_outcomes": [
    {{"label": "Escalation contained", "probability": 35, "description": "..."}}
  ],
  "recommended_actions": [],
  "disclaimer": "Scenario analysis, not prediction."
}}

Rules:
- This is scenario analysis, not prediction.
- Do not use financial advice language.
- Do not claim certainty.
- Probabilities must sum close to 100.
- Use only provided context and user assumptions.
"""


async def run_scenario(
    session: AsyncSession,
    *,
    user_id: str,
    scenario: str,
    base_event_id: str | None,
    assumptions: dict[str, Any],
) -> dict[str, Any]:
    key = scenario_hash(user_id, scenario, base_event_id, assumptions)
    cached = await session.scalar(select(ScenarioRun).where(ScenarioRun.scenario_hash == key))
    if cached:
        return {"status": "success", "cached": True, "result": cached.result_json, "run_id": str(cached.id)}
    context = await scenario_context(session, base_event_id)
    prompt = build_prompt(scenario, assumptions, context)
    provider = "cloud-command-gateway/openrouter"
    raw = await hf_client._call_openrouter(prompt, model="openrouter/auto")
    if not raw:
        provider = "cloud-command-gateway/gemini"
        raw = await hf_client._call_gemini(prompt)
    result = parse_scenario_result(raw).model_dump()
    run = ScenarioRun(
        user_id=user_id,
        input_text=scenario,
        base_event_id=UUID(base_event_id) if base_event_id else None,
        assumptions_json=assumptions or {},
        result_json=result,
        provider_used=provider,
        scenario_hash=key,
    )
    session.add(run)
    await session.commit()
    return {"status": "success", "cached": False, "result": result, "run_id": str(run.id)}
