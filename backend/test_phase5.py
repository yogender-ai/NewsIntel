import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import main
from app.services.dashboard_read_model import compare_dashboard_payloads


class Phase5EngineTests(unittest.TestCase):
    def test_story_graph_returns_nodes_and_edges(self):
        cluster = {
            "thread_title": "Nvidia antitrust probe expands",
            "summary": "Regulators are reviewing AI chip competition.",
            "impact_line": "Legal pressure may slow AI chip deals.",
            "pulse_score": 82,
            "exposure_score": 88,
            "risk_type": "risk",
            "article_ids": ["1"],
        }
        articles = [{
            "id": "1",
            "title": "Nvidia faces antitrust review",
            "entities": [{"name": "Nvidia", "type": "ORG"}],
        }]

        graph = main.build_story_graph(cluster, articles, ["legal", "ai"], ["global"])

        self.assertEqual(len(graph["nodes"]), 4)
        self.assertEqual(len(graph["edges"]), 3)
        self.assertEqual(graph["edges"][-1]["relationship"], "raises risk")

    def test_personalization_filters_dismissed_and_boosts_watched(self):
        payload = {
            "articles": [],
            "clusters": [
                {"thread_title": "Legal AI Signal", "summary": "AI regulation", "pulse_score": 70, "exposure_score": 60, "signal_tier": "SIGNAL"},
                {"thread_title": "Dismiss Me", "summary": "Market noise", "pulse_score": 90, "exposure_score": 90, "signal_tier": "CRITICAL"},
            ],
        }
        dismissed_id = main._signal_id(payload["clusters"][1])
        watched_id = main._signal_id(payload["clusters"][0])
        phase5 = {
            "saved": [],
            "watched": [{"signal_id": watched_id}],
            "tracked_entities": [],
            "dismissed": [{"signal_id": dismissed_id}],
            "interactions": [{"signal_id": watched_id, "interaction_type": "graph"}],
        }

        result = main._personalize_payload(payload, "user-1", ["ai", "legal"], ["global"], phase5)

        self.assertEqual(len(result["clusters"]), 1)
        self.assertEqual(result["clusters"][0]["signal_id"], watched_id)
        self.assertGreater(result["clusters"][0]["relevance_score"], 60)
        self.assertEqual(result["dismissed_count"], 1)

    def test_why_relevant_uses_real_factors(self):
        cluster = {
            "thread_title": "Education AI policy",
            "summary": "Global AI education rules mention OpenAI.",
            "pulse_score": 65,
            "exposure_score": 70,
        }
        phase5 = {
            "saved": [],
            "watched": [],
            "tracked_entities": [{"entity_name": "OpenAI", "follow_weight": 1.0}],
            "dismissed": [],
            "interactions": [],
        }

        why = main._why_relevant(cluster, ["education", "ai"], ["global"], phase5, [])

        labels = " ".join(f["label"] for f in why["factors"])
        self.assertIn("Education", labels)
        self.assertIn("OpenAI", labels)
        self.assertGreaterEqual(why["score"], 50)

    def test_dashboard_comparison_reports_signal_and_pulse_differences(self):
        legacy = {
            "clusters": [
                {"signal_id": "old-1", "thread_title": "Nvidia chip demand", "pulse_score": 60},
                {"signal_id": "old-2", "thread_title": "OpenAI funding", "pulse_score": 70},
            ]
        }
        event_backed = {
            "clusters": [
                {"signal_id": "event-1", "thread_title": "Nvidia chip demand", "pulse_score": 76},
            ]
        }

        comparison = compare_dashboard_payloads(legacy, event_backed)

        self.assertEqual(comparison["legacy_signal_count"], 2)
        self.assertEqual(comparison["event_signal_count"], 1)
        self.assertEqual(comparison["clustering_difference"], -1)
        self.assertEqual(comparison["pulse_differences_by_title"]["Nvidia chip demand"], 16)


if __name__ == "__main__":
    unittest.main()
