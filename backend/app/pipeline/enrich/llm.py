from __future__ import annotations

import json
import logging
import re

import httpx

from app.core.config import get_settings
from app.core.redis import RedisClient
from app.pipeline.enrich.gateway import GatewayClient
from app.pipeline.types import EnrichedArticle, RelHint

logger = logging.getLogger("newsintel-llm")


def _clean_json(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    match = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(match.group(0) if match else text)


def _quota(response: dict) -> bool:
    body = str(response.get("body") or "").lower()
    status = response.get("status_code")
    markers = ("quota", "credit", "payment", "billing", "free-models-per-day", "resource_exhausted")
    return status in {402, 403} or any(marker in body for marker in markers)


def _prompt(batch: list[EnrichedArticle]) -> str:
    payload = []
    for index, item in enumerate(batch):
        payload.append(
            {
                "article_index": index,
                "title": item.article.title[:180],
                "summary": item.article.summary[:400],
                "source": item.article.source_name,
                "category": item.article.category,
                "entities": [entity.name for entity in item.entities[:6]],
                "published_at": item.article.published_at.isoformat() if item.article.published_at else None,
            }
        )
    return (
        "Enrich real RSS articles. Use ONLY the provided text. Do not invent facts, numbers, or sources. "
        "Return ONLY minified JSON with key items. Each item: article_index, display_title (<=12 words), "
        "summary (45-80 words), why_it_matters (20-45 words), importance (0-100), importance_reason (<=20 words), "
        "relationships (array of {target_index,type,reason}). "
        "Do not emit pulse, entities, or sentiment.\n"
        f"ARTICLES:{json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}"
    )


async def _complete(client: httpx.AsyncClient, gateway: GatewayClient, prompt: str, redis: RedisClient) -> dict:
    settings = get_settings()
    circuit = await redis.get_json("newsintel:circuit:ai")
    if circuit:
        return {"ok": False, "status_code": 503, "content": "", "body": "circuit_open"}
    last = {"ok": False, "status_code": None, "content": "", "body": "no_model"}
    for model in settings.openrouter_model_chain:
        last = await gateway.call_openrouter(client, prompt, model, 900)
        if last.get("ok"):
            return last
        if _quota(last):
            break
    gemini = await gateway.call_gemini(client, prompt, 900)
    if gemini.get("ok"):
        return gemini
    if _quota(last) or _quota(gemini):
        await redis.set_json("newsintel:circuit:ai", {"reason": "quota"}, ttl_seconds=600)
    return gemini if gemini.get("status_code") else last


def _apply(batch: list[EnrichedArticle], parsed: dict) -> None:
    items = parsed.get("items") if isinstance(parsed, dict) else None
    used: set[int] = set()
    if not isinstance(items, list):
        for item in batch:
            item.llm_status = "failed"
            item.llm_summary = item.article.summary
            item.display_title = item.article.title
            item.llm_importance = 50
        return
    for row in items:
        if not isinstance(row, dict):
            continue
        try:
            index = int(row.get("article_index"))
        except (TypeError, ValueError):
            continue
        if index < 0 or index >= len(batch) or index in used:
            continue
        used.add(index)
        item = batch[index]
        item.display_title = str(row.get("display_title") or item.article.title)[:200]
        item.llm_summary = str(row.get("summary") or item.article.summary)[:1200]
        item.why_it_matters = str(row.get("why_it_matters") or "")[:800]
        try:
            item.llm_importance = max(0, min(100, int(float(row.get("importance") or 50))))
        except (TypeError, ValueError):
            item.llm_importance = 50
        item.llm_importance_reason = str(row.get("importance_reason") or "")[:240]
        rels = []
        for rel in row.get("relationships") or []:
            if not isinstance(rel, dict):
                continue
            try:
                target = int(rel.get("target_index"))
            except (TypeError, ValueError):
                continue
            if 0 <= target < len(batch) and target != index:
                rels.append(RelHint(target_index=target, type=str(rel.get("type") or "related"), reason=str(rel.get("reason") or "")))
        item.relationships = rels
        item.llm_status = "ok"
    for index, item in enumerate(batch):
        if index not in used:
            item.llm_status = "failed"
            item.llm_summary = item.article.summary
            item.display_title = item.article.title
            item.llm_importance = 50


async def enrich_llm(articles: list[EnrichedArticle], redis: RedisClient) -> None:
    settings = get_settings()
    batch_size = max(1, int(settings.newsintel_enrich_batch_size))
    gateway = GatewayClient()
    async with httpx.AsyncClient() as client:
        for offset in range(0, len(articles), batch_size):
            batch = articles[offset: offset + batch_size]
            prompt = _prompt(batch)
            response = await _complete(client, gateway, prompt, redis)
            if not response.get("ok"):
                logger.warning("llm.batch fail status=%s", response.get("status_code"))
                for item in batch:
                    item.llm_status = "failed"
                    item.llm_summary = item.article.summary
                    item.display_title = item.article.title
                    item.llm_importance = 50
                continue
            try:
                parsed = _clean_json(response["content"])
            except Exception:
                response = await _complete(client, gateway, prompt, redis)
                try:
                    parsed = _clean_json(response.get("content") or "")
                except Exception:
                    parsed = {}
            _apply(batch, parsed)
            logger.info("llm.batch ok=%s failed=%s model=%s", sum(1 for i in batch if i.llm_status == "ok"), sum(1 for i in batch if i.llm_status != "ok"), response.get("model"))
