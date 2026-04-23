"""
News-Intel Backend v4 — LIVE NEWS
- Real news from Google News RSS (no more hardcoded articles)
- All AI via Cloud Command Gateway
- Parallel processing with asyncio.gather
- Single combined dashboard endpoint
"""

import logging
import json
import asyncio
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import hf_client
import news_fetcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("news-intel-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.database.connect()
    await db.init_db()
    logger.info("News-Intel API v4 — LIVE NEWS ready.")
    yield
    await db.database.disconnect()


app = FastAPI(title="News-Intel AI API", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class DashboardRequest(BaseModel):
    """Dashboard now fetches its OWN news. Frontend just sends preferences."""
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
# LIVE NEWS DASHBOARD
# ---------------------------------------------------------------------------

@app.post("/api/dashboard")
async def get_dashboard(request: DashboardRequest, force: bool = False):
    """
    1. Fetches REAL news from Google News RSS based on user preferences
    2. Runs AI analysis on all articles in parallel
    3. Returns everything the dashboard needs in ONE response
    
    ?force=true clears all caches and fetches fresh data.
    """
    # Force refresh: clear ALL caches so everything is fresh
    if force:
        news_fetcher.force_refresh()
        hf_client.clear_cache()
        logger.info("Force refresh: all caches cleared")

    topics = request.topics or ["tech", "ai", "markets"]
    regions = request.regions or []

    # If no prefs sent, try DB
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

    # ── Step 1: Fetch REAL news ──────────────────────────────────
    articles = await news_fetcher.fetch_news(
        topics=topics,
        regions=regions,
        max_articles=10,  # Fetch more for better clustering
    )

    if not articles:
        raise HTTPException(503, "Could not fetch news. Try again in a moment.")

    logger.info(f"Fetched {len(articles)} live articles for topics={topics}")

    # ── Step 2: Analyze all articles in parallel ─────────────────
    async def analyze_one(article):
        text = article["text"][:1000]
        if len(text) < 30:
            text = article["title"]

        ner_task = hf_client.extract_entities(text)
        sent_task = hf_client.analyze_sentiment(text)
        ner_result, sent_result = await asyncio.gather(ner_task, sent_task)

        return {
            "id": article["id"],
            "title": article["title"],
            "source": article["source"],
            "url": article.get("url", ""),
            "published": article.get("published", ""),
            "text_preview": article["text"][:200],
            "entities": ner_result.get("entities", []),
            "sentiment": {
                "label": sent_result.get("label", "UNKNOWN").upper(),
                "confidence": round(sent_result.get("score", 0.5), 3),
            },
        }

    analysis_results = await asyncio.gather(*[analyze_one(a) for a in articles])

    # ── Step 3: Brief + Impact in parallel ───────────────────────
    combined_text = "\n\n".join([f"[{a['source']}] {a['title']}\n{a['text']}" for a in articles])

    async def get_brief():
        brief = await hf_client.generate_narrative_brief(combined_text)
        if not brief or len(brief) < 20:
            hf_result = await hf_client.summarize_text(combined_text[:2000])
            return hf_result.get("summary", "")
        return brief

    async def get_impact():
        prefs = await db.get_user_prefs("local_user_123")
        cats = json.loads(prefs["preferred_categories"] or "[]") if prefs else topics
        regs = json.loads(prefs["preferred_regions"] or "[]") if prefs else regions
        return await hf_client.generate_so_what(combined_text[:1500], cats, regs)

    brief_result, impact_result = await asyncio.gather(get_brief(), get_impact())

    # ── Step 4: Build tension index from entities ────────────────
    tension_scores = {}
    all_entities = []
    for result in analysis_results:
        for ent in result["entities"]:
            all_entities.append(ent)
            if ent.get("type") in ("LOC", "GPE", "ORG", "location"):
                region = ent["name"]
                if region not in tension_scores:
                    tension_scores[region] = 0
                if result["sentiment"]["label"] == "NEGATIVE":
                    tension_scores[region] += int(result["sentiment"]["confidence"] * 100)
                elif result["sentiment"]["label"] == "POSITIVE":
                    tension_scores[region] -= int(result["sentiment"]["confidence"] * 30)

    for r in tension_scores:
        tension_scores[r] = max(0, min(100, tension_scores[r]))

    # ── Step 5: Cluster stories ──────────────────────────────────
    cluster_input = [{"id": a["id"], "title": a["title"], "source": a["source"]} for a in analysis_results]
    clusters = await hf_client.cluster_stories(cluster_input)

    asyncio.create_task(_track_entities_bg(all_entities))

    return {
        "status": "success",
        "live": True,
        "daily_brief": brief_result,
        "articles": analysis_results,
        "clusters": clusters,
        "tension_index": tension_scores,
        "impact": impact_result if isinstance(impact_result, dict) else {},
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
    ner_task = hf_client.extract_entities(request.text[:1500])
    sent_task = hf_client.analyze_sentiment(request.text[:1500])
    persp_task = hf_client.analyze_perspectives(request.text[:2000])

    entities_result, sentiment_result, perspectives = await asyncio.gather(
        ner_task, sent_task, persp_task
    )

    return {
        "status": "success",
        "title": request.title,
        "entities": entities_result.get("entities", []),
        "sentiment": sentiment_result,
        "perspectives": perspectives,
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
        "version": "4.0.0",
        "pipeline": "RSS→Gateway→HF+Gemini",
        "features": ["live_news", "sentiment", "ner", "perspectives", "impact"],
    }
