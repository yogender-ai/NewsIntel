"""Ask NewsIntel — hybrid RAG over the indexed signal corpus, plus web background.

Retrieval (app/services/rag.py) runs vector + lexical search over NewsIntel's own
archive, fuses and reranks the candidates, then optionally adds Wikipedia/DuckDuckGo
background so the model can explain terms the archive assumes you already know.
Archive passages and web items share one [S#] citation sequence, and every response
carries a step-by-step trace of how the answer was reached.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_account, get_session
from app.models.account import Account, AccountProfile
from app.services.rag import answer_question, corpus_stats

router = APIRouter(tags=["ask"])


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    max_sources: int = Field(default=8, ge=3, le=12)
    # None searches the whole corpus; the default keeps answers current.
    days: int | None = Field(default=14, ge=1, le=90)
    personalize: bool = True
    include_web: bool = True


@router.post("/api/ask")
async def ask_newsintel(
    payload: AskRequest,
    session: AsyncSession = Depends(get_session),
    account: Account | None = Depends(get_optional_account),
):
    question = payload.question.strip()
    if len(question) < 3:
        raise HTTPException(status_code=400, detail="Ask a complete question.")

    profile = None
    if account is not None and payload.personalize:
        profile = await session.scalar(
            select(AccountProfile).where(AccountProfile.account_id == account.id)
        )

    result = await answer_question(
        session,
        question,
        profile=profile,
        days=payload.days,
        max_sources=payload.max_sources,
        include_web=payload.include_web,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=503, detail=result.get("error") or "Ask is unavailable.")
    return result


@router.get("/api/ask/corpus")
async def ask_corpus(session: AsyncSession = Depends(get_session)):
    """What the answer engine can currently see.

    Surfaced on the Ask screen so an empty or stale index is visible, rather than
    silently producing weak answers over three stale stories.
    """
    return await corpus_stats(session)
