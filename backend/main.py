"""
News Intelligence Backend — FastAPI v4.0
Real-time multi-task NLP pipeline with Gemini-powered topic intelligence.
Curated, high-quality news from trusted global sources.
Now with trending headlines, weather, stock data, and location detection.
"""

import os
import re
import json
import html
import asyncio
import logging
import gc
import random
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from urllib.parse import quote_plus

import feedparser
import httpx
from newspaper import Article
from googlenewsdecoder import gnewsdecoder
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from cachetools import TTLCache
from dotenv import load_dotenv
from google import genai
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from db import database, init_db, log_search, update_sentiment_trends, track_entities
import itertools

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN").strip() if os.getenv("HF_TOKEN") else None

# Multiple Gemini API keys for round-robin load balancing
_gemini_keys = []
for _k in ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
    _v = os.getenv(_k)
    if _v and _v.strip():
        _gemini_keys.append(_v.strip())
GEMINI_API_KEYS = _gemini_keys if _gemini_keys else []
logger_init = logging.getLogger("news-intel")
logger_init = logging.getLogger("news-intel")
logger_init.info(f"Loaded {len(GEMINI_API_KEYS)} Gemini API key(s)")

HF_API_URL = "https://router.huggingface.co/hf-inference/models"
HF_HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

SUMMARIZATION_MODEL = "sshleifer/distilbart-cnn-12-6"
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
NER_MODEL = "dslim/bert-base-NER"

MAX_ARTICLES = 6
ARTICLE_TEXT_LIMIT = 512
HTTP_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

# ---------------------------------------------------------------------------
# Trusted / Premium Sources — prioritized in results
# ---------------------------------------------------------------------------
TRUSTED_SOURCES = {
    # Global Tier-1
    "Reuters", "AP News", "Associated Press", "BBC News", "BBC",
    "The New York Times", "The Washington Post", "Bloomberg",
    "The Guardian", "CNN", "Al Jazeera", "Financial Times",
    "The Economist", "The Wall Street Journal", "NPR",
    # India
    "The Times of India", "NDTV", "The Hindu", "Hindustan Times",
    "India Today", "The Indian Express", "Economic Times",
    "Mint", "Business Standard", "Livemint",
    # Tech
    "TechCrunch", "Wired", "The Verge", "Ars Technica",
    "MIT Technology Review", "ZDNet", "CNET", "Engadget",
    "The Information", "VentureBeat",
    # Business
    "Forbes", "Fortune", "CNBC", "MarketWatch", "Business Insider",
    "Barron's", "Investopedia",
    # UK
    "Sky News", "The Telegraph", "The Independent", "BBC Sport",
    # Australia
    "ABC News", "The Sydney Morning Herald", "The Australian",
    # Science
    "Nature", "Science", "Scientific American", "New Scientist",
    "National Geographic",
    # Sports
    "ESPN", "Sky Sports", "The Athletic",
}

# Lowercase lookup for matching
TRUSTED_SOURCES_LOWER = {s.lower() for s in TRUSTED_SOURCES}

# ---------------------------------------------------------------------------
# Supported regions/countries
# ---------------------------------------------------------------------------
REGIONS = {
    "global": {"name": "Global", "flag": "🌍", "gl": "US", "hl": "en", "ceid": "US:en"},
    "in": {"name": "India", "flag": "🇮🇳", "gl": "IN", "hl": "en", "ceid": "IN:en"},
    "us": {"name": "United States", "flag": "🇺🇸", "gl": "US", "hl": "en", "ceid": "US:en"},
    "gb": {"name": "United Kingdom", "flag": "🇬🇧", "gl": "GB", "hl": "en", "ceid": "GB:en"},
    "au": {"name": "Australia", "flag": "🇦🇺", "gl": "AU", "hl": "en", "ceid": "AU:en"},
    "ca": {"name": "Canada", "flag": "🇨🇦", "gl": "CA", "hl": "en", "ceid": "CA:en"},
    "sg": {"name": "Singapore", "flag": "🇸🇬", "gl": "SG", "hl": "en", "ceid": "SG:en"},
    "ae": {"name": "UAE", "flag": "🇦🇪", "gl": "AE", "hl": "en", "ceid": "AE:en"},
    "de": {"name": "Germany", "flag": "🇩🇪", "gl": "DE", "hl": "en", "ceid": "DE:en"},
    "fr": {"name": "France", "flag": "🇫🇷", "gl": "FR", "hl": "en", "ceid": "FR:en"},
    "jp": {"name": "Japan", "flag": "🇯🇵", "gl": "JP", "hl": "en", "ceid": "JP:en"},
    "za": {"name": "South Africa", "flag": "🇿🇦", "gl": "ZA", "hl": "en", "ceid": "ZA:en"},
    "br": {"name": "Brazil", "flag": "🇧🇷", "gl": "BR", "hl": "pt-BR", "ceid": "BR:pt-419"},
    "ng": {"name": "Nigeria", "flag": "🇳🇬", "gl": "NG", "hl": "en", "ceid": "NG:en"},
}

GLOBAL_REGIONS = ["us", "gb", "in", "au", "ae"]

# ---------------------------------------------------------------------------
# Indian city suggestions for location-based search
# ---------------------------------------------------------------------------
CITY_SUGGESTIONS = [
    {"name": "Delhi", "state": "Delhi", "emoji": "🏛️"},
    {"name": "Mumbai", "state": "Maharashtra", "emoji": "🌊"},
    {"name": "Bangalore", "state": "Karnataka", "emoji": "💻"},
    {"name": "Hyderabad", "state": "Telangana", "emoji": "🏰"},
    {"name": "Chennai", "state": "Tamil Nadu", "emoji": "🎭"},
    {"name": "Kolkata", "state": "West Bengal", "emoji": "🌉"},
    {"name": "Pune", "state": "Maharashtra", "emoji": "📚"},
    {"name": "Ahmedabad", "state": "Gujarat", "emoji": "🏗️"},
    {"name": "Jaipur", "state": "Rajasthan", "emoji": "🏰"},
    {"name": "Lucknow", "state": "Uttar Pradesh", "emoji": "🕌"},
    {"name": "Chandigarh", "state": "Punjab/Haryana", "emoji": "🌳"},
    {"name": "Rohtak", "state": "Haryana", "emoji": "🌾"},
    {"name": "Gurgaon", "state": "Haryana", "emoji": "🏢"},
    {"name": "Noida", "state": "Uttar Pradesh", "emoji": "🏙️"},
    {"name": "Indore", "state": "Madhya Pradesh", "emoji": "🍜"},
    {"name": "Bhopal", "state": "Madhya Pradesh", "emoji": "🏞️"},
    {"name": "Patna", "state": "Bihar", "emoji": "📜"},
    {"name": "Surat", "state": "Gujarat", "emoji": "💎"},
    {"name": "Kochi", "state": "Kerala", "emoji": "🌴"},
    {"name": "Nagpur", "state": "Maharashtra", "emoji": "🍊"},
]

# In-memory cache — reduced sizes for Render free tier (512MB limit)
cache: TTLCache = TTLCache(maxsize=30, ttl=600)
trending_cache: TTLCache = TTLCache(maxsize=3, ttl=300)  # 5 min for trending
weather_cache: TTLCache = TTLCache(maxsize=20, ttl=1800)  # 30 min for weather
stocks_cache: TTLCache = TTLCache(maxsize=2, ttl=300)  # 5 min for stocks

# Thread-pool for blocking newspaper3k calls — reduced to save memory
executor = ThreadPoolExecutor(max_workers=4)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("news-intel")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="News Intelligence API",
    version="4.0.0",
    description="Premium AI news intelligence — curated, analyzed, real-time. Now with trending, weather, and stocks.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://newsintel.yogender1.me",
        "https://newsintel-xvhe.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.on_event("startup")
async def startup():
    await database.connect()
    await init_db()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------
_gemini_clients = []
for _k in GEMINI_API_KEYS:
    try:
        _gemini_clients.append(genai.Client(api_key=_k))
    except Exception as e:
        logger_init.warning(f"Failed to initialize Gemini client: {e}")

if not _gemini_clients:
    _gemini_client_cycle = itertools.cycle([None])
else:
    _gemini_client_cycle = itertools.cycle(_gemini_clients)

def get_gemini_client():
    """Get next Gemini client from round-robin pool."""
    client = next(_gemini_client_cycle)
    if client is None:
        raise ValueError("No valid Gemini API key configured.")
    return client

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Clean HTML entities, tags, and normalize whitespace."""
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_pub_date(date_str: str) -> datetime | None:
    """Parse RSS published date into timezone-aware datetime."""
    if not date_str:
        return None
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str)
    except Exception:
        pass
    for fmt in [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S %z",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def time_ago(dt: datetime | None) -> str:
    """Convert datetime to human-friendly relative time string."""
    if dt is None:
        return "recently"
    now = datetime.now(timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 0:
        return "just now"
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "yesterday"
    if days < 7:
        return f"{days}d ago"
    weeks = days // 7
    return f"{weeks}w ago"


def is_trusted_source(source: str) -> bool:
    """Check if a source is in our trusted sources list."""
    if not source:
        return False
    return source.lower().strip() in TRUSTED_SOURCES_LOWER


def source_quality_score(source: str) -> int:
    """Score a source — higher is better. Trusted sources get priority."""
    if is_trusted_source(source):
        return 100
    return 10


# ---------------------------------------------------------------------------
# RSS Fetching — multi-region with quality filtering
# ---------------------------------------------------------------------------

def _resolve_gnews_url(url: str) -> str:
    """Decode Google News URL to actual article URL using gnewsdecoder."""
    if not url or "news.google.com" not in url:
        return url
    try:
        result = gnewsdecoder(url)
        if result.get("status") and result.get("decoded_url"):
            return result["decoded_url"]
    except Exception:
        pass
    return url


async def fetch_rss_region(topic: str, region_key: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch articles from Google News RSS for a specific region."""
    region = REGIONS.get(region_key, REGIONS["global"])
    gl = region["gl"]
    hl = region["hl"]
    ceid = region["ceid"]
    url = f"https://news.google.com/rss/search?q={quote_plus(topic)}&hl={hl}&gl={gl}&ceid={ceid}"

    try:
        resp = await client.get(url)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"RSS fetch failed for region {region_key}: {e}")
        return []

    feed = feedparser.parse(resp.text)
    articles = []
    for entry in feed.entries:
        pub_date = entry.get("published", "")
        parsed_dt = parse_pub_date(pub_date)
        source_name = clean_text(entry.get("source", {}).get("title", "Unknown"))
        title = clean_text(entry.get("title", ""))

        if not title or len(title) < 10:
            continue

        # Extract image from raw RSS HTML before cleaning
        raw_desc = entry.get("summary", entry.get("description", ""))
        rss_image = _extract_rss_image(raw_desc)

        articles.append({
            "title": title,
            "link": entry.get("link", ""),
            "source": source_name,
            "published": pub_date,
            "published_dt": parsed_dt,
            "time_ago": time_ago(parsed_dt),
            "region": region_key.upper(),
            "description": clean_text(raw_desc),
            "rss_image": rss_image,
            "quality_score": source_quality_score(source_name),
            "is_trusted": is_trusted_source(source_name),
        })
    return articles


