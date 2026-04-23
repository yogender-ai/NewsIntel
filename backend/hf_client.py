"""
hf_client.py — Multi-Provider AI Client v10

Routing:
  1. OpenRouter (free models: DeepSeek R1, Llama 3.3) → Primary for synthesis
  2. Gemini 2.5 Flash → Fallback for synthesis, primary for perspectives
  3. HF Space → Sentiment & NER (free, unlimited)
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
GATEWAY_BASE_URL = os.getenv("GATEWAY_BASE_URL", "https://cloud-command.onrender.com/api/gateway")

# Clean the base URL — strip trailing slash and any provider suffix
if "/api/gateway" in GATEWAY_BASE_URL:
    _parts = GATEWAY_BASE_URL.split("/api/gateway")
    GATEWAY_ROOT = f"{_parts[0].rstrip('/')}/api/gateway"
else:
    GATEWAY_ROOT = GATEWAY_BASE_URL.rstrip("/")

GEMINI_URL = f"{GATEWAY_ROOT}/gemini"
# OpenRouter endpoint — gateway proxies to https://openrouter.ai/api
# The gateway route is: /api/gateway/openrouter/{path}
# OpenRouter's chat endpoint is: /v1/chat/completions
OPENROUTER_URL = f"{GATEWAY_ROOT}/openrouter/v1/chat/completions"
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "YAsh213kadian/News_intel_HF_space_1")
HF_URL_BASE = f"{GATEWAY_ROOT}/huggingface-space/{HF_SPACE_URL}"

HEADERS = {
    "X-Gateway-Secret": GATEWAY_SECRET or "",
    "X-Project-Category": "News-Intel",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

if not GATEWAY_SECRET:
    logger.error("GATEWAY_SECRET missing — AI calls will fail.")

_http = httpx.AsyncClient(timeout=90.0)

# ---------------------------------------------------------------------------
# Cache with TTL
# ---------------------------------------------------------------------------
_cache = {}
_CACHE_TTL = 300  # 5 min

def _ck(prefix, text):
    return f"{prefix}:{hash(text[:300])}"

def _get(k):
    entry = _cache.get(k)
    if entry and (time.time() - entry[0] < _CACHE_TTL):
        return entry[1]
    return None

def _put(k, v):
    if len(_cache) > 100:
        oldest = sorted(_cache.items(), key=lambda x: x[1][0])[:50]
        for ok, _ in oldest:
            del _cache[ok]
    _cache[k] = (time.time(), v)

def clear_cache():
    _cache.clear()
    logger.info("AI cache cleared.")


# ---------------------------------------------------------------------------
# Provider Callers
# ---------------------------------------------------------------------------

async def _call_hf(endpoint: str, text: str) -> dict:
    """Call HF Space through Gateway. Free & unlimited."""
    k = _ck(f"hf_{endpoint}", text)
    c = _get(k)
    if c: return c

    url = f"{HF_URL_BASE}/{endpoint}"
    try:
        r = await _http.post(url, headers=HEADERS, json={"inputs": text})
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, str): data = json.loads(data)
            _put(k, data)
            return data
        logger.error(f"HF {endpoint}: {r.status_code}")
        return {"error": f"HF Status {r.status_code}"}
    except Exception as e:
        logger.error(f"HF {endpoint}: {e}")
        return {"error": str(e)}


async def _call_openrouter(prompt: str, model: str = "openrouter/auto") -> str:
    """Call OpenRouter via Cloud Command Gateway.
    
    OpenRouter uses OpenAI-compatible format.
    Gateway route: /api/gateway/openrouter/v1/chat/completions
    → proxies to: https://openrouter.ai/api/v1/chat/completions
    """
    k = _ck("openrouter", prompt)
    c = _get(k)
    if c: return c

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.5,
        "max_tokens": 2000,
    }
    try:
        r = await _http.post(OPENROUTER_URL, headers=HEADERS, json=payload)
        if r.status_code == 200:
            data = r.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if text:
                logger.info(f"OpenRouter success ({len(text)} chars)")
                _put(k, text)
                return text
        logger.warning(f"OpenRouter {r.status_code}: {r.text[:200]}")
        return ""
    except Exception as e:
        logger.error(f"OpenRouter: {e}")
        return ""


# Gemini model fallback chain
_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]

async def _call_gemini(prompt: str, model: str = None) -> str:
    """Call Gemini via Cloud Command Gateway with model fallback."""
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
                text = _extract_gemini(data)
                if text:
                    logger.info(f"Gemini {m} success ({len(text)} chars)")
                    _put(k, text)
                    return text
            elif r.status_code in (429, 503):
                logger.warning(f"Gemini {m} → {r.status_code}, trying next...")
                await asyncio.sleep(0.3)
                continue
            else:
                logger.error(f"Gemini {m} → {r.status_code}")
                continue
        except Exception as e:
            logger.error(f"Gemini {m}: {e}")
            continue

    logger.error("All Gemini models exhausted.")
    return ""


def _extract_gemini(data) -> str:
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
    """Strip markdown code fences from AI output."""
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
        clean = clean.rsplit("```", 1)[0]
    return clean.strip()


# ---------------------------------------------------------------------------
# HF Space Endpoints (FREE — unlimited)
# ---------------------------------------------------------------------------

async def analyze_sentiment(text: str) -> dict:
    r = await _call_hf("analyze_sentiment", text)
    return r if "error" not in r else {"label": "NEUTRAL", "score": 0.5}

async def extract_entities(text: str) -> dict:
    r = await _call_hf("extract_entities", text)
    return r if "error" not in r else {"entities": []}

async def summarize_text(text: str) -> dict:
    r = await _call_hf("summarize", text)
    return r if "error" not in r else {"summary": ""}


# ---------------------------------------------------------------------------
# Consolidated Intelligence (1 call = brief + clusters + impact)
# ---------------------------------------------------------------------------

async def generate_full_intelligence(articles_text: str, article_list: list,
                                      user_categories: list, user_regions: list) -> dict:
    """
    ONE AI call generates:
    1. Daily brief (4 insights)
    2. Story clusters with pulse scores
    3. Impact analysis
    
    Tries OpenRouter first (free), falls back to Gemini.
    """
    cats = ", ".join(user_categories) if user_categories else "technology, finance, geopolitics"
    regs = ", ".join(user_regions) if user_regions else "global"
    listing = "\n".join([f'{a["id"]}. [{a["source"]}] {a["title"]}' for a in article_list])

    prompt = f"""You are a senior intelligence analyst. Analyze these news sources.

