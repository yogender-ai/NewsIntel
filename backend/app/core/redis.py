from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import urlsplit

from app.core.config import get_settings

logger = logging.getLogger("newsintel-redis")

try:
    from redis.asyncio import Redis
    from redis.exceptions import RedisError
except ModuleNotFoundError:  # pragma: no cover
    Redis = None

    class RedisError(Exception):
        pass


UNLOCK_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
"""

HEARTBEAT_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end
"""


def _has_password(redis_url: str) -> bool:
    parts = urlsplit(redis_url or "")
    return bool(parts.password)


class RedisClient:
    def __init__(self, *, require: bool):
        self.require = require
        self.settings = get_settings()
        self.client: Redis | None = None

    async def connect(self) -> None:
        url = (self.settings.redis_url or "").strip()
        if self.settings.redis_required_auth and url and not _has_password(url):
            raise RuntimeError("REDIS_URL must include a password in production")
        if not url:
            if self.require:
                raise RuntimeError("REDIS_URL is required for the worker")
            logger.warning("REDIS_URL empty; API will serve Postgres snapshots only")
            return
        if Redis is None:
            if self.require:
                raise RuntimeError("redis package is not installed")
            logger.warning("redis package missing; API degraded")
            return
        self.client = Redis.from_url(url, encoding="utf-8", decode_responses=True)
        try:
            await self.client.ping()
        except RedisError as exc:
            self.client = None
            if self.require:
                raise RuntimeError(f"Redis ping failed: {exc}") from exc
            logger.warning("Redis ping failed; API degraded: %s", exc)

    @property
    def available(self) -> bool:
        return self.client is not None

    async def get(self, key: str) -> str | None:
        if not self.client:
            return None
        return await self.client.get(key)

    async def get_json(self, key: str) -> Any | None:
        raw = await self.get(key)
        if not raw:
            return None
        return json.loads(raw)

    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        if not self.client:
            return
        if ttl_seconds:
            await self.client.set(key, value, ex=ttl_seconds)
        else:
            await self.client.set(key, value)

    async def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        await self.set(key, json.dumps(value, default=str), ttl_seconds)

    async def set_nx(self, key: str, value: str, ttl_seconds: int) -> bool:
        if not self.client:
            return False
        return bool(await self.client.set(key, value, ex=ttl_seconds, nx=True))

    async def expire_if_owner(self, key: str, token: str, ttl_seconds: int) -> bool:
        if not self.client:
            return False
        result = await self.client.eval(HEARTBEAT_LUA, 1, key, token, str(ttl_seconds))
        return bool(result)

    async def delete_if_owner(self, key: str, token: str) -> bool:
        if not self.client:
            return False
        result = await self.client.eval(UNLOCK_LUA, 1, key, token)
        return bool(result)

    async def delete(self, key: str) -> None:
        if not self.client:
            return
        await self.client.delete(key)

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()
            self.client = None


redis_api = RedisClient(require=False)
redis_worker = RedisClient(require=True)
