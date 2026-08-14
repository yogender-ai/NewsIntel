from __future__ import annotations

import hashlib
import logging

import httpx

from app.core.redis import RedisClient
from app.pipeline.enrich.gateway import GatewayClient
from app.pipeline.types import EnrichedArticle, Entity

logger = logging.getLogger("newsintel-hf")


def _sha(text: str) -> str:
    return hashlib.sha256(text[:1500].encode("utf-8")).hexdigest()


def _entities(payload: dict) -> list[Entity]:
    raw = payload.get("entities") or payload.get("result") or []
    out: list[Entity] = []
    if isinstance(raw, dict):
        raw = raw.get("entities") or []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("word") or "").strip()
        if not name:
            continue
        out.append(
            Entity(
                name=name,
                type=str(item.get("type") or item.get("entity_group") or "MISC"),
                score=float(item.get("score") or 0),
            )
        )
    return out[:12]


def _sentiment(payload: dict) -> tuple[str, float, list[dict]]:
    scores = payload.get("all_scores") or payload.get("scores") or []
    if isinstance(payload.get("result"), list):
        scores = payload["result"]
    normalized = []
    for item in scores if isinstance(scores, list) else []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").lower()
        if "pos" in label:
            label = "positive"
        elif "neg" in label:
            label = "negative"
        elif "neu" in label:
            label = "neutral"
        normalized.append({"label": label, "score": float(item.get("score") or 0)})
    if not normalized:
        label = str(payload.get("label") or "neutral").lower()
        if "pos" in label:
            label = "positive"
        elif "neg" in label:
            label = "negative"
        else:
            label = "neutral"
        return label, float(payload.get("score") or 0.0), [{"label": label, "score": float(payload.get("score") or 0)}]
    top = max(normalized, key=lambda row: row["score"])
    return top["label"], top["score"], normalized


async def enrich_hf(articles: list[EnrichedArticle], redis: RedisClient) -> None:
    gateway = GatewayClient()
    async with httpx.AsyncClient() as client:
        for item in articles:
            text = f"{item.article.title}. {item.article.summary}"[:1500]
            digest = _sha(text)
            try:
                ner = await redis.get_json(f"newsintel:hf:ner:{digest}")
                if not ner:
                    ner = await gateway.call_hf(client, "extract_entities", text)
                    await redis.set_json(f"newsintel:hf:ner:{digest}", ner, ttl_seconds=7 * 24 * 3600)
                sent = await redis.get_json(f"newsintel:hf:sent:{digest}")
                if not sent:
                    sent = await gateway.call_hf(client, "analyze_sentiment", text)
                    await redis.set_json(f"newsintel:hf:sent:{digest}", sent, ttl_seconds=7 * 24 * 3600)
                item.entities = _entities(ner if isinstance(ner, dict) else {})
                label, score, all_scores = _sentiment(sent if isinstance(sent, dict) else {})
                item.sentiment_label = label
                item.sentiment_score = score
                item.all_scores = all_scores
                item.hf_status = "ok"
            except Exception as exc:
                logger.warning("hf.fail title=%s err=%s", item.article.title[:80], exc)
                item.hf_status = "failed"
                item.sentiment_label = "neutral"
                item.sentiment_score = 0.0
                item.all_scores = []
                item.entities = []
