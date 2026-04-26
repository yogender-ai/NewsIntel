import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.models.news import Article, Event, EventArticle
from app.services.intensity_scoring import dynamic_event_intensity
from app.services.semantic_clustering import compare_article_to_article
from app.services.semantic_embeddings import EMBEDDING_MODEL, article_embedding_text, embed_text, text_hash
from app.services.semantic_personalization import semantic_relevance
import main


def make_article(title, preview="", source="Example", hours_ago=1):
    now = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    return Article(
        id=uuid.uuid4(),
        canonical_url=f"https://example.com/{uuid.uuid4().hex}",
        url_hash=uuid.uuid4().hex,
        title=title,
        normalized_title=title.lower(),
        title_hash=uuid.uuid4().hex,
        source=source,
        published_at=now,
        first_seen_at=now,
        last_seen_at=now,
        text_preview=preview,
        embedding_json=embed_text(article_embedding_text(title, preview, source)),
        embedding_model=EMBEDDING_MODEL,
        embedding_text_hash=text_hash(article_embedding_text(title, preview, source)),
    )


def make_event(title, articles=None, metadata=None):
    now = datetime.now(timezone.utc)
    event = Event(
        id=uuid.uuid4(),
        slug=uuid.uuid4().hex,
        title=title,
        normalized_title=title.lower(),
        category="ai",
        region="global",
        confidence_score=0.8,
        source_count=len(articles or []) or 1,
        first_seen_at=now,
        last_seen_at=now,
        last_meaningful_update_at=now,
        metadata_json=metadata or {"ai": {"status": "enriched"}},
    )
    event.article_links = [
        EventArticle(event=event, article=article, role="supporting", confidence_score=0.8)
        for article in (articles or [make_article(title)])
    ]
    return event


class Phase6IntelligenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_embedding_clustering_merges_semantic_duplicate_without_llm(self):
        candidate = make_article("Nvidia AI chip rally accelerates on strong demand", "Semiconductor demand rises.")
        with patch("hf_client._call_openrouter", new=AsyncMock(return_value="")) as gateway:
            decision = await compare_article_to_article(
                "Nvidia AI chip rally accelerates on strong demand",
                "Semiconductor demand rises.",
                candidate,
            )
        self.assertEqual(decision.decision, "merge")
        self.assertIn("embedding", decision.method)
        gateway.assert_not_awaited()

    async def test_ambiguous_clustering_uses_llm_validation(self):
        candidate = make_article("Nvidia AI chip demand expands after earnings")
        with patch("hf_client._call_openrouter", new=AsyncMock(return_value='{"same_event": false, "confidence": 0.77, "reason": "same sector, different event"}')):
            decision = await compare_article_to_article("Nvidia AI chip platform launch boosts demand", "", candidate)
        self.assertEqual(decision.decision, "reject")
        self.assertEqual(decision.method, "llm_validation")

    def test_dynamic_intensity_uses_phase6_features(self):
        event = make_event(
            "Nvidia AI chip demand accelerates",
            articles=[
                make_article("Nvidia AI chip demand accelerates", hours_ago=1),
                make_article("Nvidia AI chip demand accelerates again", source="Reuters", hours_ago=2),
            ],
        )
        score, breakdown = dynamic_event_intensity(event, None)
        self.assertGreater(score, 0)
        self.assertEqual(breakdown["model"], "phase6_dynamic_event_intensity_v1")
        self.assertIn("source_acceleration", breakdown)

    def test_semantic_personalization_scores_profile_against_event_text(self):
        cluster = {"thread_title": "Nvidia AI chip demand accelerates", "summary": "AI semiconductor demand rises", "entities": []}
        phase5 = {"tracked_entities": [{"entity_name": "Nvidia"}], "interactions": [{"signal_id": "nvidia-ai", "interaction_type": "open"}]}
        relevance = semantic_relevance(cluster, ["ai"], ["global"], phase5, [])
        self.assertEqual(relevance["model"], "phase6_semantic_profile_event_relevance_v1")
        self.assertGreater(relevance["score"], 50)

    async def test_delta_uses_7d_average_and_confidence(self):
        async def fake_history(topics, days=7):
            return {topics[0]: [{"pulse_score": 40}, {"pulse_score": 50}, {"pulse_score": 60}]}

        with patch.object(main.db, "get_pulse_history", new=AsyncMock(side_effect=fake_history)), \
             patch.object(main.db, "save_pulse_snapshot", new=AsyncMock()):
            delta = await main.compute_daily_delta(
                ["ai"],
                [{"thread_title": "AI chip rally", "summary": "ai demand", "pulse_score": 80, "article_ids": ["1"]}],
            )
        self.assertEqual(delta[0]["previous"], 50)
        self.assertEqual(delta[0]["delta"], 30)
        self.assertEqual(delta[0]["baseline_window"], "7d_moving_average")
        self.assertTrue(delta[0]["has_baseline"])
        self.assertIn("volatility_confidence", delta[0])


if __name__ == "__main__":
    unittest.main()
