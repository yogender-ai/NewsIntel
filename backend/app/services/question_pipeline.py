from __future__ import annotations

import json
import re

import httpx
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.events import publish
from app.models.signal import Signal
from app.pipeline.enrich.gateway import GatewayClient
from app.services.web_evidence import gather_web_evidence


def _clean_json(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    match = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(match.group(0) if match else text)


def _tokens(text: str) -> set[str]:
    return {part for part in re.findall(r"[a-z0-9]{3,}", (text or "").lower())}


def _desk_rows(signals) -> list[dict]:
    rows = []
    for item in signals:
        rows.append({
            "id": str(item.id),
            "origin": "desk",
            "kind": "signal",
            "title": item.title,
            "url": item.source_url,
            "snippet": (item.summary or item.why_it_matters or "")[:280],
            "pulse": item.pulse,
            "category": item.category,
            "source_name": item.source_name,
            "importance": item.importance,
            "hay": f"{item.title} {item.summary} {item.why_it_matters}".lower(),
        })
    return rows


def _rank_desk(rows: list[dict], query: str, limit: int = 6) -> list[dict]:
    wanted = _tokens(query)
    scored = []
    for row in rows:
        score = sum(1 for token in wanted if token in row["hay"])
        scored.append((score, row["pulse"] or 0, row))
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    picked = [item[2] for item in scored if item[0] > 0][:limit]
    if not picked:
        picked = [item[2] for item in scored[:limit]]
    for row in picked:
        row.pop("hay", None)
    return picked


async def _call_model(prompt: str, max_tokens: int) -> dict:
    gateway = GatewayClient()
    async with httpx.AsyncClient() as client:
        gemini = await gateway.call_gemini(client, prompt, max_tokens)
        if gemini.get("ok"):
            return gemini
        return await gateway.call_openrouter(client, prompt, "openrouter/free", max_tokens)


async def collect_evidence(question: str, base_event_id: str | None = None) -> dict:
    publish("stage", name="ask-desk", status="running")
    async with AsyncSessionLocal() as session:
        signals = list((await session.scalars(select(Signal).order_by(Signal.pulse.desc()).limit(16))).all())
    desk_all = _desk_rows(signals)
    if base_event_id:
        desk_all.sort(key=lambda row: 0 if row["id"] == str(base_event_id) else 1)
    desk = _rank_desk(desk_all, question)
    publish("stage", name="ask-desk", status="done", counts={"desk": len(desk)})

    publish("stage", name="ask-web", status="running")
    web = await gather_web_evidence(question)
    publish("stage", name="ask-web", status="done", counts={"web": len(web)})
    return {"desk": desk, "web": web, "sources": desk + web}


async def run_ask(question: str) -> dict:
    evidence = await collect_evidence(question)
    sources = evidence["sources"]
    if not sources:
        publish("stage", name="ask-ai", status="done", counts={"matched": 0})
        return {
            "status": "empty",
            "question": question,
            "answer": "No desk signals or web references matched that question.",
            "sources": [],
            "source_count": 0,
            "desk_count": 0,
            "web_count": 0,
        }
    lines = [
        f"[{item['origin'].upper()}{index + 1}] title={item['title']} | url={item.get('url') or ''} | {item.get('snippet') or ''}"
        for index, item in enumerate(sources)
    ]
    prompt = (
        "Answer using ONLY these sources. Cite [DESK#] or [WEB#]. "
        "If the sources do not contain the answer, say you cannot substantiate it. Do not invent facts.\n"
        f"Question: {question}\nSources:\n" + "\n".join(lines)
    )
    publish("stage", name="ask-ai", status="running")
    response = await _call_model(prompt, 500)
    publish("stage", name="ask-ai", status="done", counts={"ok": 1 if response.get("ok") else 0})
    if not response.get("ok"):
        raise RuntimeError("AI providers did not return an answer.")
    return {
        "status": "success",
        "question": question,
        "answer": (response.get("content") or "").strip(),
        "sources": [
            {
                "title": item["title"],
                "summary": item.get("snippet"),
                "source": item.get("source_name") or item.get("kind"),
                "url": item.get("url"),
                "origin": item["origin"],
            }
            for item in sources
        ],
        "source_count": len(sources),
        "desk_count": len(evidence["desk"]),
        "web_count": len(evidence["web"]),
        "provider_used": response.get("provider"),
    }


async def run_simulate(scenario: str, assumptions: dict | None = None, base_event_id: str | None = None) -> dict:
    evidence = await collect_evidence(scenario, base_event_id)
    desk = evidence["desk"]
    web = evidence["web"]
    sources = evidence["sources"]
    prompt = (
        "You are NewsIntel scenario analysis, not prediction. "
        "Use ONLY the provided DESK signals and WEB sources. Never invent articles, numbers, or URLs. "
        "If sources do not support the scenario, say so and keep scores low. "
        "Return ONLY JSON: summary, impact_score, confidence, "
        "impact_areas:[{area,score,direction,explanation}], "
        "chain_reaction:[{step,title,description}], "
        "possible_outcomes:[{label,probability,description}], "
        "recommended_actions:[string], "
        "desk_impact:[{signal_id,title,effect,reason}], "
        "citations:[{origin,title,url}], disclaimer. "
        "Scores 0-100. Probabilities sum to 100.\n"
        f"SCENARIO:{scenario}\nASSUMPTIONS:{json.dumps(assumptions or {})}\n"
        f"DESK:{json.dumps(desk)}\nWEB:{json.dumps(web)}"
    )
    publish("stage", name="ask-ai", status="running")
    response = await _call_model(prompt, 700)
    publish("stage", name="ask-ai", status="done", counts={"ok": 1 if response.get("ok") else 0})
    if not response.get("ok"):
        raise RuntimeError("AI providers did not return a scenario.")
    parsed = _clean_json(response["content"])
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
