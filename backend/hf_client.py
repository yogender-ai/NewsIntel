"""
hf_client.py — Intelligence Command Center v10
PRO-GRADE MULTI-PROVIDER AI

Routing Hierarchy:
1. OpenRouter (Free DeepSeek R1 / Llama 3.3) -> Primary for Intelligence
2. Gemini 2.5 Flash -> Fallback & Perspectives
3. HF Space -> Sentiment & NER (Infinite Free)
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

# Ensure URLs are clean
GATEWAY_ROOT = GATEWAY_BASE_URL.rstrip("/")
GEMINI_URL = f"{GATEWAY_ROOT}/gemini"
OPENROUTER_URL = f"{GATEWAY_ROOT}/openrouter"
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "YAsh213kadian/News_intel_HF_space_1")
HF_URL_BASE = f"{GATEWAY_ROOT}/huggingface-space/{HF_SPACE_URL}"

HEADERS = {
    "X-Gateway-Secret": GATEWAY_SECRET or "",
    "X-Project-Category": "News-Intel",
    "Content-Type": "application/json",
}

_http = httpx.AsyncClient(timeout=90.0)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
_cache = {}
_CACHE_TTL = 300

def _ck(prefix, text):
    return f"{prefix}:{hash(text[:300])}"

def _get(k):
    entry = _cache.get(k)
    if entry and (time.time() - entry[0] < _CACHE_TTL):
        return entry[1]
    return None

def _put(k, v):
    _cache[k] = (time.time(), v)

# ---------------------------------------------------------------------------
# Provider Callers
# ---------------------------------------------------------------------------

async def _call_hf(endpoint: str, text: str) -> dict:
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
        return {"error": f"HF Status {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}

async def _call_openrouter(prompt: str, model: str = "openrouter/auto") -> str:
    """Call OpenRouter via Gateway. OpenRouter auto-selects free models."""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.6
    }
    try:
        r = await _http.post(OPENROUTER_URL + "/chat/completions", headers=HEADERS, json=payload)
        if r.status_code == 200:
            data = r.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.warning(f"OpenRouter {r.status_code}: {r.text}")
        return ""
    except Exception as e:
        logger.error(f"OpenRouter Error: {e}")
        return ""

async def _call_gemini(prompt: str, model: str = "gemini-2.5-flash") -> str:
    payload = {"contents": [{"parts": [{"text": prompt}]}], "model": model}
    try:
        r = await _http.post(GEMINI_URL, headers=HEADERS, json=payload)
        if r.status_code == 200:
            data = r.json()
            # Extract logic
            candidates = data.get("candidates", [])
            if candidates:
                return candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        return ""
    except Exception:
        return ""

# ---------------------------------------------------------------------------
# Intelligence Logic
# ---------------------------------------------------------------------------

async def generate_full_intelligence(articles_text: str, article_list: list,
                                      user_categories: list, user_regions: list) -> dict:
    """
    ONE call does everything.
    Tries OpenRouter (Free) first, then Gemini (Fallback).
    """
    cats = ", ".join(user_categories) if user_categories else "all major categories"
    regs = ", ".join(user_regions) if user_regions else "global"
    listing = "\n".join([f'{a["id"]}. [{a["source"]}] {a["title"]}' for a in article_list])

    prompt = f"""You are a senior intelligence officer. Analyze these sources and reader profile.

NEWS SOURCES:
{articles_text[:4000]}

ARTICLE INDEX:
{listing}

READER PROFILE: Interested in [{cats}] across [{regs}].

TASK: Return exactly this JSON structure.
{{
  "daily_brief": "Exactly 4 distinct insights, one per sentence. Separate sentences with \\n. Use precise data.",
  "clusters": [
    {{
      "thread_title": "Descriptive title",
      "article_ids": ["1", "3"],
      "summary": "One sentence summary",
      "pulse_score": 85
    }}
  ],
  "impact": {{
    "headline": "Direct personal impact sentence",
    "why_it_matters": "2 sentences explaining relevance",
    "actions": ["Step 1", "Step 2"]
  }}
}}

RULES:
- Return ONLY JSON.
- Every article ID must be in a cluster.
- 'pulse_score' is 0-100 based on scale/urgency.
- Use perfect English. No typos."""

    # Priority 1: OpenRouter (Free & Powerful)
    result_text = await _call_openrouter(prompt)
    if not result_text:
        # Priority 2: Gemini
        result_text = await _call_gemini(prompt)

    if not result_text:
        return _fallback_intel(article_list)

    try:
        # Clean markdown
        clean = result_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        parsed = json.loads(clean)
        return parsed
    except Exception as e:
        logger.warning(f"Parse error: {e}")
        return _fallback_intel(article_list)

def _fallback_intel(articles):
    return {
        "daily_brief": "Intelligence feed is active. Processing delayed. Please refresh in 30 seconds.",
        "clusters": [{"thread_title": a["title"], "article_ids": [a["id"]], "summary": "", "pulse_score": 50} for a in articles],
        "impact": {"headline": "Intelligence synthesis pending", "why_it_matters": "", "actions": []}
    }

async def analyze_perspectives(text: str) -> list:
    prompt = f"Analyze perspectives for this story: {text[:2000]}. Return JSON list: [{{'viewpoint': '...', 'framing': '...', 'emphasis': '...', 'omission': '...'}}]"
    res = await _call_openrouter(prompt) or await _call_gemini(prompt)
    try:
        clean = res.strip()
        if clean.startswith("```"): clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(clean)
    except: return []

async def analyze_sentiment(text: str) -> dict: return await _call_hf("analyze_sentiment", text)
async def extract_entities(text: str) -> dict: return await _call_hf("extract_entities", text)
async def summarize_text(text: str) -> dict: return await _call_hf("summarize", text)
