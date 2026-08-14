from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["legacy"])


@router.get("/api/user/preferences")
async def get_preferences():
    return {"status": "not_found", "data": None}


@router.post("/api/user/preferences")
@router.delete("/api/user/account")
@router.get("/api/watchlist")
@router.post("/api/watchlist")
@router.get("/api/alerts")
@router.get("/api/alert-rules")
async def leftover():
    return JSONResponse(status_code=410, content={"status": "gone", "message": "Not part of core v2. Use Home, Orbit, Stories, Map, Simulator, Pipeline."})
