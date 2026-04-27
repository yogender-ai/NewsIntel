import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import hf_client
from app.models.news import HomeSnapshot, ScenarioRun
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
    snapshot = await session.scalar(
        select(HomeSnapshot).where(HomeSnapshot.active.is_(True)).order_by(HomeSnapshot.created_at.desc()).limit(1)
    )
    payload = snapshot.payload_json if snapshot and isinstance(snapshot.payload_json, dict) else {}
    items = payload.get("simulatorContext") if isinstance(payload.get("simulatorContext"), list) else []
    base_event = None
    if base_event_id:
        base_event = next((item for item in items if str(item.get("id")) == str(base_event_id)), None)
    return {
        "base_event": base_event,
        "related_events": items[:8],
        "source": "home_snapshots.simulatorContext",
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
        base_event_id=None,
        assumptions_json=assumptions or {},
        result_json=result,
        provider_used=provider,
        scenario_hash=key,
    )
    session.add(run)
    await session.commit()
    return {"status": "success", "cached": False, "result": result, "run_id": str(run.id)}