NEWS SOURCES:
{articles_text[:4000]}

ARTICLE INDEX:
{listing}

READER PROFILE: Professional interested in [{cats}], tracking [{regs}].

Return ONLY valid JSON (no markdown fences, no explanation):
{{
  "daily_brief": "Exactly 4 clear insights, one per line, separated by newlines. Each insight is ONE precise sentence with names and numbers. No filler phrases.",
  "clusters": [
    {{
      "thread_title": "Short descriptive topic label",
      "article_ids": ["1", "3"],
      "summary": "One sentence synthesis",
      "pulse_score": 75
    }}
  ],
  "impact": {{
    "headline": "One sentence: how this affects the reader directly",
    "why_it_matters": "2-3 sentences with specifics",
    "actions": ["Concrete step 1", "Concrete step 2"]
  }}
}}

RULES:
- Each article ID must appear in exactly ONE cluster
- pulse_score: 0-100 based on urgency and scale
- Maximum 2-5 clusters
- Use correct English spelling and grammar
- Be precise: include names, percentages, dollar amounts where available"""

    # Priority 1: OpenRouter (Free)
    result_text = await _call_openrouter(prompt)

    # Priority 2: Gemini (Fallback)
    if not result_text:
        result_text = await _call_gemini(prompt)

    if not result_text:
        return _fallback_intelligence(article_list)

    try:
        parsed = json.loads(_clean_json(result_text))
        # Validate
        if not isinstance(parsed.get("clusters"), list) or len(parsed["clusters"]) == 0:
            parsed["clusters"] = _fallback_clusters(article_list)
        if not isinstance(parsed.get("impact"), dict):
            parsed["impact"] = {"headline": "Analysis pending", "why_it_matters": "", "actions": []}
        return parsed
    except Exception as e:
        logger.warning(f"Intelligence parse error: {e}")
        return _fallback_intelligence(article_list)


def _fallback_clusters(articles):
    return [{"thread_title": a["title"], "article_ids": [a["id"]], "summary": "", "pulse_score": 50} for a in articles]

def _fallback_intelligence(articles):
    return {
        "daily_brief": "Intelligence synthesis temporarily delayed. HuggingFace sentiment and entity analysis remain active.\nTry refreshing in 1-2 minutes when API quota resets.\nAll news sources are being ingested from Google News RSS in real-time.\nThe system will automatically recover once the AI provider responds.",
        "clusters": _fallback_clusters(articles),
        "impact": {"headline": "AI synthesis temporarily at capacity — data is still live", "why_it_matters": "Sentiment and entities from HuggingFace are processing normally. Only the brief and clustering require the AI provider.", "actions": ["Wait 60 seconds and refresh", "Check Cloud Command for API status"]},
    }


# ---------------------------------------------------------------------------
# Perspective Analysis (1 separate call — for deep-dive only)
# ---------------------------------------------------------------------------

async def analyze_perspectives(text: str) -> list:
    """Analyze story from multiple perspectives. Used on deep-dive page only."""
    prompt = f"""Analyze this news story from 3 different political perspectives. Be specific and insightful.

Story: {text[:2000]}

Return ONLY valid JSON array (no markdown):
[
  {{"viewpoint": "Progressive", "framing": "How progressive media frames this (1-2 sentences)", "emphasis": "What they highlight", "omission": "What they downplay"}},
  {{"viewpoint": "Centrist", "framing": "How centrist media frames this (1-2 sentences)", "emphasis": "What they highlight", "omission": "What they downplay"}},
  {{"viewpoint": "Conservative", "framing": "How conservative media frames this (1-2 sentences)", "emphasis": "What they highlight", "omission": "What they downplay"}}
]"""

    result = await _call_openrouter(prompt)
    if not result:
        result = await _call_gemini(prompt)
    if not result:
        return []

    try:
        parsed = json.loads(_clean_json(result))
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [{"viewpoint": k.capitalize(), **v} for k, v in parsed.items() if isinstance(v, dict)]
        return []
    except Exception as e:
        logger.warning(f"Perspective parse: {e}")
        return []
