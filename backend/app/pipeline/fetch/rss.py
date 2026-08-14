from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape

import feedparser
import httpx

from app.core.config import get_settings
from app.core.redis import RedisClient
from app.pipeline.fetch.sources import DEFAULT_FEEDS, Feed
from app.pipeline.types import ImageCandidate, RawItem, StageStat

logger = logging.getLogger("newsintel-fetch")

USER_AGENT = "NewsIntelBot/1.1 (+https://newsintel.local)"
PIXEL_HINTS = ("npr-rss-pixel", "1x1", "pixel.gif", "tracking")


def _clean(text: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"\s+", " ", text).strip()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _intish(value) -> int | None:
    try:
        if value in (None, ""):
            return None
        return int(str(value).split()[0])
    except (TypeError, ValueError):
        return None


def extract_image_candidates(entry: dict) -> list[ImageCandidate]:
    candidates: list[ImageCandidate] = []
    for media in entry.get("media_content") or []:
        url = (media.get("url") or "").strip()
        mime = (media.get("type") or media.get("medium") or "").lower()
        if not url:
            continue
        if mime and not (mime.startswith("image") or mime == "image"):
            continue
        candidates.append(
            ImageCandidate(
                url=url,
                origin="media_content",
                width=_intish(media.get("width")),
                height=_intish(media.get("height")),
                mime=media.get("type"),
            )
        )
    for thumb in entry.get("media_thumbnail") or []:
        url = (thumb.get("url") or "").strip()
        if url:
            candidates.append(
                ImageCandidate(
                    url=url,
                    origin="media_thumbnail",
                    width=_intish(thumb.get("width")),
                    height=_intish(thumb.get("height")),
                )
            )
    for enc in entry.get("enclosures") or []:
        url = (enc.get("href") or enc.get("url") or "").strip()
        mime = (enc.get("type") or "").lower()
        if url and mime.startswith("image/"):
            candidates.append(ImageCandidate(url=url, origin="enclosure", mime=mime))
    html = " ".join(
        filter(
            None,
            [
                entry.get("content", [{}])[0].get("value") if entry.get("content") else "",
                entry.get("summary", ""),
            ],
        )
    )
    for match in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html, flags=re.I):
        src = match.group(1)
        lowered = src.lower()
        if any(hint in lowered for hint in PIXEL_HINTS):
            continue
        candidates.append(ImageCandidate(url=src, origin="html_img"))
    return candidates


def entry_to_item(feed: Feed, entry: dict) -> RawItem | None:
    title = _clean(entry.get("title") or "")
    if " - " in title:
        title = title.rsplit(" - ", 1)[0].strip()
    link = (entry.get("link") or "").strip()
    if not title or not link:
        return None
    summary = _clean(entry.get("summary") or entry.get("description") or title)
    return RawItem(
        source_id=feed.source_id,
        source_name=feed.source_name,
        category=feed.category,
        title=title[:500],
        url=link,
        summary=summary[:1000],
        published_at=_parse_dt(entry.get("published") or entry.get("updated")),
        image_candidates=extract_image_candidates(entry),
    )


async def fetch_feed(client: httpx.AsyncClient, feed: Feed, redis: RedisClient, cap: int) -> list[RawItem]:
    settings = get_settings()
    cache_key = f"newsintel:source:{feed.source_id}:body"
    etag_key = f"newsintel:source:{feed.source_id}:etag"
    headers = {"User-Agent": USER_AGENT}
    etag = await redis.get(etag_key)
    if etag:
        headers["If-None-Match"] = etag
    try:
        response = await client.get(feed.url, headers=headers, timeout=8.0)
    except Exception as exc:
        logger.warning("fetch.fail source=%s err=%s", feed.source_id, exc)
        cached = await redis.get(cache_key)
        if cached:
            parsed = feedparser.parse(cached)
            return [item for entry in parsed.entries[:cap] if (item := entry_to_item(feed, entry))]
        return []
    if response.status_code == 304:
        cached = await redis.get(cache_key)
        body = cached or ""
    elif response.status_code != 200:
        logger.warning("fetch.http source=%s status=%s", feed.source_id, response.status_code)
        return []
    else:
        body = response.text
        await redis.set(cache_key, body, ttl_seconds=50 * 60)
        if response.headers.get("etag"):
            await redis.set(etag_key, response.headers["etag"], ttl_seconds=6 * 3600)
    parsed = feedparser.parse(body)
    items = []
    for entry in parsed.entries[: cap]:
        item = entry_to_item(feed, entry)
        if item:
            items.append(item)
    logger.info("fetch.done source=%s items=%s images=%s", feed.source_id, len(items), sum(1 for i in items if i.image_candidates))
    _ = settings
    return items


async def fetch_all_sources(redis: RedisClient) -> tuple[list[RawItem], StageStat]:
    settings = get_settings()
    started = datetime.now(timezone.utc)
    cap = max(4, int(settings.newsintel_items_per_feed))
    items: list[RawItem] = []
    async with httpx.AsyncClient(
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
        timeout=8.0,
    ) as client:
        for feed in DEFAULT_FEEDS:
            items.extend(await fetch_feed(client, feed, redis, cap))
    finished = datetime.now(timezone.utc)
    return items, StageStat(
        name="fetch",
        started_at=started.isoformat(),
        finished_at=finished.isoformat(),
        elapsed_ms=int((finished - started).total_seconds() * 1000),
        counts={"fetched": len(items), "feeds": len(DEFAULT_FEEDS)},
    )
