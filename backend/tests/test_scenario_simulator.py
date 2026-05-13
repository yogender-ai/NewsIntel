import json

from app.services.scenario_simulator import DISCLAIMER, fallback_scenario_result, parse_scenario_result


def test_parse_scenario_result_normalizes_probabilities():
    raw = json.dumps(
        {
            "summary": "A policy shock may raise public attention. The signal could spread if more sources confirm it.",
            "impact_score": 64,
            "confidence": 70,
            "impact_areas": [
                {"area": "public", "score": 65, "direction": "rising", "explanation": "Coverage may increase."},
                {"area": "policy", "score": 58, "direction": "mixed", "explanation": "Officials may respond."},
            ],
            "chain_reaction": [
                {"step": 1, "title": "Trigger", "description": "The story breaks."},
                {"step": 2, "title": "Response", "description": "Stakeholders respond."},
                {"step": 3, "title": "Follow-on", "description": "New coverage changes attention."},
            ],
            "possible_outcomes": [
                {"label": "Contained", "probability": 60, "description": "Facts settle quickly."},
                {"label": "Uncertain", "probability": 60, "description": "The story remains active."},
            ],
            "recommended_actions": ["Track source count."],
            "disclaimer": "wrong disclaimer",
        }
    )

    result = parse_scenario_result(raw)

    assert result.disclaimer == DISCLAIMER
    assert sum(item.probability for item in result.possible_outcomes) == 100


def test_fallback_scenario_result_returns_useful_structure():
    context = {
        "related_events": [
            {
                "id": "one",
                "title": "Major education policy dispute expands",
                "summary": "Officials are responding to public criticism.",
                "category": "education",
                "pulse_score": 72,
            }
        ]
    }

    result = fallback_scenario_result(
        "What if the education policy dispute escalates over 30 days?",
        {"severity": "high", "market_reaction": "medium", "time_horizon": "30d"},
        context,
    )

    assert result.impact_score >= 60
    assert len(result.chain_reaction) >= 4
    assert len(result.impact_areas) >= 3
    assert sum(item.probability for item in result.possible_outcomes) == 100
    assert result.disclaimer == DISCLAIMER