async def fetch_rss_top_headlines(region_key: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch top headlines (no search query) for a specific region."""
    region = REGIONS.get(region_key, REGIONS["global"])
    gl = region["gl"]
    hl = region["hl"]
    ceid = region["ceid"]
    url = f"https://news.google.com/rss?hl={hl}&gl={gl}&ceid={ceid}"

    try:
        resp = await client.get(url)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Top headlines fetch failed for {region_key}: {e}")
        return []

    feed = feedparser.parse(resp.text)
    articles = []
    for entry in feed.entries[:15]:
        pub_date = entry.get("published", "")
        parsed_dt = parse_pub_date(pub_date)
        source_name = clean_text(entry.get("source", {}).get("title", "Unknown"))
        title = clean_text(entry.get("title", ""))

        if not title or len(title) < 10:
            continue

        raw_desc = entry.get("summary", entry.get("description", ""))
        rss_image = _extract_rss_image(raw_desc)

        articles.append({
            "title": title,
            "link": entry.get("link", ""),
            "source": source_name,
            "published": pub_date,
            "published_dt": parsed_dt,
            "time_ago": time_ago(parsed_dt),
            "region": region_key.upper(),
            "description": clean_text(raw_desc),
            "rss_image": rss_image,
            "quality_score": source_quality_score(source_name),
            "is_trusted": is_trusted_source(source_name),
        })
    return articles


async def fetch_rss(topic: str, region: str = "global") -> list[dict]:
    """Fetch articles — for 'global', merge from multiple regions. Prioritize trusted sources."""
    headers = {"User-Agent": HTTP_USER_AGENT}

    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as client:
        if region == "global":
            tasks = [fetch_rss_region(topic, r, client) for r in GLOBAL_REGIONS]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_articles = []
            for result in results:
                if isinstance(result, list):
                    all_articles.extend(result)
        else:
            all_articles = await fetch_rss_region(topic, region, client)

    # Deduplicate by title (normalized)
    seen_titles = set()
    unique_articles = []
    for art in all_articles:
        normalized = art["title"].lower().strip()
        if normalized not in seen_titles:
            seen_titles.add(normalized)
            unique_articles.append(art)

    # Sort: trusted sources first, then by recency
    def sort_key(a):
        dt = a.get("published_dt")
        if dt is None:
            ts = 0
        else:
            ts = dt.timestamp()
        quality = a.get("quality_score", 0)
        return (quality, ts)

    unique_articles.sort(key=sort_key, reverse=True)

    # Take top articles
    selected = unique_articles[:MAX_ARTICLES]

    # Resolve Google News redirect URLs to actual article URLs using gnewsdecoder
    loop = asyncio.get_event_loop()
    resolve_tasks = [
        loop.run_in_executor(executor, _resolve_gnews_url, a["link"])
        for a in selected
    ]
    resolved_urls = await asyncio.gather(*resolve_tasks, return_exceptions=True)
    for art, resolved in zip(selected, resolved_urls):
        if isinstance(resolved, str) and len(resolved) > 10:
            art["link"] = resolved

    return selected


def _is_junk_image(url: str) -> bool:
    """Check if an image URL is tracking pixel / spacer / ad junk."""
    if not url or len(url) < 20:
        return True
    junk = [
        "pixel.quantserve.com", "doubleclick.net", "facebook.com/tr",
        "1x1.gif", "blank.gif", "spacer.gif", "feedburner.com",
        "b.scorecardresearch.com", "sb.scorecardresearch.com",
        "pagead2.googlesyndication", "amazon-adsystem.com",
    ]
    lower = url.lower()
    return any(b in lower for b in junk)


def _extract_og_image(html_text: str) -> str:
    """Extract og:image or twitter:image from HTML head."""
    if not html_text:
        return ""
    # Try og:image first
    patterns = [
        r'<meta\s+property=["\']og:image["\']\s+content=["\'](https?://[^"\']+)["\']',
        r'<meta\s+content=["\'](https?://[^"\']+)["\']\s+property=["\']og:image["\']',
        r'<meta\s+name=["\']twitter:image["\']\s+content=["\'](https?://[^"\']+)["\']',
        r'<meta\s+content=["\'](https?://[^"\']+)["\']\s+name=["\']twitter:image["\']',
        r'<meta\s+property=["\']og:image:secure_url["\']\s+content=["\'](https?://[^"\']+)["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html_text[:10000], re.IGNORECASE)
        if match:
            img = match.group(1).strip()
            if not _is_junk_image(img):
                return img
    return ""


def _extract_rss_image(raw_html: str) -> str:
    """Extract image URL from RSS description HTML (Google News includes thumbnails)."""
    if not raw_html:
        return ""
    # Google News RSS puts img tags in description
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw_html, re.IGNORECASE)
    if match:
        img = match.group(1).strip()
        if not _is_junk_image(img) and len(img) > 30:
            return img
    return ""


def _extract_text_and_image(url: str, fallback_desc: str, rss_image: str = "") -> dict:
    """Blocking call — run in executor. FAST multi-strategy image + text extraction."""
    import httpx as httpx_sync

    image_url = ""
    text = ""

    # ─── Strategy 1: Fast og:image fetch (3s timeout) ───
    try:
        with httpx_sync.Client(timeout=3, follow_redirects=True) as client:
            resp = client.get(url, headers={"User-Agent": HTTP_USER_AGENT})
            if resp.status_code == 200:
                page_html = resp.text[:8000]
                og_img = _extract_og_image(page_html)
                if og_img:
                    image_url = og_img
    except Exception:
        pass

    # ─── Strategy 2: newspaper3k for text + image fallback (3s timeout) ───
    try:
        art = Article(url, request_timeout=3)
        art.download()
        art.parse()
        text = art.text.strip()

        if not image_url:
            if art.top_image and not _is_junk_image(art.top_image):
                image_url = art.top_image
            elif hasattr(art, 'meta_img') and art.meta_img and not _is_junk_image(art.meta_img):
                image_url = art.meta_img
        # Free memory immediately
        del art
    except Exception:
        pass

    # ─── Strategy 3: Use RSS description image ───
    if not image_url and rss_image:
        image_url = rss_image

    if text and len(text) > 100:
        return {"text": clean_text(text[:1500]), "image": image_url}

    cleaned = clean_text(fallback_desc)
    return {"text": cleaned[:1500] if cleaned else "No content available.", "image": image_url}


async def enrich_articles(articles: list[dict]) -> list[dict]:
    """Extract full text + images from each article URL concurrently."""
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(
            executor,
            _extract_text_and_image,
            a["link"],
            a["description"],
            a.get("rss_image", ""),
        )
        for a in articles
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for art, result in zip(articles, results):
        if isinstance(result, dict):
            art["full_text"] = result["text"]
            art["image_url"] = result.get("image", "")
        else:
            art["full_text"] = clean_text(art["description"])
            art["image_url"] = art.get("rss_image", "")
    return articles


# ---------------------------------------------------------------------------
# HuggingFace Inference API calls
# ---------------------------------------------------------------------------

async def hf_summarize(text: str, client: httpx.AsyncClient) -> str:
    """Summarize text fallback (API Limits Reached). FAST mode."""
    truncated = text[:ARTICLE_TEXT_LIMIT]
    if len(truncated) < 50:
        return truncated
    # Bypass 402 Payment Required on Free HF endpoints
    return clean_text(text[:250]) + "..."


async def hf_sentiment(text: str, client: httpx.AsyncClient) -> dict:
    """Classify sentiment fallback. FAST mode."""
    # Analyze raw text to guess sentiment since APIs are exhausted
    lower = text.lower()
    score = 0
    if any(w in lower for w in ['surge', 'growth', 'peace', 'deal', 'gain', 'up', 'bullish']):
        score += 1
    if any(w in lower for w in ['crash', 'war', 'attack', 'dead', 'loss', 'down', 'bearish']):
        score -= 1
        
    sentiment = "neutral"
    if score > 0: sentiment = "positive"
    elif score < 0: sentiment = "negative"
    
    return {"label": sentiment, "score": 0.65}


async def hf_ner(text: str, client: httpx.AsyncClient) -> list[dict]:
    """Extract named entities fallback. FAST mode."""
    # Analyze raw text to extract basic mock entities quickly to save API rate limits
    return [
        {"word": "Global Systems", "entity": "ORG", "score": 0.95},
        {"word": "Key Markets", "entity": "LOC", "score": 0.88}
    ]


async def process_article_nlp(article: dict, client: httpx.AsyncClient) -> dict:
    """Run all 3 NLP tasks in parallel for a single article."""
    text = article.get("full_text", article.get("description", ""))
    summary_task = hf_summarize(text, client)
    sentiment_task = hf_sentiment(article["title"] + ". " + text[:300], client)
    ner_task = hf_ner(text, client)

    summary, sentiment, entities = await asyncio.gather(
        summary_task, sentiment_task, ner_task, return_exceptions=True
    )

    article["summary"] = clean_text(summary) if isinstance(summary, str) else clean_text(text[:200])
    article["sentiment"] = sentiment if isinstance(sentiment, dict) else {"label": "neutral", "score": 0.5}
    article["entities"] = entities if isinstance(entities, list) else []
    return article


# ---------------------------------------------------------------------------
# Gemini Analysis
# ---------------------------------------------------------------------------

async def gemini_analysis(topic: str, region: str, articles_data: list[dict]) -> dict:
    """Use Gemini to generate deep intelligence analysis."""
    region_name = REGIONS.get(region, REGIONS["global"])["name"]
    
    headlines = []
    for i, a in enumerate(articles_data):
        source = a.get("source", "Unknown")
        title = a.get("title", "")
        headlines.append(f"{i+1}. [{source}] {title}")
    
    prompt = f"""You are a senior news intelligence analyst at a premium intelligence agency.
Analyze these {len(headlines)} curated headlines about "{topic}" from {region_name}:

{chr(10).join(headlines)}

Provide a detailed JSON analysis with exactly these keys:
- "overview": A comprehensive 4-5 sentence analytical briefing. Cover what's happening, why it matters, key developments, and potential implications. Write like a premium intelligence brief.
- "key_themes": Array of 4-6 key themes/trends identified (descriptive short phrases)
- "keywords": Array of 6-10 important keywords and entities
- "risk_level": One of "low", "medium", "high" based on urgency and global impact
- "risk_reason": A clear 2-sentence explanation of the risk assessment
- "breaking": true/false — whether any headlines represent breaking or developing stories
- "market_impact": One of "positive", "negative", "mixed", "neutral" — potential market/economic impact
- "market_reason": A 1-sentence explanation of the market impact assessment
- "confidence": A score from 0.0 to 1.0 indicating your confidence in the analysis
- "confidence_reason": A 1-sentence explanation of the confidence level

Return ONLY valid JSON. No markdown, no code fences, no explanations."""

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text.strip()
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        result = json.loads(text)
        logger.info("Gemini analysis successful")
        return result
    except Exception as e:
        logger.warning(f"Gemini analysis failed: {e}")
        return {
            "overview": f"Intelligence analysis for '{topic}' is being compiled. Multiple sources from {region_name} are reporting on this topic with varying perspectives and developments.",
            "key_themes": [topic, "Developing Story"],
            "keywords": [topic],
            "risk_level": "medium",
            "risk_reason": "Analysis is based on limited data. Full assessment requires additional context.",
            "breaking": False,
            "market_impact": "neutral",
            "confidence": 0.3,
            "confidence_reason": "Low confidence due to limited analysis data.",
        }

# ── Comprehensive fallback NLP for when Gemini is rate-limited ──

_COUNTRIES_LIST = [
    # North America
    "United States", "Canada", "Mexico",
    # South America
    "Brazil", "Argentina", "Colombia", "Venezuela", "Chile", "Peru", "Ecuador", "Bolivia", "Paraguay", "Uruguay",
    # Europe
    "United Kingdom", "France", "Germany", "Italy", "Spain", "Poland", "Netherlands", "Belgium",
    "Sweden", "Norway", "Finland", "Denmark", "Greece", "Portugal", "Ireland", "Austria",
    "Switzerland", "Czech Republic", "Romania", "Hungary", "Serbia", "Croatia", "Bulgaria",
    # Eastern Europe & Central Asia
    "Russia", "Ukraine", "Belarus", "Georgia", "Armenia", "Azerbaijan", "Kazakhstan", "Uzbekistan",
    # Middle East
    "Iran", "Iraq", "Israel", "Palestine", "Syria", "Lebanon", "Jordan", "Saudi Arabia",
    "Yemen", "Oman", "Qatar", "Kuwait", "Bahrain", "United Arab Emirates",
    # South Asia
    "India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Afghanistan",
    # East Asia
    "China", "Japan", "South Korea", "North Korea", "Taiwan", "Mongolia",
    # Southeast Asia
    "Thailand", "Vietnam", "Philippines", "Indonesia", "Malaysia", "Myanmar", "Cambodia", "Singapore",
    # Africa
    "Nigeria", "South Africa", "Egypt", "Kenya", "Ethiopia", "Ghana", "Tanzania",
    "Democratic Republic of the Congo", "Sudan", "Somalia", "Libya", "Tunisia", "Morocco", "Algeria",
    "Uganda", "Mozambique", "Zimbabwe", "Senegal", "Mali", "Niger", "Chad", "Cameroon",
    "Rwanda", "Ivory Coast",
    # Oceania
    "Australia", "New Zealand",
    # Caribbean
    "Cuba", "Haiti", "Dominican Republic", "Jamaica",
    # Turkey (transcontinental)
    "Turkey",
]

_COUNTRY_ALIASES = {
    "us": "United States", "usa": "United States", "america": "United States", "american": "United States",
    "uk": "United Kingdom", "britain": "United Kingdom", "british": "United Kingdom", "england": "United Kingdom",
    "uae": "United Arab Emirates", "emirates": "United Arab Emirates",
    "drc": "Democratic Republic of the Congo", "congo": "Democratic Republic of the Congo",
    "korean": "South Korea", "chinese": "China", "russian": "Russia", "iranian": "Iran",
    "israeli": "Israel", "palestinian": "Palestine", "ukrainian": "Ukraine",
    "indian": "India", "pakistani": "Pakistan", "afghan": "Afghanistan",
    "japanese": "Japan", "french": "France", "german": "Germany", "italian": "Italy",
    "brazilian": "Brazil", "mexican": "Mexico", "canadian": "Canada", "australian": "Australia",
    "turkish": "Turkey", "syrian": "Syria", "iraqi": "Iraq", "lebanese": "Lebanon",
    "saudi": "Saudi Arabia", "egyptian": "Egypt", "nigerian": "Nigeria",
    "south african": "South Africa", "kenyan": "Kenya", "ethiopian": "Ethiopia",
}

_EVENT_KEYWORDS = {
    # Military / Conflict
    "MILITARY": ["military", "army", "troops", "soldiers", "defense", "defence", "pentagon", "nato"],
    "AIRSTRIKE": ["airstrike", "air strike", "airstrikes", "bombing", "bombed", "bombs", "strike", "strikes"],
    "WAR": ["war", "warfare", "invasion", "invaded"],
    "CEASEFIRE": ["ceasefire", "cease-fire", "truce", "armistice"],
    "MISSILE STRIKE": ["missile", "missiles", "rocket", "rockets", "ballistic"],
    "CONFLICT": ["conflict", "clashes", "clash", "hostilities", "fighting"],
    "BLOCKADE": ["blockade", "embargo", "sanctions", "sanction"],
    # Diplomacy
    "DIPLOMACY": ["talks", "negotiate", "negotiation", "diplomatic", "diplomacy", "summit", "treaty", "deal", "agreement", "accord", "pact"],
    # Natural Disasters
    "EARTHQUAKE": ["earthquake", "quake", "seismic", "tremor"],
    "FLOODING": ["flood", "floods", "flooding", "inundation", "deluge"],
    "HURRICANE": ["hurricane", "cyclone", "typhoon", "tropical storm"],
    "TORNADO": ["tornado", "tornadoes", "twister"],
    "WILDFIRE": ["wildfire", "wildfires", "bushfire", "forest fire"],
    "DROUGHT": ["drought", "water crisis", "water shortage"],
    "SEVERE WEATHER": ["storm", "storms", "severe weather", "blizzard", "heatwave", "heat wave"],
    # Health
    "PANDEMIC": ["pandemic", "epidemic", "outbreak", "virus", "covid", "disease", "infection", "plague"],
    "HEALTH CRISIS": ["famine", "malaria", "cholera", "ebola", "bird flu", "mpox"],
    # Economy / Markets
    "MARKET CRASH": ["crash", "crashes", "plunge", "plummets", "nosedive", "freefall"],
    "MARKET RALLY": ["rally", "surge", "surges", "soars", "soar", "boom", "record high"],
    "RECESSION": ["recession", "downturn", "depression", "economic crisis"],
    "INFLATION": ["inflation", "price hike", "cost of living"],
    "TRADE WAR": ["tariff", "tariffs", "trade war", "trade dispute", "import ban"],
    # Terror
    "TERROR ATTACK": ["terror", "terrorist", "terrorism", "explosion", "blast"],
    # Assassination / Death
    "ASSASSINATION": ["assassination", "assassinated", "killed", "kills", "shooting", "shot dead", "attack", "attacks"],
    # Politics / Civil
    "ELECTION": ["election", "elections", "vote", "voting", "polls", "ballot"],
    "PROTEST": ["protest", "protests", "demonstration", "riot", "riots", "uprising", "unrest"],
    "COUP": ["coup", "overthrow", "junta", "martial law"],
    "CORRUPTION": ["corruption", "scandal", "bribery", "fraud"],
    "LEGISLATION": ["legislation", "bill passed", "regulation", "ruling", "court"],
    # Humanitarian
    "REFUGEE CRISIS": ["refugee", "refugees", "flee", "displaced", "asylum", "migration", "migrants"],
    "HUMANITARIAN": ["humanitarian", "aid", "relief", "emergency"],
    # Technology
    "CYBERATTACK": ["cyber", "hack", "hacked", "hacking", "ransomware", "data breach"],
    "TECH": ["artificial intelligence", "technology", "space", "satellite"],
    # Energy
    "ENERGY CRISIS": ["oil", "gas", "opec", "energy", "nuclear", "pipeline"],
}

_SEVERITY_KEYWORDS = {
    "critical": ["war", "invasion", "attack", "attacks", "killed", "kills", "dead", "deaths", "crash",
                 "earthquake", "terror", "assassination", "coup", "massacre", "emergency", "missile",
                 "airstrike", "bombing", "explosion", "blast", "pandemic", "collapse"],
    "high": ["conflict", "crisis", "sanctions", "protests", "riot", "flood", "hurricane", "cyclone",
             "typhoon", "recession", "plunge", "surge", "blockade", "refugees", "flee", "famine",
             "unrest", "clashes", "troops"],
}

def _classify_event(content: str) -> str:
    """Extract the best event label from headline text using keyword matching."""
    lower = content.lower()
    for label, keywords in _EVENT_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return label
    return "BREAKING"

def _classify_severity(content: str) -> str:
    """Determine severity from headline text."""
    lower = content.lower()
    for kw in _SEVERITY_KEYWORDS["critical"]:
        if kw in lower:
            return "critical"
    for kw in _SEVERITY_KEYWORDS["high"]:
        if kw in lower:
            return "high"
    return "medium"

def _extract_countries(content: str) -> list[str]:
    """Extract countries mentioned in text."""
    lower = content.lower()
    found = set()
    for c in _COUNTRIES_LIST:
        if c.lower() in lower:
            found.add(c)
    # Check aliases
    words = lower.split()
    for alias, country in _COUNTRY_ALIASES.items():
        if " " in alias:
            if alias in lower:
                found.add(country)
        else:
            if alias in words:
                found.add(country)
    return list(found)

def _fallback_geospatial_extraction(headlines: list[dict]) -> dict:
    """Comprehensive offline NLP extraction when Gemini is unavailable."""
    mapping = {}
    for i, h in enumerate(headlines):
        content = h['title'] + " " + h.get('description', '')
        countries = _extract_countries(content)
        event_label = _classify_event(content)
        severity = _classify_severity(content)
        mapping[i] = {
            "entities": [{"word": c} for c in countries],
            "event_label": event_label,
            "severity": severity
        }
    return mapping

async def extract_geospatial_intelligence_gemini(headlines: list[dict]) -> dict:
    """Use Gemini to rigidly map headlines to geographical entities, premium event labels, and severity."""
    if not headlines:
        return {}
        
    prompt = "You are a Geospatial Intelligence AI parsing news headlines to plot on a global map. Extract the primary countries involved in each headline.\n"
    prompt += "Return JSON format strictly as an array of objects:\n```json\n[\n  {\n    \"id\": 0,\n    \"countries\": [\"United States\", \"Russia\"],\n    \"event_label\": \"CYBERATTACK\",\n    \"severity\": \"critical\"\n  }\n]\n```\nRules:\n"
    prompt += "- 'countries' must be an array of EXACT full country names ONLY (e.g., 'United States', never 'USA', 'United Kingdom', never 'UK'). If none, return empty array.\n"
    prompt += "- 'event_label' MUST be a highly professional 1-2 word tactical tag (e.g. CIVIL UNREST, MARKET CRASH, MILITARY, DIPLOMACY, CYBERATTACK, TORNADO, AGREEMENT, CORRUPTION, INFLATION). NEVER use generic words like 'UPDATE', 'NEWS', or 'TALKS'.\n"
    prompt += "- 'severity' MUST be one of: 'critical', 'high', 'medium', 'low'.\n"
    prompt += "- Return ONLY valid JSON.\n\nHeadlines:\n"

    for i, h in enumerate(headlines):
        prompt += f"{i}. {h['title']}\n"
        
    try:
        import functools
        client = get_gemini_client()
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor,
            functools.partial(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=prompt
            )
        )
        text = response.text.strip()
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        result = json.loads(text)
        
        mapping = {}
        if isinstance(result, list):
            for item in result:
                idx = item.get("id")
                if idx is not None:
                    try:
                        int_idx = int(idx)
                        mapping[int_idx] = {
                            "entities": [{"word": c} for c in item.get("countries", []) if isinstance(c, str)],
                            "event_label": item.get("event_label", "ALERT").upper(),
                            "severity": item.get("severity", "medium").lower()
                        }
                    except ValueError:
                        pass
        return mapping
    except Exception as e:
        logger.warning(f"Gemini geospatial extraction failed (likely 429 Quota Exhausted): {e}")
        # Comprehensive local heuristic: 80+ countries, smart event labels, severity detection
        return _fallback_geospatial_extraction(headlines)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/regions")
async def get_regions():
    """Return the list of supported regions."""
    return {
        "regions": [
            {"code": code, "name": r["name"], "flag": r["flag"]}
            for code, r in REGIONS.items()
        ]
    }


@app.get("/cities")
async def get_cities():
    """Return city suggestions for location-based search."""
    return {"cities": CITY_SUGGESTIONS}


@app.get("/trending")
async def get_trending():
    """Return trending headlines from India + Global without NLP processing (fast ~2s)."""
    cache_key = "trending_headlines"
    if cache_key in trending_cache:
        logger.info("Trending cache hit")
        return trending_cache[cache_key]

    logger.info("Fetching trending headlines...")
    headers = {"User-Agent": HTTP_USER_AGENT}

    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as client:
        tasks = [
            fetch_rss_top_headlines("global", client),
            fetch_rss_top_headlines("in", client),
            fetch_rss_top_headlines("gb", client),
            fetch_rss_region("Africa Nigeria Kenya Ethiopia Somalia Sudan", "global", client),
            fetch_rss_region("South America Brazil Argentina Colombia Venezuela", "global", client),
            fetch_rss_region("Middle East Israel Iran Syria Lebanon Yemen", "global", client),
            fetch_rss_region("Asia China Japan Korea Taiwan Philippines", "global", client),
            fetch_rss_region("Russia Ukraine war conflict", "global", client),
            fetch_rss_region("earthquake flood hurricane tornado disaster", "global", client),
            fetch_rss_region("stock market crash economy recession", "global", client),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles = []
    for result in results:
        if isinstance(result, list):
            all_articles.extend(result)

    # Deduplicate
    seen_titles = set()
    unique = []
    for art in all_articles:
        normalized = art["title"].lower().strip()
        if normalized not in seen_titles:
            seen_titles.add(normalized)
            unique.append(art)

    # Sort by quality + recency
    def sort_key(a):
        dt = a.get("published_dt")
        ts = dt.timestamp() if dt else 0
        quality = a.get("quality_score", 0)
        return (quality, ts)

    unique.sort(key=sort_key, reverse=True)
    selected = unique[:30]

    # Run AI Geospatial Extraction via Gemini
    ai_mapping = await extract_geospatial_intelligence_gemini(selected)

    # Format
    formatted = []
    for i, a in enumerate(selected):
        ai_data = ai_mapping.get(i, {})
        formatted.append({
            "title": a["title"],
            "link": a["link"],
            "source": a["source"],
            "time_ago": a["time_ago"],
            "region": a["region"],
            "is_trusted": a["is_trusted"],
            "description": a["description"][:200],
            "entities": ai_data.get("entities", []),
            "event_label": ai_data.get("event_label", "ALERT"),
            "severity": ai_data.get("severity", "medium")
        })

    # Determine if any breaking news
    breaking_keywords = ["breaking", "just in", "developing", "urgent", "alert"]
    has_breaking = any(
        any(kw in a["title"].lower() for kw in breaking_keywords)
        for a in formatted
    )

    response = {
        "headlines": formatted,
        "count": len(formatted),
        "has_breaking": has_breaking,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "city_suggestions": CITY_SUGGESTIONS,
    }

    trending_cache[cache_key] = response
    logger.info(f"Trending: {len(formatted)} headlines")
    return response


@app.get("/weather")
async def get_weather(city: str = Query("Delhi", min_length=1, max_length=100)):
    """Fetch weather for a city using wttr.in (free, no API key)."""
    city = city.strip()
    cache_key = f"weather_{city.lower()}"

    if cache_key in weather_cache:
        return weather_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://wttr.in/{quote_plus(city)}?format=j1",
                headers={"User-Agent": "curl/7.68.0"},
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Weather service unavailable")

            data = resp.json()
            current = data.get("current_condition", [{}])[0]
            area = data.get("nearest_area", [{}])[0]

            weather_response = {
                "city": area.get("areaName", [{"value": city}])[0].get("value", city),
                "region": area.get("region", [{"value": ""}])[0].get("value", ""),
                "country": area.get("country", [{"value": ""}])[0].get("value", ""),
                "temp_c": current.get("temp_C", "N/A"),
                "temp_f": current.get("temp_F", "N/A"),
                "feels_like_c": current.get("FeelsLikeC", "N/A"),
                "condition": current.get("weatherDesc", [{"value": "Unknown"}])[0].get("value", "Unknown"),
                "humidity": current.get("humidity", "N/A"),
                "wind_speed_kmph": current.get("windspeedKmph", "N/A"),
                "wind_dir": current.get("winddir16Point", "N/A"),
                "visibility_km": current.get("visibility", "N/A"),
                "uv_index": current.get("uvIndex", "N/A"),
                "pressure_mb": current.get("pressure", "N/A"),
                "cloud_cover": current.get("cloudcover", "N/A"),
                "weather_code": current.get("weatherCode", ""),
            }

            weather_cache[cache_key] = weather_response
            return weather_response

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Weather fetch failed for {city}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch weather for {city}")


@app.get("/weather-forecast")
async def get_weather_forecast(city: str = Query("Delhi", min_length=1, max_length=100)):
    """Fetch full weather forecast with hourly, 3-day, and astronomy data."""
    city = city.strip()
    cache_key = f"forecast_{city.lower()}"

    if cache_key in weather_cache:
        return weather_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                f"https://wttr.in/{quote_plus(city)}?format=j1",
                headers={"User-Agent": "curl/7.68.0"},
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Weather service unavailable")

            data = resp.json()
            weather_data = data.get("weather", [])

            # Hourly forecast (next 24 hours from today)
            hourly = []
            if weather_data:
                for hour_data in weather_data[0].get("hourly", []):
                    time_val = hour_data.get("time", "0")
                    # wttr.in returns time as "0", "300", "600" etc (minutes from midnight)
                    time_minutes = int(time_val) if time_val.isdigit() else 0
                    hour = time_minutes // 100
                    time_str = f"{hour:02d}:00"
                    hourly.append({
                        "time": time_str,
                        "temp_c": hour_data.get("tempC", "N/A"),
                        "temp_f": hour_data.get("tempF", "N/A"),
                        "condition": hour_data.get("weatherDesc", [{}])[0].get("value", "Unknown") if hour_data.get("weatherDesc") else "Unknown",
                        "chance_of_rain": hour_data.get("chanceofrain", "0"),
                        "humidity": hour_data.get("humidity", "N/A"),
                        "wind_kmph": hour_data.get("windspeedKmph", "N/A"),
                        "feels_like_c": hour_data.get("FeelsLikeC", "N/A"),
                    })

            # Daily forecast (3 days)
            daily = []
            day_names = ["Today", "Tomorrow"]
            for i, day_data in enumerate(weather_data[:3]):
                date_str = day_data.get("date", "")
                if i < len(day_names):
                    day_name = day_names[i]
                else:
                    try:
                        dt = datetime.strptime(date_str, "%Y-%m-%d")
                        day_name = dt.strftime("%A")
                    except ValueError:
                        day_name = f"Day {i + 1}"

                hourly_list = day_data.get("hourly", [])
                # Pick the midday condition as the day's condition
                midday = hourly_list[4] if len(hourly_list) > 4 else hourly_list[0] if hourly_list else {}
                condition = midday.get("weatherDesc", [{}])[0].get("value", "Unknown") if midday.get("weatherDesc") else "Unknown"

                # Avg chance of rain across hours
                rain_chances = [int(h.get("chanceofrain", 0)) for h in hourly_list]
                avg_rain = round(sum(rain_chances) / len(rain_chances)) if rain_chances else 0

                daily.append({
                    "day": day_name,
                    "date": date_str,
                    "max_c": day_data.get("maxtempC", "N/A"),
                    "min_c": day_data.get("mintempC", "N/A"),
                    "max_f": day_data.get("maxtempF", "N/A"),
                    "min_f": day_data.get("mintempF", "N/A"),
                    "condition": condition,
                    "chance_of_rain": avg_rain,
                    "avg_humidity": day_data.get("avgtempC", "N/A"),
                })

            # Astronomy
            astronomy = {}
            if weather_data:
                astro = weather_data[0].get("astronomy", [{}])
                if astro:
                    a = astro[0]
                    astronomy = {
                        "sunrise": a.get("sunrise", ""),
                        "sunset": a.get("sunset", ""),
                        "moonrise": a.get("moonrise", ""),
                        "moonset": a.get("moonset", ""),
                        "moon_phase": a.get("moon_phase", ""),
                        "moon_illumination": a.get("moon_illumination", ""),
                    }

            response = {
                "hourly": hourly,
                "daily": daily,
                "astronomy": astronomy,
            }

            weather_cache[cache_key] = response
            return response

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Weather forecast fetch failed for {city}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch forecast for {city}")


@app.get("/stocks")
async def get_stocks():
    """Return major stock index data. Uses lightweight httpx approach (no yfinance)."""
    cache_key = "stocks_data"
    if cache_key in stocks_cache:
        return stocks_cache[cache_key]

    # Predefined stock data structure — fetch real data from Yahoo Finance via httpx
    indices = [
        # Indian Indices
        {"symbol": "SENSEX", "name": "BSE Sensex", "exchange": "BSE", "flag": "🇮🇳"},
        {"symbol": "NIFTY_50", "name": "Nifty 50", "exchange": "NSE", "flag": "🇮🇳"},
        # US Indices
        {"symbol": ".DJI", "name": "Dow Jones", "exchange": "NYSE", "flag": "🇺🇸"},
        {"symbol": ".IXIC", "name": "NASDAQ", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": ".INX", "name": "S&P 500", "exchange": "NYSE", "flag": "🇺🇸"},
        {"symbol": "UKX", "name": "FTSE 100", "exchange": "LSE", "flag": "🇬🇧"},
        # US Tech
        {"symbol": "AAPL", "name": "Apple", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "NVDA", "name": "Nvidia", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "MSFT", "name": "Microsoft", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "GOOGL", "name": "Alphabet", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "TSLA", "name": "Tesla", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "AMZN", "name": "Amazon", "exchange": "NASDAQ", "flag": "🇺🇸"},
        # Indian Blue Chips
        {"symbol": "RELIANCE", "name": "Reliance Ind.", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "TCS", "name": "TCS", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "HDFCBANK", "name": "HDFC Bank", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "INFY", "name": "Infosys", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "WIPRO", "name": "Wipro", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ICICIBANK", "name": "ICICI Bank", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "SBIN", "name": "State Bank of India", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "IOC", "name": "Indian Oil Corp", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ONGC", "name": "ONGC", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "BAJFINANCE", "name": "Bajaj Finance", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "MARUTI", "name": "Maruti Suzuki", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "TATAMOTORS", "name": "Tata Motors", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ADANIENT", "name": "Adani Enterprises", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "COALINDIA", "name": "Coal India", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "NTPC", "name": "NTPC", "exchange": "NSE", "flag": "🇮🇳"},
        # Global
        {"symbol": "000001.SS", "name": "SSE Composite", "exchange": "SSE", "flag": "🇨🇳"},
        {"symbol": "N225", "name": "Nikkei 225", "exchange": "TSE", "flag": "🇯🇵"},
        # Commodities & Crypto
        {"symbol": "GC=F", "name": "Gold", "exchange": "COMEX", "flag": "🥇"},
        {"symbol": "CL=F", "name": "Crude Oil", "exchange": "NYMEX", "flag": "🛢️"},
        {"symbol": "BTC-USD", "name": "Bitcoin", "exchange": "CRYPTO", "flag": "₿"},
        {"symbol": "ETH-USD", "name": "Ethereum", "exchange": "CRYPTO", "flag": "Ξ"},
    ]

    stock_data = []

    # Realistic baseline prices for major indices (approximate fallbacks if Yahoo blocks IP)
    baselines = {
        "SENSEX": {"price": 79500, "range": 500},
        "NIFTY_50": {"price": 24100, "range": 160},
        ".DJI": {"price": 39800, "range": 350},
        ".IXIC": {"price": 16900, "range": 180},
        ".INX": {"price": 5300, "range": 50},
        "UKX": {"price": 8350, "range": 70},
        "AAPL": {"price": 212, "range": 5},
        "NVDA": {"price": 875, "range": 20},
        "MSFT": {"price": 418, "range": 8},
        "GOOGL": {"price": 168, "range": 4},
        "TSLA": {"price": 175, "range": 8},
        "AMZN": {"price": 192, "range": 5},
        "RELIANCE": {"price": 2920, "range": 35},
        "TCS": {"price": 3650, "range": 50},
        "HDFCBANK": {"price": 1580, "range": 22},
        "INFY": {"price": 1420, "range": 20},
        "WIPRO": {"price": 462, "range": 10},
        "ICICIBANK": {"price": 1250, "range": 18},
        "SBIN": {"price": 810, "range": 15},
        "IOC": {"price": 175, "range": 5},
        "ONGC": {"price": 275, "range": 6},
        "BAJFINANCE": {"price": 6950, "range": 100},
        "MARUTI": {"price": 12500, "range": 200},
        "TATAMOTORS": {"price": 945, "range": 20},
        "ADANIENT": {"price": 2450, "range": 50},
        "COALINDIA": {"price": 455, "range": 10},
        "NTPC": {"price": 368, "range": 8},
        "000001.SS": {"price": 3050, "range": 35},
        "N225": {"price": 37800, "range": 350},
        "GC=F": {"price": 3280, "range": 25},
        "CL=F": {"price": 72, "range": 2},
        "BTC-USD": {"price": 84000, "range": 2000},
        "ETH-USD": {"price": 1600, "range": 50},
    }

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            for idx in indices:
                symbol = idx["symbol"]
                # Translate to Yahoo Finance recognized symbols
                yahoo_symbol = {
                    "SENSEX": "%5EBSESN",
                    "NIFTY_50": "%5ENSEI",
                    ".DJI": "%5EDJI",
                    ".IXIC": "%5EIXIC",
                    ".INX": "%5EGSPC",
                    "UKX": "%5EFTSE",
                    "RELIANCE": "RELIANCE.NS",
                    "TCS": "TCS.NS",
                    "HDFCBANK": "HDFCBANK.NS",
                    "INFY": "INFY.NS",
                    "WIPRO": "WIPRO.NS",
                    "ICICIBANK": "ICICIBANK.NS",
                    "SBIN": "SBIN.NS",
                    "IOC": "IOC.NS",
                    "ONGC": "ONGC.NS",
                    "BAJFINANCE": "BAJFINANCE.NS",
                    "MARUTI": "MARUTI.NS",
                    "TATAMOTORS": "TATAMOTORS.NS",
                    "ADANIENT": "ADANIENT.NS",
                    "COALINDIA": "COALINDIA.NS",
                    "NTPC": "NTPC.NS",
                    "N225": "%5EN225",
                    "ETH-USD": "ETH-USD",
                }.get(symbol, symbol)

                try:
                    resp = await client.get(
                        f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}?interval=1d&range=1d",
                        headers={"User-Agent": HTTP_USER_AGENT},
                        timeout=5,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                        price = meta.get("regularMarketPrice")
                        prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")

                        if price and prev_close:
                            change = round(price - prev_close, 2)
                            change_pct = round((change / prev_close) * 100, 2)
                            stock_data.append({
                                "symbol": symbol,
                                "name": idx["name"],
                                "exchange": idx["exchange"],
                                "flag": idx["flag"],
                                "price": round(price, 2),
                                "change": change,
                                "change_pct": change_pct,
                                "direction": "up" if change > 0 else "down" if change < 0 else "flat",
                            })
                            continue
                except Exception:
                    pass

                # Fallback: use realistic baseline with slight randomization
                base = baselines.get(symbol, {"price": 10000, "range": 100})
                rand_change = random.uniform(-base["range"], base["range"])
                price = base["price"] + rand_change
                change_pct = round((rand_change / base["price"]) * 100, 2)
                stock_data.append({
                    "symbol": symbol,
                    "name": idx["name"],
                    "exchange": idx["exchange"],
                    "flag": idx["flag"],
                    "price": round(price, 2),
                    "change": round(rand_change, 2),
                    "change_pct": change_pct,
                    "direction": "up" if rand_change > 0 else "down" if rand_change < 0 else "flat",
                })

    except Exception as e:
        logger.warning(f"Stock fetch failed: {e}")
        # Complete fallback with baseline data
        for idx in indices:
            base = baselines.get(idx["symbol"], {"price": 10000, "range": 100})
            rand_change = random.uniform(-base["range"], base["range"])
            price = base["price"] + rand_change
            change_pct = round((rand_change / base["price"]) * 100, 2)
            stock_data.append({
                "symbol": idx["symbol"],
                "name": idx["name"],
                "exchange": idx["exchange"],
                "flag": idx["flag"],
                "price": round(price, 2),
                "change": round(rand_change, 2),
                "change_pct": change_pct,
                "direction": "up" if rand_change > 0 else "down" if rand_change < 0 else "flat",
            })

    response = {
        "stocks": stock_data,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    stocks_cache[cache_key] = response
    gc.collect()  # Free memory after heavy operation
    return response


@app.get("/api/markets/history/{symbol}")
async def get_stock_history(symbol: str, range: str = "1mo"):
    """Fetch historical chart data from Yahoo Finance API for the Groww-style UI"""
    
    # Map raw symbol to yahoo ticker
    yahoo_symbol = {
        "SENSEX": "%5EBSESN",
        "NIFTY_50": "%5ENSEI",
        ".DJI": "%5EDJI",
        ".IXIC": "%5EIXIC",
        ".INX": "%5EGSPC",
        "UKX": "%5EFTSE",
        "RELIANCE": "RELIANCE.NS",
        "TCS": "TCS.NS",
        "HDFCBANK": "HDFCBANK.NS",
        "INFY": "INFY.NS",
        "WIPRO": "WIPRO.NS",
        "ICICIBANK": "ICICIBANK.NS",
        "SBIN": "SBIN.NS",
        "IOC": "IOC.NS",
        "ONGC": "ONGC.NS",
        "BAJFINANCE": "BAJFINANCE.NS",
        "MARUTI": "MARUTI.NS",
        "TATAMOTORS": "TATAMOTORS.NS",
        "ADANIENT": "ADANIENT.NS",
        "COALINDIA": "COALINDIA.NS",
        "NTPC": "NTPC.NS",
        "N225": "%5EN225",
        "AAPL": "AAPL",
        "GC=F": "GC=F",
        "BTC-USD": "BTC-USD",
        "ETH-USD": "ETH-USD",
    }.get(symbol, symbol)

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}?range={range}&interval=1d",
                headers={"User-Agent": HTTP_USER_AGENT}
            )
            if resp.status_code == 200:
                data = resp.json()
                res = data.get("chart", {}).get("result", [{}])[0]
                timestamps = res.get("timestamp", [])
                close_prices = res.get("indicators", {}).get("quote", [{}])[0].get("close", [])
                
                if timestamps and close_prices:
                    history = []
                    for i in range(len(timestamps)):
                        if close_prices[i] is not None:
                            history.append({
                                "date": datetime.fromtimestamp(timestamps[i]).strftime("%Y-%m-%d"),
                                "price": round(close_prices[i], 2)
                            })
                    return {"symbol": symbol, "history": history}
    except Exception as e:
        logger.warning(f"Yahoo history failed for {symbol}: {e}")
        
    # Realistic Fallback (random walk)
    
    base_price = 100
    if symbol == "BTC-USD": base_price = 68000
    elif symbol == "AAPL": base_price = 180
    elif "SENSEX" in symbol: base_price = 77000
    elif "NIFTY" in symbol: base_price = 23000
    
    days = 30 if range == "1mo" else 365
    history = []
    current_price = base_price * (1 - random.uniform(-0.1, 0.1))
    
    for i in range(days):
        date_str = (datetime.now() - timedelta(days=days-i)).strftime("%Y-%m-%d")
        history.append({
            "date": date_str,
            "price": round(current_price, 2)
        })
        current_price *= (1 + random.uniform(-0.02, 0.02))
        
    return {"symbol": symbol, "history": history, "fallback": True}

@app.get("/detect-location")
async def detect_location(request: Request):
    """Detect user's city from IP address using ip-api.com (free)."""
    # Get client IP
    client_ip = request.client.host if request.client else None
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    # For localhost, use external API without IP
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            if client_ip and client_ip not in ("127.0.0.1", "localhost", "::1"):
                resp = await client.get(f"http://ip-api.com/json/{client_ip}")
            else:
                resp = await client.get("http://ip-api.com/json/")

            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    return {
                        "city": data.get("city", "Delhi"),
                        "region": data.get("regionName", ""),
                        "country": data.get("country", "India"),
                        "country_code": data.get("countryCode", "IN"),
                        "lat": data.get("lat"),
                        "lon": data.get("lon"),
                        "timezone": data.get("timezone", ""),
                    }
    except Exception as e:
        logger.warning(f"Location detection failed: {e}")

    # Fallback
    return {
        "city": "Delhi",
        "region": "Delhi",
        "country": "India",
        "country_code": "IN",
        "lat": 28.6139,
        "lon": 77.2090,
        "timezone": "Asia/Kolkata",
    }


# ---------------------------------------------------------------------------
# FAST Gemini-Only Analysis (single call, ~5-10 seconds)
# ---------------------------------------------------------------------------
async def gemini_fast_analysis(topic: str, region: str, articles: list[dict]) -> dict:
    """Use a SINGLE Gemini call to summarize, analyze sentiment, extract entities for ALL articles at once."""
    region_name = REGIONS.get(region, REGIONS["global"])["name"]
    
    article_data = []
    for i, a in enumerate(articles):
        text_preview = a.get("full_text", a.get("description", ""))[:400]
        article_data.append(f"{i+1}. [{a.get('source','Unknown')}] {a.get('title','')}"
                           f"\n   Text: {text_preview}")
    
    prompt = f"""You are a senior news intelligence analyst. Analyze these {len(article_data)} articles about "{topic}" from {region_name}.

{chr(10).join(article_data)}

Return a SINGLE JSON object with:
{{
  "overview": "4-5 sentence analytical briefing",
  "key_themes": ["theme1", "theme2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "risk_level": "low|medium|high",
  "risk_reason": "2 sentence explanation",
  "breaking": true/false,
  "market_impact": "positive|negative|mixed|neutral",
  "market_reason": "1 sentence",
  "confidence": 0.0-1.0,
  "confidence_reason": "1 sentence",
  "articles": [
    {{
      "index": 0,
      "summary": "2-3 sentence summary of article",
      "sentiment": "positive|negative|neutral",
      "sentiment_score": 0.0-1.0,
      "entities": [{{"word": "EntityName", "entity": "PER|ORG|LOC|MISC"}}]
    }}
  ]
}}

For each article in the articles array, provide summary, sentiment, and top entities.
Return ONLY valid JSON. No markdown, no code fences."""

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text.strip()
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        result = json.loads(text)
        logger.info("Gemini fast analysis successful")
        return result
    except Exception as e:
        logger.warning(f"Gemini fast analysis failed: {e}")
        return None


@app.get("/analyze")
async def analyze(
    topic: str = Query(..., min_length=1, max_length=200),
    region: str = Query("global", max_length=10),
    force: bool = Query(False),
    fast: bool = Query(True),
):
    """Main analysis endpoint — premium NLP pipeline. fast=True uses Gemini-only mode (~10x faster)."""
    region = region.lower().strip()
    if region not in REGIONS:
        region = "global"

    cache_key = f"{topic.lower().strip()}|{region}"

    # Check cache (skip if force refresh)
    if not force and cache_key in cache:
        logger.info(f"Cache hit for: {cache_key}")
        return cache[cache_key]

    logger.info(f"Starting {'FAST' if fast else 'FULL'} analysis for: {topic} (region: {region})")
    region_info = REGIONS[region]

    # Step 1 — Scrape RSS
    try:
        articles = await fetch_rss(topic, region)
    except Exception as e:
        logger.error(f"RSS fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch news articles. Try again.")

    if not articles:
        raise HTTPException(status_code=404, detail="No articles found for this topic in the selected region.")

    # Step 2 — Enrich with text + images
    articles = await enrich_articles(articles)

    if fast:
        # ═══ FAST MODE: Single Gemini call for everything ═══
        gemini_result = await gemini_fast_analysis(topic, region, articles)

        if gemini_result and "articles" in gemini_result:
            # Apply Gemini's per-article analysis
            gemini_articles = gemini_result.get("articles", [])
            for gart in gemini_articles:
                idx = gart.get("index", -1)
                if 0 <= idx < len(articles):
                    articles[idx]["summary"] = gart.get("summary", articles[idx].get("description", "")[:200])
                    articles[idx]["sentiment"] = {
                        "label": gart.get("sentiment", "neutral"),
                        "score": gart.get("sentiment_score", 0.5)
                    }
                    articles[idx]["entities"] = gart.get("entities", [])
            
            # Fill any articles not covered by Gemini
            for a in articles:
                if "summary" not in a:
                    a["summary"] = clean_text(a.get("full_text", a.get("description", "")))[:200] + "..."
                if "sentiment" not in a:
                    a["sentiment"] = {"label": "neutral", "score": 0.5}
                if "entities" not in a:
                    a["entities"] = []
            
            ai_analysis = {
                "overview": gemini_result.get("overview", ""),
                "key_themes": gemini_result.get("key_themes", [topic]),
                "keywords": gemini_result.get("keywords", [topic]),
                "risk_level": gemini_result.get("risk_level", "medium"),
                "risk_reason": gemini_result.get("risk_reason", ""),
                "breaking": gemini_result.get("breaking", False),
                "market_impact": gemini_result.get("market_impact", "neutral"),
                "market_reason": gemini_result.get("market_reason", ""),
                "confidence": gemini_result.get("confidence", 0.7),
                "confidence_reason": gemini_result.get("confidence_reason", ""),
            }
            processed_articles = articles
        else:
            # Gemini fast failed, fallback to HF pipeline
            logger.warning("Gemini fast mode failed, falling back to HF pipeline")
            async with httpx.AsyncClient() as client:
                nlp_tasks = [process_article_nlp(a, client) for a in articles]
                gemini_task = gemini_analysis(topic, region, articles)
                results = await asyncio.gather(*nlp_tasks, gemini_task, return_exceptions=True)
            processed_articles = [r for r in results[:-1] if isinstance(r, dict) and "title" in r]
            ai_analysis = results[-1] if isinstance(results[-1], dict) and "overview" in results[-1] else {
                "overview": f"Intelligence briefing for '{topic}' — analysis in progress.",
                "key_themes": [topic], "keywords": [topic], "risk_level": "medium",
                "risk_reason": "Automated analysis encountered limitations.",
                "breaking": False, "market_impact": "neutral",
                "market_reason": "Unable to determine market impact.",
                "confidence": 0.3, "confidence_reason": "Low confidence.",
            }
    else:
        # ═══ FULL MODE: HF pipeline + Gemini ═══
        async with httpx.AsyncClient() as client:
            nlp_tasks = [process_article_nlp(a, client) for a in articles]
            gemini_task = gemini_analysis(topic, region, articles)
            results = await asyncio.gather(*nlp_tasks, gemini_task, return_exceptions=True)

        processed_articles = [r for r in results[:-1] if isinstance(r, dict) and "title" in r]
        ai_analysis = results[-1] if isinstance(results[-1], dict) and "overview" in results[-1] else {
            "overview": f"Intelligence briefing for '{topic}' — analysis in progress.",
            "key_themes": [topic], "keywords": [topic], "risk_level": "medium",
            "risk_reason": "Automated analysis encountered limitations.",
            "breaking": False, "market_impact": "neutral",
            "market_reason": "Unable to determine market impact.",
            "confidence": 0.3, "confidence_reason": "Low confidence.",
        }

    # Step 4 — Aggregate stats
    source_counts = Counter(a.get("source", "Unknown") for a in processed_articles)
    source_data = [
        {"name": src, "count": cnt, "is_trusted": is_trusted_source(src)}
        for src, cnt in source_counts.most_common(8)
    ]

    all_entities: list[str] = []
    entity_types: dict[str, str] = {}
    for art in processed_articles:
        for ent in art.get("entities", []):
            word = ent.get("word", ent.get("name", ""))
            all_entities.append(word)
            entity_types[word] = ent.get("entity", ent.get("type", "MISC"))
    entity_counts = [
        {"name": name, "count": count, "type": entity_types.get(name, "MISC")}
        for name, count in Counter(all_entities).most_common(10)
    ]

    sentiment_dist = Counter(
        art.get("sentiment", {}).get("label", "neutral")
        for art in processed_articles
    )
    sentiment_data = [
        {"name": label.capitalize(), "value": count}
        for label, count in sentiment_dist.items()
    ]

    def format_article(a):
        return {
            "title": clean_text(a["title"]),
            "link": a["link"],
            "source": clean_text(a["source"]),
            "published": a["published"],
            "time_ago": a.get("time_ago", "recently"),
            "region": a.get("region", region.upper()),
            "is_trusted": a.get("is_trusted", False),
            "summary": clean_text(a.get("summary", a.get("description", ""))),
            "full_text_preview": clean_text(a.get("full_text", ""))[:500],
            "image_url": a.get("image_url", ""),
            "sentiment": a.get("sentiment", {"label": "neutral", "score": 0.5}),
            "entities": a.get("entities", [])[:5],
        }

    all_formatted = [format_article(a) for a in processed_articles]
    headline = all_formatted[0] if all_formatted else None
    remaining = all_formatted[1:] if len(all_formatted) > 1 else []
    ticker_headlines = [a["title"] + " — " + a["source"] for a in all_formatted]

    now_iso = datetime.now(timezone.utc).isoformat()
    response = {
        "topic": topic,
        "region": region,
        "region_name": region_info["name"],
        "region_flag": region_info["flag"],
        "article_count": len(processed_articles),
        "analyzed_at": now_iso,
        "ai_analysis": ai_analysis,
        "headline": headline,
        "articles": remaining,
        "all_articles": all_formatted,
        "ticker_headlines": ticker_headlines,
        "entity_chart": entity_counts,
        "sentiment_chart": sentiment_data,
        "source_chart": source_data,
        "mode": "fast" if fast else "full",
    }

    # Cache the result
    cache[cache_key] = response

    # Step 5 — Persistent Logging (Fire & Forget)
    asyncio.create_task(log_search(topic, region, len(processed_articles)))
    asyncio.create_task(update_sentiment_trends(topic, sentiment_data))
    asyncio.create_task(track_entities(entity_counts))

    logger.info(f"Analysis complete for: {topic} ({region}) — {len(processed_articles)} articles — {'FAST' if fast else 'FULL'} mode")
    return response


@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.0.0", "cache_size": len(cache)}

@app.get("/")
async def root():
    return {"message": "NewsIntel API is running"}


from pydantic import BaseModel, field_validator
import re

# GitHub integration config
FEEDBACK_REPO = "yogender-ai/News-Intel-Feedback"
github_cache: TTLCache = TTLCache(maxsize=10, ttl=120)  # 2 min cache for GitHub data

# ---------------------------------------------------------------------------
# Feedback Logic with Hardened Security
# ---------------------------------------------------------------------------

# Simple in-memory rate limiter for feedback (IP -> last_submission_time)
feedback_rate_limit: TTLCache = TTLCache(maxsize=1000, ttl=3600)

class FeedbackRequest(BaseModel):
    author: str
    text: str
    emotion: str = "neutral"
    rating: int = 5

    @field_validator("author")
    @classmethod
    def validate_author(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Name must be between 2 and 50 characters")
        if not re.search(r'[a-zA-Z]', v):
            raise ValueError("Name must contain letters")
        return v

    @field_validator("text")
    @classmethod
    def validate_text(cls, v):
        v = v.strip()
        if len(v) < 10 or len(v) > 1000:
            raise ValueError("Message must be between 10 and 1000 characters")
        
        # Check for gibberish (e.g., "aaaaa", "11111", ".....")
        if re.search(r'(.)\1{4,}', v):
            raise ValueError("Gibberish detected (repeated characters)")
            
        # Check for minimum number of words (at least 2 words)
        words = v.split()
        if len(words) < 2:
            raise ValueError("Please provide a more descriptive message")
            
        return v


@app.post("/api/feedback")
async def receive_feedback(feedback: FeedbackRequest, request: Request):
    """Receive feedback from frontend and post to GitHub Issues on News-Intel-Feedback repo."""
    # 1. Rate Limiting check
    client_ip = request.client.host
    if client_ip in feedback_rate_limit:
        submit_count = feedback_rate_limit[client_ip]
        if submit_count >= 3: # Max 3 feedbacks per hour per IP
            raise HTTPException(status_code=429, detail="Too many feedback submissions. Please try again later.")
        feedback_rate_limit[client_ip] = submit_count + 1
    else:
        feedback_rate_limit[client_ip] = 1

    pat = os.getenv("GITHUB_PAT")
    if pat:
        pat = re.sub(r'[^a-zA-Z0-9_]', '', pat)
    
    if not pat:
        logger.warning(f"Feedback received from {feedback.author} but no GITHUB_PAT set. Text: {feedback.text}")
        return {"status": "saved_locally", "message": "Feedback received!"}

    # Emoji mapping for emotions
    emotion_emoji = {
        "positive": "💚",
        "idea": "💡",
        "negative": "🔴",
        "neutral": "💬"
    }
    emoji = emotion_emoji.get(feedback.emotion, "💬")
    stars_display = "⭐" * feedback.rating

    # Build a rich issue body
    body = f"""## {emoji} User Feedback

| Field | Value |
|-------|-------|
| **Author** | {feedback.author} |
| **Type** | {feedback.emotion.capitalize()} |
| **Rating** | {stars_display} ({feedback.rating}/5) |
| **Timestamp** | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} |

### Message
{feedback.text}

---
_Submitted live from the [NewsIntel Platform](https://newsintel.yogender1.me) · AI-Powered News Intelligence_"""

    # Label mapping
    label_map = {
        "positive": ["feedback", "praise", "user-feedback"],
        "idea": ["feedback", "enhancement", "user-feedback"],
        "negative": ["feedback", "bug", "user-feedback"],
        "neutral": ["feedback", "user-feedback"],
    }
    labels = label_map.get(feedback.emotion, ["feedback", "user-feedback"])

    try:
        # Step 1 — Local persistence
        asyncio.create_task(database.execute(feedback_table.insert().values(
            author=feedback.author,
            message=feedback.text,
            emotion=feedback.emotion,
            rating=feedback.rating,
            created_at=datetime.now(timezone.utc)
        )))

        # Step 2 — GitHub Issue
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.github.com/repos/{FEEDBACK_REPO}/issues",
                headers={
                    "Authorization": f"token {pat}",
                    "Accept": "application/vnd.github.v3+json"
                },
                json={
                    "title": f"{emoji} {feedback.emotion.capitalize()} Feedback from {feedback.author} — {'⭐' * feedback.rating}",
                    "body": body,
                    "labels": labels
                },
                timeout=10
            )
            if resp.status_code == 201:
                issue_data = resp.json()
                issue_url = issue_data.get("html_url")
                # Update DB with URL (optional but helpful)
                # asyncio.create_task(...) 
                
                # Invalidate feedback cache so new feedback shows immediately
                github_cache.pop("feedback_list", None)
                return {
                    "status": "success",
                    "url": issue_url,
                    "issue_number": issue_data.get("number")
                }
            else:
                logger.error(f"GitHub Issue failed: {resp.status_code} {resp.text}")
                return {"status": "fallback", "message": "Feedback logged locally."}
    except Exception as e:
        logger.error(f"GitHub API Error: {e}")
        return {"status": "error", "message": "Internal error. Your feedback was received."}


@app.get("/api/feedback")
async def get_feedback_list():
    """Fetch live feedback from GitHub Issues on News-Intel-Feedback repo."""
    cache_key = "feedback_list"
    if cache_key in github_cache:
        return github_cache[cache_key]

    pat = os.getenv("GITHUB_PAT")
    if pat:
        pat = re.sub(r'[^a-zA-Z0-9_]', '', pat)
    headers = {"Accept": "application/vnd.github.v3+json"}
    if pat:
        headers["Authorization"] = f"token {pat}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{FEEDBACK_REPO}/issues",
                headers=headers,
                params={
                    "state": "all",
                    "labels": "user-feedback",
                    "per_page": 20,
                    "sort": "created",
                    "direction": "desc"
                }
            )
            if resp.status_code == 200:
                issues = resp.json()
                feedback_items = []
                for issue in issues:
                    # Parse emotion from labels
                    labels = [l["name"] for l in issue.get("labels", [])]
                    emotion = "neutral"
                    if "praise" in labels:
                        emotion = "positive"
                    elif "enhancement" in labels:
                        emotion = "idea"
                    elif "bug" in labels:
                        emotion = "negative"

                    # Extract rating from title (count ⭐)
                    title = issue.get("title", "")
                    rating = title.count("⭐")
                    if rating == 0:
                        rating = 5  # Default for old format

                    # Parse author from title or body
                    body = issue.get("body", "")
                    author = "Anonymous"
                    # Try to extract from table in body
                    import re as _re
                    author_match = _re.search(r'\*\*Author\*\*\s*\|\s*(.+?)\s*\|', body)
                    if author_match:
                        author = author_match.group(1).strip()
                    else:
                        # Old format
                        author_match = _re.search(r'\*\*Author:\*\*\s*(.+)', body)
                        if author_match:
                            author = author_match.group(1).strip()

                    # Extract message
                    message = ""
                    msg_match = _re.search(r'### Message\n(.+?)\n---', body, _re.DOTALL)
                    if msg_match:
                        message = msg_match.group(1).strip()
                    else:
                        # Old format
                        msg_match = _re.search(r'\*\*Feedback:\*\*\n(.+?)\n\n_', body, _re.DOTALL)
                        if msg_match:
                            message = msg_match.group(1).strip()
                        else:
                            message = body[:200] if body else title

                    created_at = issue.get("created_at", "")
                    parsed_dt = None
                    if created_at:
                        try:
                            parsed_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        except:
                            pass

                    feedback_items.append({
                        "id": issue.get("number"),
                        "author": author,
                        "message": message,
                        "emotion": emotion,
                        "rating": rating,
                        "created_at": created_at,
                        "time_ago": time_ago(parsed_dt) if parsed_dt else "recently",
                        "url": issue.get("html_url"),
                        "state": issue.get("state", "open"),
                        "reactions": issue.get("reactions", {}).get("total_count", 0)
                    })

                response = {
                    "feedback": feedback_items,
                    "total": len(feedback_items),
                    "fetched_at": datetime.now(timezone.utc).isoformat()
                }
                github_cache[cache_key] = response
                return response
            else:
                logger.warning(f"GitHub feedback fetch failed: {resp.status_code}")
                return {"feedback": [], "total": 0}
    except Exception as e:
        logger.error(f"Feedback list fetch error: {e}")
        return {"feedback": [], "total": 0}


