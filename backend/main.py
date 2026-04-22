"""
News-Intel Backend — FastAPI
All AI routed through Cloud Command Gateway → HF Spaces + Gemini
"""

import logging
import json
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
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
    logger.info("Database connected. News-Intel API ready.")
    yield
    await db.database.disconnect()


app = FastAPI(title="News-Intel AI API", version="2.0.0", lifespan=lifespan)

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
    published_at: str = ""


class BriefRequest(BaseModel):
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


class ImpactRequest(BaseModel):
    story_text: str


# ---------------------------------------------------------------------------
# Layer 01 — Daily Brief (Gemini narrative synthesis)
# ---------------------------------------------------------------------------

@app.post("/api/daily-brief")
async def generate_daily_brief(request: BriefRequest):
    if not request.articles:
        raise HTTPException(400, "No articles provided.")

    combined = "\n\n---\n\n".join(
        [f"[{a.source}] {a.title}\n{a.text}" for a in request.articles[:8]]
    )

    # Primary: Gemini narrative synthesis (the real intelligence layer)
    brief = await hf_client.generate_narrative_brief(combined)

    # Fallback: HF summarization if Gemini fails
    if not brief or len(brief) < 20:
        hf_result = await hf_client.summarize_text(combined[:2000])
        brief = hf_result.get("summary", "Brief generation temporarily unavailable.")

    return {
        "status": "success",
        "daily_brief": brief,
        "sources_used": len(request.articles),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Layer 02 — Story Clustering + Sentiment + Entity Analysis
# ---------------------------------------------------------------------------

@app.post("/api/stories/analyze")
async def analyze_stories(request: BriefRequest):
    if not request.articles:
        raise HTTPException(400, "No articles provided.")

    results = []
    tension_scores = {}
    all_entities = []

    for article in request.articles:
        # Real NER via HF through Gateway
        ner_result = await hf_client.extract_entities(article.text[:1500])
        entities = ner_result.get("entities", [])

        # Real sentiment via HF through Gateway
        sentiment_result = await hf_client.analyze_sentiment(article.text[:1500])
        label = sentiment_result.get("label", "UNKNOWN").upper()
        score = sentiment_result.get("score", 0.5)

        # Track entities in DB
        await db.track_entities(entities)

        # Build per-region tension contributions
        for ent in entities:
            if ent.get("type") in ("LOC", "GPE", "location"):
                region = ent["name"]
                if region not in tension_scores:
                    tension_scores[region] = 0
                if label == "NEGATIVE":
                    tension_scores[region] += score * 100
                elif label == "POSITIVE":
                    tension_scores[region] -= score * 30

        all_entities.extend(entities)

        results.append({
            "id": article.id,
            "title": article.title,
            "source": article.source,
            "entities": entities,
            "sentiment": {"label": label, "confidence": round(score, 3)},
        })

    # Deduplicate entities by name
    seen = set()
    unique_entities = []
    for e in all_entities:
        key = e["name"].lower()
        if key not in seen:
            seen.add(key)
            unique_entities.append(e)

    # Normalize tension scores to 0-100
    for region in tension_scores:
        tension_scores[region] = max(0, min(100, int(tension_scores[region])))

    return {
        "status": "success",
        "articles": results,
        "tension_index": tension_scores,
        "key_entities": unique_entities[:20],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Layer 03 — Story Deep Dive (Perspectives + Timeline)
# ---------------------------------------------------------------------------

@app.post("/api/stories/deep-dive")
async def story_deep_dive(request: StoryDeepDiveRequest):
    # Parallel intelligence: entities, sentiment, perspectives
    entities_result = await hf_client.extract_entities(request.text[:1500])
    sentiment_result = await hf_client.analyze_sentiment(request.text[:1500])
    perspectives = await hf_client.analyze_perspectives(request.text[:2000])

    return {
        "status": "success",
        "title": request.title,
        "entities": entities_result.get("entities", []),
        "sentiment": sentiment_result,
        "perspectives": perspectives,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Layer 05 — Personal Relevance Engine ("So What?")
# ---------------------------------------------------------------------------

@app.post("/api/personalize/impact")
async def personalize_impact(request: ImpactRequest):
    mock_uid = "local_user_123"
    prefs = await db.get_user_prefs(mock_uid)

    user_categories = []
    user_regions = []

    if prefs:
        user_categories = json.loads(prefs["preferred_categories"] or "[]")
        user_regions = json.loads(prefs["preferred_regions"] or "[]")

    # Gemini-powered personalized impact analysis
    impact = await hf_client.generate_so_what(
        request.story_text, user_categories, user_regions
    )

    return {
        "status": "success",
        **impact,
    }


# ---------------------------------------------------------------------------
# User Preferences
# ---------------------------------------------------------------------------

@app.post("/api/user/preferences")
async def save_preferences(prefs: UserPreferencesInput):
    mock_uid = "local_user_123"
    await db.upsert_user_prefs(mock_uid, prefs.dict())
    return {"status": "success", "message": "Preferences saved."}


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
    return {
        "status": "online",
        "version": "2.0.0",
        "pipeline": "cloud-command-gateway → hf-space + gemini",
    }
