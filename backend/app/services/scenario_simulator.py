import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import hf_client
from app.models.news import HomeSnapshot, ScenarioRun
from app.services.event_enrichment import clean_json_text


DISCLAIMER = "Scenario analysis, not prediction."
logger = logging.getLogger("news-intel-scenario-simulator")


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


def _clamp_int(value: Any, low: int = 0, high: int = 100, default: int = 0) -> int:
    try:
        numeric = int(round(float(value)))
    except (TypeError, ValueError):
        numeric = default
    return max(low, min(high, numeric))


def _clean_label(value: Any, fallback: str) -> str:
    text = str(value or "").replace("\n", " ").strip()
    return text[:140] or fallback


def _context_items(context: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    base_event = context.get("base_event")
    if isinstance(base_event, dict):
        items.append(base_event)
    related = context.get("related_events")
    if isinstance(related, list):
        for item in related:
            if isinstance(item, dict) and item not in items:
                items.append(item)
    return items[:8]


def _normalize_probabilities(outcomes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not outcomes:
        raise ValueError("scenario output has no possible outcomes")
    weights = [_clamp_int(item.get("probability"), default=0) for item in outcomes]
    total = sum(weights)
    if total <= 0:
        raise ValueError("scenario probabilities must be positive")

    normalized = []
    running = 0
    for index, item in enumerate(outcomes):
        if index == len(outcomes) - 1:
            probability = 100 - running
        else:
            probability = int(round(weights[index] * 100 / total))
            running += probability
        updated = dict(item)
        updated["probability"] = _clamp_int(probability)
        normalized.append(updated)

    diff = 100 - sum(item["probability"] for item in normalized)
    if normalized and diff:
        strongest = max(range(len(normalized)), key=lambda index: normalized[index]["probability"])
        normalized[strongest]["probability"] = _clamp_int(normalized[strongest]["probability"] + diff)
    return normalized


def parse_scenario_result(raw: str) -> ScenarioResult:
    result = ScenarioResult.model_validate(json.loads(clean_json_text(raw)))
    data = result.model_dump()
    data["disclaimer"] = DISCLAIMER
    data["possible_outcomes"] = _normalize_probabilities(data.get("possible_outcomes") or [])
    result = ScenarioResult.model_validate(data)
    if len(result.impact_areas) < 2 or len(result.chain_reaction) < 3 or len(result.possible_outcomes) < 2:
        raise ValueError("scenario output is missing analysis detail")
    if not result.recommended_actions:
        raise ValueError("scenario output is missing recommended actions")
    forbidden = "financial advice"
    text = json.dumps(result.model_dump(), ensure_ascii=True).lower()
    if forbidden in text or "guaranteed" in text or "certainly will" in text:
        raise ValueError("scenario uses prohibited certainty/advice language")
    return result


def fallback_scenario_result(scenario: str, assumptions: dict[str, Any], context: dict[str, Any]) -> ScenarioResult:
    items = _context_items(context)
    severity = str((assumptions or {}).get("severity") or "medium").lower()
    market_reaction = str((assumptions or {}).get("market_reaction") or "medium").lower()
    time_horizon = str((assumptions or {}).get("time_horizon") or "30d")
    severity_base = {"low": 42, "medium": 62, "high": 78}.get(severity, 62)
    market_bonus = {"low": -5, "medium": 0, "high": 8}.get(market_reaction, 0)
    pulses = [_clamp_int(item.get("pulse_score"), default=50) for item in items if item.get("pulse_score") is not None]
    avg_pulse = sum(pulses) / len(pulses) if pulses else 50
    impact_score = _clamp_int(severity_base * 0.65 + avg_pulse * 0.35 + market_bonus)
    confidence = _clamp_int(46 + min(len(items) * 6, 28) + (8 if pulses else 0), high=86)
    focus = _clean_label(items[0].get("title") if items else "", "the selected news signal")
    scenario_text = _clean_label(scenario, "the scenario")

    if severity == "high":
        probabilities = [20, 45, 35]
    elif severity == "low":
        probabilities = [55, 30, 15]
    else:
        probabilities = [35, 40, 25]

    return ScenarioResult.model_validate(
        {
            "summary": (
                f"{scenario_text} is modeled as a {severity} severity scenario over {time_horizon}, using the current live news context around {focus}. "
                "The main effect may come from how public attention, official response, and downstream confidence move together as new reporting arrives."
            ),
            "impact_score": impact_score,
            "confidence": confidence,
            "impact_areas": [
                {
                    "area": "Public attention",
                    "score": _clamp_int(impact_score + 8),
                    "direction": "rising",
                    "explanation": "More coverage or repeated updates could push the story higher in the dashboard pulse.",
                },
                {
                    "area": "Institutional response",
                    "score": _clamp_int(impact_score + (5 if severity == "high" else -2)),
                    "direction": "mixed",
                    "explanation": "Agencies, companies, or public figures may need to clarify facts or respond to pressure.",
                },
                {
                    "area": "Market and confidence signal",
                    "score": _clamp_int(impact_score + market_bonus),
                    "direction": "sensitive",
                    "explanation": "The market signal depends on whether the event affects trust, operations, funding, or policy expectations.",
                },
                {
                    "area": "Information quality",
                    "score": _clamp_int(confidence),
                    "direction": "watch",
                    "explanation": "The result is stronger when more independent sources confirm the same facts.",
                },
            ],
            "chain_reaction": [
                {
                    "step": 1,
                    "title": "Trigger becomes visible",
                    "description": "The scenario starts from the reported event and the assumptions selected in the simulator.",
                },
                {
                    "step": 2,
                    "title": "Stakeholders react",
                    "description": "Public officials, companies, communities, or media outlets may add statements and new context.",
                },
                {
                    "step": 3,
                    "title": "Second-order effects form",
                    "description": "Attention can spread into policy, trust, operations, or market confidence depending on severity.",
                },
                {
                    "step": 4,
                    "title": "Signal stabilizes or escalates",
                    "description": "The story either loses pressure as facts settle, or gains pressure if new evidence appears.",
                },
            ],
            "possible_outcomes": [
                {
                    "label": "Contained impact",
                    "probability": probabilities[0],
                    "description": "The issue stays limited because facts are clarified quickly and follow-on coverage slows.",
                },
                {
                    "label": "Extended uncertainty",
                    "probability": probabilities[1],
                    "description": "The story remains active while stakeholders respond and source coverage continues.",
                },
                {
                    "label": "Wider escalation",
                    "probability": probabilities[2],
                    "description": "New evidence or stronger reactions expand the impact beyond the original event.",
                },
            ],
            "recommended_actions": [
                "Track source count, pulse score, and sentiment movement before treating the signal as stronger.",
                "Compare official statements with independent reporting to reduce rumor risk.",
                "Watch named entities and related regions for follow-on updates.",
                "Re-run the scenario after major new information appears.",
            ],
            "disclaimer": DISCLAIMER,
        }
    )


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
- The summary must be 2-3 simple sentences.
- Include 3-5 impact_areas, 4-6 chain_reaction steps, 3 possible_outcomes, and 3-5 recommended_actions.
- Outcome probabilities must sum to exactly 100.
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
    provider = "local-rule-fallback"
    result_model: ScenarioResult | None = None
    last_error: Exception | None = None
    for provider_name, caller in [
        ("cloud-command-gateway/openrouter", lambda: hf_client._call_openrouter(prompt, model="openrouter/auto")),
        ("cloud-command-gateway/gemini", lambda: hf_client._call_gemini(prompt)),
    ]:
        try:
            raw = await caller()
            if not raw:
                continue
            result_model = parse_scenario_result(raw)
            provider = provider_name
            break
        except Exception as exc:
            last_error = exc
            logger.warning("Scenario provider returned unusable output provider=%s error=%s", provider_name, exc)

    if result_model is None:
        if last_error:
            logger.info("Using local scenario fallback after provider error: %s", last_error)
        result_model = fallback_scenario_result(scenario, assumptions or {}, context)

    result = result_model.model_dump()
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