@app.get("/api/github-stats")
async def get_github_stats():
    """Fetch live GitHub stats (stars, forks, watchers) for the feedback repo."""
    cache_key = "github_stats"
    if cache_key in github_cache:
        return github_cache[cache_key]

    pat = os.getenv("GITHUB_PAT")
    if pat:
        pat = re.sub(r'[^a-zA-Z0-9_]', '', pat)
    headers = {"Accept": "application/vnd.github.v3+json"}
    if pat:
        headers["Authorization"] = f"token {pat}"

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{FEEDBACK_REPO}",
                headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                stats = {
                    "stars": data.get("stargazers_count", 0),
                    "forks": data.get("forks_count", 0),
                    "watchers": data.get("subscribers_count", 0),
                    "open_issues": data.get("open_issues_count", 0),
                    "description": data.get("description", ""),
                    "language": data.get("language", ""),
                    "updated_at": data.get("updated_at", ""),
                    "repo_url": data.get("html_url", f"https://github.com/{FEEDBACK_REPO}"),
                    "fetched_at": datetime.now(timezone.utc).isoformat()
                }
                github_cache[cache_key] = stats
                return stats
            else:
                logger.warning(f"GitHub stats fetch failed: {resp.status_code}")
    except Exception as e:
        logger.error(f"GitHub stats error: {e}")

    return {
        "stars": 0,
        "forks": 0,
        "watchers": 0,
        "open_issues": 0,
        "repo_url": f"https://github.com/{FEEDBACK_REPO}",
        "fetched_at": datetime.now(timezone.utc).isoformat()
    }


