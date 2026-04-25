from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as v2_router
from app.core.cache import cache
from app.core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await cache.close()
    await engine.dispose()


app = FastAPI(title="News Intel Production API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v2_router)


@app.get("/health")
async def health():
    return {"status": "online", "version": "2.0.0", "scheduler": "external"}

