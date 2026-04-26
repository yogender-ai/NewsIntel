import json
import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.news import Article, Event, EventArticle, EventRelationship
from app.services.event_enrichment import AI_STATUS_ENRICHED
from app.services.event_relationships import (
    CandidatePair,
    EventRelationshipService,
    compact_event_for_relationship,
    load_orbit_payload,
    pair_candidate,
)


class FakeScalars:
    def __init__(self, rows):
        self.rows = rows

    def unique(self):
        return self

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, scalar_batches=None):
        self.scalar_batches = list(scalar_batches or [])
        self.added = []
        self.committed = 0

    async def scalars(self, _stmt):
        return FakeScalars(self.scalar_batches.pop(0) if self.scalar_batches else [])

    async def scalar(self, _stmt):
        for item in self.added:
            if item.__class__.__name__ in {"EventRelationship", "EventRelationshipCheck"}:
                return item
        return None

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        self.committed += 1


def make_event(title, category="ai", entities=None, source="Example", pulse=72):
    now = datetime.now(timezone.utc)
    event = Event(
        id=uuid.uuid4(),
        slug=f"event-{uuid.uuid4().hex[:8]}",
        title=title,
        normalized_title=title.lower(),
        category=category,
        region="global",
        confidence_score=0.82,
        source_count=2,
        first_seen_at=now,
        last_seen_at=now,
        last_meaningful_update_at=now,
        metadata_json={
            "ai": {
                "status": AI_STATUS_ENRICHED,
                "pulse_score": pulse,
                "why_it_matters": "This changes AI infrastructure exposure.",
                "entities": [{"name": name, "type": "company"} for name in (entities or [])],
                "story_graph_json": {
                    "nodes": [{"id": "event", "label": "AI chip demand", "type": "trigger"}],
                    "edges": [{"from": "event", "to": "impact", "label": "amplifies"}],
                },
            }
        },
    )
    article = Article(
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
        text_preview="AI chip rally and semiconductor demand accelerate.",
    )
    event.article_links = [EventArticle(event=event, article=article, role="primary", confidence_score=0.9)]
    return event


class EventRelationshipTests(unittest.IsolatedAsyncioTestCase):
    def test_related_semiconductor_events_become_candidate(self):
        nvidia = make_event("Nvidia hits $5 trillion market cap as AI chip rally accelerates", entities=["Nvidia"])
        intel = make_event("Chip rally extends as Intel forecast signals broader AI demand", entities=["Nvidia", "Intel"])

        candidate = pair_candidate(nvidia, intel)

        self.assertIsNotNone(candidate)
        self.assertGreaterEqual(candidate.score, 3.0)

    def test_unrelated_events_do_not_link(self):
        chip = make_event("Nvidia AI chip rally accelerates", entities=["Nvidia"])
        climate = make_event("Monsoon forecast improves reservoir levels", category="climate", entities=["India"], source="Weather Desk")

        self.assertIsNone(pair_candidate(chip, climate))

    async def test_duplicate_relationships_not_created(self):
        first = make_event("Nvidia AI chip rally accelerates", entities=["Nvidia"])
        second = make_event("Intel forecast signals broader AI chip demand", entities=["Nvidia", "Intel"])
        candidate = CandidatePair(first, second, 8.0, {"reasons": [], "source": compact_event_for_relationship(first), "target": compact_event_for_relationship(second)})
        service = EventRelationshipService(FakeSession())
        validation = type(
            "Validation",
            (),
            {
                "relationship_type": "amplifies",
                "confidence": 0.82,
                "evidence": "Both events cite AI chip demand and Nvidia exposure.",
            },
        )()

        await service.upsert_relationship(candidate, validation)
        await service.upsert_relationship(candidate, validation)

        relationships = [item for item in service.session.added if isinstance(item, EventRelationship)]
        self.assertEqual(len(relationships), 1)

    async def test_orbit_returns_nodes_and_edges(self):
        first = make_event("Nvidia AI chip rally accelerates", entities=["Nvidia"])
        second = make_event("Intel forecast signals broader AI chip demand", entities=["Nvidia", "Intel"])
        edge = EventRelationship(
            id=uuid.uuid4(),
            source_event_id=first.id,
            target_event_id=second.id,
            relationship_type="amplifies",
            confidence=0.82,
            evidence="Shared AI semiconductor demand.",
            pair_hash="pair",
        )
        session = FakeSession([[first, second], [edge]])

        payload = await load_orbit_payload(session, user_id="user", topics=["ai"], regions=["global"])

        self.assertEqual(len(payload["nodes"]), 2)
        self.assertEqual(len(payload["edges"]), 1)

    async def test_ai_invalid_json_handled_safely(self):
        first = make_event("Nvidia AI chip rally accelerates", entities=["Nvidia"])
        second = make_event("Intel forecast signals broader AI chip demand", entities=["Nvidia", "Intel"])
        candidate = CandidatePair(first, second, 8.0, {"source": {}, "target": {}})
        service = EventRelationshipService(FakeSession())

        with patch("hf_client._call_openrouter", new=AsyncMock(return_value="{not-json")), \
             patch("hf_client._call_gemini", new=AsyncMock(return_value="")):
            status = await service.validate_candidate(candidate)

        self.assertEqual(status, "failed")
        self.assertFalse(any(isinstance(item, EventRelationship) for item in service.session.added))


if __name__ == "__main__":
    unittest.main()