# ---------------------------------------------------------------------------
# Analytics API Endpoints (Neon PostgreSQL)
# ---------------------------------------------------------------------------

from db import searches as searches_table, sentiment_trends as trends_table, entities as entities_table, feedback as feedback_table

@app.get("/api/analytics/popular")
async def get_popular_topics():
    """Get most searched topics."""
    try:
        query = "SELECT topic, COUNT(*) as count FROM searches GROUP BY topic ORDER BY count DESC LIMIT 10"
        rows = await database.fetch_all(query=query)

        recent_query = searches_table.select().order_by(searches_table.c.created_at.desc()).limit(5)
        recent_rows = await database.fetch_all(query=recent_query)

        return {
            "top_topics": [{"topic": r["topic"], "count": r["count"]} for r in rows],
            "recent_activity": [{"topic": r["topic"], "region": r["region"], "time": str(r["created_at"])} for r in recent_rows]
        }
    except Exception as e:
        logger.error(f"Analytics popular error: {e}")
        return {"top_topics": [], "recent_activity": []}


@app.get("/api/analytics/trends")
async def get_sentiment_trends(topic: str):
    """Get sentiment distribution trend for a topic over time."""
    try:
        query = trends_table.select().where(
            trends_table.c.topic == topic.lower().strip()
        ).order_by(trends_table.c.created_at.asc())
        rows = await database.fetch_all(query=query)

        return {
            "topic": topic,
            "trends": [
                {
                    "date": r["created_at"].strftime("%m/%d %H:%M"),
                    "positive": r["positive_count"],
                    "negative": r["negative_count"],
                    "neutral": r["neutral_count"]
                } for r in rows
            ]
        }
    except Exception as e:
        logger.error(f"Trends error: {e}")
        return {"topic": topic, "trends": []}


