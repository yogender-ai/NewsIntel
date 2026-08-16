from __future__ import annotations

import logging
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
    search = await client.get(
        "https://en.wikipedia.org/w/api.php",
        params={"action": "opensearch", "search": query, "limit": 3, "namespace": 0, "format": "json"},
        headers=HEADERS,
        timeout=8.0,
    )
    search.raise_for_status()
    data = search.json()
    titles = data[1] if isinstance(data, list) and len(data) > 1 else []
    urls = data[3] if isinstance(data, list) and len(data) > 3 else []
    rows = []
    for title, url in list(zip(titles, urls))[:3]:
        extract = ""
        try:
            page = await client.get(
                "https://en.wikipedia.org/api/rest_v1/page/summary/" + quote_plus(str(title).replace(" ", "_")),
                headers=HEADERS,
                timeout=8.0,
            )
            if page.status_code == 200:
                extract = _clean((page.json() or {}).get("extract"), 360)
        except Exception:
            extract = ""
        rows.append({
            "origin": "web",
            "kind": "wikipedia",
            "title": str(title),
            "url": str(url),
            "snippet": extract or "Wikipedia result",
        })
    return rows


async def _duckduckgo(client: httpx.AsyncClient, query: str) -> list[dict]:
    response = await client.get(
        "https://api.duckduckgo.com/",
        params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
        headers=HEADERS,
        timeout=8.0,
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
        for fetcher in (_wikipedia, _duckduckgo):
            try:
                found.extend(await fetcher(client, q))
            except Exception as exc:
                logger.info("web evidence %s failed: %s", fetcher.__name__, exc)
    unique = []
    for item in found:
        key = (item.get("url") or item.get("title") or "").lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique[:6]
