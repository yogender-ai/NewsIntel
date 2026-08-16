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
from app.services.web_evidence import gather_web_evidence

router = APIRouter(tags=["simulate"])


class SimulateRequest(BaseModel):
    scenario: str = ""
    input_text: str = ""
    assumptions: dict = Field(default_factory=dict)
    base_event_id: str | None = None


def _clean_json(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    match = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(match.group(0) if match else text)


def _desk_rows(signals) -> list[dict]:
    rows = []
    for item in signals:
        rows.append({
            "id": str(item.id),
            "origin": "desk",
            "kind": "signal",
            "title": item.title,
            "url": item.source_url,
            "snippet": (item.summary or item.why_it_matters or "")[:360],
            "pulse": item.pulse,
            "category": item.category,
            "source_name": item.source_name,
            "importance": item.importance,
        })
    return rows


@router.post("/api/simulate")
async def simulate(payload: SimulateRequest):
    text = (payload.scenario or payload.input_text or "").strip()
    if len(text) < 8:
        raise HTTPException(status_code=400, detail="Describe a scenario first.")
    async with AsyncSessionLocal() as session:
        signals = list((await session.scalars(select(Signal).order_by(Signal.pulse.desc()).limit(10))).all())
    desk = _desk_rows(signals)
    if payload.base_event_id:
        desk.sort(key=lambda row: 0 if row["id"] == str(payload.base_event_id) else 1)
    web = await gather_web_evidence(text)
    sources = desk[:8] + web
    prompt = (
        "You are NewsIntel scenario analysis, not prediction. "
        "Use ONLY the provided DESK signals and WEB sources. Never invent articles, numbers, or URLs. "
        "If web sources are empty, say so and stay on desk evidence. "
        "Return ONLY JSON with keys: "
        "summary, impact_score, confidence, "
        "impact_areas:[{area,score,direction,explanation}], "
        "chain_reaction:[{step,title,description}], "
        "possible_outcomes:[{label,probability,description}], "
        "recommended_actions:[string], "
        "desk_impact:[{signal_id,title,effect,reason}], "
        "citations:[{origin,title,url}], "
        "disclaimer. "
        "Scores 0-100. Probabilities must sum to 100. "
        "desk_impact may only reference ids from DESK. citations may only use provided titles/urls.\n"
        f"SCENARIO:{text}\nASSUMPTIONS:{json.dumps(payload.assumptions)}\n"
        f"DESK:{json.dumps(desk)}\nWEB:{json.dumps(web)}"
    )
    gateway = GatewayClient()
    async with httpx.AsyncClient() as client:
        response = await gateway.call_openrouter(client, prompt, "openrouter/free", 1200)
        if not response.get("ok"):
            response = await gateway.call_gemini(client, prompt, 1200)
    if not response.get("ok"):
        raise HTTPException(status_code=503, detail="AI providers did not return a scenario.")
    try:
        parsed = _clean_json(response["content"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Scenario JSON was invalid.") from exc
    parsed.setdefault("disclaimer", "Scenario analysis, not prediction.")
    allowed = {(s.get("url") or "").rstrip("/") for s in sources if s.get("url")}
    citations = []
    for cite in parsed.get("citations") or []:
        if not isinstance(cite, dict):
            continue
        url = str(cite.get("url") or "").rstrip("/")
        if url and url not in allowed:
            continue
        citations.append({
            "origin": cite.get("origin") if cite.get("origin") in ("desk", "web") else "desk",
            "title": cite.get("title") or "Source",
            "url": url,
        })
    if not citations:
        citations = [{"origin": s["origin"], "title": s["title"], "url": s.get("url") or ""} for s in sources[:6]]
    parsed["citations"] = citations
    desk_ids = {row["id"] for row in desk}
    desk_impact = []
    for item in parsed.get("desk_impact") or []:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("signal_id") or "")
        if sid not in desk_ids:
            continue
        match = next(row for row in desk if row["id"] == sid)
        desk_impact.append({
            "signal_id": sid,
            "title": match["title"],
            "effect": item.get("effect") or "watch",
            "reason": item.get("reason") or "",
            "pulse": match.get("pulse"),
            "url": match.get("url"),
        })
    parsed["desk_impact"] = desk_impact
    return {
        "status": "success",
        "result": parsed,
        "provider_used": response.get("provider") or "gateway",
        "sources": sources,
        "desk_count": len(desk),
        "web_count": len(web),
    }
