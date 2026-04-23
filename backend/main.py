"""
News-Intel Backend v10 — Professional Intelligence Pipeline

Pipeline: RSS → HF(NER+Sentiment) → OpenRouter/Gemini(Synthesis) → Response
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
# Database Lifecycle (CRITICAL — was deleted by previous AI)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.database.connect()
    await db.init_db()
    logger.info("News-Intel v10 ready. DB connected.")
    yield
    await db.database.disconnect()


app = FastAPI(title="News-Intel v10", version="10.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Models (CRITICAL for FastAPI JSON parsing)
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

    # 4. Tension Map
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

    # Background entity tracking
    asyncio.create_task(_track_entities_bg(all_entities))

    return {
        "status": "success",
        "daily_brief": intelligence.get("daily_brief", ""),
        "articles": analysis_results,
        "clusters": intelligence.get("clusters", []),
        "impact": intelligence.get("impact", {}),
        "tension_index": tension,
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
        "version": "10.0.0",
        "pipeline": "RSS → HF(free) → OpenRouter/Gemini(consolidated)",
    }
