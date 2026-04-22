"""
hf_client.py — Cloud Command Gateway Integration v3

All AI routed through Cloud Command Gateway.
Optimized: batch-friendly, cached, minimal gateway calls.
"""

import os
import json
import logging
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

# The GATEWAY_BASE_URL already points to the gemini endpoint
# e.g. https://cloud-command.onrender.com/api/gateway/gemini
# For HF space: https://cloud-command.onrender.com/api/gateway/huggingface-space/...
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

_http_client = httpx.AsyncClient(timeout=45.0)

# ---------------------------------------------------------------------------
# Simple in-memory cache to avoid duplicate calls
# ---------------------------------------------------------------------------
_cache = {}

def _cache_key(func_name: str, text: str) -> str:
    return f"{func_name}:{hash(text[:200])}"

def _get_cached(key: str):
    return _cache.get(key)

def _set_cached(key: str, value):
    # Keep cache small — max 100 entries
    if len(_cache) > 100:
        _cache.clear()
    _cache[key] = value


# ---------------------------------------------------------------------------
# Core Gateway Callers
# ---------------------------------------------------------------------------

async def _call_hf(endpoint: str, text: str) -> dict:
    """Call HF Space endpoint through Gateway."""
    ck = _cache_key(f"hf_{endpoint}", text)
    cached = _get_cached(ck)
    if cached:
        return cached

    url = f"{HF_URL_BASE}/{endpoint}"
    payload = {"inputs": text}

    try:
        response = await _http_client.post(url, headers=HEADERS, json=payload)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, str):
                data = json.loads(data)
            _set_cached(ck, data)
            return data
        else:
            logger.error(f"HF {endpoint}: status {response.status_code}, body: {response.text[:200]}")
            return {"error": f"Status {response.status_code}"}
    except Exception as e:
        logger.error(f"HF {endpoint} failed: {e}")
        return {"error": str(e)}


async def _call_gemini(prompt: str) -> str:
    """Call Gemini through Gateway."""
    ck = _cache_key("gemini", prompt)
    cached = _get_cached(ck)
    if cached:
        return cached

    # Try the standard Gemini API payload format
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    try:
        logger.info(f"Gemini call → {GEMINI_URL}")
        response = await _http_client.post(GEMINI_URL, headers=HEADERS, json=payload)
        logger.info(f"Gemini response: {response.status_code}")

        if response.status_code != 200:
            body = response.text[:500]
            logger.error(f"Gemini error {response.status_code}: {body}")

            # If 400/404, the gateway might expect a different payload format
            # Try alternative: just send the prompt as "text" field
            alt_payload = {"text": prompt}
            logger.info("Retrying with alt payload format...")
            response = await _http_client.post(GEMINI_URL, headers=HEADERS, json=alt_payload)
            logger.info(f"Gemini alt response: {response.status_code}")

            if response.status_code != 200:
                # Try third format: prompt field
                alt_payload2 = {"prompt": prompt, "model": "gemini"}
                response = await _http_client.post(GEMINI_URL, headers=HEADERS, json=alt_payload2)
                logger.info(f"Gemini alt2 response: {response.status_code}")

                if response.status_code != 200:
                    logger.error(f"All Gemini formats failed. Last: {response.text[:300]}")
                    return ""

        data = response.json()
        logger.info(f"Gemini response structure: {type(data).__name__}, "
                     f"keys={list(data.keys()) if isinstance(data, dict) else 'N/A'}")

        text_result = _extract_text_from_response(data)
        if text_result:
            _set_cached(ck, text_result)
        return text_result

    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        return ""


def _extract_text_from_response(data) -> str:
    """Extract text from various possible response structures."""
    if isinstance(data, str):
        return data

    if not isinstance(data, dict):
        return str(data) if data else ""

    # Standard Gemini: {candidates: [{content: {parts: [{text: "..."}]}}]}
    candidates = data.get("candidates", [])
    if candidates:
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if parts:
            return parts[0].get("text", "")

    # Wrapped: {result: {candidates: [...]}} or {result: "text"}
    result = data.get("result")
    if result:
        if isinstance(result, str):
            return result
        if isinstance(result, dict):
            return _extract_text_from_response(result)

    # Direct fields
    for key in ("text", "response", "output", "generated_text", "message", "content"):
        if key in data and data[key]:
            val = data[key]
            if isinstance(val, str):
                return val
            if isinstance(val, dict):
                return _extract_text_from_response(val)

    # Data field wrapping
    if "data" in data:
        return _extract_text_from_response(data["data"])

    logger.warning(f"Could not extract text from: {json.dumps(data)[:400]}")
    return ""


# ---------------------------------------------------------------------------
# HF Space endpoints
# ---------------------------------------------------------------------------

async def summarize_text(text: str) -> dict:
    result = await _call_hf("summarize", text)
    if "error" in result:
        return {"summary": ""}
    return result

async def analyze_sentiment(text: str) -> dict:
    result = await _call_hf("analyze_sentiment", text)
    if "error" in result:
        return {"label": "UNKNOWN", "score": 0.5}
    return result

async def extract_entities(text: str) -> dict:
    result = await _call_hf("extract_entities", text)
    if "error" in result:
        return {"entities": []}
    return result


# ---------------------------------------------------------------------------
# Gemini-powered intelligence layers
# ---------------------------------------------------------------------------

async def generate_narrative_brief(articles_text: str) -> str:
    prompt = f"""You are an elite intelligence briefing system. Synthesize these news sources into exactly 4 key insights. Each insight should be ONE clear sentence.

Rules:
- Exactly 4 bullet points
- Each starts with the most important word
- Connect causes to effects
- Be specific: use names, numbers, percentages
- No filler phrases like "In today's news" or "It is worth noting"

Sources:
{articles_text[:3000]}

Write 4 key insights now (plain text, one per line, no bullet characters):"""
    return await _call_gemini(prompt)


async def analyze_perspectives(text: str) -> dict:
    prompt = f"""Analyze this news story from 3 ideological perspectives.

Story: {text[:2000]}

Return ONLY valid JSON (no markdown, no backticks):
{{"left":{{"framing":"How left-leaning media frames this","emphasis":"What they highlight","omission":"What they downplay","tone":"Emotional tone"}},"center":{{"framing":"How centrist media frames this","emphasis":"What they highlight","omission":"What they downplay","tone":"Emotional tone"}},"right":{{"framing":"How right-leaning media frames this","emphasis":"What they highlight","omission":"What they downplay","tone":"Emotional tone"}}}}"""
    raw = await _call_gemini(prompt)
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except Exception as e:
        logger.warning(f"Perspective parse failed: {e}, raw={raw[:200]}")
        return {}


async def generate_so_what(story_text: str, user_categories: list, user_regions: list) -> dict:
    cats = ", ".join(user_categories) if user_categories else "general topics"
    regs = ", ".join(user_regions) if user_regions else "global"

    prompt = f"""A user interested in [{cats}] and tracking [{regs}] just read this:

{story_text[:1500]}

Return ONLY valid JSON (no markdown, no backticks):
{{"impact_score":0.7,"headline":"One line: how this affects the user","actions":["Action 1","Action 2"],"why_it_matters":"2 sentences explaining personal relevance"}}"""
    raw = await _call_gemini(prompt)
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except Exception:
        return {
            "impact_score": 0.5,
            "headline": "Analysis processing",
            "actions": [],
            "why_it_matters": raw[:200] if raw else "Gemini analysis temporarily unavailable."
        }
