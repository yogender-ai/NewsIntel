import inspect
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.core.config import get_settings
from app.repositories.ingestion import IngestionRepository
from app.services.event_clustering import should_cluster_titles
from app.services.ingestion_pipeline import IngestionPipeline


class ProductionIngestionQAAudit(unittest.TestCase):
    def test_same_story_across_sources_should_cluster(self):
        reuters = "Nvidia shares rise after new AI chip demand report"
        cnbc = "Nvidia stock rises as AI chip demand report boosts outlook"
        self.assertTrue(should_cluster_titles(cnbc, reuters, threshold=0.72))

    def test_similar_but_different_stories_should_not_cluster(self):
        nvidia = "Nvidia shares rise after new AI chip demand report"
        amd = "AMD shares rise after new AI chip demand report"
        self.assertFalse(should_cluster_titles(amd, nvidia, threshold=0.72))

    def test_numeric_conflicts_should_not_cluster(self):
        first = "OpenAI raises 10 billion in new funding round"
        second = "OpenAI raises 40 billion in new funding round"
        self.assertFalse(should_cluster_titles(second, first, threshold=0.72))

    def test_event_memory_window_is_bounded(self):
        settings = get_settings()
        self.assertGreaterEqual(settings.article_duplicate_window_hours, 24)
        self.assertLessEqual(settings.article_duplicate_window_hours, 48)

        source = inspect.getsource(IngestionRepository._find_similar_event)
        self.assertIn("Event.last_seen_at >= cutoff", source)
        self.assertIn(".limit(100)", source)

    def test_dedup_order_is_documented_in_pipeline_code(self):
        pipeline_source = inspect.getsource(IngestionPipeline.ingest_topics)
        repository_source = inspect.getsource(IngestionRepository.ingest)
        find_source = inspect.getsource(IngestionRepository._find_or_create_article)

        self.assertLess(pipeline_source.index("self.redirects.resolve"), pipeline_source.index("self.repository.ingest"))
        self.assertLess(repository_source.index("normalize_url"), repository_source.index("sha256_text"))
        self.assertLess(find_source.index("Article.url_hash"), find_source.index("_find_similar_article"))

    def test_scheduler_uses_distributed_lock(self):
        source = Path("app/workers/ingestion_worker.py").read_text(encoding="utf-8")
        self.assertIn("cache.lock", source)
        self.assertIn("ingestion-lock:", source)

    def test_invalid_redis_url_falls_back_to_local_cache(self):
        from app.core.cache import _build_redis_client

        self.assertIsNone(_build_redis_client("not-a-redis-url"))
        self.assertIsNone(_build_redis_client("postgresql://user:pass@example.com/db"))


class PipelineOrderQAAudit(unittest.IsolatedAsyncioTestCase):
    async def test_redirect_resolve_runs_before_repository_ingest(self):
        class FakeRepository:
            def __init__(self):
                self.seen_url = None

            async def ingest(self, incoming):
                self.seen_url = incoming.source_url
                return incoming

        class FakeSession:
            async def commit(self):
                return None

        pipeline = IngestionPipeline(session=FakeSession())
        fake_repo = FakeRepository()
        pipeline.repository = fake_repo
        pipeline.redirects.resolve = AsyncMock(return_value="https://publisher.com/article")

        with patch(
            "news_fetcher.fetch_news",
            new=AsyncMock(
                return_value=[
                    {
                        "source": "Reuters",
                        "url": "https://news.google.com/rss/articles/redirect",
                        "title": "Nvidia shares rise after new AI chip demand report",
                        "text": "Nvidia shares rose after fresh AI chip demand reporting.",
                        "published": datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT"),
                    }
                ]
            ),
        ):
            await pipeline.ingest_topics(["ai"], ["global"], max_articles=1)

        self.assertEqual(fake_repo.seen_url, "https://publisher.com/article")


if __name__ == "__main__":
    unittest.main()
