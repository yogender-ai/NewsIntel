import unittest
import uuid
from datetime import datetime, timezone

from app.models.news import Article, Event, EventArticle
from app.services.geo_signals import build_map_signals, ensure_event_geo, extract_geo


class FakeScalars:
    def __init__(self, rows):
        self.rows = rows
    def unique(self):
        return self
    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, rows):
        self.rows = rows
        self.committed = 0
    async def scalars(self, _stmt):
        return FakeScalars(self.rows)
    async def commit(self):
        self.committed += 1


def make_event(title, category="ai", text="", metadata=None):
    now = datetime.now(timezone.utc)
    event = Event(
        id=uuid.uuid4(),
        slug=uuid.uuid4().hex,
        title=title,
        normalized_title=title.lower(),
        category=category,
        region="global",
        confidence_score=0.8,
        source_count=2,
        first_seen_at=now,
        last_seen_at=now,
        last_meaningful_update_at=now,
        metadata_json=metadata or {"ai": {"status": "enriched", "pulse_score": 72, "entities": []}},
    )
    article = Article(
        id=uuid.uuid4(),
        canonical_url="https://example.com",
        url_hash=uuid.uuid4().hex,
        title=title,
        normalized_title=title.lower(),
        title_hash=uuid.uuid4().hex,
        source="Example",
        published_at=now,
        first_seen_at=now,
        last_seen_at=now,
        text_preview=text,
    )
    event.article_links = [EventArticle(event=event, article=article, role="primary", confidence_score=0.9)]
    return event


class GeoSignalTests(unittest.IsolatedAsyncioTestCase):
    def test_event_with_india_entity_maps_to_india(self):
        event = make_event("India semiconductor investment grows")
        geo = extract_geo(event)
        self.assertEqual(geo["countries"], ["IN"])
        self.assertEqual(geo["primary_location"], "India")

    def test_event_without_geo_has_no_fake_location(self):
        event = make_event("Semiconductor demand grows", text="Chip demand improved.")
        self.assertEqual(extract_geo(event)["countries"], [])

    async def test_endpoint_shape_only_real_locations_and_filters(self):
        india = make_event("India AI chip policy expands", category="ai")
        generic = make_event("Semiconductor demand grows", category="ai")
        payload = await build_map_signals(FakeSession([india, generic]), layer="technology", time_window="7d")
        self.assertEqual([region["id"] for region in payload["regions"]], ["IN"])
        self.assertIn("technology", payload["layers"])

    def test_no_duplicate_geo_rows(self):
        event = make_event("India and Indian chip policy in Delhi")
        geo = ensure_event_geo(event)
        self.assertEqual(geo["countries"], ["IN"])


if __name__ == "__main__":
    unittest.main()
