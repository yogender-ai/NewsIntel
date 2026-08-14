from __future__ import annotations

import hashlib
import ipaddress
import logging
import re
import socket
from html import unescape
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings
from app.core.redis import RedisClient
from app.pipeline.types import ImageCandidate, RawItem

logger = logging.getLogger("newsintel-images")

USER_AGENT = "NewsIntelBot/1.1 (+https://newsintel.local)"
MIN_WIDTH = 200
MIN_HEIGHT = 120
MIN_BYTES = 8192
BLOCKED_HOSTS = ("doubleclick", "googlesyndication", "scorecardresearch", "facebook.com/tr")
PRIVATE_NETS = (
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
)
MAGIC = (
    (b"\xff\xd8", "jpeg"),
    (b"\x89PNG", "png"),
    (b"GIF", "gif"),
    (b"RIFF", "webp"),
)


def _sha(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def _public_ip(host: str) -> str | None:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return None
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            continue
        if any(addr in net for net in PRIVATE_NETS):
            continue
        if addr.version == 6 and addr.ipv6_mapped:
            continue
        return ip
    return None


def _url_ok(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        return False
    if host.endswith("news.google.com") or url.startswith("data:"):
        return False
    if any(bad in host or bad in url.lower() for bad in BLOCKED_HOSTS):
        return False
    return True


def _dims_ok(width: int | None, height: int | None) -> bool:
    if width is None or height is None:
        return True
    return width >= MIN_WIDTH and height >= MIN_HEIGHT


def _magic_ok(blob: bytes) -> bool:
    return any(blob.startswith(prefix) or (prefix == b"RIFF" and b"WEBP" in blob[:16]) for prefix, _ in MAGIC)


async def _validate_url(client: httpx.AsyncClient, url: str, redis: RedisClient) -> str | None:
    if not _url_ok(url):
        return None
    ok_key = f"newsintel:image:ok:{_sha(url)}"
    bad_key = f"newsintel:image:bad:{_sha(url)}"
    cached = await redis.get_json(ok_key)
    if cached and cached.get("final_url"):
        return cached["final_url"]
    if await redis.get(bad_key):
        return None
    host = urlparse(url).hostname or ""
    if not _public_ip(host):
        await redis.set(bad_key, "private_or_unresolved", ttl_seconds=24 * 3600)
        return None
    headers = {"User-Agent": USER_AGENT}
    try:
        head = await client.head(url, headers=headers, timeout=3.0, follow_redirects=True)
        final_url = str(head.url)
        content_type = (head.headers.get("content-type") or "").lower()
        length = int(head.headers.get("content-length") or 0)
        if head.status_code == 200 and content_type.startswith("image/") and "svg" not in content_type:
            if length and length < MIN_BYTES:
                await redis.set(bad_key, "too_small", ttl_seconds=24 * 3600)
                return None
            await redis.set_json(
                ok_key,
                {"url": url, "final_url": final_url, "content_type": content_type, "bytes": length},
                ttl_seconds=7 * 24 * 3600,
            )
            await redis.set_json(
                f"newsintel:image:ok:{_sha(final_url)}",
                {"url": url, "final_url": final_url, "content_type": content_type, "bytes": length},
                ttl_seconds=7 * 24 * 3600,
            )
            return final_url
        if head.status_code not in {405, 403, 400} and head.status_code != 200:
            await redis.set(bad_key, f"http_{head.status_code}", ttl_seconds=24 * 3600)
            return None
        get = await client.get(url, headers={**headers, "Range": "bytes=0-32767"}, timeout=4.0, follow_redirects=True)
        blob = get.content[:65536]
        final_url = str(get.url)
        content_type = (get.headers.get("content-type") or "").lower()
        if get.status_code in {200, 206} and (
            content_type.startswith("image/") or _magic_ok(blob)
        ) and "svg" not in content_type:
            if len(blob) < 32:
                await redis.set(bad_key, "tiny_body", ttl_seconds=24 * 3600)
                return None
            await redis.set_json(
                ok_key,
                {"url": url, "final_url": final_url, "content_type": content_type, "bytes": len(blob)},
                ttl_seconds=7 * 24 * 3600,
            )
            return final_url
    except Exception as exc:
        logger.info("image.reject url=%s reason=%s", url[:120], exc)
        await redis.set(bad_key, str(exc)[:120], ttl_seconds=24 * 3600)
        return None
    await redis.set(bad_key, "not_image", ttl_seconds=24 * 3600)
    return None


async def _og_image(client: httpx.AsyncClient, page_url: str) -> str | None:
    try:
        response = await client.get(page_url, headers={"User-Agent": USER_AGENT}, timeout=4.0, follow_redirects=True)
    except Exception:
        return None
    html = response.text[:65536]
    match = re.search(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        flags=re.I,
    ) or re.search(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        html,
        flags=re.I,
    )
    if not match:
        return None
    return unescape(match.group(1).strip())


def rank_candidates(candidates: list[ImageCandidate]) -> list[ImageCandidate]:
    usable = [c for c in candidates if _url_ok(c.url) and _dims_ok(c.width, c.height)]
    usable.sort(key=lambda c: (c.width or 0) * (c.height or 0), reverse=True)
    return usable


async def filter_items_with_images(
    items: list[RawItem],
    redis: RedisClient,
) -> tuple[list[tuple[RawItem, str]], int]:
    settings = get_settings()
    accepted: list[tuple[RawItem, str]] = []
    rejected = 0
    og_used = 0
    async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": USER_AGENT}, timeout=4.0) as client:
        for item in items:
            image_url = None
            for candidate in rank_candidates(item.image_candidates):
                image_url = await _validate_url(client, candidate.url, redis)
                if image_url:
                    break
            if not image_url and og_used < settings.newsintel_og_image_cap:
                og = await _og_image(client, item.url)
                og_used += 1
                if og:
                    image_url = await _validate_url(client, og, redis)
            if image_url:
                accepted.append((item, image_url))
            else:
                rejected += 1
                logger.info("image.reject title=%s source=%s", item.title[:80], item.source_id)
    return accepted, rejected
