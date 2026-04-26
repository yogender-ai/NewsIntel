import json
import unittest
from unittest.mock import AsyncMock, patch

from app.services.scenario_simulator import DISCLAIMER, parse_scenario_result, run_scenario


VALID_RESULT = json.dumps(
    {
        "summary": "Scenario pressure rises across regional risk and markets.",
        "impact_score": 72,
        "confidence": 61,
        "impact_areas": [{"area": "markets", "score": 70, "direction": "negative", "explanation": "Risk repricing could rise."}],
        "chain_reaction": [{"step": 1, "title": "Trigger", "description": "Tensions increase."}],
        "possible_outcomes": [
            {"label": "Contained", "probability": 55, "description": "Diplomacy limits spillover."},
            {"label": "Escalates", "probability": 45, "description": "Regional risk broadens."},
        ],
        "recommended_actions": ["Monitor verified regional signals."],
        "disclaimer": DISCLAIMER,
    }
)


class FakeSession:
    def __init__(self):
        self.added = []
        self.committed = 0
    async def scalar(self, _stmt):
        return None
    async def scalars(self, _stmt):
        return FakeScalars([])
    def add(self, item):
        self.added.append(item)
    async def commit(self):
        self.committed += 1


class FakeScalars:
    def __init__(self, rows):
        self.rows = rows
    def all(self):
        return self.rows


class ScenarioSimulatorTests(unittest.IsolatedAsyncioTestCase):
    def test_disclaimer_always_included(self):
        data = json.loads(VALID_RESULT)
        data["disclaimer"] = "Prediction."
        result = parse_scenario_result(json.dumps(data))
        self.assertEqual(result.disclaimer, DISCLAIMER)

    def test_invalid_ai_json_handled(self):
        with self.assertRaises(Exception):
            parse_scenario_result("{not-json")

    async def test_scenario_result_stored(self):
        session = FakeSession()
        with patch("hf_client._call_openrouter", new=AsyncMock(return_value=VALID_RESULT)), \
             patch("hf_client._call_gemini", new=AsyncMock(return_value="")):
            payload = await run_scenario(
                session,
                user_id="user",
                scenario="What if Taiwan tensions escalate in 30 days?",
                base_event_id=None,
                assumptions={"time_horizon": "30d"},
            )
        self.assertEqual(payload["status"], "success")
        self.assertEqual(session.committed, 1)
        self.assertEqual(len(session.added), 1)
        self.assertEqual(session.added[0].result_json["disclaimer"], DISCLAIMER)


if __name__ == "__main__":
    unittest.main()
