"""
hf_client.py — Cloud Command Gateway Integration v5

ALL AI routed through Cloud Command Gateway:
  - HF Space: sentiment, NER, summarization (FREE, unlimited)
  - Gemini: ONE consolidated call per dashboard load (saves quota)

Model chain: gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash
"""

import os
import json
import logging
import time
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("hf_client")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET")
GATEWAY_BASE_URL = os.getenv("GATEWAY_BASE_URL", "https://cloud-command.onrender.com/api/gateway/gemini")
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "YAsh213kadian/News_intel_HF_space_1")

if "/api/gateway" in GATEWAY_BASE_URL:
    _parts = GATEWAY_BASE_URL.split("/api/gateway")
    GATEWAY_ROOT = f"{_parts[0].rstrip('/')}/api/gateway"
else:
    GATEWAY_ROOT = GATEWAY_BASE_URL.rstrip("/")

GEMINI_URL = f"{GATEWAY_ROOT}/gemini"
HF_URL_BASE = f"{GATEWAY_ROOT}/huggingface-space/{HF_SPACE_URL}"

HEADERS = {
    "X-Gateway-Secret": GATEWAY_SECRET or "",
    "X-Project-Category": "News-Intel",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

if not GATEWAY_SECRET:
    logger.error("GATEWAY_SECRET is missing — AI calls will fail.")

_http = httpx.AsyncClient(timeout=60.0)

# ---------------------------------------------------------------------------
# Cache with TTL
# ---------------------------------------------------------------------------
_cache = {}
_CACHE_TTL = 300  # 5 minutes

def _ck(prefix, text):
    return f"{prefix}:{hash(text[:200])}"

def _get(k):
    entry = _cache.get(k)
    if entry is None:
        return None
    ts, val = entry
    if time.time() - ts > _CACHE_TTL:
        del _cache[k]
        return None
    return val

def _put(k, v):
    if len(_cache) > 80:
        oldest = sorted(_cache.items(), key=lambda x: x[1][0])[:40]
        for ok, _ in oldest:
            del _cache[ok]
    _cache[k] = (time.time(), v)

def clear_cache():
    """Clear all cached AI results."""
    _cache.clear()
    logger.info("AI cache cleared.")


# ---------------------------------------------------------------------------
# Gateway Callers
# ---------------------------------------------------------------------------

async def _call_hf(endpoint: str, text: str) -> dict:
    """Call HF Space through Gateway. Cached."""
    k = _ck(f"hf_{endpoint}", text)
    c = _get(k)
    if c: return c

    url = f"{HF_URL_BASE}/{endpoint}"
    try:
        r = await _http.post(url, headers=HEADERS, json={"inputs": text})
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, str):
                data = json.loads(data)
            _put(k, data)
            return data
        logger.error(f"HF {endpoint}: {r.status_code}")
        return {"error": f"Status {r.status_code}"}
    except Exception as e:
        logger.error(f"HF {endpoint}: {e}")
        return {"error": str(e)}


# Better model → worse model fallback chain
# gemini-2.5-flash gives higher quality text (no spelling errors)
# flash-lite is faster but lower quality
# 2.0-flash is old but very available
_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]

async def _call_gemini(prompt: str, model: str = None) -> str:
    """Call Gemini through Gateway with automatic model fallback on 503/429."""
    k = _ck("gemini", prompt)
    c = _get(k)
    if c: return c

    models = [model] if model else _GEMINI_MODELS

    for m in models:
        payload = {"contents": [{"parts": [{"text": prompt}]}], "model": m}
        try:
            r = await _http.post(GEMINI_URL, headers=HEADERS, json=payload)
            if r.status_code == 200:
                data = r.json()
                text = _extract(data)
                if text:
                    _put(k, text)
                    logger.info(f"Gemini {m} → success ({len(text)} chars)")
                    return text
            elif r.status_code in (503, 429):
                logger.warning(f"Gemini {m} → {r.status_code}, trying next model...")
                await asyncio.sleep(0.5)  # Brief pause before retry
                continue
            else:
                logger.error(f"Gemini {m} → {r.status_code}: {r.text[:200]}")
                continue
        except Exception as e:
            logger.error(f"Gemini {m}: {e}")
            continue

    logger.error("All Gemini models exhausted.")
    return ""


def _extract(data) -> str:
    """Extract text from Gemini response."""
    if isinstance(data, str): return data
    if not isinstance(data, dict): return str(data) if data else ""

    for container in [data, data.get("result", {})]:
        if not isinstance(container, dict): continue
        candidates = container.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "")

    for key in ("text", "response", "output", "generated_text", "message"):
        if key in data and isinstance(data[key], str):
            return data[key]

    return ""


def _clean_json(raw: str) -> str:
    """Strip markdown code fences from Gemini JSON output."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


# ---------------------------------------------------------------------------
# HF Space Endpoints (FREE — unlimited calls)
# ---------------------------------------------------------------------------

async def summarize_text(text: str) -> dict:
    r = await _call_hf("summarize", text)
    return r if "error" not in r else {"summary": ""}

async def analyze_sentiment(text: str) -> dict:
    r = await _call_hf("analyze_sentiment", text)
    return r if "error" not in r else {"label": "UNKNOWN", "score": 0.5}

async def extract_entities(text: str) -> dict:
    r = await _call_hf("extract_entities", text)
    return r if "error" not in r else {"entities": []}


# ---------------------------------------------------------------------------
# CONSOLIDATED GEMINI CALL — One call does EVERYTHING
# ---------------------------------------------------------------------------

async def generate_full_intelligence(articles_text: str, article_list: list,
                                      user_categories: list, user_regions: list) -> dict:
    """
    ONE Gemini call that generates:
    1. Daily brief (4 insights)
    2. Story clusters
    3. Impact analysis

    This replaces 3 separate calls, cutting API usage by 66%.
    """
    cats = ", ".join(user_categories) if user_categories else "technology, finance, geopolitics"
    regs = ", ".join(user_regions) if user_regions else "global"

    listing = "\n".join([f'{a["id"]}. [{a["source"]}] {a["title"]}' for a in article_list])

    prompt = f"""You are an elite intelligence analyst. Analyze these news sources and produce a structured intelligence report.

