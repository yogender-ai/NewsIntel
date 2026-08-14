from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from app.core.database import AsyncSessionLocal
from app.models.signal import Signal
from app.pipeline.enrich.gateway import GatewayClient
from sqlalchemy import select

router = APIRouter(tags=["ask"])


class AskRequest(BaseModel):
    question: str
    max_sources: int = 8


@router.post("/api/ask")
async def ask_newsintel(payload: AskRequest):
    question = (payload.question or "").strip()
    if len(question) < 3:
        raise HTTPException(status_code=400, detail="Ask a complete question.")
    async with AsyncSessionLocal() as session:
        stories = list(
            (
                await session.scalars(select(Signal).order_by(Signal.enriched_at.desc()).limit(40))
            ).all()
        )
    tokens = {token for token in question.lower().split() if len(token) > 2}
    ranked = []
    for story in stories:
        hay = f"{story.title} {story.summary} {story.why_it_matters}".lower()
        score = sum(1 for token in tokens if token in hay)
        if score:
            ranked.append((score, story))
    ranked.sort(key=lambda item: item[0], reverse=True)
    sources = []
    for _, story in ranked[: max(3, min(payload.max_sources, 12))]:
        sources.append(
            {
                "title": story.title,
                "summary": story.summary,
                "source": story.source_name,
                "url": story.source_url,
                "published": story.published_at.isoformat() if story.published_at else None,
            }
        )
    if not sources:
        raise HTTPException(status_code=404, detail="No stored signals match that question.")
    lines = [
        f"[S{index + 1}] title={item['title']} | source={item['source']} | summary={item['summary']} | url={item['url']}"
        for index, item in enumerate(sources)
    ]
    prompt = (
        "Answer using ONLY these NewsIntel signals. Cite [S#]. Do not invent facts.\n"
        f"Question: {question}\nSources:\n" + "\n".join(lines)
    )
    gateway = GatewayClient()
    async with httpx.AsyncClient() as client:
        response = await gateway.call_openrouter(client, prompt, "openrouter/free", 700)
        if not response.get("ok"):
            response = await gateway.call_gemini(client, prompt, 700)
    if not response.get("ok"):
        raise HTTPException(status_code=503, detail="AI providers did not return an answer.")
    return {
        "status": "success",
        "question": question,
        "answer": response["content"].strip(),
        "sources": sources,
        "source_count": len(sources),
    }
