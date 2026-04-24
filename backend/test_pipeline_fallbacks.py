"""Offline pipeline tests for provider fallback and quota-saving behavior.

Run from News-Intel/backend:
    python test_pipeline_fallbacks.py

The tests monkeypatch network callers, so they do not burn OpenRouter,
Gemini, HuggingFace, or RSS quota.
"""

import asyncio
import json
import sys

sys.path.insert(0, ".")

import hf_client
import main


ARTICLES = [
    {"id": "1", "title": "AI data center rules tighten", "source": "TestWire"},
    {"id": "2", "title": "Chip exports rebound", "source": "MarketDesk"},
]

VALID_JSON = json.dumps(
    {
        "daily_brief": "AI regulation is tightening.\nChip exports are rebounding.\nMarkets are watching infrastructure costs.\nPolicy risk remains active.",
        "clusters": [
            {
                "thread_title": "AI Infrastructure Regulation",
                "article_ids": ["1"],
                "summary": "Regulators are focusing on AI data centers.",
                "pulse_score": 74,
                "impact_line": "Compliance costs may rise.",
                "why_it_matters": "AI infrastructure plans can be delayed by energy and data rules.",
                "risk_type": "risk",
                "opportunity_counter": "Compliance tooling demand can grow.",
            }
        ],
        "impact": {
            "headline": "AI infrastructure faces policy pressure.",
            "why_it_matters": "Energy rules and compliance expectations are becoming board-level risks.",
            "actions": ["Track local energy rules"],
            "top_risk": "Compliance delays",
            "top_opportunity": "Compliance automation",
        },
    }
)


async def test_openrouter_primary():
    async def openrouter(_prompt, model="openrouter/auto"):
        return VALID_JSON

    async def gemini(_prompt, model=None):
        raise AssertionError("Gemini should not be called when OpenRouter works")

    old_or, old_g = hf_client._call_openrouter, hf_client._call_gemini
    hf_client._call_openrouter, hf_client._call_gemini = openrouter, gemini
    try:
        result = await hf_client.generate_full_intelligence("news", ARTICLES, ["ai"], ["global"])
        assert result["_synthesis_provider"] == "openrouter"
        assert result["clusters"][0]["thread_title"] == "AI Infrastructure Regulation"
    finally:
        hf_client._call_openrouter, hf_client._call_gemini = old_or, old_g


async def test_gemini_fallback():
    async def openrouter(_prompt, model="openrouter/auto"):
        return ""

    async def gemini(_prompt, model=None):
        return VALID_JSON

    old_or, old_g = hf_client._call_openrouter, hf_client._call_gemini
    hf_client._call_openrouter, hf_client._call_gemini = openrouter, gemini
    try:
        result = await hf_client.generate_full_intelligence("news", ARTICLES, ["ai"], ["global"])
        assert result["_synthesis_provider"] == "gemini"
    finally:
        hf_client._call_openrouter, hf_client._call_gemini = old_or, old_g


async def test_deterministic_fallback():
    async def empty(*_args, **_kwargs):
        return ""

    old_or, old_g = hf_client._call_openrouter, hf_client._call_gemini
    hf_client._call_openrouter, hf_client._call_gemini = empty, empty
    try:
        result = await hf_client.generate_full_intelligence("news", ARTICLES, ["ai"], ["global"])
        assert result["_synthesis_provider"] == "deterministic_fallback"
        assert len(result["clusters"]) == len(ARTICLES)
        assert result["clusters"][0]["is_ai_synthesized"] is False
    finally:
        hf_client._call_openrouter, hf_client._call_gemini = old_or, old_g


async def test_fast_refresh_reuses_llm():
    main._cached_payload = {
        "daily_brief": "cached brief",
        "clusters": [{"thread_title": "Cached", "article_ids": ["1"], "summary": "", "pulse_score": 60}],
        "impact": {"headline": "cached"},
    }

    async def fetch_news(*_args, **_kwargs):
        return [{"id": "1", "title": "Cached story", "text": "Cached story text", "source": "TestWire"}]

    async def entities(_text):
        return {"entities": []}

    async def sentiment(_text):
        return {"label": "NEUTRAL", "score": 0.5}

    async def daily_delta(topics, _clusters):
        return [{"topic": topic, "label": topic.title(), "current": 50, "previous": 50, "delta": 0} for topic in topics]

    async def track_entities(_entities):
        return None

    old_fetch = main.news_fetcher.fetch_news
    old_ent, old_sent = main.hf_client.extract_entities, main.hf_client.analyze_sentiment
    old_delta, old_track = main.compute_daily_delta, main._track_entities_bg
    main.news_fetcher.fetch_news = fetch_news
    main.hf_client.extract_entities, main.hf_client.analyze_sentiment = entities, sentiment
    main.compute_daily_delta, main._track_entities_bg = daily_delta, track_entities
    try:
        result = await main._build_intelligence(["ai"], ["global"], run_llm=False, reuse_payload=main._cached_payload)
        assert result["refresh_type"] == "fast"
        assert result["pipeline_status"]["synthesis"] == "cache_reuse"
    finally:
        main.news_fetcher.fetch_news = old_fetch
        main.hf_client.extract_entities, main.hf_client.analyze_sentiment = old_ent, old_sent
        main.compute_daily_delta, main._track_entities_bg = old_delta, old_track


async def main_test():
    tests = [
        test_openrouter_primary,
        test_gemini_fallback,
        test_deterministic_fallback,
        test_fast_refresh_reuses_llm,
    ]
    for test in tests:
        await test()
        print(f"PASS {test.__name__}")


if __name__ == "__main__":
    asyncio.run(main_test())
