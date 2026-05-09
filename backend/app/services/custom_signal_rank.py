from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MODEL_VERSION = "newsintel-signalrank-mlp-v1"
MODEL_PATH = Path(__file__).resolve().parents[2] / "ml_models" / "signalrank_v1.json"

FEATURES = [
    "source_count",
    "confidence",
    "freshness_6h",
    "freshness_24h",
    "velocity",
    "high_risk",
    "medium_risk",
    "high_opportunity",
    "medium_opportunity",
    "negative_or_mixed",
    "entity_density",
    "urgency_terms",
    "technology_topic",
    "politics_topic",
    "education_topic",
    "entertainment_topic",
]

URGENT_TERMS = {
    "attack",
    "ban",
    "breakthrough",
    "crash",
    "crisis",
    "cyberattack",
    "emergency",
    "explosion",
    "lawsuit",
    "outage",
    "probe",
    "recall",
    "risk",
    "shutdown",
    "strike",
    "surge",
    "warning",
}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _sigmoid(value: float) -> float:
    if value >= 0:
        z = math.exp(-value)
        return 1 / (1 + z)
    z = math.exp(value)
    return z / (1 + z)


def _relu(value: float) -> float:
    return max(0.0, value)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _age_hours(value: datetime | None) -> float:
    seen = _as_utc(value)
    if not seen:
        return 24.0
    return max(0.0, (datetime.now(timezone.utc) - seen).total_seconds() / 3600)


def _risk_value(value: Any) -> str:
    return str(value or "").strip().lower()


def _entities_count(values: Any) -> int:
    if isinstance(values, list):
        return len(values)
    return 0


def _urgency_score(text: str) -> float:
    tokens = set(re.findall(r"[a-z][a-z0-9\-]{2,}", (text or "").lower()))
    if not tokens:
        return 0.0
    return _clamp(len(tokens & URGENT_TERMS) / 3)


def signal_tier(score: float) -> str:
    if score >= 78:
        return "CRITICAL"
    if score >= 58:
        return "SIGNAL"
    if score >= 35:
        return "WATCH"
    return "NOISE"


def _category_features(category: str | None) -> list[float]:
    value = str(category or "").strip().lower()
    return [
        1.0 if value == "tech" else 0.0,
        1.0 if value == "politics" else 0.0,
        1.0 if value == "education" else 0.0,
        1.0 if value == "entertainment" else 0.0,
    ]


def event_features(event: Any, ai: dict[str, Any] | None = None) -> list[float]:
    ai = ai or {}
    age = _age_hours(getattr(event, "last_seen_at", None))
    source_count = int(getattr(event, "source_count", 1) or 1)
    text = f"{getattr(event, 'title', '')} {getattr(event, 'summary', '')} {ai.get('summary', '')} {ai.get('why_it_matters', '')}"
    risk = _risk_value(ai.get("risk_level"))
    opportunity = _risk_value(ai.get("opportunity_level"))
    sentiment = _risk_value(ai.get("sentiment"))
    return [
        _clamp(source_count / 5),
        _clamp(float(getattr(event, "confidence_score", 0.35) or 0.35)),
        _clamp(1 - age / 6),
        _clamp(1 - age / 24),
        _clamp((source_count / max(age, 1.0)) / 2),
        1.0 if risk == "high" else 0.0,
        1.0 if risk == "medium" else 0.0,
        1.0 if opportunity == "high" else 0.0,
        1.0 if opportunity == "medium" else 0.0,
        1.0 if sentiment in {"negative", "mixed"} else 0.0,
        _clamp(max(_entities_count(ai.get("entities")), _entities_count(getattr(event, "entities", []))) / 8),
        _urgency_score(text),
        *_category_features(getattr(event, "category", None)),
    ]


def story_features(story: Any) -> list[float]:
    age = _age_hours(getattr(story, "enriched_at", None) or getattr(story, "published_at", None))
    text = f"{getattr(story, 'display_title', '')} {getattr(story, 'summary', '')} {getattr(story, 'why_it_matters', '')}"
    risk = _risk_value(getattr(story, "risk_level", ""))
    sentiment = _risk_value(getattr(story, "sentiment", ""))
    return [
        0.2,
        0.55,
        _clamp(1 - age / 6),
        _clamp(1 - age / 24),
        _clamp(1 / max(age, 1.0) / 2),
        1.0 if risk == "high" else 0.0,
        1.0 if risk == "medium" else 0.0,
        0.0,
        0.0,
        1.0 if sentiment in {"negative", "mixed"} else 0.0,
        _clamp(_entities_count(getattr(story, "entities_json", [])) / 8),
        _urgency_score(text),
        *_category_features(getattr(story, "category", None)),
    ]


@dataclass(slots=True)
class SignalRankPrediction:
    score: int
    tier: str
    confidence: float
    model_version: str
    trained_examples: int
    feature_names: list[str]


