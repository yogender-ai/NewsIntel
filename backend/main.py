"""
News-Intel Backend v11 — Signal Intelligence Pipeline

Pipeline: RSS → HF(NER+Sentiment) → OpenRouter/Gemini(Synthesis) → Signal Classification → Response

New in v11:
- Deterministic signal_tier (CRITICAL/SIGNAL/WATCH/NOISE) per cluster
- Exposure scoring (user prefs × cluster relevance)
- Daily Delta (topic-level pulse comparison vs 24h snapshot)
- Opportunity Radar (top risk + top opportunity from AI)
- Monitoring Queue (WATCH-tier threads with timestamps)
"""

import logging
import json
import asyncio
from contextlib import asynccontextmanager
from typing import List
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import hf_client
import news_fetcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("news-intel-api")


# ---------------------------------------------------------------------------
# Database Lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.database.connect()
    await db.init_db()
    logger.info("News-Intel v11 (Signal Intelligence) ready. DB connected.")
    yield
    await db.database.disconnect()


app = FastAPI(title="News-Intel v11", version="11.0.0", lifespan=lifespan)

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
    preferred_categories: List[str] = []
    preferred_regions: List[str] = []
    youtube_channels: List[str] = []
    onboarded: bool = True


# ---------------------------------------------------------------------------
# Signal Tier Classification (DETERMINISTIC — no LLM dependency)
# ---------------------------------------------------------------------------

def classify_signal_tier(pulse_score: float, source_count: int, source_diversity: float,
                         sentiment_intensity: float, exposure_score: float) -> str:
    """
    Classify a cluster into CRITICAL / SIGNAL / WATCH / NOISE using weighted scoring.

    Inputs:
        pulse_score: 0-100 from AI (urgency/scale)
        source_count: number of articles in cluster
        source_diversity: ratio of unique sources to total articles (0-1)
        sentiment_intensity: abs(positive_ratio - negative_ratio), 0-1
        exposure_score: 0-100 personal relevance to user

    Returns: "CRITICAL", "SIGNAL", "WATCH", or "NOISE"
    """
    # Weighted composite score (0-100)
    composite = (
        pulse_score * 0.35 +
        min(source_count * 12, 100) * 0.15 +  # Cap at ~8 sources = 100
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
# Exposure Scoring (user prefs × cluster content overlap)
# ---------------------------------------------------------------------------

# Keyword maps for matching user preferences to cluster content
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
}

REGION_KEYWORDS = {
    "us": ["united states", "america", "us", "washington", "biden", "trump", "federal reserve"],
    "china": ["china", "beijing", "chinese", "xi jinping", "ccp", "taiwan"],
    "india": ["india", "indian", "modi", "delhi", "mumbai", "rupee"],
    "europe": ["europe", "eu", "european", "brussels", "germany", "france", "uk", "britain"],
    "middle-east": ["middle east", "iran", "israel", "saudi", "gaza", "yemen", "syria"],
    "russia": ["russia", "russian", "moscow", "putin", "ukraine", "kremlin"],
    "japan-korea": ["japan", "japanese", "korea", "korean", "tokyo", "samsung"],
    "latam": ["latin america", "brazil", "mexico", "argentina", "colombia"],
    "africa": ["africa", "african", "nigeria", "south africa", "kenya", "egypt"],
    "southeast-asia": ["southeast asia", "singapore", "vietnam", "indonesia", "philippines", "thailand"],
}


def compute_exposure_score(cluster_text: str, user_topics: list, user_regions: list) -> int:
    """
    Compute exposure score (0-100) based on keyword overlap between
    cluster content and user's tracked topics + regions.
    """
    if not user_topics and not user_regions:
        return 50  # Default mid-range if no prefs

    text_lower = cluster_text.lower()
    hits = 0
    total_keywords = 0

    # Check topic keywords
    for topic in user_topics:
        keywords = TOPIC_KEYWORDS.get(topic, [topic])
        total_keywords += len(keywords)
        for kw in keywords:
            if kw in text_lower:
                hits += 1

    # Check region keywords
    for region in user_regions:
        keywords = REGION_KEYWORDS.get(region, [region])
        total_keywords += len(keywords)
        for kw in keywords:
            if kw in text_lower:
                hits += 1

    if total_keywords == 0:
        return 50

    # Raw overlap ratio → scale to 0-100 with a boost curve
    # Even 2-3 keyword hits should produce meaningful scores
    ratio = hits / total_keywords
    # Boost: sqrt curve so low matches still register
    score = min(100, int((ratio ** 0.5) * 100))

    # Minimum floor of 10 if there's ANY hit
    if hits > 0 and score < 15:
        score = 15

    return score


# ---------------------------------------------------------------------------
# Daily Delta (topic-level pulse comparison)
# ---------------------------------------------------------------------------

