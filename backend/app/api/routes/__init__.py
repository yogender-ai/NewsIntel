from fastapi import APIRouter

from app.api.routes import (
    admin,
    ask,
    auth,
    chat,
    health,
    jobs,
    legacy,
    map,
    monitor,
    orbit,
    simulate,
    snapshot,
    stories,
    stream,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(snapshot.router)
api_router.include_router(stories.router)
api_router.include_router(jobs.router)
api_router.include_router(admin.router)
api_router.include_router(ask.router)
api_router.include_router(chat.router)
api_router.include_router(map.router)
api_router.include_router(orbit.router)
api_router.include_router(monitor.router)
api_router.include_router(simulate.router)
api_router.include_router(stream.router)
api_router.include_router(legacy.router)

# Older entrypoints imported `router`. Keep both names so nothing breaks.
router = api_router
