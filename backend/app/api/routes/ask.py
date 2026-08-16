from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.question_pipeline import run_ask

router = APIRouter(tags=["ask"])


class AskRequest(BaseModel):
    question: str
    max_sources: int = 8


@router.post("/api/ask")
async def ask_newsintel(payload: AskRequest):
    question = (payload.question or "").strip()
    if len(question) < 3:
        raise HTTPException(status_code=400, detail="Ask a complete question.")
    try:
        result = await run_ask(question)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:180] or "AI providers did not return an answer.") from exc
    if result.get("status") == "empty":
        raise HTTPException(status_code=404, detail=result.get("answer") or "No stored signals match that question.")
    return result
