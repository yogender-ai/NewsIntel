import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.cors import ALLOWED_ORIGIN_REGEX, allowed_origins
from app.core.database import engine
from app.core.redis import redis_api
from app.core.schema import ensure_core_v2_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_core_v2_schema()
    try:
        await redis_api.connect()
    except Exception as exc:
        print(f"redis connect skipped: {exc}")
    worker_task = None
    embed = os.getenv("EMBED_WORKER", os.getenv("OIL_EMBED_WORKER", "1"))
    if embed == "1":
        from app.worker import embed_worker

        worker_task = asyncio.create_task(embed_worker(redis_api))
    yield
    if worker_task:
        worker_task.cancel()
    await redis_api.close()
    await engine.dispose()


app = FastAPI(title="NewsIntel Core v2", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)
