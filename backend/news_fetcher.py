"""
news_fetcher.py — Real-time news from Google News RSS

No API key needed. Free. Fetches real headlines with links.
Uses feedparser for RSS, httpx for article text extraction.
"""

import os
import re
import logging
import asyncio
import hashlib
from datetime import datetime, timezone
from urllib.parse import quote

import feedparser
import httpx

logger = logging.getLogger("news_fetcher")

# Topic → Google News search query mapping
TOPIC_QUERIES = {
    "tech": "technology AI semiconductor",
    "politics": "geopolitics international relations diplomacy",
    "markets": "stock market economy financial markets",
    "ai": "artificial intelligence machine learning LLM",
    "climate": "climate change renewable energy carbon",
    "healthcare": "healthcare pharma medical research",
    "defense": "defense military security NATO",
    "crypto": "cryptocurrency bitcoin blockchain",
    "space": "space exploration NASA SpaceX",
    "trade": "global trade supply chain tariffs",
}

REGION_BOOST = {
    "us": "United States",
    "china": "China",
    "india": "India",
    "europe": "European Union",
    "middle-east": "Middle East",
    "russia": "Russia",
    "japan-korea": "Japan South Korea",
    "latam": "Latin America Brazil",
    "africa": "Africa",
    "southeast-asia": "Southeast Asia",
}

_http = httpx.AsyncClient(
    timeout=12.0,
    follow_redirects=True,
    headers={"User-Agent": "Mozilla/5.0 (compatible; NewsIntel/1.0)"},
)

# In-memory cache: avoid re-fetching same topics within 10 min
_news_cache = {}
_CACHE_TTL = 600  # 10 minutes


def _cache_key(topics, regions):
    raw = f"{sorted(topics)}_{sorted(regions)}"
    return hashlib.md5(raw.encode()).hexdigest()


async def fetch_news(topics: list = None, regions: list = None, max_articles: int = 8) -> list:
    """
    Fetch real news articles from Google News RSS.
    Returns list of {id, title, text, source, url, published}.
    """
    if not topics:
        topics = ["tech", "markets", "ai"]

    ck = _cache_key(topics, regions or [])
    if ck in _news_cache:
        cached_time, cached_data = _news_cache[ck]
        if (datetime.now(timezone.utc) - cached_time).total_seconds() < _CACHE_TTL:
            logger.info(f"News cache hit ({len(cached_data)} articles)")
            return cached_data

    all_articles = []
    seen_titles = set()

    # Build queries from topics
    queries = []
    for t in topics[:4]:  # Max 4 topics to limit requests
        q = TOPIC_QUERIES.get(t, t)
        # Add region boost if specified
        if regions:
            region_terms = " ".join([REGION_BOOST.get(r, "") for r in regions[:2] if r in REGION_BOOST])
            if region_terms:
                q = f"{q} {region_terms}"
        queries.append(q)

    # Also add a "general world news" query
    queries.append("breaking news world today")

    # Fetch RSS feeds in parallel
    tasks = [_fetch_rss(q) for q in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"RSS fetch error: {result}")
            continue
        for article in result:
            # Deduplicate by title similarity
            title_key = re.sub(r'[^a-z0-9]', '', article["title"].lower())[:60]
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)
            all_articles.append(article)

    # Sort by published date (newest first), take top N
    all_articles.sort(key=lambda a: a.get("published", ""), reverse=True)
    final = all_articles[:max_articles]

    # Assign IDs
    for i, a in enumerate(final):
        a["id"] = str(i + 1)

    # Cache
    _news_cache[ck] = (datetime.now(timezone.utc), final)
    logger.info(f"Fetched {len(final)} real articles from {len(queries)} queries")

    return final


async def _fetch_rss(query: str) -> list:
    """Fetch articles from Google News RSS for a query."""
    encoded = quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en&gl=US&ceid=US:en"

    try:
        resp = await _http.get(url)
        if resp.status_code != 200:
            logger.warning(f"RSS {resp.status_code} for query: {query}")
            return []

        feed = feedparser.parse(resp.text)
        articles = []

        for entry in feed.entries[:6]:  # Max 6 per query
            title = entry.get("title", "").strip()
            if not title or len(title) < 10:
                continue

            # Extract source from title (Google News format: "Title - Source")
            source = "Unknown"
            if " - " in title:
                parts = title.rsplit(" - ", 1)
                title = parts[0].strip()
                source = parts[1].strip()

            # Get description/summary
            desc = entry.get("summary", entry.get("description", ""))
            # Clean HTML tags from description
            desc = re.sub(r'<[^>]+>', '', desc).strip()
            # Sometimes description is just the title repeated
            if desc.lower() == title.lower() or len(desc) < 20:
                desc = title

            # Get link (Google News redirects to actual source)
            link = entry.get("link", "")

            # Get published date
            published = entry.get("published", "")

            articles.append({
                "title": title,
                "text": desc if len(desc) > 30 else title,
                "source": source,
                "url": link,
                "published": published,
            })

        return articles

    except Exception as e:
        logger.error(f"RSS fetch error for '{query}': {e}")
        return []


async def extract_article_text(url: str) -> str:
    """
    Try to extract fuller article text from URL.
    Falls back to empty string if extraction fails.
    Used optionally to enrich short RSS descriptions.
    """
    try:
        resp = await _http.get(url, timeout=8.0)
        if resp.status_code != 200:
            return ""

        text = resp.text
        # Simple extraction: find <p> tags content
        paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', text, re.DOTALL)
        clean = [re.sub(r'<[^>]+>', '', p).strip() for p in paragraphs]
        clean = [p for p in clean if len(p) > 40 and not p.startswith('©')]
        return " ".join(clean[:5])[:1500]  # First 5 paragraphs, max 1500 chars

    except Exception:
        return ""