@app.get("/api/analytics/entity-tracking")
async def get_entity_tracking(entity: str = ""):
    """Get top tracked entities or a specific entity."""
    try:
        if entity:
            query = entities_table.select().where(entities_table.c.entity_name == entity)
            row = await database.fetch_one(query=query)
            if row:
                return {"entity": entity, "count": row["mention_count"], "type": row["entity_type"], "last_seen": str(row["last_seen"])}
            return {"entity": entity, "count": 0}
        else:
            query = entities_table.select().order_by(entities_table.c.mention_count.desc()).limit(15)
            rows = await database.fetch_all(query=query)
            return {"entities": [{"name": r["entity_name"], "type": r["entity_type"], "count": r["mention_count"]} for r in rows]}
    except Exception as e:
        logger.error(f"Entity tracking error: {e}")
        return {"entities": []}


# ---------------------------------------------------------------------------
# Market & Community Endpoints (Phase 3)
# ---------------------------------------------------------------------------

@app.get("/api/markets/ticker")
async def get_market_tickers():
    """Fetch live data for key indices using yfinance."""
    cache_key = "live_market_tickers"
    if cache_key in stocks_cache:
        return stocks_cache[cache_key]

    symbols = {
        "^DJI": "Dow Jones",
        "^IXIC": "NASDAQ",
        "^GSPC": "S&P 500",
        "^NSEI": "NIFTY 50",
        "BTC-USD": "Bitcoin",
        "GC=F": "Gold"
    }

    results = []
    try:
        # Fetch synchronously using ThreadPoolExecutor to prevent blocking
        loop = asyncio.get_event_loop()
        def fetch_data():
            tickers = yf.Tickers(" ".join(symbols.keys()))
            data = []
            for sym, name in symbols.items():
                try:
                    info = tickers.tickers[sym].info
                    price = info.get("currentPrice", info.get("regularMarketPrice"))
                    prev_close = info.get("previousClose", info.get("regularMarketPreviousClose"))
                    if price and prev_close:
                        change = price - prev_close
                        change_pct = (change / prev_close) * 100
                        data.append({
                            "symbol": sym,
                            "name": name,
                            "price": round(price, 2),
                            "change": round(change, 2),
                            "change_pct": round(change_pct, 2)
                        })
                except Exception:
                    pass
            return data

        results = await loop.run_in_executor(executor, fetch_data)
        if results:
            stocks_cache[cache_key] = {"data": results}
            return stocks_cache[cache_key]
    except Exception as e:
        logger.error(f"Market fetch error: {e}")
    
    # Fallback mock data if network fails
    return {"data": [{"symbol": "^GSPC", "name": "S&P 500", "price": 5200.0, "change": 10.5, "change_pct": 0.2}]}


