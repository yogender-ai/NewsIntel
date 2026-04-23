"""
main.py — News-Intel v10
Professional Intelligence Pipeline
"""

import logging
import json
import asyncio
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import hf_client
import news_fetcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("news-intel-api")

app = FastAPI(title="News-Intel v10")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DashboardRequest(BaseModel):
    topics: List[str] = []
    regions: List[str] = []
    user_id: str = "local_user_123"

@app.post("/api/dashboard")
async def get_dashboard(request: DashboardRequest, force: bool = False):
    if force:
        news_fetcher.force_refresh()
        hf_client._cache.clear()

    # 1. Fetch News
    articles = await news_fetcher.fetch_news(
        topics=request.topics or ["tech", "markets"],
        regions=request.regions or [],
        max_articles=12
    )
    if not articles: raise HTTPException(503, "News source unavailable")

    # 2. High-Signal Analysis (Parallel)
    async def analyze(a):
        # SEND MORE TEXT for better sentiment/NER
        # Combine title + text to avoid the "neutral" trap
        rich_text = f"{a['title']}. {a['text'][:1200]}"
        
        ner, sent = await asyncio.gather(
            hf_client.extract_entities(rich_text[:1000]),
            hf_client.analyze_sentiment(rich_text[:800])
        )
        
        return {
            "id": a["id"],
            "title": a["title"],
            "source": a["source"],
            "url": a.get("url", ""),
            "published": a.get("published", ""),
            "text_preview": a["text"][:300],
            "entities": ner.get("entities", []),
            "sentiment": {
                "label": sent.get("label", "NEUTRAL").upper(),
                "confidence": round(sent.get("score", 0.5), 3),
            },
        }

    analysis = await asyncio.gather(*[analyze(a) for a in articles])

    # 3. AI Synthesis (Brief, Clusters, Impact)
    combined = "\n\n".join([f"[{a['source']}] {a['title']}\n{a['text']}" for a in articles])
    intel = await hf_client.generate_full_intelligence(
        combined,
        [{"id": a["id"], "title": a["title"], "source": a["source"]} for a in analysis],
        request.topics,
        request.regions
    )

    # 4. Tension Map Data
    tension = {}
    for a in analysis:
        for e in a["entities"]:
            if e.get("type") in ("LOC", "GPE", "location"):
                name = e["name"]
                tension[name] = tension.get(name, 30)
                if a["sentiment"]["label"] == "NEGATIVE":
                    tension[name] += int(a["sentiment"]["confidence"] * 40)
                elif a["sentiment"]["label"] == "POSITIVE":
                    tension[name] -= 10
    
    for k in tension: tension[k] = max(10, min(95, tension[k]))

    return {
        "status": "success",
        "daily_brief": intel.get("daily_brief", ""),
        "articles": analysis,
        "clusters": intel.get("clusters", []),
        "impact": intel.get("impact", {}),
        "tension_index": tension,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@app.post("/api/stories/deep-dive")
async def story_deep_dive(req: dict):
    perspectives = await hf_client.analyze_perspectives(req.get("text", ""))
    return {"status": "success", "perspectives": perspectives}

@app.post("/api/user/preferences")
async def save_prefs(prefs: dict):
    await db.upsert_user_prefs(prefs.get("user_id", "local_user_123"), prefs)
    return {"status": "success"}

@app.get("/health")
async def health(): return {"status": "online", "version": "10.0.0"}
