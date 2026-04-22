import logging
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import hf_client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("news-intel-api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up database...")
    await db.database.connect()
    await db.init_db()
    yield
    logger.info("Shutting down database...")
    await db.database.disconnect()

app = FastAPI(title="News-Intel AI API", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------
class ArticleInput(BaseModel):
    id: str
    text: str
    source: str

class ClusterRequest(BaseModel):
    articles: List[ArticleInput]

class UserPreferencesInput(BaseModel):
    display_name: str
    email: str
    preferred_categories: List[str]
    preferred_regions: List[str]
    youtube_channels: List[str]
    onboarded: bool = True

class ImpactRequest(BaseModel):
    story_text: str

# -----------------------------------------------------------------------------
# Layer 01: Daily Brief
# -----------------------------------------------------------------------------
@app.post("/api/daily-brief")
async def generate_daily_brief(request: ClusterRequest):
    """
    Synthesizes multiple articles into a single narrative brief using Hugging Face summarization.
    """
    if not request.articles:
        raise HTTPException(status_code=400, detail="No articles provided.")
    
    # Combine texts for the summarizer (in a real scenario, you'd chunk this smartly)
    combined_text = "\n\n".join([f"Source: {a.source}\n{a.text}" for a in request.articles[:5]])
    
    # Use real Hugging Face model
    summary_result = await hf_client.summarize_text(combined_text)
    
    if "summary" not in summary_result:
        raise HTTPException(status_code=500, detail="Failed to generate summary.")
        
    return {
        "status": "success",
        "daily_brief": summary_result["summary"],
        "sources_used": len(request.articles)
    }

# -----------------------------------------------------------------------------
# Layer 02 & 03: Story Clustering & Tension Graph
# -----------------------------------------------------------------------------
@app.post("/api/stories/cluster")
async def cluster_stories(request: ClusterRequest):
    """
    Analyzes multiple articles, extracts entities and sentiment, and clusters them.
    """
    if not request.articles:
        raise HTTPException(status_code=400, detail="No articles provided.")
    
    results = []
    global_sentiment_score = 0
    
    for article in request.articles:
        # Real AI Entity Extraction
        ner_result = await hf_client.extract_entities(article.text)
        entities = ner_result.get("entities", [])
        
        # Real AI Sentiment Analysis
        sentiment_result = await hf_client.analyze_sentiment(article.text)
        sentiment_label = sentiment_result.get("label", "UNKNOWN")
        sentiment_score = sentiment_result.get("score", 0.0)
        
        # Log entities to DB for trend tracking
        await db.track_entities(entities)
        
        # Calculate a naive tension score contribution (Negative = higher tension)
        if sentiment_label.upper() == "NEGATIVE":
            global_sentiment_score += sentiment_score
        elif sentiment_label.upper() == "POSITIVE":
            global_sentiment_score -= (sentiment_score * 0.5)

        results.append({
            "id": article.id,
            "source": article.source,
            "entities": entities,
            "sentiment": {
                "label": sentiment_label,
                "confidence": sentiment_score
            }
        })
        
    return {
        "status": "success",
        "tension_index": round(global_sentiment_score, 2),
        "analyzed_articles": results
    }

# -----------------------------------------------------------------------------
# User Preferences (Mock Auth)
# -----------------------------------------------------------------------------
@app.post("/api/user/preferences")
async def save_preferences(prefs: UserPreferencesInput):
    """
    Saves user onboarding data. Mocks Firebase UID for now.
    """
    mock_uid = "local_user_123"
    await db.upsert_user_prefs(mock_uid, prefs.dict())
    return {"status": "success", "message": "Preferences saved."}

@app.get("/api/user/preferences")
async def get_preferences():
    """
    Gets user onboarding data. Mocks Firebase UID for now.
    """
    mock_uid = "local_user_123"
    prefs = await db.get_user_prefs(mock_uid)
    if not prefs:
        return {"status": "not_found", "data": None}
    
    # Convert Record to dict
    return {"status": "success", "data": dict(prefs)}

# -----------------------------------------------------------------------------
# Layer 05: Personal Relevance Engine (So What?)
# -----------------------------------------------------------------------------
@app.post("/api/personalize/impact")
async def personalize_impact(request: ImpactRequest):
    """
    Cross-references story entities with user preferences to generate an impact score.
    """
    # Get user preferences
    mock_uid = "local_user_123"
    prefs = await db.get_user_prefs(mock_uid)
    
    # Extract entities from the story
    ner_result = await hf_client.extract_entities(request.story_text)
    entities = ner_result.get("entities", [])
    entity_names = [e["name"].lower() for e in entities]
    
    impact_items = []
    relevance_score = 0.0
    
    if prefs:
        import json
        saved_regions = [r.lower() for r in json.loads(prefs["preferred_regions"] or "[]")]
        saved_categories = [c.lower() for c in json.loads(prefs["preferred_categories"] or "[]")]
        
        # Naive matching logic based on real AI extracted entities
        for ent in entity_names:
            if ent in saved_regions:
                impact_items.append(f"This involves a region you track ({ent.title()}).")
                relevance_score += 0.3
            if ent in saved_categories:
                impact_items.append(f"This matches your category interests ({ent.title()}).")
                relevance_score += 0.2
                
    if not impact_items:
        impact_items.append("No direct impact detected based on your current watchlist.")
        
    return {
        "status": "success",
        "relevance_score": min(1.0, relevance_score),
        "impact_items": list(set(impact_items)),
        "detected_entities": entities
    }

@app.get("/health")
async def health_check():
    return {"status": "online", "ai_pipeline": "hugging_face"}