NEWS SOURCES:
{articles_text[:3500]}

ARTICLE INDEX:
{listing}

READER PROFILE: Professional interested in [{cats}], tracking [{regs}].

PRODUCE ALL THREE SECTIONS in ONE JSON response. Use proper English with correct spelling and grammar.

Return ONLY valid JSON, no markdown fences, no explanation:
{{
  "daily_brief": "Write exactly 4 key insights as a single paragraph. Each insight is ONE clear sentence with names, numbers, and specifics. Separate sentences with line breaks. No filler phrases. No bullet points.",
  "clusters": [
    {{
      "thread_title": "Short clear topic label",
      "article_ids": ["1", "3"],
      "summary": "One sentence synthesis of what this cluster covers"
    }}
  ],
  "impact": {{
    "impact_score": 0.75,
    "headline": "One sentence: how this directly affects the reader",
    "why_it_matters": "2-3 sentences explaining personal relevance with specifics",
    "actions": ["Concrete action 1", "Concrete action 2", "Concrete action 3"]
  }}
}}

CLUSTERING RULES:
- Articles about the SAME event go in the same cluster
- Each article ID must appear in exactly ONE cluster
- Standalone articles get their own single-item cluster
- thread_title should be concise (not a full headline)
- Maximum 2-5 clusters

QUALITY RULES:
- Use correct English spelling and grammar
- Be precise: include names, percentages, dollar amounts
- The daily_brief must have exactly 4 sentences separated by newlines
- impact.headline must be one actionable sentence"""

    raw = await _call_gemini(prompt)
    if not raw:
        return _fallback_intelligence(article_list)

    try:
        parsed = json.loads(_clean_json(raw))
        # Validate structure
        result = {}
        result["daily_brief"] = parsed.get("daily_brief", "")
        result["clusters"] = parsed.get("clusters", [])
        result["impact"] = parsed.get("impact", {})

        # Validate clusters have required fields
        if not isinstance(result["clusters"], list) or len(result["clusters"]) == 0:
            result["clusters"] = _fallback_clusters(article_list)

        # Validate impact
        if not isinstance(result["impact"], dict) or "headline" not in result["impact"]:
            result["impact"] = {"impact_score": 0.5, "headline": "Analysis temporarily unavailable", "actions": [], "why_it_matters": ""}

        return result
    except Exception as e:
        logger.warning(f"Intelligence parse error: {e} — raw: {raw[:200]}")
        return _fallback_intelligence(article_list)


def _fallback_clusters(articles):
    return [{"thread_title": a["title"], "article_ids": [a["id"]], "summary": ""} for a in articles]

def _fallback_intelligence(articles):
    return {
        "daily_brief": "Intelligence analysis temporarily unavailable due to API limits. The system is processing real news from Google News RSS. Sentiment and entity analysis from HuggingFace are still active. Try refreshing in a few minutes when API quota resets.",
        "clusters": _fallback_clusters(articles),
        "impact": {"impact_score": 0.5, "headline": "Gemini API temporarily at capacity — refresh in 1-2 minutes", "actions": ["Wait for API quota to reset", "Check Cloud Command dashboard for error logs"], "why_it_matters": "The free tier Gemini API has a limit of 15 requests per minute and 1000 per day."},
    }


# ---------------------------------------------------------------------------
# Perspective Analysis (for Story Deep Dive — 1 call)
# ---------------------------------------------------------------------------

async def analyze_perspectives(text: str) -> dict:
    """Analyze story from Left/Center/Right perspectives."""
    prompt = f"""Analyze this news story from 3 political perspectives. Be specific and insightful. Use correct English spelling and grammar.

Story: {text[:2000]}

Return ONLY valid JSON, no markdown, no backticks:
[
  {{"viewpoint": "Progressive", "framing": "How progressive media frames this in 1-2 sentences", "emphasis": "What they highlight", "omission": "What they downplay"}},
  {{"viewpoint": "Centrist", "framing": "How centrist media frames this in 1-2 sentences", "emphasis": "What they highlight", "omission": "What they downplay"}},
  {{"viewpoint": "Conservative", "framing": "How conservative media frames this in 1-2 sentences", "emphasis": "What they highlight", "omission": "What they downplay"}}
]"""

    raw = await _call_gemini(prompt)
    if not raw:
        return []
    try:
        parsed = json.loads(_clean_json(raw))
        if isinstance(parsed, list):
            return parsed
        elif isinstance(parsed, dict):
            # Old format: {left: {}, center: {}, right: {}}
            result = []
            for label, data in parsed.items():
                if isinstance(data, dict):
                    data["viewpoint"] = label.capitalize()
                    result.append(data)
            return result
        return []
    except Exception as e:
        logger.warning(f"Perspective parse: {e}")
        return []
