from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.question_pipeline import run_simulate

router = APIRouter(tags=["simulate"])


class SimulateRequest(BaseModel):
    scenario: str = ""
    input_text: str = ""
    assumptions: dict = Field(default_factory=dict)
    base_event_id: str | None = None


@router.post("/api/simulate")
async def simulate(payload: SimulateRequest):
    text = (payload.scenario or payload.input_text or "").strip()
    if len(text) < 8:
        raise HTTPException(status_code=400, detail="Describe a scenario first.")
    try:
        return await run_simulate(text, payload.assumptions, payload.base_event_id)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Scenario JSON was invalid.") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:180] or "AI providers did not return a scenario.") from exc
