from __future__ import annotations

import json
import secrets
import time
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urlsplit

try:
    from redis.asyncio import Redis
    from redis.exceptions import RedisError
except ModuleNotFoundError:
    Redis = None

    class RedisError(Exception):
        pass

from app.core.config import get_settings


settings = get_settings()

logger = logging.getLogger("news-intel-cache")


def _safe_redis_url_label(redis_url: str) -> str:
    parts = urlsplit(redis_url)
    if not parts.scheme:
        return "<missing-scheme>"
    if not parts.hostname:
        return f"{parts.scheme}://<missing-host>"
    return f"{parts.scheme}://{parts.hostname}"


def _build_redis_client(redis_url: str) -> Redis | None:
    redis_url = (redis_url or "").strip()
    if not redis_url:
        return None
    if Redis is None:
        logger.warning("redis package is not installed; using process-local cache/locks")
        return None

    try:
        return Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    except (RedisError, ValueError) as exc:
        logger.warning(
            "Invalid REDIS_URL %s; falling back to process-local cache/locks: %s",
            _safe_redis_url_label(redis_url),
            exc,
        )
        return None


redis_client = _build_redis_client(settings.redis_url)


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

    async def _disable_redis(self, operation: str, exc: Exception) -> None:
        logger.warning("Redis %s failed; using process-local fallback: %s", operation, exc)
        client = self.client
        self.client = None
        if client:
            try:
                await client.aclose()
            except Exception:
                logger.debug("Failed to close Redis client after %s failure", operation, exc_info=True)

    async def get_json(self, key: str) -> dict[str, Any] | list[Any] | None:
        if not self.client:
            return await self.local.get_json(key)
        try:
            raw = await self.client.get(key)
        except RedisError as exc:
            await self._disable_redis("get", exc)
            return await self.local.get_json(key)
        if not raw:
            return None
        return json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        if not self.client:
            await self.local.set_json(key, value, ttl_seconds)
            return
        try:
            await self.client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
        except RedisError as exc:
            await self._disable_redis("set", exc)
            await self.local.set_json(key, value, ttl_seconds)

    async def delete_pattern(self, pattern: str) -> int:
        if not self.client:
            return await self.local.delete_pattern(pattern)
        deleted = 0
        try:
            async for key in self.client.scan_iter(match=pattern, count=250):
                deleted += await self.client.delete(key)
            return deleted
        except RedisError as exc:
            await self._disable_redis("delete_pattern", exc)
            return await self.local.delete_pattern(pattern)

    @asynccontextmanager
    async def lock(self, key: str, ttl_seconds: int) -> AsyncIterator[bool]:
        if not self.client:
            logger.info("REDIS_URL not configured; using process-local lock for %s", key)
            async with self.local.lock(key, ttl_seconds) as acquired:
                yield acquired
            return
        token = secrets.token_urlsafe(24)
        try:
            acquired = bool(await self.client.set(key, token, ex=ttl_seconds, nx=True))
        except RedisError as exc:
            await self._disable_redis("lock", exc)
            async with self.local.lock(key, ttl_seconds) as local_acquired:
                yield local_acquired
            return
        try:
            yield acquired
        finally:
            try:
                if acquired and self.client and await self.client.get(key) == token:
                    await self.client.delete(key)
            except RedisError as exc:
                await self._disable_redis("unlock", exc)

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()
        await self.local.close()


cache = RedisCache()
