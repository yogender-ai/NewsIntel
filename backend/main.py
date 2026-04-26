"""
News-Intel Backend v12 — Cached Intelligence Pipeline

Architecture:
- Background scheduler pre-computes intelligence every 5 min (fast) and 15 min (full LLM)
- GET /api/dashboard serves cached payload INSTANTLY
- POST /api/dashboard triggers force-refresh
- Stale-while-revalidate: user gets cached data immediately, bg refresh if stale

Pipeline: RSS → HF(NER+Sentiment) → OpenRouter/Gemini(Synthesis) → Signal Classification → Cache
"""

import logging
import json
import asyncio
import time
import os
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import hf_client
import news_fetcher
from app.core.cors import ALLOWED_ORIGIN_REGEX, allowed_origins
from app.core.database import AsyncSessionLocal as EventStoreSessionLocal
from app.services.dashboard_read_model import build_dashboard_payload

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("news-intel-api")


# ---------------------------------------------------------------------------
# Intelligence Cache (in-memory)
# ---------------------------------------------------------------------------
_cached_payload: Optional[dict] = None       # Latest full dashboard payload
_cached_at: Optional[datetime] = None        # When it was generated
_cache_lock = asyncio.Lock()                 # Prevent concurrent refreshes
_bg_task: Optional[asyncio.Task] = None      # Background scheduler handle
_shared_refresh_task: Optional[asyncio.Task] = None
_profile_cache: dict = {}                    # Personalized payloads keyed by profile
_profile_locks: dict = {}                    # Prevent duplicate refreshes per profile
_profile_refresh_tasks: dict = {}
_article_analysis_cache: dict = {}
MAX_PROFILE_CACHES = 24
MAX_ARTICLE_ANALYSIS_CACHE = 256

FAST_INTERVAL = 300    # 5 min — RSS + NLP + tiers
FULL_INTERVAL = 900    # 15 min — + LLM synthesis
STALE_THRESHOLD = 360  # 6 min — after this, trigger bg refresh on user request


# ---------------------------------------------------------------------------
# Database Lifecycle + Background Scheduler
# ---------------------------------------------------------------------------
ARTICLE_ANALYSIS_TTL = 1800

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bg_task
    await db.database.connect()
    await db.init_db()
    logger.info("News-Intel v12 (Cached Intelligence) ready. DB connected.")

    # Phase 5.5: ingestion scheduler runs outside the API process.
    _bg_task = None
    logger.info("Event-store dashboard mode active. Legacy RSS scheduler disabled.")

    yield

    # Shutdown
    if _bg_task:
        _bg_task.cancel()
        try:
            await _bg_task
        except asyncio.CancelledError:
            pass
    await db.database.disconnect()


