"""
News-Intel Backend v3 — Optimized API
- Parallel AI calls with asyncio.gather (not sequential)
- Caching layer in hf_client prevents duplicate gateway hits
- Single combined endpoint to reduce frontend requests
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("news-intel-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.database.connect()
    await db.init_db()
    logger.info("News-Intel API v3 ready.")
    yield
    await db.database.disconnect()


app = FastAPI(title="News-Intel AI API", version="3.0.0", lifespan=lifespan)

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

class ArticleInput(BaseModel):
    id: str
    title: str = ""
    text: str
    source: str
    url: str = ""


class DashboardRequest(BaseModel):
    """Single request for the entire dashboard — reduces frontend calls from 3 to 1."""
    articles: List[ArticleInput]


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
# COMBINED DASHBOARD ENDPOINT
# One request from frontend → all intelligence layers processed in parallel
# ---------------------------------------------------------------------------

@app.post("/api/dashboard")
async def get_dashboard(request: DashboardRequest):
    """
    Single endpoint that returns everything the dashboard needs:
    - Daily brief (narrative synthesis)
    - Per-article analysis (sentiment + entities)
    - Tension index (per-region)
    - Personal impact ("So What?")
    
    This replaces 3 separate API calls with 1.
    """
    if not request.articles:
        raise HTTPException(400, "No articles provided.")

    articles = request.articles[:6]  # Cap at 6 to limit gateway calls

    # ── Step 1: Analyze all articles in parallel ─────────────────
    async def analyze_one(article):
        ner_task = hf_client.extract_entities(article.text[:1000])
        sent_task = hf_client.analyze_sentiment(article.text[:1000])
        ner_result, sent_result = await asyncio.gather(ner_task, sent_task)
        return {
            "id": article.id,
            "title": article.title,
            "source": article.source,
            "entities": ner_result.get("entities", []),
            "sentiment": {
                "label": sent_result.get("label", "UNKNOWN").upper(),
                "confidence": round(sent_result.get("score", 0.5), 3),
            },
        }

    # Run all article analyses in parallel (not sequential!)
    analysis_results = await asyncio.gather(*[analyze_one(a) for a in articles])

    # ── Step 2: Generate brief in parallel with impact ───────────
    combined_text = "\n\n".join([f"[{a.source}] {a.title}\n{a.text}" for a in articles])

    async def get_brief():
        brief = await hf_client.generate_narrative_brief(combined_text)
        if not brief or len(brief) < 20:
            hf_result = await hf_client.summarize_text(combined_text[:2000])
            return hf_result.get("summary", "")
        return brief

    async def get_impact():
        mock_uid = "local_user_123"
        prefs = await db.get_user_prefs(mock_uid)
        cats = json.loads(prefs["preferred_categories"] or "[]") if prefs else []
        regs = json.loads(prefs["preferred_regions"] or "[]") if prefs else []
        return await hf_client.generate_so_what(combined_text[:1500], cats, regs)

    brief_result, impact_result = await asyncio.gather(get_brief(), get_impact())

    # ── Step 3: Build tension index from entities ────────────────
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

    # Track entities in DB (fire and forget)
    asyncio.create_task(_track_entities_bg(all_entities))

    return {
        "status": "success",
        "daily_brief": brief_result,
        "articles": analysis_results,
        "tension_index": tension_scores,
        "impact": impact_result if isinstance(impact_result, dict) else {},
        "sources_count": len(articles),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _track_entities_bg(entities):
    """Background task to track entities in DB."""
    try:
        await db.track_entities(entities)
    except Exception as e:
        logger.warning(f"Entity tracking failed: {e}")


# ---------------------------------------------------------------------------
# Layer 03 — Story Deep Dive (on-demand, only when user clicks a story)
# ---------------------------------------------------------------------------

@app.post("/api/stories/deep-dive")
async def story_deep_dive(request: StoryDeepDiveRequest):
    # Run all 3 analyses in parallel
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
    mock_uid = "local_user_123"
    await db.upsert_user_prefs(mock_uid, prefs.dict())
    return {"status": "success"}


@app.get("/api/user/preferences")
async def get_preferences():
    mock_uid = "local_user_123"
    prefs = await db.get_user_prefs(mock_uid)
    if not prefs:
        return {"status": "not_found", "data": None}
    return {"status": "success", "data": dict(prefs)}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {"status": "online", "version": "3.0.0", "pipeline": "gateway→hf+gemini"}
