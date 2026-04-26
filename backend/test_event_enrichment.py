import json
import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.news import Article, Event, EventArticle
from app.services.dashboard_read_model import build_dashboard_payload
from app.services.event_enrichment import (
    AI_STATUS_ENRICHED,
    AI_STATUS_FAILED,
    AI_STATUS_PENDING,
    EventEnrichmentService,
    compact_event_evidence,
    evidence_hash,
    mark_event_pending,
)


VALID_AI_JSON = json.dumps(
    {
        "summary": "OpenAI raised funding as AI infrastructure demand accelerated.",
        "impact_line": "AI infrastructure financing pressure is rising.",
        "why_it_matters": "The event can affect cloud, chips, and private AI valuations.",
        "sentiment": "mixed",
        "entities": [{"name": "OpenAI", "type": "company"}],
        "risk_level": "medium",
        "opportunity_level": "high",
        "story_graph": {
            "nodes": [
                {"id": "event", "label": "Funding round", "type": "trigger"},
                {"id": "impact", "label": "Infrastructure demand", "type": "impact"},
                {"id": "exposure", "label": "AI portfolio exposure", "type": "user_exposure"},
            ],
            "edges": [{"from": "event", "to": "impact", "label": "causes"}],
        },
        "confidence_explanation": "Multiple linked sources support the same event.",
        "uncertainty": "Terms could change before close.",
    }
)


class FakeSession:
    def __init__(self, events=None):
        self.events = events or []
        self.flushed = 0
        self.committed = 0

    async def flush(self):
        self.flushed += 1

    async def commit(self):
        self.committed += 1

    async def scalars(self, _stmt):
        return FakeScalars(self.events)


class FakeScalars:
    def __init__(self, rows):
        self.rows = rows

    def unique(self):
        return self

    def all(self):
        return self.rows


def make_event(metadata=None, source_count=3):
    now = datetime.now(timezone.utc)
    event = Event(
        id=uuid.uuid4(),
        slug=f"event-{uuid.uuid4().hex[:8]}",
        title="OpenAI raises funding",
        normalized_title="openai raises funding",
        category="ai",
        region="global",
        confidence_score=0.82,
        source_count=source_count,
        first_seen_at=now,
        last_seen_at=now,
        last_meaningful_update_at=now,
        metadata_json=metadata or {"ai": {"status": AI_STATUS_PENDING}},
    )
    article = Article(
        id=uuid.uuid4(),
        canonical_url="https://example.com/openai-funding",
        url_hash=uuid.uuid4().hex,
        title="OpenAI raises funding",
        normalized_title="openai raises funding",
        title_hash=uuid.uuid4().hex,
        source="Example News",
        published_at=now,
        first_seen_at=now,
        last_seen_at=now,
        text_preview="Funding surge signals intensifying AI race.",
    )
    link = EventArticle(event=event, article=article, role="primary", confidence_score=0.9)
    event.article_links = [link]
    return event


class EventEnrichmentTests(unittest.IsolatedAsyncioTestCase):
    def test_event_created_with_ai_status_pending(self):
        event = make_event(metadata={})
        mark_event_pending(event, reason="new_event")

        self.assertEqual(event.metadata_json["ai"]["status"], AI_STATUS_PENDING)
        self.assertEqual(event.metadata_json["ai"]["pending_reason"], "new_event")

    async def test_enrichment_updates_event_to_enriched_and_calls_gateway(self):
        event = make_event()
        service = EventEnrichmentService(FakeSession())

        with patch("hf_client._call_openrouter", new=AsyncMock(return_value=VALID_AI_JSON)) as gateway, \
             patch("hf_client._call_gemini", new=AsyncMock(return_value="")):
            status = await service.enrich_event(event, topics=["ai"])

        self.assertEqual(status, AI_STATUS_ENRICHED)
        self.assertEqual(event.metadata_json["ai"]["status"], AI_STATUS_ENRICHED)
        self.assertEqual(event.metadata_json["ai"]["summary"], "OpenAI raised funding as AI infrastructure demand accelerated.")
        self.assertEqual(event.metadata_json["ai"]["provider_used"], "cloud-command-gateway/openrouter")
        self.assertGreater(event.metadata_json["ai"]["pulse_score"], 0)
        gateway.assert_awaited()

    async def test_invalid_ai_json_marks_failed_after_retry(self):
        event = make_event()
        service = EventEnrichmentService(FakeSession())

        with patch("hf_client._call_openrouter", new=AsyncMock(return_value="{not-json")) as gateway, \
             patch("hf_client._call_gemini", new=AsyncMock(return_value="")):
            status = await service.enrich_event(event, topics=["ai"])

        self.assertEqual(status, AI_STATUS_FAILED)
        self.assertEqual(event.metadata_json["ai"]["status"], AI_STATUS_FAILED)
        self.assertEqual(event.metadata_json["ai"]["failure_reason"], "invalid_or_empty_ai_json")
        self.assertEqual(gateway.await_count, 2)

    async def test_dashboard_uses_ai_summary_when_available(self):
        event = make_event()
        service = EventEnrichmentService(FakeSession())
        with patch("hf_client._call_openrouter", new=AsyncMock(return_value=VALID_AI_JSON)), \
             patch("hf_client._call_gemini", new=AsyncMock(return_value="")):
            await service.enrich_event(event, topics=["ai"])

        payload = await build_dashboard_payload(FakeSession([event]), topics=["ai"], regions=["global"])

        cluster = payload["clusters"][0]
        self.assertEqual(cluster["summary"], "OpenAI raised funding as AI infrastructure demand accelerated.")
        self.assertEqual(cluster["impact_line"], "AI infrastructure financing pressure is rising.")
        self.assertEqual(cluster["entities"], [{"name": "OpenAI", "type": "company"}])
        self.assertEqual(cluster["ai_status"], AI_STATUS_ENRICHED)

    async def test_dashboard_shows_pending_state_when_unavailable(self):
        event = make_event(metadata={"ai": {"status": AI_STATUS_PENDING}})

        payload = await build_dashboard_payload(FakeSession([event]), topics=["ai"], regions=["global"])

        cluster = payload["clusters"][0]
        self.assertEqual(cluster["summary"], "AI analysis pending")
        self.assertEqual(cluster["impact_line"], "AI analysis pending")
        self.assertEqual(cluster["why_it_matters"], "Impact is still being confirmed across sources.")

    async def test_enrichment_does_not_rerun_if_evidence_hash_unchanged(self):
        event = make_event()
        event.metadata_json = {
            "ai": {
                "status": AI_STATUS_FAILED,
                "evidence_hash": evidence_hash(compact_event_evidence(event)),
            }
        }
        service = EventEnrichmentService(FakeSession())

        with patch("hf_client._call_openrouter", new=AsyncMock(return_value=VALID_AI_JSON)) as gateway:
            status = await service.enrich_event(event, topics=["ai"])

        self.assertEqual(status, "skipped")
        gateway.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