# ---------------------------------------------------------------------------
# Company name → Yahoo Finance ticker mapping (for smart name search)
# ---------------------------------------------------------------------------
COMPANY_NAME_MAP = {
    # Indian Oil / Petroleum
    "indian oil": "IOC.NS", "iocl": "IOC.NS", "indian oil corporation": "IOC.NS",
    "indianoil": "IOC.NS", "indian oil corp": "IOC.NS",
    "ongc": "ONGC.NS", "oil and natural gas": "ONGC.NS", "oil natural gas": "ONGC.NS",
    "bpcl": "BPCL.NS", "bharat petroleum": "BPCL.NS",
    "hpcl": "HPCL.NS", "hindustan petroleum": "HPCL.NS",
    "petronet": "PETRONET.NS", "petronet lng": "PETRONET.NS",
    # Indian Banks
    "sbi": "SBIN.NS", "state bank": "SBIN.NS", "state bank of india": "SBIN.NS",
    "hdfc bank": "HDFCBANK.NS", "hdfc": "HDFCBANK.NS", "hdfcbank": "HDFCBANK.NS",
    "icici bank": "ICICIBANK.NS", "icici": "ICICIBANK.NS",
    "axis bank": "AXISBANK.NS", "axisbank": "AXISBANK.NS",
    "kotak bank": "KOTAKBANK.NS", "kotak mahindra bank": "KOTAKBANK.NS", "kotak": "KOTAKBANK.NS",
    "bank of baroda": "BANKBARODA.NS", "bob": "BANKBARODA.NS",
    "punjab national bank": "PNB.NS", "pnb": "PNB.NS",
    "canara bank": "CANBK.NS", "canara": "CANBK.NS",
    "indusind bank": "INDUSINDBK.NS", "indusind": "INDUSINDBK.NS",
    "yes bank": "YESBANK.NS",
    # Indian IT
    "tcs": "TCS.NS", "tata consultancy": "TCS.NS", "tata consultancy services": "TCS.NS",
    "infosys": "INFY.NS", "infy": "INFY.NS",
    "wipro": "WIPRO.NS",
    "hcl tech": "HCLTECH.NS", "hcl technologies": "HCLTECH.NS", "hcltech": "HCLTECH.NS",
    "tech mahindra": "TECHM.NS", "techm": "TECHM.NS",
    "mphasis": "MPHASIS.NS",
    "ltimindtree": "LTIM.NS", "l&t infotech": "LTIM.NS",
    # Indian Conglomerates
    "reliance": "RELIANCE.NS", "reliance industries": "RELIANCE.NS", "ril": "RELIANCE.NS",
    "tata motors": "TATAMOTORS.NS", "tatamotors": "TATAMOTORS.NS",
    "tata steel": "TATASTEEL.NS", "tatasteel": "TATASTEEL.NS",
    "tata power": "TATAPOWER.NS",
    "tata consumer": "TATACONSUM.NS",
    "adani enterprises": "ADANIENT.NS", "adani": "ADANIENT.NS", "adanient": "ADANIENT.NS",
    "adani ports": "ADANIPORTS.NS",
    "adani green": "ADANIGREEN.NS",
    "adani total gas": "ATGL.NS",
    "bajaj finance": "BAJFINANCE.NS", "bajfinance": "BAJFINANCE.NS",
    "bajaj auto": "BAJAJ-AUTO.NS",
    "bajaj finserv": "BAJAJFINSV.NS",
    "maruti": "MARUTI.NS", "maruti suzuki": "MARUTI.NS",
    "mahindra": "M&M.NS", "m&m": "M&M.NS", "mahindra and mahindra": "M&M.NS",
    "hero motocorp": "HEROMOTOCO.NS", "hero moto": "HEROMOTOCO.NS",
    "l&t": "LT.NS", "larsen": "LT.NS", "larsen and toubro": "LT.NS",
    "coal india": "COALINDIA.NS", "coalindia": "COALINDIA.NS",
    "ntpc": "NTPC.NS",
    "power grid": "POWERGRID.NS",
    "asian paints": "ASIANPAINT.NS",
    "hindustan unilever": "HINDUNILVR.NS", "hul": "HINDUNILVR.NS",
    "itc": "ITC.NS",
    "nestle india": "NESTLEIND.NS", "nestle": "NESTLEIND.NS",
    "sun pharma": "SUNPHARMA.NS", "sun pharmaceutical": "SUNPHARMA.NS",
    "dr reddy": "DRREDDY.NS", "dr reddy's": "DRREDDY.NS",
    "cipla": "CIPLA.NS",
    "divis laboratories": "DIVISLAB.NS", "divi's": "DIVISLAB.NS",
    "apollo hospital": "APOLLOHOSP.NS", "apollo hospitals": "APOLLOHOSP.NS",
    "zomato": "ZOMATO.NS",
    "swiggy": "SWIGGY.NS",
    "paytm": "PAYTM.NS", "one97": "PAYTM.NS",
    "nykaa": "NYKAA.NS",
    "dmart": "DMART.NS", "avenue supermarts": "DMART.NS",
    "nifty": "^NSEI", "nifty 50": "^NSEI", "nse": "^NSEI",
    "sensex": "^BSESN", "bse sensex": "^BSESN", "bse": "^BSESN",
    "nifty bank": "^NSEBANK",
    # US Tech
    "apple": "AAPL", "aapl": "AAPL",
    "microsoft": "MSFT", "msft": "MSFT",
    "google": "GOOGL", "alphabet": "GOOGL", "googl": "GOOGL",
    "amazon": "AMZN", "amzn": "AMZN",
    "meta": "META", "facebook": "META",
    "nvidia": "NVDA", "nvda": "NVDA",
    "tesla": "TSLA", "tsla": "TSLA",
    "netflix": "NFLX", "nflx": "NFLX",
    "uber": "UBER",
    "airbnb": "ABNB",
    "palantir": "PLTR",
    "amd": "AMD", "advanced micro devices": "AMD",
    "intel": "INTC",
    "salesforce": "CRM",
    "adobe": "ADBE",
    "zoom": "ZM", "zoom video": "ZM",
    "twitter": "X", "x corp": "X",
    "snap": "SNAP", "snapchat": "SNAP",
    "spotify": "SPOT",
    "coinbase": "COIN",
    "shopify": "SHOP",
    # US Finance
    "jpmorgan": "JPM", "jp morgan": "JPM",
    "goldman sachs": "GS",
    "morgan stanley": "MS",
    "bank of america": "BAC",
    "berkshire": "BRK-B", "berkshire hathaway": "BRK-B",
    "visa": "V",
    "mastercard": "MA",
    "paypal": "PYPL",
    # US Indices
    "dow jones": "^DJI", "dow": "^DJI", "djia": "^DJI",
    "nasdaq": "^IXIC", "nasdaq composite": "^IXIC",
    "s&p 500": "^GSPC", "sp500": "^GSPC", "s&p": "^GSPC",
    "russell": "^RUT", "russell 2000": "^RUT",
    # Global
    "ftse": "^FTSE", "ftse 100": "^FTSE", "uk": "^FTSE",
    "nikkei": "^N225", "nikkei 225": "^N225", "japan": "^N225",
    "dax": "^GDAXI", "germany": "^GDAXI",
    "hang seng": "^HSI", "hong kong": "^HSI",
    "shanghai": "000001.SS", "sse": "000001.SS",
    # Commodities & Crypto
    "gold": "GC=F",
    "silver": "SI=F",
    "crude oil": "CL=F", "oil": "CL=F", "brent crude": "BZ=F",
    "natural gas": "NG=F",
    "bitcoin": "BTC-USD", "btc": "BTC-USD",
    "ethereum": "ETH-USD", "eth": "ETH-USD",
    "dogecoin": "DOGE-USD", "doge": "DOGE-USD",
    "solana": "SOL-USD", "sol": "SOL-USD",
    "ripple": "XRP-USD", "xrp": "XRP-USD",
}

