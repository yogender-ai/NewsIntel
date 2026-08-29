from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger("news-intel-web-evidence")

HEADERS = {
    "User-Agent": "NewsIntelSimulator/1.0 (https://newsintel.yogender1.me)",
    "Accept": "application/json",
}


def _clean(value: object, limit: int = 280) -> str:
    return " ".join(str(value or "").split())[:limit]


async def _wikipedia(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Full-text search over Wikipedia, then fetch a summary for each hit.

    Uses action=query&list=search rather than opensearch: opensearch matches on
    article *title prefixes*, so any question-shaped query ("why might shipping
    cost more…") returned empty arrays and this whole evidence source silently
    contributed nothing.
    """
    search = await client.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": 3,
            "srprop": "snippet",
            "format": "json",
        },
        headers=HEADERS,
        timeout=6.0,
    )
    search.raise_for_status()
    hits = ((search.json() or {}).get("query") or {}).get("search") or []
    if not hits:
        return []

    async def _summary(hit: dict) -> dict:
        title = str(hit.get("title") or "")
        # Strip the HTML highlight markup the search API embeds in snippets.
        snippet = _clean(re.sub(r"<[^>]+>", "", str(hit.get("snippet") or "")), 280)
        extract = ""
        try:
            page = await client.get(
                "https://en.wikipedia.org/api/rest_v1/page/summary/"
                + quote_plus(title.replace(" ", "_")),
                headers=HEADERS,
                timeout=6.0,
            )
            if page.status_code == 200:
                extract = _clean((page.json() or {}).get("extract"), 280)
        except Exception:
            extract = ""
        return {
            "origin": "web",
            "kind": "wikipedia",
            "title": title,
            "url": "https://en.wikipedia.org/wiki/" + quote_plus(title.replace(" ", "_")),
            "snippet": extract or snippet,
            "extract": extract or snippet,
        }

    return list(await asyncio.gather(*[_summary(hit) for hit in hits]))


async def _duckduckgo(client: httpx.AsyncClient, query: str) -> list[dict]:
    response = await client.get(
        "https://api.duckduckgo.com/",
        params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
        headers=HEADERS,
        timeout=3.5,
    )
    response.raise_for_status()
    data = response.json() if response.content else {}
    rows = []
    abstract = _clean(data.get("AbstractText"), 360)
    href = data.get("AbstractURL") or data.get("AbstractSource")
    heading = data.get("Heading")
    if abstract and href:
        rows.append({
            "origin": "web",
            "kind": "reference",
            "title": heading or "DuckDuckGo abstract",
            "url": href,
            "snippet": abstract,
        })
    for topic in (data.get("RelatedTopics") or [])[:4]:
        if not isinstance(topic, dict):
            continue
        text = _clean(topic.get("Text"), 280)
        first = (topic.get("FirstURL") or "").strip()
        if text and first:
            rows.append({
                "origin": "web",
                "kind": "reference",
                "title": text.split(" - ", 1)[0][:120],
                "url": first,
                "snippet": text,
            })
    return rows[:4]


async def gather_web_evidence(query: str) -> list[dict]:
    q = _clean(query, 180)
    if len(q) < 8:
        return []
    found: list[dict] = []
    seen = set()
    async with httpx.AsyncClient(follow_redirects=True) as client:
        parts = await asyncio.gather(_wikipedia(client, q), _duckduckgo(client, q), return_exceptions=True)
        for part in parts:
            if isinstance(part, Exception):
                logger.info("web evidence failed: %s", part)
                continue
            found.extend(part)
    unique = []
    for item in found:
        key = (item.get("url") or item.get("title") or "").lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique[:6]
