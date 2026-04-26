import json
import secrets
import time
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings


settings = get_settings()

logger = logging.getLogger("news-intel-cache")
redis_client = (
    Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    if settings.redis_url
    else None
)


class LocalCache:
    """Process-local fallback for single-instance deployments without Redis."""

    def __init__(self):
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: set[str] = set()

    async def get_json(self, key: str) -> dict[str, Any] | list[Any] | None:
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at and expires_at < time.time():
            self._store.pop(key, None)
            return None
        return value

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        expires_at = time.time() + ttl_seconds if ttl_seconds else 0
        self._store[key] = (expires_at, value)

    async def delete_pattern(self, pattern: str) -> int:
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            keys = [key for key in self._store if key.startswith(prefix)]
        else:
            keys = [pattern] if pattern in self._store else []
        for key in keys:
            self._store.pop(key, None)
        return len(keys)

    @asynccontextmanager
    async def lock(self, key: str, ttl_seconds: int) -> AsyncIterator[bool]:
        if key in self._locks:
            yield False
            return
        self._locks.add(key)
        try:
            yield True
        finally:
            self._locks.discard(key)

    async def close(self) -> None:
        self._store.clear()
        self._locks.clear()


class RedisCache:
    def __init__(self, client: Redis | None = redis_client):
        self.client = client
        self.local = LocalCache()

    @property
    def using_redis(self) -> bool:
        return self.client is not None

    async def get_json(self, key: str) -> dict[str, Any] | list[Any] | None:
        if not self.client:
            return await self.local.get_json(key)
        raw = await self.client.get(key)
        if not raw:
            return None
        return json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        if not self.client:
            await self.local.set_json(key, value, ttl_seconds)
            return
        await self.client.set(key, json.dumps(value, default=str), ex=ttl_seconds)

    async def delete_pattern(self, pattern: str) -> int:
        if not self.client:
            return await self.local.delete_pattern(pattern)
        deleted = 0
        async for key in self.client.scan_iter(match=pattern, count=250):
            deleted += await self.client.delete(key)
        return deleted

    @asynccontextmanager
    async def lock(self, key: str, ttl_seconds: int) -> AsyncIterator[bool]:
        if not self.client:
            logger.info("REDIS_URL not configured; using process-local lock for %s", key)
            async with self.local.lock(key, ttl_seconds) as acquired:
                yield acquired
            return
        token = secrets.token_urlsafe(24)
        acquired = bool(await self.client.set(key, token, ex=ttl_seconds, nx=True))
        try:
            yield acquired
        finally:
            if acquired and await self.client.get(key) == token:
                await self.client.delete(key)

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()
        await self.local.close()


cache = RedisCache()