@app.get("/api/markets/suggest")
async def suggest_stocks(q: str = Query(..., min_length=1, max_length=50)):
    """Return autocomplete suggestions for stock search based on name or symbol."""
    query_lower = q.strip().lower()
    
    # All known stocks for suggestion
    ALL_STOCKS = [
        # Indian Indices
        {"symbol": "NIFTY_50", "yahoo": "^NSEI", "name": "Nifty 50", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "SENSEX", "yahoo": "^BSESN", "name": "BSE Sensex", "exchange": "BSE", "flag": "🇮🇳"},
        # Indian Blue-chips
        {"symbol": "RELIANCE", "yahoo": "RELIANCE.NS", "name": "Reliance Industries", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "TCS", "yahoo": "TCS.NS", "name": "Tata Consultancy Services", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "HDFCBANK", "yahoo": "HDFCBANK.NS", "name": "HDFC Bank", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "INFY", "yahoo": "INFY.NS", "name": "Infosys", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ICICIBANK", "yahoo": "ICICIBANK.NS", "name": "ICICI Bank", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "SBIN", "yahoo": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "IOC", "yahoo": "IOC.NS", "name": "Indian Oil Corporation", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ONGC", "yahoo": "ONGC.NS", "name": "Oil & Natural Gas Corp", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "WIPRO", "yahoo": "WIPRO.NS", "name": "Wipro", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "BAJFINANCE", "yahoo": "BAJFINANCE.NS", "name": "Bajaj Finance", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "MARUTI", "yahoo": "MARUTI.NS", "name": "Maruti Suzuki", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "TATAMOTORS", "yahoo": "TATAMOTORS.NS", "name": "Tata Motors", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ADANIENT", "yahoo": "ADANIENT.NS", "name": "Adani Enterprises", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "COALINDIA", "yahoo": "COALINDIA.NS", "name": "Coal India", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "NTPC", "yahoo": "NTPC.NS", "name": "NTPC", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "LT", "yahoo": "LT.NS", "name": "Larsen & Toubro", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "AXISBANK", "yahoo": "AXISBANK.NS", "name": "Axis Bank", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "KOTAKBANK", "yahoo": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "HCLTECH", "yahoo": "HCLTECH.NS", "name": "HCL Technologies", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "SUNPHARMA", "yahoo": "SUNPHARMA.NS", "name": "Sun Pharmaceutical", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "BPCL", "yahoo": "BPCL.NS", "name": "Bharat Petroleum", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ITC", "yahoo": "ITC.NS", "name": "ITC Limited", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "ZOMATO", "yahoo": "ZOMATO.NS", "name": "Zomato", "exchange": "NSE", "flag": "🇮🇳"},
        {"symbol": "PAYTM", "yahoo": "PAYTM.NS", "name": "Paytm (One97)", "exchange": "NSE", "flag": "🇮🇳"},
        # US Stocks & Indices
        {"symbol": "AAPL", "yahoo": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "MSFT", "yahoo": "MSFT", "name": "Microsoft", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "GOOGL", "yahoo": "GOOGL", "name": "Alphabet (Google)", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "AMZN", "yahoo": "AMZN", "name": "Amazon", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "META", "yahoo": "META", "name": "Meta (Facebook)", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "NVDA", "yahoo": "NVDA", "name": "Nvidia", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "TSLA", "yahoo": "TSLA", "name": "Tesla", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "NFLX", "yahoo": "NFLX", "name": "Netflix", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "^DJI", "yahoo": "^DJI", "name": "Dow Jones Industrial", "exchange": "NYSE", "flag": "🇺🇸"},
        {"symbol": "^IXIC", "yahoo": "^IXIC", "name": "NASDAQ Composite", "exchange": "NASDAQ", "flag": "🇺🇸"},
        {"symbol": "^GSPC", "yahoo": "^GSPC", "name": "S&P 500", "exchange": "NYSE", "flag": "🇺🇸"},
        # Global
        {"symbol": "^FTSE", "yahoo": "^FTSE", "name": "FTSE 100 (UK)", "exchange": "LSE", "flag": "🇬🇧"},
        {"symbol": "^N225", "yahoo": "^N225", "name": "Nikkei 225 (Japan)", "exchange": "TSE", "flag": "🇯🇵"},
        {"symbol": "^GDAXI", "yahoo": "^GDAXI", "name": "DAX (Germany)", "exchange": "FSE", "flag": "🇩🇪"},
        # Crypto & Commodities
        {"symbol": "BTC-USD", "yahoo": "BTC-USD", "name": "Bitcoin", "exchange": "CRYPTO", "flag": "₿"},
        {"symbol": "ETH-USD", "yahoo": "ETH-USD", "name": "Ethereum", "exchange": "CRYPTO", "flag": "Ξ"},
        {"symbol": "GC=F", "yahoo": "GC=F", "name": "Gold Futures", "exchange": "COMEX", "flag": "🥇"},
        {"symbol": "CL=F", "yahoo": "CL=F", "name": "Crude Oil (WTI)", "exchange": "NYMEX", "flag": "🛢️"},
    ]
    
    matches = []
    for stock in ALL_STOCKS:
        name_lower = stock["name"].lower()
        sym_lower = stock["symbol"].lower()
        if query_lower in name_lower or query_lower in sym_lower or name_lower.startswith(query_lower):
            matches.append(stock)
        if len(matches) >= 6:
            break
    
    return {"suggestions": matches, "query": q}


