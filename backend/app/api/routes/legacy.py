from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["legacy"])


@router.get("/api/user/preferences")
async def get_preferences():
    return {"status": "ok", "data": {"preferred_categories": [], "preferred_regions": [], "tracked_entities": []}}


@router.post("/api/user/preferences")
async def save_preferences():
    return {"status": "ok", "data": {"preferred_categories": [], "preferred_regions": [], "tracked_entities": []}}


@router.get("/api/alerts")
async def get_alerts():
    return {"alerts": []}


@router.delete("/api/user/account")
@router.get("/api/watchlist")
@router.post("/api/watchlist")
@router.get("/api/alert-rules")
async def leftover():
    return JSONResponse(
        status_code=410,
        content={"status": "gone", "message": "Not part of the live feed. Use Home, Orbit, Stories, Map, or Simulator."},
    )