class SignalRankModel:
    """Tiny local MLP trained from NewsIntel data, with deterministic seed weights."""

    def __init__(self, input_size: int = len(FEATURES), hidden_size: int = 8):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.trained_examples = 0
        self.w1, self.b1, self.w2, self.b2 = self._seed_weights(input_size, hidden_size)

    @staticmethod
    def _seed_weights(input_size: int, hidden_size: int) -> tuple[list[list[float]], list[float], list[float], float]:
        groups = [
            {"source_count": 1.5, "confidence": 0.9, "freshness_24h": 0.6},
            {"freshness_6h": 1.4, "velocity": 1.6, "urgency_terms": 0.8},
            {"high_risk": 1.4, "medium_risk": 0.8, "negative_or_mixed": 0.7},
            {"high_opportunity": 1.1, "medium_opportunity": 0.7, "entity_density": 0.4},
            {"entity_density": 1.0, "urgency_terms": 1.0, "source_count": 0.5},
            {"technology_topic": 0.35, "politics_topic": 0.35, "education_topic": 0.2, "entertainment_topic": 0.15},
            {"confidence": 1.1, "source_count": 0.9, "velocity": 0.5},
            {"freshness_6h": 0.7, "high_risk": 0.9, "high_opportunity": 0.8},
        ]
        index = {name: idx for idx, name in enumerate(FEATURES)}
        w1 = [[0.0 for _ in range(input_size)] for _ in range(hidden_size)]
        for row_index, weights in enumerate(groups[:hidden_size]):
            for name, weight in weights.items():
                w1[row_index][index[name]] = weight
        b1 = [-0.45, -0.35, -0.55, -0.5, -0.4, -0.25, -0.45, -0.5][:hidden_size]
        w2 = [0.75, 0.95, 0.8, 0.55, 0.65, 0.25, 0.7, 0.75][:hidden_size]
        b2 = -1.25
        return w1, b1, w2, b2

    def predict_probability(self, features: list[float]) -> float:
        hidden = [
            _relu(sum(weight * features[col] for col, weight in enumerate(row)) + self.b1[row_index])
            for row_index, row in enumerate(self.w1)
        ]
        logit = sum(weight * hidden[index] for index, weight in enumerate(self.w2)) + self.b2
        return _sigmoid(logit)

    def predict(self, features: list[float]) -> SignalRankPrediction:
        probability = self.predict_probability(features)
        score = round(probability * 100)
        confidence = round(0.58 + min(self.trained_examples, 1000) / 1000 * 0.27, 3)
        return SignalRankPrediction(
            score=score,
            tier=signal_tier(score),
            confidence=confidence,
            model_version=MODEL_VERSION,
            trained_examples=self.trained_examples,
            feature_names=FEATURES,
        )

    def train(self, rows: list[tuple[list[float], float]], *, epochs: int = 140, learning_rate: float = 0.035) -> None:
        if not rows:
            return
        for _epoch in range(epochs):
            for features, target in rows:
                hidden_pre = [
                    sum(weight * features[col] for col, weight in enumerate(row)) + self.b1[row_index]
                    for row_index, row in enumerate(self.w1)
                ]
                hidden = [_relu(value) for value in hidden_pre]
                probability = _sigmoid(sum(weight * hidden[index] for index, weight in enumerate(self.w2)) + self.b2)
                delta_out = probability - _clamp(target)

                old_w2 = list(self.w2)
                for i in range(self.hidden_size):
                    self.w2[i] -= learning_rate * delta_out * hidden[i]
                self.b2 -= learning_rate * delta_out

                for i in range(self.hidden_size):
                    if hidden_pre[i] <= 0:
                        continue
                    delta_hidden = delta_out * old_w2[i]
                    for j in range(self.input_size):
                        self.w1[i][j] -= learning_rate * delta_hidden * features[j]
                    self.b1[i] -= learning_rate * delta_hidden
        self.trained_examples += len(rows)

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": MODEL_VERSION,
            "features": FEATURES,
            "hidden_size": self.hidden_size,
            "trained_examples": self.trained_examples,
            "w1": self.w1,
            "b1": self.b1,
            "w2": self.w2,
            "b2": self.b2,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "SignalRankModel":
        model = cls(input_size=len(payload.get("features") or FEATURES), hidden_size=int(payload.get("hidden_size") or 8))
        model.trained_examples = int(payload.get("trained_examples") or 0)
        model.w1 = [[float(value) for value in row] for row in payload["w1"]]
        model.b1 = [float(value) for value in payload["b1"]]
        model.w2 = [float(value) for value in payload["w2"]]
        model.b2 = float(payload["b2"])
        return model


_MODEL: SignalRankModel | None = None


def load_model() -> SignalRankModel:
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    if MODEL_PATH.exists():
        try:
            payload = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
            if payload.get("version") == MODEL_VERSION and payload.get("features") == FEATURES:
                _MODEL = SignalRankModel.from_dict(payload)
                return _MODEL
        except (OSError, ValueError, KeyError, TypeError):
            pass
    _MODEL = SignalRankModel()
    return _MODEL


def save_model(model: SignalRankModel | None = None) -> None:
    target = model or load_model()
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(json.dumps(target.to_dict(), separators=(",", ":")), encoding="utf-8")


def predict_event_signal(event: Any, ai: dict[str, Any] | None = None) -> SignalRankPrediction:
    return load_model().predict(event_features(event, ai))


def predict_story_signal(story: Any) -> SignalRankPrediction:
    return load_model().predict(story_features(story))


def training_target_from_score(score: float, source_count: int = 1, engagement_bonus: float = 0.0) -> float:
    objective = _clamp(float(score or 0) / 100)
    source_bonus = _clamp(source_count / 5) * 0.18
    return _clamp(objective * 0.82 + source_bonus + engagement_bonus)
