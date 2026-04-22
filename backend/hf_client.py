"""
hf_client.py — Cloud Command Gateway Integration v4

ALL AI routed through Cloud Command Gateway:
  - HF Space: sentiment, NER, summarization
  - Gemini 2.5 Flash Lite: narrative synthesis, perspectives, impact

Optimized: cached, no retries, no duplicate calls.
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

_http = httpx.AsyncClient(timeout=45.0)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
_cache = {}

def _ck(prefix, text):
    return f"{prefix}:{hash(text[:200])}"

def _get(k):
    return _cache.get(k)

def _put(k, v):
    if len(_cache) > 80:
        _cache.clear()
    _cache[k] = v


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


# Models to try in order — if one 503s, try the next
_GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]

async def _call_gemini(prompt: str, model: str = None) -> str:
    """Call Gemini through Gateway with automatic model fallback on 503."""
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
                    return text
            elif r.status_code == 503:
                logger.warning(f"Gemini {m} → 503 high demand, trying next model...")
                continue  # Try next model
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

    # Standard: {candidates: [{content: {parts: [{text: "..."}]}}]}
    for container in [data, data.get("result", {})]:
        if not isinstance(container, dict): continue
        candidates = container.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "")

    # Direct fields
    for key in ("text", "response", "output", "generated_text", "message"):
        if key in data and isinstance(data[key], str):
            return data[key]

    return ""


# ---------------------------------------------------------------------------
# HF Space Endpoints
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
# Gemini Intelligence Layers
# ---------------------------------------------------------------------------

async def generate_narrative_brief(articles_text: str) -> str:
    """Generate a scannable intelligence brief."""
    prompt = f"""You are an elite intelligence analyst. Create exactly 4 key insights from these news sources.

Rules:
- Exactly 4 insights, one per line
- Each insight is ONE clear, specific sentence
- Use names, numbers, percentages — be precise
- Connect cause to effect where possible
- No filler phrases like "In today's news" or "It is worth noting"
- No bullet points or numbering — just plain sentences

Sources:
{articles_text[:3000]}

4 insights:"""
    return await _call_gemini(prompt)


async def analyze_perspectives(text: str) -> dict:
    """Analyze story from Left/Center/Right perspectives."""
    prompt = f"""Analyze this news story from 3 political perspectives. Be specific and insightful.

Story: {text[:2000]}

Return ONLY valid JSON, no markdown, no backticks, no explanation:
{{"left":{{"framing":"How progressive media frames this in 1-2 sentences","emphasis":"What they highlight","omission":"What they downplay","tone":"The emotional tone used"}},"center":{{"framing":"How centrist media frames this in 1-2 sentences","emphasis":"What they highlight","omission":"What they downplay","tone":"The emotional tone used"}},"right":{{"framing":"How conservative media frames this in 1-2 sentences","emphasis":"What they highlight","omission":"What they downplay","tone":"The emotional tone used"}}}}"""

    raw = await _call_gemini(prompt)
    if not raw:
        return {}
    try:
        cleaned = raw.strip()
        # Strip markdown code fences if present
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except Exception as e:
        logger.warning(f"Perspective parse: {e}")
        return {}


async def generate_so_what(story_text: str, user_categories: list, user_regions: list) -> dict:
    """Generate personalized impact analysis."""
    cats = ", ".join(user_categories) if user_categories else "technology, finance, geopolitics"
    regs = ", ".join(user_regions) if user_regions else "global"

    prompt = f"""A professional interested in [{cats}] tracking [{regs}] just read this news:

{story_text[:1500]}

Analyze the personal impact. Return ONLY valid JSON, no markdown:
{{"impact_score":0.75,"headline":"One sentence: how this directly affects the reader","why_it_matters":"2-3 sentences explaining personal relevance with specifics","actions":["Concrete action 1","Concrete action 2","Concrete action 3"]}}"""

    raw = await _call_gemini(prompt)
    if not raw:
        return {"impact_score": 0.5, "headline": "Analysis temporarily unavailable", "actions": [], "why_it_matters": ""}
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except Exception:
        return {"impact_score": 0.5, "headline": raw[:100], "actions": [], "why_it_matters": raw[:300]}


async def cluster_stories(articles: list) -> list:
    """
    Phase 4: Cluster related articles into story threads.
    Input: list of {id, title, source}
    Output: list of clusters [{thread_title, article_ids, summary}]
    """
    if len(articles) <= 2:
        return [{"thread_title": a["title"], "article_ids": [a["id"]], "summary": ""} for a in articles]

    listing = "\n".join([f'{a["id"]}. [{a["source"]}] {a["title"]}' for a in articles])

    prompt = f"""You are a news editor. Group these articles into story clusters. 
Articles about the SAME event or topic go in the same cluster.

Articles:
{listing}

Return ONLY valid JSON array, no markdown, no backticks:
[{{"thread_title":"Short descriptive title for this story thread","article_ids":["1","3"],"summary":"One sentence synthesis of what this cluster covers"}}]

Rules:
- Each article ID must appear in exactly ONE cluster
- Standalone articles get their own single-item cluster
- thread_title should be a clear, concise topic label (not a full headline)
- Maximum 2-4 clusters"""

    raw = await _call_gemini(prompt)
    if not raw:
        return [{"thread_title": a["title"], "article_ids": [a["id"]], "summary": ""} for a in articles]

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
        clusters = json.loads(cleaned.strip())
        if isinstance(clusters, list) and len(clusters) > 0:
            return clusters
    except Exception as e:
        logger.warning(f"Cluster parse: {e}")

    return [{"thread_title": a["title"], "article_ids": [a["id"]], "summary": ""} for a in articles]

