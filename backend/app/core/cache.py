import json
import secrets
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings


settings = get_settings()

redis_client = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)


class RedisCache:
    def __init__(self, client: Redis = redis_client):
        self.client = client

    async def get_json(self, key: str) -> dict[str, Any] | list[Any] | None:
        raw = await self.client.get(key)
        if not raw:
            return None
        return json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        await self.client.set(key, json.dumps(value, default=str), ex=ttl_seconds)

    async def delete_pattern(self, pattern: str) -> int:
        deleted = 0
        async for key in self.client.scan_iter(match=pattern, count=250):
            deleted += await self.client.delete(key)
        return deleted

    @asynccontextmanager
    async def lock(self, key: str, ttl_seconds: int) -> AsyncIterator[bool]:
        token = secrets.token_urlsafe(24)
        acquired = bool(await self.client.set(key, token, ex=ttl_seconds, nx=True))
        try:
            yield acquired
        finally:
            if acquired and await self.client.get(key) == token:
                await self.client.delete(key)

    async def close(self) -> None:
        await self.client.aclose()


cache = RedisCache()
