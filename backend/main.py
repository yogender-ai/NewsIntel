"""
News-Intel Backend v5 — OPTIMIZED PIPELINE
- Real news from Google News RSS
- ALL AI via Cloud Command Gateway
- ONE consolidated Gemini call (brief + clusters + impact)
- HF Space for NER + Sentiment (free, unlimited)
- Parallel processing with asyncio.gather
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
    logger.info("News-Intel API v5 — OPTIMIZED PIPELINE ready.")
    yield
    await db.database.disconnect()


app = FastAPI(title="News-Intel AI API", version="5.0.0", lifespan=lifespan)

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
# DASHBOARD — Optimized Pipeline
#
# API CALL BUDGET:
#   HF Space (FREE): 10 sentiment + 10 NER = 20 calls (no limit)
#   Gemini (RATE LIMITED): 1 consolidated call (was 3)
#   Total Gemini calls: 1 per dashboard load ✓
# ---------------------------------------------------------------------------

@app.post("/api/dashboard")
async def get_dashboard(request: DashboardRequest, force: bool = False):
    if force:
        news_fetcher.force_refresh()
        hf_client.clear_cache()
        logger.info("Force refresh: all caches cleared")

    topics = request.topics or ["tech", "ai", "markets"]
    regions = request.regions or []

    # Try DB for saved preferences
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
        max_articles=10,
    )

    if not articles:
        raise HTTPException(503, "Could not fetch news. Try again in a moment.")

    logger.info(f"Fetched {len(articles)} live articles for topics={topics}")

    # ── Step 2: HF analysis (FREE — run in parallel) ─────────────
    async def analyze_one(article):
        text = article["text"][:1000]
        if len(text) < 30:
            text = article["title"]

        # Send MORE text to sentiment for better accuracy (not just 30 chars)
        sent_text = f"{article['title']}. {article['text'][:500]}"

        ner_task = hf_client.extract_entities(text)
        sent_task = hf_client.analyze_sentiment(sent_text)
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

    # ── Step 3: ONE consolidated Gemini call ──────────────────────
    # This replaces 3 separate calls (brief + clustering + impact)
    combined_text = "\n\n".join([f"[{a['source']}] {a['title']}\n{a['text']}" for a in articles])
    article_index = [{"id": a["id"], "title": a["title"], "source": a["source"]} for a in analysis_results]

    intelligence = await hf_client.generate_full_intelligence(
        articles_text=combined_text,
        article_list=article_index,
        user_categories=topics,
        user_regions=regions,
    )

    # ── Step 4: Build tension index from entities + sentiment ────
    tension_scores = {}
    all_entities = []
    for result in analysis_results:
        for ent in result["entities"]:
            all_entities.append(ent)
            if ent.get("type") in ("LOC", "GPE", "ORG", "location"):
                region = ent["name"]
                if region not in tension_scores:
                    tension_scores[region] = 30  # Base tension (not zero)
                if result["sentiment"]["label"] == "NEGATIVE":
                    tension_scores[region] += int(result["sentiment"]["confidence"] * 50)
                elif result["sentiment"]["label"] == "POSITIVE":
                    tension_scores[region] -= int(result["sentiment"]["confidence"] * 20)
                else:
                    tension_scores[region] += 5  # Neutral adds small amount

    for r in tension_scores:
        tension_scores[r] = max(10, min(95, tension_scores[r]))

    asyncio.create_task(_track_entities_bg(all_entities))

    return {
        "status": "success",
        "live": True,
        "daily_brief": intelligence.get("daily_brief", ""),
        "articles": analysis_results,
        "clusters": intelligence.get("clusters", []),
        "tension_index": tension_scores,
        "impact": intelligence.get("impact", {}),
        "sources_count": len(articles),
        "topics_used": topics,
        "model_used": "gemini-2.5-flash (consolidated)",
        "gemini_calls": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _track_entities_bg(entities):
    try:
        await db.track_entities(entities)
    except Exception as e:
        logger.warning(f"Entity tracking: {e}")


# ---------------------------------------------------------------------------
# Story Deep Dive (1 Gemini call for perspectives)
# ---------------------------------------------------------------------------

@app.post("/api/stories/deep-dive")
async def story_deep_dive(request: StoryDeepDiveRequest):
    """
    Deep dive uses data already computed on dashboard (entities, sentiment).
    Only makes 1 Gemini call for perspectives analysis.
    """
    text = request.text[:2000] if len(request.text) > 30 else request.title

    # HF calls (free) + 1 Gemini call for perspectives
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
        "version": "5.0.0",
        "pipeline": "RSS → HF(free) → Gemini(1 call)",
        "optimization": "Consolidated: 3 Gemini calls → 1",
        "models": {
            "primary": "gemini-2.5-flash",
            "fallback_1": "gemini-2.5-flash-lite",
            "fallback_2": "gemini-2.0-flash",
            "sentiment": "HF RoBERTa",
            "ner": "HF BERT-NER",
        },
    }