app = FastAPI(title="News-Intel v12", version="12.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# CORS-safe exception handler — ensures 500 errors still return CORS headers.
# Without this, unhandled exceptions bypass CORSMiddleware and the browser
# reports a CORS block instead of the real error.
# ---------------------------------------------------------------------------
from starlette.responses import JSONResponse
import re as _re

_cors_origin_re = _re.compile(ALLOWED_ORIGIN_REGEX)
_cors_origins_set = set(allowed_origins())


@app.exception_handler(Exception)
async def _cors_safe_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin and (origin in _cors_origins_set or _cors_origin_re.match(origin)):
        headers["access-control-allow-origin"] = origin
        headers["access-control-allow-credentials"] = "true"
    logger.error("Unhandled exception (CORS-safe): %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)[:200]},
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------
class DashboardRequest(BaseModel):
    topics: List[str] = []
    regions: List[str] = []

class IngestNowRequest(BaseModel):
    topics: List[str] = ["ai", "tech", "markets"]
    regions: List[str] = ["global"]
    max_articles: int = 40

class StoryDeepDiveRequest(BaseModel):
    title: str
    text: str
    source: str = ""

class UserPreferencesInput(BaseModel):
    display_name: str = ""
    email: str = ""
    photo_url: str = ""
    preferred_categories: List[str] = []
    preferred_regions: List[str] = []
    youtube_channels: List[str] = []
    onboarded: bool = True

class InteractionInput(BaseModel):
    signal_id: str
    interaction_type: str
    dwell_time_seconds: int = 0
    metadata: dict = {}

class WatchlistInput(BaseModel):
    signal_id: str
    watch_priority: int = 1

class SavedThreadInput(BaseModel):
    thread_id: str

class TrackedEntityInput(BaseModel):
    entity_name: str
    entity_type: str = "ENTITY"
    follow_weight: float = 1.0

class DismissSignalInput(BaseModel):
    signal_id: str
    dismiss_reason: str = "not_relevant"


# ---------------------------------------------------------------------------
# Signal Tier Classification (DETERMINISTIC — no LLM dependency)
# ---------------------------------------------------------------------------

def classify_signal_tier(pulse_score: float, source_count: int, source_diversity: float,
                         sentiment_intensity: float, exposure_score: float) -> str:
    composite = (
        pulse_score * 0.35 +
        min(source_count * 12, 100) * 0.15 +
        source_diversity * 100 * 0.10 +
        sentiment_intensity * 100 * 0.15 +
        exposure_score * 0.25
    )

    if composite >= 72:
        return "CRITICAL"
    elif composite >= 50:
        return "SIGNAL"
    elif composite >= 28:
        return "WATCH"
    else:
        return "NOISE"


# ---------------------------------------------------------------------------
# Exposure Scoring
# ---------------------------------------------------------------------------

TOPIC_KEYWORDS = {
    "tech": ["technology", "tech", "semiconductor", "chip", "software", "hardware", "silicon", "computing"],
    "politics": ["politics", "geopolitics", "election", "government", "diplomacy", "congress", "senate", "parliament"],
    "markets": ["market", "stock", "economy", "financial", "invest", "trading", "wall street", "nasdaq", "dow"],
    "ai": ["ai", "artificial intelligence", "machine learning", "llm", "neural", "openai", "deepseek", "claude", "gpt"],
    "climate": ["climate", "renewable", "energy", "carbon", "solar", "wind", "emission", "green"],
    "healthcare": ["healthcare", "pharma", "medical", "drug", "vaccine", "hospital", "health"],
    "defense": ["defense", "military", "army", "navy", "weapon", "missile", "nato", "war"],
    "crypto": ["crypto", "bitcoin", "blockchain", "ethereum", "web3", "defi", "token"],
    "space": ["space", "nasa", "spacex", "satellite", "orbit", "rocket", "moon", "mars"],
    "trade": ["trade", "tariff", "supply chain", "shipping", "import", "export", "commerce"],
    "auto": ["automotive", "ev", "electric vehicle", "tesla", "toyota", "car", "battery", "autonomous"],
    "telecom": ["telecom", "5g", "broadband", "wireless", "spectrum", "network", "carrier"],
    "real-estate": ["real estate", "housing", "mortgage", "property", "construction", "rent"],
    "media": ["media", "entertainment", "streaming", "netflix", "disney", "film", "music", "content"],
    "education": ["education", "edtech", "university", "school", "learning", "student"],
    "legal": ["legal", "regulation", "law", "court", "antitrust", "compliance", "legislation", "ruling"],
}

REGION_KEYWORDS = {
    "global": [],  # Global = no keyword filter, everything matches
    "us": ["united states", "america", "us", "washington", "biden", "trump", "federal reserve"],
    "china": ["china", "beijing", "chinese", "xi jinping", "ccp", "taiwan"],
    "india": ["india", "indian", "modi", "delhi", "mumbai", "rupee"],
    "europe": ["europe", "eu", "european", "brussels", "germany", "france"],
    "middle-east": ["middle east", "iran", "israel", "saudi", "gaza", "yemen", "syria"],
    "russia": ["russia", "russian", "moscow", "putin", "ukraine", "kremlin"],
    "japan-korea": ["japan", "japanese", "korea", "korean", "tokyo", "samsung"],
    "latam": ["latin america", "brazil", "mexico", "argentina", "colombia"],
    "africa": ["africa", "african", "nigeria", "south africa", "kenya", "egypt"],
    "southeast-asia": ["southeast asia", "singapore", "vietnam", "indonesia", "philippines", "thailand"],
    "uk": ["uk", "united kingdom", "britain", "british", "london", "england", "scotland"],
    "canada": ["canada", "canadian", "toronto", "ottawa", "trudeau"],
    "australia": ["australia", "australian", "sydney", "melbourne", "new zealand"],
}


def _normalize_profile_values(values: list) -> list:
    normalized = []
    seen = set()
    for value in values or []:
        cleaned = str(value or "").strip().lower()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            normalized.append(cleaned)
    return normalized


def _profile_cache_key(topics: list, regions: list) -> str:
    return json.dumps(
        {
            "topics": sorted(_normalize_profile_values(topics)),
            "regions": sorted(_normalize_profile_values(regions)),
        },
        separators=(",", ":"),
        sort_keys=True,
    )


def _get_profile_lock(cache_key: str) -> asyncio.Lock:
    if cache_key not in _profile_locks:
        _profile_locks[cache_key] = asyncio.Lock()
    return _profile_locks[cache_key]


def _prune_profile_cache():
    if len(_profile_cache) <= MAX_PROFILE_CACHES:
        return

    oldest_first = sorted(
        _profile_cache.items(),
        key=lambda item: item[1].get("cached_at") or datetime.min.replace(tzinfo=timezone.utc),
    )
    while len(_profile_cache) > MAX_PROFILE_CACHES and oldest_first:
        cache_key, _ = oldest_first.pop(0)
        _profile_cache.pop(cache_key, None)
        _profile_locks.pop(cache_key, None)
        task = _profile_refresh_tasks.pop(cache_key, None)
        if task and not task.done():
            task.cancel()


def _article_analysis_cache_key(article: dict) -> str:
    return json.dumps(
        {
            "title": article.get("title", "").strip().lower(),
            "source": article.get("source", "").strip().lower(),
            "published": article.get("published", ""),
        },
        separators=(",", ":"),
        sort_keys=True,
    )


def _get_cached_article_analysis(article: dict) -> Optional[dict]:
    cache_key = _article_analysis_cache_key(article)
    entry = _article_analysis_cache.get(cache_key)
    if not entry:
        return None

    age_seconds = (datetime.now(timezone.utc) - entry["cached_at"]).total_seconds()
    if age_seconds > ARTICLE_ANALYSIS_TTL:
        _article_analysis_cache.pop(cache_key, None)
        return None
    return entry["result"]


def _put_cached_article_analysis(article: dict, result: dict):
    if len(_article_analysis_cache) >= MAX_ARTICLE_ANALYSIS_CACHE:
        oldest_first = sorted(
            _article_analysis_cache.items(),
            key=lambda item: item[1]["cached_at"],
        )[: MAX_ARTICLE_ANALYSIS_CACHE // 2]
        for cache_key, _ in oldest_first:
            _article_analysis_cache.pop(cache_key, None)

    _article_analysis_cache[_article_analysis_cache_key(article)] = {
        "cached_at": datetime.now(timezone.utc),
        "result": result,
    }


def _task_running(task: Optional[asyncio.Task]) -> bool:
    return bool(task) and not task.done()


def _attach_cache_metadata(
    payload: dict,
    cached_at: Optional[datetime],
    personalized: bool,
    refresh_in_progress: bool = False,
) -> dict:
    age_seconds = (datetime.now(timezone.utc) - cached_at).total_seconds() if cached_at else 0
    response = {**payload}
    response["cache_age_seconds"] = max(0, int(age_seconds))
    response["cached_at"] = cached_at.isoformat() if cached_at else None
    response["is_stale"] = age_seconds > STALE_THRESHOLD
    response["personalization_mode"] = "profile" if personalized else "shared"
    response["refresh_in_progress"] = refresh_in_progress
    return response


async def _event_backed_dashboard_payload(topics: list, regions: list) -> dict:
    normalized_topics = _normalize_profile_values(topics)
    normalized_regions = _normalize_profile_values(regions)
    try:
        async with EventStoreSessionLocal() as session:
            payload = await build_dashboard_payload(
                session,
                topics=normalized_topics,
                regions=normalized_regions,
            )
        payload["daily_delta"] = await compute_daily_delta(payload.get("topics_used", []), payload.get("clusters", []))
    except Exception as exc:
        logger.error("Event-backed dashboard read failed: %s", exc)
        now = datetime.now(timezone.utc)
        payload = {
            "status": "degraded",
            "version": "12.0.0-event-backed",
            "daily_brief": "",
            "articles": [],
            "clusters": [],
            "impact": {},
            "tension_index": {},
            "daily_delta": [],
            "exposure_score": 50,
            "opportunity_radar": {},
            "monitoring_queue": [],
            "sources_count": None,
            "topics_used": normalized_topics,
            "regions_used": normalized_regions,
            "generated_at": now.isoformat(),
            "refresh_type": "event_store_unavailable",
            "pipeline_status": {
                "news": "event_store_unavailable",
                "source_of_truth": "events,event_articles",
                "error": str(exc)[:240],
            },
            "next_refresh_at": None,
        }
    return _attach_cache_metadata(
        payload,
        datetime.fromisoformat(payload["generated_at"]),
        personalized=False,
        refresh_in_progress=False,
    )


async def _refresh_profile_cache(topics: list, regions: list, force_refresh_news: bool = False,
                                 clear_model_cache: bool = False, run_llm: bool = True):
    normalized_topics = _normalize_profile_values(topics)
    normalized_regions = _normalize_profile_values(regions)
    cache_key = _profile_cache_key(normalized_topics, normalized_regions)

    async with _get_profile_lock(cache_key):
        cached_profile = _profile_cache.get(cache_key)
        if force_refresh_news:
            news_fetcher.force_refresh()
        if clear_model_cache:
            hf_client.clear_cache()

        payload = await _build_intelligence(
            normalized_topics,
            normalized_regions,
            run_llm=run_llm or not cached_profile,
            reuse_payload=cached_profile["payload"] if cached_profile else None,
        )
        cached_at = datetime.now(timezone.utc)
        _profile_cache[cache_key] = {
            "payload": payload,
            "cached_at": cached_at,
            "topics": normalized_topics,
            "regions": normalized_regions,
        }
        _prune_profile_cache()
        return payload, cached_at, cache_key


def compute_exposure_score(cluster_text: str, user_topics: list, user_regions: list) -> int:
    if not user_topics and not user_regions:
        return 50
    # If user selected "global" region, everything is relevant
    if "global" in user_regions:
        # Still compute topic relevance, but boost the baseline
        text_lower = cluster_text.lower()
        topic_hits = 0
        topic_total = 0
        for topic in user_topics:
            keywords = TOPIC_KEYWORDS.get(topic, [topic])
            topic_total += len(keywords)
            for kw in keywords:
                if kw in text_lower:
                    topic_hits += 1
        if topic_total == 0:
            return 70
        ratio = topic_hits / topic_total
        return min(100, max(70, int(70 + (ratio ** 0.5) * 30)))
    text_lower = cluster_text.lower()
    hits = 0
    total_keywords = 0
    for topic in user_topics:
        keywords = TOPIC_KEYWORDS.get(topic, [topic])
        total_keywords += len(keywords)
        for kw in keywords:
            if kw in text_lower:
                hits += 1
    for region in user_regions:
        keywords = REGION_KEYWORDS.get(region, [region])
        total_keywords += len(keywords)
        for kw in keywords:
            if kw in text_lower:
                hits += 1
    if total_keywords == 0:
        return 50
    ratio = hits / total_keywords
    score = min(100, int((ratio ** 0.5) * 100))
    if hits > 0 and score < 15:
        score = 15
    return score


def _matched_profile_topics(cluster_text: str, user_topics: list) -> list:
    text_lower = (cluster_text or "").lower()
    matches = []
    for topic in user_topics or []:
        keywords = TOPIC_KEYWORDS.get(topic, [topic])
        if any(kw in text_lower for kw in keywords):
            matches.append({
                "id": topic,
                "label": topic.replace("-", " ").title(),
            })
    return matches


def _signal_id(cluster: dict) -> str:
    raw = f"{cluster.get('thread_title') or cluster.get('summary') or 'signal'}"
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in raw)
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-")[:96] or "signal"


def _cluster_text(cluster: dict, articles: list = None) -> str:
    text = f"{cluster.get('thread_title', '')} {cluster.get('summary', '')} {cluster.get('impact_line', '')} {cluster.get('why_it_matters', '')}"
    article_ids = {str(aid) for aid in cluster.get("article_ids", [])}
    for article in articles or []:
        if not article_ids or str(article.get("id")) in article_ids:
            text += f" {article.get('title', '')} {article.get('text_preview', '')}"
    return text


def _cluster_entities(cluster: dict, articles: list) -> list:
    article_ids = {str(aid) for aid in cluster.get("article_ids", [])}
    entities = {}
    for article in articles or []:
        if article_ids and str(article.get("id")) not in article_ids:
            continue
        for ent in article.get("entities", []) or []:
            name = ent.get("name")
            if not name:
                continue
            entities[name] = {
                "name": name,
                "type": ent.get("type", "ENTITY"),
                "count": entities.get(name, {}).get("count", 0) + 1,
            }
    return sorted(entities.values(), key=lambda item: item["count"], reverse=True)


async def _phase5_profile(user_id: str) -> dict:
    if not user_id:
        return {
            "saved": [],
            "watched": [],
            "tracked_entities": [],
            "dismissed": [],
            "interactions": [],
        }
    saved, watched, tracked, dismissed, interactions = await asyncio.gather(
        db.list_saved_threads(user_id),
        db.list_watched_signals(user_id),
        db.list_tracked_entities(user_id),
        db.list_dismissed_signals(user_id),
        db.list_user_interactions(user_id),
    )
    return {
        "saved": saved,
        "watched": watched,
        "tracked_entities": tracked,
        "dismissed": dismissed,
        "interactions": interactions,
    }


def _interaction_weights(interactions: list) -> dict:
    weights = {}
    multipliers = {
        "open": 1.5,
        "click": 1.0,
        "explain": 1.2,
        "graph": 1.4,
        "save": 3.0,
        "watch": 2.5,
        "dismiss": -4.0,
    }
    for item in interactions or []:
        signal_id = item.get("signal_id")
        if not signal_id:
            continue
        weights[signal_id] = weights.get(signal_id, 0) + multipliers.get(item.get("interaction_type"), 0.5)
    return weights


def _why_relevant(cluster: dict, user_topics: list, user_regions: list, phase5: dict, articles: list) -> dict:
    text = _cluster_text(cluster, articles).lower()
    tracked_entities = phase5.get("tracked_entities", [])
    interactions = phase5.get("interactions", [])
    watched = {item["signal_id"] for item in phase5.get("watched", [])}
    saved = {item["thread_id"] for item in phase5.get("saved", [])}
    signal_id = cluster.get("signal_id") or _signal_id(cluster)

    factors = []
    score = 0
    for topic in user_topics or []:
        keywords = TOPIC_KEYWORDS.get(topic, [topic])
        if any(kw in text for kw in keywords):
            factors.append({"label": f"{topic.replace('-', ' ').title()} topic match", "points": 25, "type": "topic"})
            score += 25
    for region in user_regions or []:
        keywords = REGION_KEYWORDS.get(region, [region])
        if region == "global" or any(kw in text for kw in keywords):
            factors.append({"label": f"{region.replace('-', ' ').title()} region overlap", "points": 15, "type": "region"})
            score += 15
            break
    for ent in tracked_entities:
        if ent["entity_name"].lower() in text:
            points = int(18 * float(ent.get("follow_weight") or 1.0))
            factors.append({"label": f"Tracked entity: {ent['entity_name']}", "points": points, "type": "entity"})
            score += points
    similar_opens = sum(1 for item in interactions if item.get("interaction_type") in ("open", "click", "graph", "explain") and item.get("signal_id") == signal_id)
    if similar_opens:
        points = min(20, similar_opens * 6)
        factors.append({"label": f"You engaged with this signal {similar_opens} time(s)", "points": points, "type": "history"})
        score += points
    if signal_id in watched:
        factors.append({"label": "Signal is on your watchlist", "points": 20, "type": "watchlist"})
        score += 20
    if signal_id in saved:
        factors.append({"label": "Thread saved by you", "points": 16, "type": "saved"})
        score += 16
    if not factors:
        factors.append({"label": "General profile similarity", "points": 8, "type": "baseline"})
        score += 8
    return {"score": min(100, score), "factors": factors[:6]}


def _personalize_payload(payload: dict, user_id: str, user_topics: list, user_regions: list, phase5: dict) -> dict:
    response = {**payload}
    articles = response.get("articles", [])
    dismissed = {item["signal_id"] for item in phase5.get("dismissed", [])}
    watched = {item["signal_id"] for item in phase5.get("watched", [])}
    saved = {item["thread_id"] for item in phase5.get("saved", [])}
    interaction_weights = _interaction_weights(phase5.get("interactions", []))
    clusters = []

    for cluster in response.get("clusters", []):
        c = {**cluster}
        signal_id = _signal_id(c)
        c["signal_id"] = signal_id
        c["thread_id"] = signal_id
        c["entities"] = _cluster_entities(c, articles)
        c["story_graph"] = build_story_graph(c, articles, user_topics, user_regions)
        c["why_relevant"] = _why_relevant(c, user_topics, user_regions, phase5, articles)
        if signal_id in dismissed:
            c["dismissed"] = True
        base_relevance = c.get("exposure_score", 50)
        entity_overlap = len([e for e in c["entities"] if any(t["entity_name"].lower() == e["name"].lower() for t in phase5.get("tracked_entities", []))])
        region_bonus = 10 if "global" in user_regions else 0
        watch_boost = 20 if signal_id in watched else 0
        saved_boost = 16 if signal_id in saved else 0
        engagement = interaction_weights.get(signal_id, 0) * 6
        dismissal_penalty = 100 if signal_id in dismissed else 0
        relevance = max(0, min(100, base_relevance + entity_overlap * 18 + region_bonus + watch_boost + saved_boost + engagement - dismissal_penalty))
        c["relevance_score"] = round(relevance, 1)
        c["confidence"] = min(0.95, 0.45 + min(c.get("source_count", 1), 5) * 0.08 + len(c["why_relevant"]["factors"]) * 0.04)
        c["_personal_rank"] = relevance + c.get("pulse_score", 50) + watch_boost + saved_boost - dismissal_penalty
        clusters.append(c)

    tier_order = {"CRITICAL": 40, "SIGNAL": 25, "WATCH": 10, "NOISE": 0}
    clusters.sort(key=lambda c: (c.get("_personal_rank", 0) + tier_order.get(c.get("signal_tier", "NOISE"), 0)), reverse=True)
    response["clusters"] = [c for c in clusters if not c.get("dismissed")]
    response["dismissed_count"] = sum(1 for c in clusters if c.get("dismissed"))
    response["saved_signal_ids"] = list(saved)
    response["watched_signal_ids"] = list(watched)
    response["tracked_entities"] = phase5.get("tracked_entities", [])
    if response["clusters"]:
        response["exposure_score"] = round(sum(c.get("relevance_score", c.get("exposure_score", 50)) for c in response["clusters"][:5]) / min(len(response["clusters"]), 5))
    return response


def build_story_graph(cluster: dict, articles: list, user_topics: list = None, user_regions: list = None) -> dict:
    signal_id = cluster.get("signal_id") or _signal_id(cluster)
    title = cluster.get("thread_title") or "Signal event"
    entities = _cluster_entities(cluster, articles)
    main_entity = entities[0]["name"] if entities else (user_topics or ["Market"])[0].replace("-", " ").title()
    risk_type = cluster.get("risk_type") or "signal"
    exposure = cluster.get("exposure_score", 50)
    impact = cluster.get("impact_line") or cluster.get("summary") or "Impact is forming"

    nodes = [
        {"id": f"{signal_id}:event", "label": title, "type": "event"},
        {"id": f"{signal_id}:primary", "label": f"{main_entity} moves", "type": "primary_effect"},
        {"id": f"{signal_id}:secondary", "label": impact[:120], "type": "secondary_impact"},
        {"id": f"{signal_id}:exposure", "label": f"Your exposure {'rises' if exposure >= 65 else 'changes'} ({round(exposure)})", "type": "personal_exposure"},
    ]
    edges = [
        {"from": nodes[0]["id"], "to": nodes[1]["id"], "relationship": "impacts"},
        {"from": nodes[1]["id"], "to": nodes[2]["id"], "relationship": "causes" if risk_type == "risk" else "correlates"},
        {"from": nodes[2]["id"], "to": nodes[3]["id"], "relationship": "raises risk" if risk_type == "risk" else "reduces opportunity" if risk_type == "opportunity" else "impacts"},
    ]
    return {"thread_id": signal_id, "nodes": nodes, "edges": edges, "confidence": min(0.9, 0.5 + len(entities) * 0.08)}


async def _ensure_alerts(user_id: str, payload: dict, phase5: dict):
    if not user_id:
        return []
    existing = await db.list_alerts(user_id, unresolved_only=True)
    clusters = payload.get("clusters", [])
    tracked = phase5.get("tracked_entities", [])
    for cluster in clusters[:6]:
        signal_id = cluster.get("signal_id") or _signal_id(cluster)
        if cluster.get("signal_tier") == "CRITICAL":
            await db.create_alert(user_id, f"Critical signal appeared: {cluster.get('thread_title', 'Untitled')}", "critical", "critical_tier", signal_id)
        if cluster.get("relevance_score", cluster.get("exposure_score", 0)) >= 80:
            await db.create_alert(user_id, f"Your exposure crossed 80: {cluster.get('thread_title', 'Signal')}", "warning", "exposure_jump", signal_id)
        text = _cluster_text(cluster, payload.get("articles", [])).lower()
        for ent in tracked:
            if ent["entity_name"].lower() in text and cluster.get("signal_tier") in ("CRITICAL", "SIGNAL"):
                await db.create_alert(user_id, f"Tracked entity {ent['entity_name']} moved to {cluster.get('signal_tier')}", "warning", "tracked_entity", signal_id)
    for delta in payload.get("daily_delta", []):
        if delta.get("has_baseline") and abs(delta.get("delta", 0)) >= 12:
            await db.create_alert(user_id, f"{delta.get('label')} exposure moved {delta.get('delta'):+}", "info", "pulse_delta")
    return existing


def _user_id_from_request(request: Request) -> str:
    return request.headers.get("X-User-Id", "").strip() or "local_user_123"


def _schedule_profile_refresh(
    topics: list,
    regions: list,
    *,
    force_refresh_news: bool = False,
    clear_model_cache: bool = False,
    run_llm: bool = False,
) -> asyncio.Task:
    normalized_topics = _normalize_profile_values(topics)
    normalized_regions = _normalize_profile_values(regions)
    cache_key = _profile_cache_key(normalized_topics, normalized_regions)
    existing = _profile_refresh_tasks.get(cache_key)
    if _task_running(existing):
        return existing

    async def runner():
        try:
            await _refresh_profile_cache(
                normalized_topics,
                normalized_regions,
                force_refresh_news=force_refresh_news,
                clear_model_cache=clear_model_cache,
                run_llm=run_llm,
            )
            logger.info("Profile refresh complete for %s", cache_key)
        except Exception as e:
            logger.error(f"Profile refresh failed for {cache_key}: {e}")
        finally:
            current = _profile_refresh_tasks.get(cache_key)
            if current is asyncio.current_task():
                _profile_refresh_tasks.pop(cache_key, None)

    task = asyncio.create_task(runner())
    _profile_refresh_tasks[cache_key] = task
    return task


# ---------------------------------------------------------------------------
# Daily Delta
# ---------------------------------------------------------------------------

async def compute_daily_delta(topics: list, current_clusters: list) -> list:
    topic_pulse_current = {}
    for topic in topics:
        keywords = TOPIC_KEYWORDS.get(topic, [topic])
        matching_pulses = []
        for cluster in current_clusters:
            cluster_text = f"{cluster.get('thread_title', '')} {cluster.get('summary', '')}".lower()
            if any(kw in cluster_text for kw in keywords):
                matching_pulses.append(cluster.get("pulse_score", 50))
        if matching_pulses:
            topic_pulse_current[topic] = round(sum(matching_pulses) / len(matching_pulses), 1)
        else:
            topic_pulse_current[topic] = 50.0

    deltas = []
    for topic in topics:
        current = topic_pulse_current.get(topic, 50.0)
        snapshot = await db.get_pulse_snapshot_24h(topic)
        previous = snapshot["pulse_score"] if snapshot else current
        delta = round(current - previous, 1)
        deltas.append({
            "topic": topic,
            "label": topic.replace("-", " ").title(),
            "current": current,
            "previous": previous,
            "delta": delta,
            "has_baseline": bool(snapshot),
        })

        try:
            neg_articles = 0
            total_articles = 0
            for cluster in current_clusters:
                cluster_text = f"{cluster.get('thread_title', '')} {cluster.get('summary', '')}".lower()
                keywords = TOPIC_KEYWORDS.get(topic, [topic])
                if any(kw in cluster_text for kw in keywords):
                    total_articles += len(cluster.get("article_ids", []))
                    if cluster.get("risk_type") == "risk":
                        neg_articles += len(cluster.get("article_ids", []))
            neg_ratio = neg_articles / max(total_articles, 1)
            await db.save_pulse_snapshot(topic, current, total_articles, neg_ratio)
        except Exception as e:
            logger.warning(f"Pulse snapshot save for '{topic}': {e}")

    return deltas


# ---------------------------------------------------------------------------
# Core Intelligence Pipeline (used by both bg scheduler and manual refresh)
# ---------------------------------------------------------------------------

async def _build_intelligence(
    topics: list,
    regions: list,
    run_llm: bool = True,
    reuse_payload: Optional[dict] = None,
) -> dict:
    """
    Execute the full intelligence pipeline. Returns the dashboard payload dict.
    If run_llm=False, skips LLM synthesis (reuses cached brief if available).
    """
    global _cached_payload

    # 1. Fetch News
    articles = await news_fetcher.fetch_news(topics=topics, regions=regions, max_articles=12)
    if not articles:
        logger.warning("No articles fetched — keeping existing cache.")
        return _cached_payload or {"status": "error", "message": "No articles available"}

    logger.info(f"Pipeline: {len(articles)} articles for {topics}")

    # 2. HF Analysis (FREE — parallel)
    async def analyze_one(article):
        cached_analysis = _get_cached_article_analysis(article)
        if cached_analysis:
            return {
                "id": article["id"],
                "title": article["title"],
                "source": article["source"],
                "url": article.get("url", ""),
                "published": article.get("published", ""),
                "text_preview": article["text"][:300],
                "entities": cached_analysis.get("entities", []),
                "sentiment": cached_analysis.get("sentiment", {"label": "NEUTRAL", "confidence": 0.5}),
            }

        rich_text = f"{article['title']}. {article['text'][:1200]}"
        ner_task = hf_client.extract_entities(rich_text[:1000])
        sent_task = hf_client.analyze_sentiment(rich_text[:800])
        ner_result, sent_result = await asyncio.gather(ner_task, sent_task)
        result = {
            "id": article["id"],
            "title": article["title"],
            "source": article["source"],
            "url": article.get("url", ""),
            "published": article.get("published", ""),
            "text_preview": article["text"][:300],
            "entities": ner_result.get("entities", []),
            "sentiment": {
                "label": sent_result.get("label", "NEUTRAL").upper(),
                "confidence": round(sent_result.get("score", 0.5), 3),
            },
        }
        _put_cached_article_analysis(
            article,
            {
                "entities": result["entities"],
                "sentiment": result["sentiment"],
            },
        )
        return result

    analysis_results = await asyncio.gather(*[analyze_one(a) for a in articles])

    # 3. AI Synthesis (only if run_llm=True)
    intelligence = {}
    if run_llm:
        combined_text = "\n\n".join([f"[{a['source']}] {a['title']}\n{a['text']}" for a in articles])
        article_index = [{"id": a["id"], "title": a["title"], "source": a["source"]} for a in analysis_results]
        intelligence = await hf_client.generate_full_intelligence(
            articles_text=combined_text,
            article_list=article_index,
            user_categories=topics,
            user_regions=regions,
        )
    elif reuse_payload or _cached_payload:
        # Reuse previous LLM output
        source_payload = reuse_payload or _cached_payload or {}
        intelligence = {
            "daily_brief": source_payload.get("daily_brief", ""),
            "clusters": source_payload.get("clusters", []),
            "impact": source_payload.get("impact", {}),
            "_synthesis_provider": "cache_reuse",
        }

    # 4. Build article lookup
    artMap = {str(a["id"]): a for a in analysis_results}

    # 5. Enrich clusters with deterministic signal tiers + exposure scores
    clusters = intelligence.get("clusters", [])
    for cluster in clusters:
        c_articles = [artMap[str(aid)] for aid in cluster.get("article_ids", []) if str(aid) in artMap]
        source_count = len(c_articles)
        unique_sources = len(set(a["source"] for a in c_articles)) if c_articles else 0
        source_diversity = unique_sources / max(source_count, 1)
        pos_count = sum(1 for a in c_articles if a["sentiment"]["label"] == "POSITIVE")
        neg_count = sum(1 for a in c_articles if a["sentiment"]["label"] == "NEGATIVE")
        total = max(len(c_articles), 1)
        sentiment_intensity = abs(pos_count - neg_count) / total

        cluster_text = f"{cluster.get('thread_title', '')} {cluster.get('summary', '')} {cluster.get('impact_line', '')}"
        for a in c_articles:
            cluster_text += f" {a['title']}"

        exposure = compute_exposure_score(cluster_text, topics, regions)
        cluster["exposure_score"] = exposure
        cluster["matched_preferences"] = _matched_profile_topics(cluster_text, topics)

        pulse = cluster.get("pulse_score", 50)
        tier = classify_signal_tier(pulse, source_count, source_diversity, sentiment_intensity, exposure)
        cluster["signal_tier"] = tier
        cluster["source_count"] = source_count
        cluster["source_diversity"] = round(source_diversity, 2)
        cluster["sentiment_intensity"] = round(sentiment_intensity, 2)
        cluster["updated_at"] = datetime.now(timezone.utc).isoformat()

    tier_order = {"CRITICAL": 0, "SIGNAL": 1, "WATCH": 2, "NOISE": 3}
    clusters.sort(key=lambda c: (tier_order.get(c.get("signal_tier", "NOISE"), 3), -c.get("pulse_score", 0)))

    # 6. Tension Map
    tension = {}
    all_entities = []
    for result in analysis_results:
        for ent in result["entities"]:
            all_entities.append(ent)
            if ent.get("type") in ("LOC", "GPE", "ORG", "location"):
                name = ent["name"]
                tension[name] = tension.get(name, 30)
                if result["sentiment"]["label"] == "NEGATIVE":
                    tension[name] += int(result["sentiment"]["confidence"] * 40)
                elif result["sentiment"]["label"] == "POSITIVE":
                    tension[name] -= 10
                else:
                    tension[name] += 5
    for k in tension:
        tension[k] = max(10, min(95, tension[k]))

    # 7. Daily Delta
    daily_delta = await compute_daily_delta(topics, clusters)

    # 8. Aggregate Exposure
    signal_clusters = [c for c in clusters if c.get("signal_tier") in ("CRITICAL", "SIGNAL")]
    aggregate_exposure = round(sum(c["exposure_score"] for c in signal_clusters) / len(signal_clusters)) if signal_clusters else 50

    # 9. Opportunity Radar
    impact = intelligence.get("impact", {})
    opportunity_radar = {
        "top_risk": impact.get("top_risk", ""),
        "top_opportunity": impact.get("top_opportunity", ""),
    }

    # 10. Monitoring Queue
    monitoring_queue = [
        {
            "thread_title": c.get("thread_title", ""),
            "pulse_score": c.get("pulse_score", 50),
            "updated_at": c.get("updated_at", ""),
            "source_count": c.get("source_count", 0),
        }
        for c in clusters if c.get("signal_tier") == "WATCH"
    ]

    # Background entity tracking
    asyncio.create_task(_track_entities_bg(all_entities))

    now = datetime.now(timezone.utc)

    return {
        "status": "success",
        "version": "12.0.0",
        "daily_brief": intelligence.get("daily_brief", ""),
        "articles": analysis_results,
        "clusters": clusters,
        "impact": impact,
        "tension_index": tension,
        "daily_delta": daily_delta,
        "exposure_score": aggregate_exposure,
        "opportunity_radar": opportunity_radar,
        "monitoring_queue": monitoring_queue,
        "sources_count": len(articles),
        "topics_used": topics,
        "regions_used": regions,
        "generated_at": now.isoformat(),
        "refresh_type": "full" if run_llm else "fast",
        "pipeline_status": {
            "news": "google_rss",
            "nlp": "huggingface_space_cached",
            "synthesis": intelligence.get("_synthesis_provider", "skipped"),
            "is_ai_synthesized": intelligence.get("_synthesis_provider") in ("openrouter", "gemini"),
            "cache": "profile-scoped" if topics or regions else "shared",
            "quota_saving": [
                "Dashboard GET serves memory cache.",
                "Fast refresh reuses previous LLM synthesis.",
                "Article NER and sentiment are cached for 30 minutes.",
                "OpenRouter is tried before Gemini; deterministic fallback avoids retry loops.",
            ],
        },
        "next_refresh_at": (now + timedelta(seconds=FAST_INTERVAL)).isoformat(),
    }


async def _track_entities_bg(entities):
    try:
        await db.track_entities(entities)
    except Exception as e:
        logger.warning(f"Entity tracking: {e}")


# ---------------------------------------------------------------------------
# Background Scheduler
# ---------------------------------------------------------------------------

async def _get_broad_topics(cycle: int = 0):
    """Get topic categories for the background scheduler.
    Alternates between two batches to cover ALL categories within 2 cycles."""
    all_topics = list(TOPIC_KEYWORDS.keys())  # All 16 categories
    mid = len(all_topics) // 2
    # Even cycles: first half, Odd cycles: second half
    batch = all_topics[:mid] if (cycle % 2 == 0) else all_topics[mid:]
    return batch, []


async def _get_user_prefs_from_header(request: Request):
    """Extract user's Firebase UID from X-User-Id header and return their preferences."""
    uid = request.headers.get("X-User-Id", "").strip()
    email = request.headers.get("X-User-Email", "").strip().lower()
    if not uid and not email:
        return ["tech", "ai", "markets"], [], uid, False

    try:
        prefs = await db.get_user_prefs(uid) if uid else None
        if not prefs and email:
            prefs = await db.get_user_prefs_by_email(email)
        if prefs:
            topics = _normalize_profile_values(json.loads(prefs["preferred_categories"] or "[]"))
            regions = _normalize_profile_values(json.loads(prefs["preferred_regions"] or "[]"))
            if topics or regions:
                return topics, regions, uid, True
    except Exception as e:
        logger.warning(f"Prefs lookup for {uid}: {e}")

    return ["tech", "ai", "markets"], [], uid, False


def _schedule_shared_refresh(*, run_llm: bool = False) -> asyncio.Task:
    global _shared_refresh_task

    if _task_running(_shared_refresh_task):
        return _shared_refresh_task

    async def runner():
        global _shared_refresh_task
        try:
            await _silent_refresh(run_llm=run_llm)
        finally:
            if _shared_refresh_task is asyncio.current_task():
                _shared_refresh_task = None

    _shared_refresh_task = asyncio.create_task(runner())
    return _shared_refresh_task


async def _silent_refresh_profile(topics: list, regions: list, run_llm: bool = False):
    try:
        await _refresh_profile_cache(
            topics,
            regions,
            force_refresh_news=True,
            run_llm=run_llm,
        )
        logger.info("Silent personalized refresh complete.")
    except Exception as e:
        logger.error(f"Silent personalized refresh failed: {e}")


async def _background_scheduler():
    """
    Background loop that pre-computes intelligence.
    - Every FAST_INTERVAL: RSS + NLP + tiers (no LLM)
    - Every FULL_INTERVAL: RSS + NLP + tiers + LLM synthesis
    """
    global _cached_payload, _cached_at

    cycle_count = 0

    # Initial full run on startup (after a short delay to let DB init)
    await asyncio.sleep(3)
    logger.info("Background scheduler: initial full pipeline run...")
    try:
        topics, regions = await _get_broad_topics()
        news_fetcher.force_refresh()
        payload = await _build_intelligence(topics, regions, run_llm=True)
        async with _cache_lock:
            _cached_payload = payload
            _cached_at = datetime.now(timezone.utc)
        logger.info(f"Initial intelligence cached: {len(payload.get('clusters', []))} clusters")
    except Exception as e:
        logger.error(f"Initial pipeline failed: {e}")

    # Periodic loop
    while True:
        try:
            await asyncio.sleep(FAST_INTERVAL)
            cycle_count += 1

            topics, regions = await _get_broad_topics(cycle_count)
            news_fetcher.force_refresh()

            # Every 3rd cycle (15 min) = full LLM refresh, otherwise fast
            run_llm = (cycle_count % 3 == 0)
            refresh_type = "full" if run_llm else "fast"
            logger.info(f"Background refresh #{cycle_count} ({refresh_type})...")

            payload = await _build_intelligence(topics, regions, run_llm=run_llm)

            async with _cache_lock:
                _cached_payload = payload
                _cached_at = datetime.now(timezone.utc)

            logger.info(f"Background {refresh_type} refresh complete: {len(payload.get('clusters', []))} clusters")

        except asyncio.CancelledError:
            logger.info("Background scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"Background refresh error: {e}")
            await asyncio.sleep(30)  # Wait before retry on error


# ---------------------------------------------------------------------------
# Dashboard Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
async def get_cached_dashboard(request: Request):
    """
    Serve cached intelligence INSTANTLY, personalized per user.
    Reads X-User-Id header to personalize exposure scores and delta.
    Uses the event-backed dashboard read model.
    """
    user_topics, user_regions, _, _ = await _get_user_prefs_from_header(request)
    return await _event_backed_dashboard_payload(user_topics, user_regions)


@app.post("/api/dashboard")
async def force_refresh_dashboard(request: Request, payload_request: DashboardRequest):
    """Force a refresh. Uses requested topics or the saved profile when available."""
    user_topics, user_regions, _, has_saved_profile = await _get_user_prefs_from_header(request)
    requested_topics = _normalize_profile_values(payload_request.topics)
    requested_regions = _normalize_profile_values(payload_request.regions)
    effective_topics = requested_topics or (user_topics if has_saved_profile else [])
    effective_regions = requested_regions or (user_regions if has_saved_profile else [])
    return await _event_backed_dashboard_payload(effective_topics, effective_regions)


async def _run_admin_ingestion(topics: list[str], regions: list[str], max_articles: int) -> dict:
    from app.workers.ingestion_worker import run_ingestion

    return await run_ingestion(
        _normalize_profile_values(topics) or ["ai", "tech", "markets"],
        _normalize_profile_values(regions) or ["global"],
        max_articles=max(1, min(int(max_articles or 40), 100)),
    )


@app.post("/api/admin/ingest-now")
async def ingest_now(request: Request, payload: IngestNowRequest):
    """Protected trigger for external schedulers such as Cloud Command."""
    expected_secret = os.getenv("INGEST_SECRET") or os.getenv("GATEWAY_SECRET")
    supplied_secret = (
        request.headers.get("X-Ingest-Secret", "").strip()
        or request.headers.get("X-Gateway-Secret", "").strip()
    )
    if not expected_secret or supplied_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid ingestion secret")

    topics = _normalize_profile_values(payload.topics) or ["ai", "tech", "markets"]
    regions = _normalize_profile_values(payload.regions) or ["global"]
    max_articles = max(1, min(int(payload.max_articles or 40), 100))
    try:
        result = await _run_admin_ingestion(topics, regions, max_articles)
    except Exception as exc:
        logger.error("Admin ingestion failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Ingestion failed",
                "error": str(exc)[:500],
                "topics": topics,
                "regions": regions,
                "max_articles": max_articles,
            },
        )
    return {
        "status": "success",
        "message": "Ingestion completed",
        "topics": topics,
        "regions": regions,
        "max_articles": max_articles,
        "result": result,
    }


async def _silent_refresh(run_llm: bool = False):
    """Non-blocking background refresh triggered by stale cache."""
    global _cached_payload, _cached_at
    async with _cache_lock:
        try:
            topics, regions = await _get_broad_topics()
            news_fetcher.force_refresh()
            payload = await _build_intelligence(
                topics,
                regions,
                run_llm=run_llm,
                reuse_payload=_cached_payload,
            )
            _cached_payload = payload
            _cached_at = datetime.now(timezone.utc)
            logger.info("Silent background refresh complete.")
        except Exception as e:
            logger.error(f"Silent refresh failed: {e}")


# ---------------------------------------------------------------------------
# Story Deep Dive
# ---------------------------------------------------------------------------
@app.post("/api/stories/deep-dive")
async def story_deep_dive(request: StoryDeepDiveRequest):
    text = request.text[:2000] if len(request.text) > 30 else request.title
    ner_task = hf_client.extract_entities(text)
    sent_task = hf_client.analyze_sentiment(f"{request.title}. {text}")
    persp_task = hf_client.analyze_perspectives(text)
    entities_result, sentiment_result, perspectives = await asyncio.gather(
        ner_task, sent_task, persp_task
    )
    return {
        "status": "success",
        "title": request.title,
        "entities": entities_result.get("entities", []),
        "sentiment": {
            "label": sentiment_result.get("label", "NEUTRAL").upper(),
            "score": round(sentiment_result.get("score", 0.5), 3),
        },
        "perspectives": perspectives if isinstance(perspectives, list) else [],
    }


# ---------------------------------------------------------------------------
# Phase 5 Personal Intelligence Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/personalized-dashboard")
async def personalized_dashboard(request: Request):
    user_topics, user_regions, uid, _ = await _get_user_prefs_from_header(request)
    user_id = uid or _user_id_from_request(request)
    base = await get_cached_dashboard(request)
    phase5 = await _phase5_profile(user_id)
    personalized = _personalize_payload(base, user_id, user_topics, user_regions, phase5)
    pulse_history = await db.get_pulse_history(user_topics, days=30)
    for cluster in personalized.get("clusters", []):
        matched_topics = [m.get("id") for m in cluster.get("matched_preferences", []) if m.get("id")]
        topic = (matched_topics or user_topics or [None])[0]
        series = pulse_history.get(topic, []) if topic else []
        cluster["pulse_trend"] = [point["pulse_score"] for point in series[-12:]]
        cluster["pulse_history_topic"] = topic
    personalized["pulse_history"] = pulse_history
    await _ensure_alerts(user_id, personalized, phase5)
    personalized["alerts"] = await db.list_alerts(user_id, unresolved_only=True)
    personalized["exposure_network"] = _build_exposure_network(user_id, personalized, user_topics, phase5)
    return personalized


@app.get("/api/watchlist")
async def get_watchlist(request: Request):
    user_id = _user_id_from_request(request)
    return {
        "watched_signals": await db.list_watched_signals(user_id),
        "saved_threads": await db.list_saved_threads(user_id),
    }


@app.post("/api/watchlist")
async def add_watchlist(request: Request, payload: WatchlistInput):
    user_id = _user_id_from_request(request)
    await db.watch_signal(user_id, payload.signal_id, payload.watch_priority)
    return {"status": "success", "watched_signals": await db.list_watched_signals(user_id)}


@app.post("/api/saved-threads")
async def add_saved_thread(request: Request, payload: SavedThreadInput):
    user_id = _user_id_from_request(request)
    await db.save_thread(user_id, payload.thread_id)
    return {"status": "success", "saved_threads": await db.list_saved_threads(user_id)}


@app.get("/api/entities")
async def get_entities(request: Request):
    user_id = _user_id_from_request(request)
    return {"tracked_entities": await db.list_tracked_entities(user_id)}


@app.post("/api/entities")
async def add_entity(request: Request, payload: TrackedEntityInput):
    user_id = _user_id_from_request(request)
    await db.track_user_entity(user_id, payload.entity_name, payload.entity_type, payload.follow_weight)
    return {"status": "success", "tracked_entities": await db.list_tracked_entities(user_id)}


@app.post("/api/dismissed-signals")
async def dismiss_signal_endpoint(request: Request, payload: DismissSignalInput):
    user_id = _user_id_from_request(request)
    await db.dismiss_signal(user_id, payload.signal_id, payload.dismiss_reason)
    return {"status": "success", "dismissed_signals": await db.list_dismissed_signals(user_id)}


@app.post("/api/interactions")
async def record_interaction_endpoint(request: Request, payload: InteractionInput):
    user_id = _user_id_from_request(request)
    await db.record_interaction(
        user_id,
        payload.signal_id,
        payload.interaction_type,
        payload.dwell_time_seconds,
        payload.metadata,
    )
    return {"status": "success"}


@app.get("/api/alerts")
async def get_alerts(request: Request):
    user_id = _user_id_from_request(request)
    rows = await db.list_alerts(user_id)
    return {
        "alerts": rows,
        "unread_count": sum(1 for row in rows if row.get("unread") and not row.get("resolved")),
    }


@app.get("/api/story-graph/{thread_id}")
async def get_story_graph(request: Request, thread_id: str):
    base = await personalized_dashboard(request)
    for cluster in base.get("clusters", []):
        if cluster.get("thread_id") == thread_id or cluster.get("signal_id") == thread_id:
            return cluster.get("story_graph") or build_story_graph(cluster, base.get("articles", []), base.get("topics_used", []), base.get("regions_used", []))
    raise HTTPException(status_code=404, detail="Story graph not found")


@app.get("/api/pulse-history")
async def get_pulse_history(request: Request, days: int = Query(30, ge=1, le=90)):
    user_topics, _, _, has_profile = await _get_user_prefs_from_header(request)
    topics = user_topics if has_profile else list(TOPIC_KEYWORDS.keys())[:6]
    history = await db.get_pulse_history(topics, days=days)
    return {
        "topics": topics,
        "history": history,
        "windows": {
            "24h": {topic: values[-24:] for topic, values in history.items()},
            "7d": {topic: values[-168:] for topic, values in history.items()},
            "30d": history,
        },
    }


@app.get("/api/exposure-network")
async def get_exposure_network(request: Request):
    user_topics, _, uid, _ = await _get_user_prefs_from_header(request)
    user_id = uid or _user_id_from_request(request)
    base = await personalized_dashboard(request)
    phase5 = await _phase5_profile(user_id)
    return _build_exposure_network(user_id, base, user_topics, phase5)


def _build_exposure_network(user_id: str, payload: dict, user_topics: list, phase5: dict) -> dict:
    nodes = [{"id": user_id, "label": "You", "type": "user"}]
    edges = []
    for topic in user_topics or []:
        topic_id = f"topic:{topic}"
        nodes.append({"id": topic_id, "label": topic.replace("-", " ").title(), "type": "topic"})
        edges.append({"from": user_id, "to": topic_id, "relationship": "tracks"})
    for ent in phase5.get("tracked_entities", []):
        ent_id = f"entity:{ent['entity_name']}"
        nodes.append({"id": ent_id, "label": ent["entity_name"], "type": "entity", "weight": ent.get("follow_weight", 1)})
        edges.append({"from": user_id, "to": ent_id, "relationship": "follows"})
    for cluster in payload.get("clusters", [])[:6]:
        sig_id = f"signal:{cluster.get('signal_id') or _signal_id(cluster)}"
        nodes.append({"id": sig_id, "label": cluster.get("thread_title", "Signal"), "type": "signal", "exposure": cluster.get("relevance_score", cluster.get("exposure_score", 50))})
        for match in cluster.get("matched_preferences", []):
            topic_id = f"topic:{match.get('id')}"
            edges.append({"from": topic_id, "to": sig_id, "relationship": "matches"})
        for ent in cluster.get("entities", [])[:3]:
            ent_id = f"entity:{ent['name']}"
            if any(n["id"] == ent_id for n in nodes):
                edges.append({"from": ent_id, "to": sig_id, "relationship": "mentioned"})
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# User Preferences
# ---------------------------------------------------------------------------
@app.post("/api/user/preferences")
async def save_preferences(request: Request, prefs: UserPreferencesInput):
    uid = request.headers.get("X-User-Id", "").strip() or "local_user_123"
    await db.upsert_user_prefs(uid, prefs.dict())
    logger.info(f"Saved preferences for user {uid}: {prefs.preferred_categories}")
    return {"status": "success"}

@app.get("/api/user/preferences")
async def get_preferences(request: Request):
    uid = request.headers.get("X-User-Id", "").strip() or "local_user_123"
    email = request.headers.get("X-User-Email", "").strip().lower()
    prefs = await db.get_user_prefs(uid)
    if not prefs and email:
        prefs = await db.get_user_prefs_by_email(email)
    if not prefs:
        return {"status": "not_found", "data": None}
    return {"status": "success", "data": dict(prefs)}

@app.delete("/api/user/account")
async def delete_account(request: Request):
    """Delete user preferences and reset account. User will see onboarding again."""
    uid = request.headers.get("X-User-Id", "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="No user ID provided")
    await db.delete_user_prefs(uid)
    logger.info(f"Deleted account data for user {uid}")
    return {"status": "success", "message": "Account data deleted"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "version": "12.0.0-event-backed",
        "pipeline": "Postgres events -> dashboard read model",
        "source_of_truth": "events,event_articles",
        "scheduler": "external_worker",
    }
