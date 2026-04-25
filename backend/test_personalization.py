import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parent))

import main


def make_request(uid: str = "user-123") -> Request:
    headers = [(b"x-user-id", uid.encode())] if uid else []
    return Request({"type": "http", "headers": headers})


class PersonalizationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        main._profile_cache.clear()

    def test_profile_cache_key_ignores_order_and_case(self):
        left = main._profile_cache_key(["Media", "legal"], ["Global", "India"])
        right = main._profile_cache_key(["legal", "media"], ["india", "global"])
        self.assertEqual(left, right)

    async def test_force_refresh_uses_requested_topics_for_event_store_read_model(self):
        fake_payload = {
            "status": "success",
            "clusters": [],
            "topics_used": ["media", "legal"],
            "regions_used": ["global"],
            "personalization_mode": "shared",
        }

        with patch.object(main, "_get_user_prefs_from_header", new=AsyncMock(return_value=(["tech"], ["us"], "user-123", True))), \
             patch.object(main, "_event_backed_dashboard_payload", new=AsyncMock(return_value=fake_payload)):
            response = await main.force_refresh_dashboard(
                make_request(),
                main.DashboardRequest(topics=["media", "legal"], regions=["global"]),
            )

        self.assertEqual(response["topics_used"], ["media", "legal"])
        self.assertEqual(response["regions_used"], ["global"])
        self.assertEqual(response["personalization_mode"], "shared")

    async def test_get_dashboard_uses_event_store_read_model(self):
        fake_payload = {"daily_brief": "", "clusters": [], "topics_used": ["media"], "regions_used": ["global"]}

        with patch.object(main, "_get_user_prefs_from_header", new=AsyncMock(return_value=(["media"], ["global"], "user-123", True))), \
             patch.object(main, "_event_backed_dashboard_payload", new=AsyncMock(return_value=fake_payload)) as event_payload:
            response = await main.get_cached_dashboard(make_request())

        event_payload.assert_awaited_once_with(["media"], ["global"])
        self.assertEqual(response["topics_used"], ["media"])

    async def test_prefs_lookup_can_recover_by_email(self):
        row = {
            "preferred_categories": '["legal", "media"]',
            "preferred_regions": '["global"]',
        }
        request = Request({
            "type": "http",
            "headers": [(b"x-user-id", b"new-uid"), (b"x-user-email", b"same@example.com")],
        })

        with patch.object(main.db, "get_user_prefs", new=AsyncMock(return_value=None)), \
             patch.object(main.db, "get_user_prefs_by_email", new=AsyncMock(return_value=row)):
            topics, regions, uid, found = await main._get_user_prefs_from_header(request)

        self.assertTrue(found)
        self.assertEqual(uid, "new-uid")
        self.assertEqual(topics, ["legal", "media"])
        self.assertEqual(regions, ["global"])


if __name__ == "__main__":
    unittest.main()
