import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.models.news import Alert, AlertRule, Event, Preference, User
from app.services.alert_engine import (
    MAX_ALERTS_PER_DAY,
    build_candidates,
    create_alert_if_allowed,
    fingerprint,
)
from app.services.digest_engine import _rules_only_digest, generate_digest


def make_user():
    return User(id=uuid.uuid4(), external_id="phase7-user", email="user@example.com", is_active=True)


def make_event(title="Nvidia appears in a critical AI signal", tier="CRITICAL", pulse=82):
    now = datetime.now(timezone.utc)
    return Event(
        id=uuid.uuid4(),
        slug=uuid.uuid4().hex,
        title=title,
        normalized_title=title.lower(),
        category="ai",
        region="global",
        confidence_score=0.9,
        source_count=5,
        first_seen_at=now,
        last_seen_at=now,
        last_meaningful_update_at=now,
        metadata_json={
            "ai": {
                "status": "enriched",
                "signal_tier": tier,
                "pulse_score": pulse,
                "pulse_breakdown": {"delta": 18},
                "entities": [{"name": "Nvidia"}],
            }
        },
    )


def make_rules(user_id):
    return [
        AlertRule(id=uuid.uuid4(), user_id=user_id, rule_type="critical_event", target_type="any", target_value="*", threshold=0, enabled=True, cooldown_minutes=360),
        AlertRule(id=uuid.uuid4(), user_id=user_id, rule_type="pulse_spike", target_type="any", target_value="*", threshold=12, enabled=True, cooldown_minutes=360),
        AlertRule(id=uuid.uuid4(), user_id=user_id, rule_type="tracked_entity", target_type="entity", target_value="*", threshold=0, enabled=True, cooldown_minutes=360),
    ]


class FakeSession:
    def __init__(self, scalars=None, scalar_lists=None):
        self.scalar_results = list(scalars or [])
        self.scalar_lists = list(scalar_lists or [])
        self.added = []

    async def scalar(self, *_args, **_kwargs):
        return self.scalar_results.pop(0) if self.scalar_results else None

    async def scalars(self, *_args, **_kwargs):
        values = self.scalar_lists.pop(0) if self.scalar_lists else []
        class Result:
            def __init__(self, items):
                self.items = items
            def all(self):
                return self.items
        return Result(values)

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        return None


class Phase7AlertsDigestTests(unittest.IsolatedAsyncioTestCase):
    async def test_critical_event_creates_alert_once(self):
        user = make_user()
        event = make_event()
        preference = Preference(user_id=user.id, categories=["ai"], regions=["global"], tracked_entities=["Nvidia"], refresh_policy={})
        candidate = [item for item in build_candidates(user, preference, make_rules(user.id), event) if item.alert_type == "critical_event"][0]
        session = FakeSession([None, None, 0, 0])
        alert, status = await create_alert_if_allowed(session, user, candidate)
        self.assertEqual(status, "created")
        self.assertIsNotNone(alert)
        self.assertEqual(len(session.added), 1)

    async def test_duplicate_alert_suppressed_by_cooldown(self):
        user = make_user()
        event = make_event()
        rule = make_rules(user.id)[0]
        candidate = build_candidates(user, Preference(user_id=user.id, categories=["ai"], regions=["global"], tracked_entities=[], refresh_policy={}), [rule], event)[0]
        existing = Alert(
            user_id=user.id,
            event_id=event.id,
            rule_id=rule.id,
            alert_type="critical_event",
            severity="critical",
            message="existing",
            fingerprint=fingerprint(user.id, "critical_event", event.id, "ai"),
            created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        session = FakeSession([existing])
        alert, status = await create_alert_if_allowed(session, user, candidate)
        self.assertIsNone(alert)
        self.assertEqual(status, "cooldown_duplicate")

    async def test_max_alerts_per_day_works(self):
        user = make_user()
        event = make_event()
        candidate = build_candidates(user, Preference(user_id=user.id, categories=["ai"], regions=["global"], tracked_entities=[], refresh_policy={}), make_rules(user.id), event)[0]
        session = FakeSession([None, None, MAX_ALERTS_PER_DAY])
        alert, status = await create_alert_if_allowed(session, user, candidate)
        self.assertIsNone(alert)
        self.assertEqual(status, "daily_cap")

    def test_tracked_entity_alert_works(self):
        user = make_user()
        event = make_event(tier="SIGNAL", pulse=70)
        preference = Preference(user_id=user.id, categories=["ai"], regions=["global"], tracked_entities=["Nvidia"], refresh_policy={})
        candidates = build_candidates(user, preference, make_rules(user.id), event)
        self.assertTrue(any(candidate.alert_type == "tracked_entity" for candidate in candidates))

    def test_rules_only_empty_digest_honest(self):
        digest = _rules_only_digest({"clusters": [], "daily_delta": []}, [], ["ai"], datetime.now(timezone.utc))
        self.assertEqual(digest["top_3"], [])
        self.assertEqual(digest["status_note"], "generated_rules_only")
        self.assertIn("No major", digest["headline"])

    async def test_ai_failure_produces_rules_only_digest(self):
        user = make_user()
        fake_session = FakeSession([None, None], [[]])
        with patch("app.services.digest_engine.build_dashboard_payload", new=AsyncMock(return_value={"clusters": [make_event().metadata_json], "daily_delta": []})), \
             patch("app.services.digest_engine._call_digest_ai", new=AsyncMock(return_value=(None, "rules_only"))):
            digest = await generate_digest(fake_session, user)
        self.assertEqual(digest.provider_used, "rules_only")
        self.assertEqual(digest.status, "generated_rules_only")


if __name__ == "__main__":
    unittest.main()
