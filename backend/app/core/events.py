"""In-process + Redis pub/sub so the dashboard sees pipeline stages live."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone

CHANNEL = "newsintel:events"
_subscribers: set[asyncio.Queue] = set()


def _pack(kind: str, **payload) -> str:
    return json.dumps(
        {"type": kind, "at": datetime.now(timezone.utc).isoformat(), **payload},
        default=str,
    )


def _fanout(message: str) -> None:
    dead = []
    for queue in list(_subscribers):
        try:
            queue.put_nowait(message)
        except Exception:
            dead.append(queue)
    for queue in dead:
        _subscribers.discard(queue)


async def _broadcast(message: str) -> None:
    from app.core.redis import redis_api

    if redis_api.client is not None:
        try:
            await redis_api.client.publish(CHANNEL, message)
            return
        except Exception:
            pass
    _fanout(message)


def publish(kind: str, **payload) -> None:
    message = _pack(kind, **payload)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        _fanout(message)
        return
    loop.create_task(_broadcast(message))


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


async def iter_sse() -> AsyncIterator[str]:
    queue = subscribe()
    pubsub = None
    try:
        yield 'data: {"type":"hello"}\n\n'
        from app.core.redis import redis_api

        if redis_api.client is not None:
            pubsub = redis_api.client.pubsub()
            await pubsub.subscribe(CHANNEL)
        while True:
            if pubsub is not None:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg.get("data"):
                    yield f"data: {msg['data']}\n\n"
                    continue
                yield "event: ping\ndata: {}\n\n"
                continue
            try:
                message = await asyncio.wait_for(queue.get(), timeout=20)
            except asyncio.TimeoutError:
                yield "event: ping\ndata: {}\n\n"
                continue
            yield f"data: {message}\n\n"
    finally:
        unsubscribe(queue)
        if pubsub is not None:
            try:
                await pubsub.unsubscribe(CHANNEL)
                await pubsub.aclose()
            except Exception:
                pass