async def compute_daily_delta(topics: list, current_clusters: list) -> list:
    """
    Compare aggregated topic pulse scores (current vs 24h-ago snapshot).
    Returns list of {topic, current, previous, delta}.
    """
    # Aggregate current pulse per topic from cluster content
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
            topic_pulse_current[topic] = 50.0  # Default neutral

    deltas = []
    for topic in topics:
        current = topic_pulse_current.get(topic, 50.0)

        # Get 24h-ago snapshot
        snapshot = await db.get_pulse_snapshot_24h(topic)
        previous = snapshot["pulse_score"] if snapshot else current  # No history = no change

        delta = round(current - previous, 1)
        deltas.append({
            "topic": topic,
            "label": topic.replace("-", " ").title(),
            "current": current,
            "previous": previous,
            "delta": delta,
        })

        # Save current snapshot for future delta calculations
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
# Dashboard
# ---------------------------------------------------------------------------
@app.post("/api/dashboard")
async def get_dashboard(request: DashboardRequest, force: bool = False):
    if force:
        news_fetcher.force_refresh()
        hf_client._cache.clear()
        logger.info("Force refresh triggered.")

    topics = request.topics or ["tech", "ai", "markets"]
    regions = request.regions or []

    # Try stored preferences if none sent
    if not request.topics:
        try:
            prefs = await db.get_user_prefs("local_user_123")
            if prefs:
                db_cats = json.loads(prefs["preferred_categories"] or "[]")
                db_regs = json.loads(prefs["preferred_regions"] or "[]")
                if db_cats: topics = db_cats
                if db_regs: regions = db_regs
        except Exception as e:
            logger.warning(f"Prefs lookup: {e}")

    # 1. Fetch News
    articles = await news_fetcher.fetch_news(topics=topics, regions=regions, max_articles=12)
    if not articles:
        raise HTTPException(503, "Could not fetch news. Try again.")

    logger.info(f"Fetched {len(articles)} articles for {topics}")

    # 2. HF Analysis (FREE — parallel)
    async def analyze_one(article):
        rich_text = f"{article['title']}. {article['text'][:1200]}"
        ner_task = hf_client.extract_entities(rich_text[:1000])
        sent_task = hf_client.analyze_sentiment(rich_text[:800])
        ner_result, sent_result = await asyncio.gather(ner_task, sent_task)

        return {
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

    analysis_results = await asyncio.gather(*[analyze_one(a) for a in articles])

    # 3. AI Synthesis (OpenRouter primary → Gemini fallback)
    combined_text = "\n\n".join([f"[{a['source']}] {a['title']}\n{a['text']}" for a in articles])
    article_index = [{"id": a["id"], "title": a["title"], "source": a["source"]} for a in analysis_results]

    intelligence = await hf_client.generate_full_intelligence(
        articles_text=combined_text,
        article_list=article_index,
        user_categories=topics,
        user_regions=regions,
    )

    # 4. Build article lookup
    artMap = {}
    for a in analysis_results:
        artMap[str(a["id"])] = a

    # 5. Enrich clusters with DETERMINISTIC signal tiers + exposure scores
    clusters = intelligence.get("clusters", [])
    for cluster in clusters:
        # Get articles in this cluster
        c_articles = [artMap[str(aid)] for aid in cluster.get("article_ids", []) if str(aid) in artMap]
        source_count = len(c_articles)
        unique_sources = len(set(a["source"] for a in c_articles)) if c_articles else 0
        source_diversity = unique_sources / max(source_count, 1)

        # Sentiment intensity: how polarized is this cluster?
        pos_count = sum(1 for a in c_articles if a["sentiment"]["label"] == "POSITIVE")
        neg_count = sum(1 for a in c_articles if a["sentiment"]["label"] == "NEGATIVE")
        total = max(len(c_articles), 1)
        sentiment_intensity = abs(pos_count - neg_count) / total

        # Cluster text for exposure computation
        cluster_text = f"{cluster.get('thread_title', '')} {cluster.get('summary', '')} {cluster.get('impact_line', '')}"
        for a in c_articles:
            cluster_text += f" {a['title']}"

        # Exposure score
        exposure = compute_exposure_score(cluster_text, topics, regions)
        cluster["exposure_score"] = exposure

        # Signal tier (deterministic)
        pulse = cluster.get("pulse_score", 50)
        tier = classify_signal_tier(pulse, source_count, source_diversity, sentiment_intensity, exposure)
        cluster["signal_tier"] = tier
        cluster["source_count"] = source_count
        cluster["source_diversity"] = round(source_diversity, 2)
        cluster["sentiment_intensity"] = round(sentiment_intensity, 2)
        cluster["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Sort clusters: CRITICAL first, then SIGNAL, then WATCH, then NOISE
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

    # 7. Daily Delta (topic-level)
    daily_delta = await compute_daily_delta(topics, clusters)

    # 8. Aggregate Exposure Score (weighted average of top signal clusters)
    signal_clusters = [c for c in clusters if c.get("signal_tier") in ("CRITICAL", "SIGNAL")]
    if signal_clusters:
        aggregate_exposure = round(sum(c["exposure_score"] for c in signal_clusters) / len(signal_clusters))
    else:
        aggregate_exposure = 50

    # 9. Opportunity Radar (lightweight — top risk + top opportunity from AI)
    impact = intelligence.get("impact", {})
    opportunity_radar = {
        "top_risk": impact.get("top_risk", ""),
        "top_opportunity": impact.get("top_opportunity", ""),
    }

    # 10. Monitoring Queue (WATCH-tier threads)
    monitoring_queue = []
    for c in clusters:
        if c.get("signal_tier") == "WATCH":
            monitoring_queue.append({
                "thread_title": c.get("thread_title", ""),
                "pulse_score": c.get("pulse_score", 50),
                "updated_at": c.get("updated_at", ""),
                "source_count": c.get("source_count", 0),
            })

    # Background entity tracking
    asyncio.create_task(_track_entities_bg(all_entities))

    return {
        "status": "success",
        "version": "11.0.0",
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
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _track_entities_bg(entities):
    try:
        await db.track_entities(entities)
    except Exception as e:
        logger.warning(f"Entity tracking: {e}")


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
async def save_preferences(prefs: UserPreferencesInput):
    await db.upsert_user_prefs("local_user_123", prefs.dict())
    return {"status": "success"}

@app.get("/api/user/preferences")
async def get_preferences():
    prefs = await db.get_user_prefs("local_user_123")
    if not prefs:
        return {"status": "not_found", "data": None}
    return {"status": "success", "data": dict(prefs)}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "version": "11.0.0",
        "pipeline": "RSS → HF(free) → OpenRouter/Gemini → Signal Classification → Response",
    }
