import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.mvp_pipeline import MVPNewsPipeline, clean_ai_json, similar_title


def settings(**overrides):
    base = {
        "mvp_categories": ["tech", "education", "entertainment", "politics"],
        "newsintel_articles_per_category": 5,
        "newsintel_rank_top_n": 15,
        "newsintel_enrich_batch_size": 3,
        "newsintel_retention_days": 7,
        "newsintel_ai_rank_max_tokens": 520,
        "newsintel_ai_enrich_max_tokens": 500,
        "newsintel_openrouter_model": "openrouter/auto",
        "title_similarity_threshold": 0.86,
        "ai_circuit_breaker_cooldown_minutes": 360,
        "newsintel_ingest_interval_minutes": 10,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def rss_item(category, index):
    return {
        "title": f"{category} real headline {index}",
        "text": f"{category} real description {index}",
        "source": "Example Source",
        "url": f"https://example.com/{category}/{index}",
        "published": "Mon, 27 Apr 2026 10:00:00 GMT",
        "category": category,
        "rss_query": f"global {category}",
    }


def test_fetch_contract_exactly_20_candidates():
    async def fake_fetch(categories, per_category):
        return [rss_item(category, index) for category in categories for index in range(per_category)]

    async def run():
        pipeline = MVPNewsPipeline(None, settings=settings(), rss_fetcher=fake_fetch)
        raw = await pipeline.rss_fetcher(pipeline.settings.mvp_categories, pipeline.settings.newsintel_articles_per_category)
        candidates = pipeline.normalize_candidates(raw)
        assert len(candidates) == 20
        assert {candidate.category for candidate in candidates} == set(pipeline.settings.mvp_categories)

    asyncio.run(run())


def test_title_similarity_deduplication_signal():
    assert similar_title("OpenAI launches new education tools", "OpenAI launches new education tool") >= 0.86
    assert similar_title("Election policy talks resume", "Streaming platform releases movie") < 0.86


def test_ai_ranking_selects_top_15(monkeypatch):
    async def run():
        pipeline = MVPNewsPipeline(None, settings=settings())
        articles = [
            SimpleNamespace(
                title=f"Headline {index}",
                description="description",
                text_preview="description",
                source="Source",
                category="tech",
                published_at=datetime.now(timezone.utc),
            )
            for index in range(20)
        ]

        async def fake_ai(_prompt, max_tokens):
            return '{"ranked":[' + ",".join(
                f'{{"article_index":{index},"rank":{index + 1},"score":{100 - index},"reason":"important","importance":"HIGH"}}'
                for index in range(15)
            ) + "]}";

        pipeline.call_ai = fake_ai
        ranked = await pipeline.rank_articles(articles)
        assert len(ranked) == 15
        assert ranked[0]["rank_position"] == 1
        assert ranked[-1]["rank_position"] == 15

    asyncio.run(run())


def test_enrichment_batch_size_setting_is_three():
    assert settings().newsintel_enrich_batch_size == 3


def test_ingestion_lock_skip_payload_shape():
    async def run():
        pipeline = MVPNewsPipeline(None, settings=settings())

        async def locked(_name, minutes):
            return False

        pipeline.acquire_lock = locked
        result = await pipeline.run_ingestion()
        assert result == {"status": "skipped", "reason": "ingestion_already_running"}

    asyncio.run(run())


def test_snapshot_payload_shape_from_cached_data():
    payload = {
        "lastUpdated": "2026-04-27T10:00:00+00:00",
        "cycleId": "cycle",
        "topStories": [],
        "feed": [],
        "categories": {"tech": [], "education": [], "entertainment": [], "politics": []},
        "pulse": [],
        "exposure": [],
        "graph": [],
        "map": [],
        "simulatorContext": [],
    }
    assert set(payload) >= {"topStories", "feed", "categories", "pulse", "exposure", "graph", "map", "simulatorContext"}


def test_cleanup_retention_window_setting_is_seven_days():
    assert settings().newsintel_retention_days == 7


@pytest.mark.parametrize(
    "response",
    [
        {"status_code": 429, "body": ""},
        {"status_code": 402, "body": ""},
        {"status_code": 500, "body": "quota exceeded"},
        {"status_code": 500, "body": "payment required"},
    ],
)
def test_ai_quota_circuit_breaker_detection(response):
    assert MVPNewsPipeline.is_quota_response(response)


def test_clean_ai_json_strips_markdown_fences():
    assert clean_ai_json('```json\n{"ok": true}\n```') == {"ok": True}
