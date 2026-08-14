from __future__ import annotations

import json
import re

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.signal import Signal
from app.pipeline.enrich.gateway import GatewayClient

router = APIRouter(tags=["simulate"])


class SimulateRequest(BaseModel):
    scenario: str = ""
    input_text: str = ""
    assumptions: dict = Field(default_factory=dict)


def _clean_json(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    match = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(match.group(0) if match else text)


@router.post("/api/simulate")
async def simulate(payload: SimulateRequest):
    text = (payload.scenario or payload.input_text or "").strip()
    if len(text) < 8:
        raise HTTPException(status_code=400, detail="Describe a scenario first.")
    async with AsyncSessionLocal() as session:
        signals = list((await session.scalars(select(Signal).order_by(Signal.pulse.desc()).limit(8))).all())
    context = [
        {"title": item.title, "summary": item.summary, "pulse": item.pulse, "category": item.category}
        for item in signals
    ]
    prompt = (
        "You are NewsIntel scenario analysis, not prediction. Use only the scenario and listed signals. "
        "Return ONLY JSON: {summary, impact_score, confidence, impact_areas:[{area,score,direction,explanation}], "
        "chain_reaction:[{step,title,description}], possible_outcomes:[{label,probability,description}], "
        "recommended_actions:[string], disclaimer}. Scores 0-100. Probabilities sum to 100.\n"
        f"SCENARIO:{text}\nASSUMPTIONS:{json.dumps(payload.assumptions)}\nSIGNALS:{json.dumps(context)}"
    )
    gateway = GatewayClient()
    async with httpx.AsyncClient() as client:
        response = await gateway.call_openrouter(client, prompt, "openrouter/free", 900)
        if not response.get("ok"):
            response = await gateway.call_gemini(client, prompt, 900)
    if not response.get("ok"):
        raise HTTPException(status_code=503, detail="AI providers did not return a scenario.")
    try:
        parsed = _clean_json(response["content"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Scenario JSON was invalid.") from exc
    parsed.setdefault("disclaimer", "Scenario analysis, not prediction.")
    return {"status": "success", "result": parsed, "provider_used": response.get("provider") or "gateway"}
