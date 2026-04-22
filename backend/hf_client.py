"""
hf_client.py — Cloud Command Gateway Integration

Routes all AI requests through the Cloud Command Gateway which proxies
to your Hugging Face Spaces. This avoids direct Gradio client dependency
and gives you centralized logging, rate-limiting, and key management.
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

# Derive gateway root (strip provider suffix)
if "/api/gateway" in GATEWAY_BASE_URL:
    _parts = GATEWAY_BASE_URL.split("/api/gateway")
    GATEWAY_ROOT = f"{_parts[0].rstrip('/')}/api/gateway"
else:
    GATEWAY_ROOT = GATEWAY_BASE_URL.rstrip("/")

HEADERS = {
    "X-Gateway-Secret": GATEWAY_SECRET or "",
    "X-Project-Category": "News-Intel",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

if not GATEWAY_SECRET:
    logger.error("GATEWAY_SECRET is missing — AI calls will fail.")

# Async HTTP client (reused across requests)
_http_client = httpx.AsyncClient(timeout=30.0)


async def _call_gateway(endpoint: str, text: str) -> dict:
    """
    Send a request to the Cloud Command Gateway which proxies to the
    Hugging Face Space endpoint.
    """
    url = f"{GATEWAY_ROOT}/huggingface-space/{HF_SPACE_URL}/{endpoint}"
    payload = {"inputs": text}

    try:
        response = await _http_client.post(url, headers=HEADERS, json=payload)

        if response.status_code == 200:
            data = response.json()
            if isinstance(data, str):
                data = json.loads(data)
            return data
        else:
            logger.error(f"Gateway {endpoint} returned {response.status_code}: {response.text[:300]}")
            return {"error": f"Gateway returned status {response.status_code}"}
    except Exception as e:
        logger.error(f"Gateway call to {endpoint} failed: {e}")
        return {"error": str(e)}


async def _call_gemini(prompt: str) -> str:
    """
    Call the Gemini model through the Cloud Command Gateway for advanced
    generation tasks (narrative synthesis, perspective analysis, etc.).
    """
    url = f"{GATEWAY_ROOT}/gemini"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    try:
        response = await _http_client.post(url, headers=HEADERS, json=payload)
        if response.status_code == 200:
            data = response.json()
            # Gemini gateway response structure
            if isinstance(data, dict):
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
                # Fallback: maybe the gateway returns text directly
                return data.get("text", data.get("response", json.dumps(data)))
            return str(data)
        else:
            logger.error(f"Gemini gateway returned {response.status_code}: {response.text[:300]}")
            return ""
    except Exception as e:
        logger.error(f"Gemini gateway call failed: {e}")
        return ""


# ---------------------------------------------------------------------------
# Public API — HF Space endpoints (via Gateway)
# ---------------------------------------------------------------------------

async def summarize_text(text: str) -> dict:
    """Summarize text via HF Space /summarize through Gateway."""
    result = await _call_gateway("summarize", text)
    if "error" in result:
        return {"summary": f"Summarization unavailable: {result['error']}"}
    return result


async def analyze_sentiment(text: str) -> dict:
    """Analyze sentiment via HF Space /analyze_sentiment through Gateway."""
    result = await _call_gateway("analyze_sentiment", text)
    if "error" in result:
        return {"label": "UNKNOWN", "score": 0.0}
    return result


async def extract_entities(text: str) -> dict:
    """Extract entities via HF Space /extract_entities through Gateway."""
    result = await _call_gateway("extract_entities", text)
    if "error" in result:
        return {"entities": []}
    return result


# ---------------------------------------------------------------------------
# Public API — Gemini endpoints (via Gateway) for advanced intelligence
# ---------------------------------------------------------------------------

async def generate_narrative_brief(articles_text: str) -> str:
    """Use Gemini to generate a coherent narrative daily brief."""
    prompt = f"""You are News-Intel, an elite intelligence briefing system. Your job is to synthesize raw news into a single, crisp paragraph that reads like a presidential daily brief.

Rules:
- ONE paragraph, max 4 sentences
- Lead with the single most consequential development
- Connect causes to effects across stories
- End with what to watch next
- No filler, no hedging, no "In today's news..."
- Write like a senior intelligence analyst, not a journalist

Raw sources:
{articles_text}

Write the brief now:"""
    return await _call_gemini(prompt)


async def analyze_perspectives(text: str) -> dict:
    """Use Gemini to analyze left/center/right framing of a story."""
    prompt = f"""Analyze this news story from three political/ideological perspectives. For each perspective, identify:
1. The framing (how they'd present the headline)
2. What they emphasize
3. What they omit
4. The emotional tone

Story:
{text}

Return a JSON object with this exact structure:
{{"left": {{"framing": "...", "emphasis": "...", "omission": "...", "tone": "..."}}, "center": {{"framing": "...", "emphasis": "...", "omission": "...", "tone": "..."}}, "right": {{"framing": "...", "emphasis": "...", "omission": "...", "tone": "..."}}}}

Return ONLY the JSON, no markdown fencing:"""
    raw = await _call_gemini(prompt)
    try:
        # Strip any markdown fencing
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except Exception:
        return {"left": {"framing": raw[:200]}, "center": {"framing": ""}, "right": {"framing": ""}}


async def generate_so_what(story_text: str, user_categories: list, user_regions: list) -> dict:
    """Use Gemini to generate personalized 'So What?' impact analysis."""
    cats = ", ".join(user_categories) if user_categories else "general"
    regs = ", ".join(user_regions) if user_regions else "global"

    prompt = f"""You are a personal intelligence advisor. A user who tracks [{cats}] in [{regs}] just read this story:

{story_text}

Generate a personalized impact analysis. Return JSON with this structure:
{{"impact_score": 0.0-1.0, "headline": "One-line impact statement", "actions": ["Actionable item 1", "Actionable item 2"], "why_it_matters": "2-sentence explanation of personal relevance"}}

Return ONLY the JSON, no markdown fencing:"""
    raw = await _call_gemini(prompt)
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except Exception:
        return {"impact_score": 0.5, "headline": "Analysis unavailable", "actions": [], "why_it_matters": raw[:200] if raw else "Could not generate analysis."}
