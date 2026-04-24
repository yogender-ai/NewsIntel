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
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import hf_client
import news_fetcher

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

    # Start background intelligence loop
    _bg_task = asyncio.create_task(_background_scheduler())
    logger.info(f"Background scheduler started: fast={FAST_INTERVAL}s, full={FULL_INTERVAL}s")

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------
class DashboardRequest(BaseModel):
    topics: List[str] = []
    regions: List[str] = []

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
    if not uid:
        return ["tech", "ai", "markets"], [], uid, False

    try:
        prefs = await db.get_user_prefs(uid)
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
    """
    global _cached_payload, _cached_at

    # Get this user's preferences
    user_topics, user_regions, uid, has_saved_profile = await _get_user_prefs_from_header(request)

    if has_saved_profile:
        cache_key = _profile_cache_key(user_topics, user_regions)
        cached_profile = _profile_cache.get(cache_key)

        if cached_profile:
            refresh_in_progress = _task_running(_profile_refresh_tasks.get(cache_key))
            response = _attach_cache_metadata(
                cached_profile["payload"],
                cached_profile.get("cached_at"),
                personalized=True,
                refresh_in_progress=refresh_in_progress,
            )
            if response["is_stale"] and not refresh_in_progress:
                run_full_refresh = response["cache_age_seconds"] >= FULL_INTERVAL
                logger.info(f"Profile cache stale for {uid or cache_key}; triggering refresh")
                _schedule_profile_refresh(
                    user_topics,
                    user_regions,
                    force_refresh_news=True,
                    run_llm=run_full_refresh,
                )
                response["refresh_in_progress"] = True
            return response

        logger.info(f"No personalized cache for {uid or cache_key}; building profile feed")
        payload, cached_at, _ = await _refresh_profile_cache(user_topics, user_regions)
        return _attach_cache_metadata(payload, cached_at, personalized=True)

    if _cached_payload:
        response = _attach_cache_metadata(
            _cached_payload,
            _cached_at,
            personalized=False,
            refresh_in_progress=_task_running(_shared_refresh_task),
        )
        if response["is_stale"] and not response["refresh_in_progress"]:
            run_full_refresh = response["cache_age_seconds"] >= FULL_INTERVAL
            logger.info(f"Shared cache stale ({response['cache_age_seconds']}s old); triggering refresh")
            _schedule_shared_refresh(run_llm=run_full_refresh)
            response["refresh_in_progress"] = True
        return response
        """Legacy shared-personalization path removed in favor of profile-scoped feeds.


        if uid and response.get("clusters"):
            clusters = []
            for c in response["clusters"]:
                c_copy = {**c}
                cluster_text = f"{c.get('thread_title', '')} {c.get('summary', '')} {c.get('impact_line', '')}"
                user_exposure = compute_exposure_score(cluster_text, user_topics, user_regions)
                c_copy["exposure_score"] = user_exposure

                # Re-classify signal tier with THIS USER's exposure score
                c_copy["signal_tier"] = classify_signal_tier(
                    c.get("pulse_score", 50),
                    c.get("source_count", 1),
                    c.get("source_diversity", 0.5),
                    c.get("sentiment_intensity", 0.5),
                    user_exposure  # <-- per-user, not global
                )
                clusters.append(c_copy)

            # Re-sort: CRITICAL first, then SIGNAL, then by pulse_score
            tier_order = {"CRITICAL": 0, "SIGNAL": 1, "WATCH": 2, "NOISE": 3}
            clusters.sort(key=lambda c: (tier_order.get(c.get("signal_tier", "NOISE"), 3), -c.get("pulse_score", 0)))
            response["clusters"] = clusters

            # Recalculate aggregate exposure for this user
            signal_clusters = [c for c in clusters if c.get("signal_tier") in ("CRITICAL", "SIGNAL")]
            response["exposure_score"] = round(sum(c["exposure_score"] for c in signal_clusters) / len(signal_clusters)) if signal_clusters else 50

        # Personalize daily delta with user's topics
        if uid:
            try:
                response["daily_delta"] = await compute_daily_delta(user_topics, response.get("clusters", []))
            except Exception:
                pass

        response["cache_age_seconds"] = int(age_seconds)
        response["cached_at"] = _cached_at.isoformat() if _cached_at else None
        response["is_stale"] = age_seconds > STALE_THRESHOLD

        if age_seconds > STALE_THRESHOLD:
            logger.info(f"Cache stale ({int(age_seconds)}s old) — triggering background refresh")
            asyncio.create_task(_silent_refresh())

        return response

    # No cache yet — run full pipeline synchronously (first load only)
    logger.info("No cache available — running initial pipeline...")
        """
    topics, regions = await _get_broad_topics()
    payload = await _build_intelligence(topics, regions, run_llm=True)
    async with _cache_lock:
        _cached_payload = payload
        _cached_at = datetime.now(timezone.utc)
    return _attach_cache_metadata(payload, _cached_at, personalized=False)


@app.post("/api/dashboard")
async def force_refresh_dashboard(request: Request, payload_request: DashboardRequest):
    """Force a refresh. Uses requested topics or the saved profile when available."""
    global _cached_payload, _cached_at

    user_topics, user_regions, _, has_saved_profile = await _get_user_prefs_from_header(request)
    requested_topics = _normalize_profile_values(payload_request.topics)
    requested_regions = _normalize_profile_values(payload_request.regions)
    effective_topics = requested_topics or (user_topics if has_saved_profile else [])
    effective_regions = requested_regions or (user_regions if has_saved_profile else [])

    news_fetcher.force_refresh()
    hf_client.clear_cache(prefixes=("openrouter", "gemini"))
    logger.info("Force refresh triggered by user.")

    if effective_topics or effective_regions:
        payload, cached_at, _ = await _refresh_profile_cache(
            effective_topics,
            effective_regions,
            clear_model_cache=False,
        )
        return _attach_cache_metadata(payload, cached_at, personalized=True)

    topics, regions = await _get_broad_topics()
    payload = await _build_intelligence(topics, regions, run_llm=True)
    async with _cache_lock:
        _cached_payload = payload
        _cached_at = datetime.now(timezone.utc)

    return _attach_cache_metadata(payload, _cached_at, personalized=False)


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
    prefs = await db.get_user_prefs(uid)
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
        "version": "12.0.0",
        "pipeline": "Background Scheduler → Cached Response",
        "cache_available": _cached_payload is not None,
        "profile_cache_entries": len(_profile_cache),
        "cached_at": _cached_at.isoformat() if _cached_at else None,
        "fast_interval_sec": FAST_INTERVAL,
        "full_interval_sec": FULL_INTERVAL,
    }