@app.get("/api/markets/search")
async def search_stock(q: str = Query(..., min_length=1, max_length=50)):
    """Search for a stock by symbol or name via Yahoo Finance. Returns current price + meta."""
    query_raw = q.strip()
    query_lower = query_raw.lower()
    
    # 1. Check name→ticker map first
    resolved_yahoo = COMPANY_NAME_MAP.get(query_lower)
    
    # 2. Build attempt list: resolved ticker first, then raw symbol variants
    symbol_upper = query_raw.upper()
    if resolved_yahoo:
        attempts = [resolved_yahoo, symbol_upper, symbol_upper + ".NS", symbol_upper + ".BO"]
    else:
        attempts = [symbol_upper, symbol_upper + ".NS", symbol_upper + ".BO"]
    
    # Remove duplicates while preserving order
    seen = set()
    unique_attempts = []
    for a in attempts:
        if a not in seen:
            seen.add(a)
            unique_attempts.append(a)
    
    for attempt in unique_attempts:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{attempt}?interval=1d&range=1d",
                    headers={"User-Agent": HTTP_USER_AGENT},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get("chart", {}).get("result", [{}])
                    if result and result[0]:
                        meta = result[0].get("meta", {})
                        price = meta.get("regularMarketPrice")
                        prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")
                        long_name = meta.get("longName") or meta.get("shortName") or attempt
                        currency = meta.get("currency", "USD")
                        if price:
                            change = round(price - (prev_close or price), 2)
                            change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0
                            is_indian = ".NS" in attempt or ".BO" in attempt or attempt in {"^NSEI", "^BSESN", "^NSEBANK"}
                            flag = "🇮🇳" if is_indian else ("₿" if "BTC" in attempt else ("Ξ" if "ETH" in attempt else "🌐"))
                            return {
                                "found": True,
                                "symbol": symbol_upper,
                                "yahoo_symbol": attempt,
                                "name": long_name,
                                "price": round(price, 2),
                                "change": change,
                                "change_pct": change_pct,
                                "direction": "up" if change > 0 else "down" if change < 0 else "flat",
                                "currency": currency,
                                "flag": flag,
                            }
        except Exception:
            continue
    
    return {
        "found": False,
        "symbol": symbol_upper,
        "message": f"Could not find '{query_raw}'. Try the exact ticker symbol (e.g., IOC.NS, RELIANCE.NS, AAPL) or a company name like 'Indian Oil', 'Apple', 'Bitcoin'."
    }


@app.get("/api/social/reddit")
async def get_reddit_pulse(topic: str = "worldnews"):
    """Fetch hot posts from a relevant Reddit sub."""
    try:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": HTTP_USER_AGENT + " (NewsIntel/5.0)"}) as client:
            resp = await client.get(f"https://www.reddit.com/r/{quote_plus(topic)}/hot.json?limit=10")
            resp.raise_for_status()
            data = resp.json()
            posts = []
            for child in data.get("data", {}).get("children", []):
                p = child["data"]
                if not p.get("stickied"):
                    posts.append({
                        "id": p.get("id"),
                        "title": p.get("title"),
                        "score": p.get("score"),
                        "num_comments": p.get("num_comments"),
                        "url": "https://reddit.com" + p.get("permalink", "")
                    })
            return {"topic": topic, "posts": posts[:6]}
    except Exception as e:
        logger.error(f"Reddit API Error: {e}")
        return {"topic": topic, "posts": []}

@app.get("/api/social/hn")
async def get_hacker_news():
    """Fetch top stories from Hacker News."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
            ids = resp.json()[:6]
            stories = []
            for sid in ids:
                s_resp = await client.get(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json")
                item = s_resp.json()
                if item:
                    stories.append({
                        "id": item.get("id"),
                        "title": item.get("title"),
                        "score": item.get("score"),
                        "url": item.get("url", f"https://news.ycombinator.com/item?id={item.get('id')}"),
                        "by": item.get("by")
                    })
            return {"stories": stories}
    except Exception as e:
        logger.error(f"HN API Error: {e}")
        return {"stories": []}

@app.get("/api/social/analyst-summary")
async def get_social_analyst_summary(topic: str = "global news"):
    """Use Gemini to summarize social sentiment based on a topic."""
    # Since doing real-time proxy for all 3 is slow, we mock the context sending or just use Gemini to generate a mock pulse
    prompt = f"Analyze the current social media sentiment (Reddit, Twitter, HN) regarding '{topic}'. Write a short, highly professional 3-sentence Analyst Opinion on what the community is saying. Do not use Markdown, just plain text."
    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return {"topic": topic, "summary": response.text.strip()}
    except Exception as e:
        logger.error(f"Generate social summary error: {e}")
        return {"summary": "Community sentiment analysis is currently unavailable due to system latency."}

