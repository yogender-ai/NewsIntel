import hashlib
import math
import re
from typing import Iterable

from app.services.text_fingerprint import normalize_title


EMBEDDING_MODEL = "newsintel-local-hash-embedding-v1"
DIMENSIONS = 192

SEMANTIC_ALIASES = {
    "ai": {"artificial", "intelligence", "llm", "model", "machine", "learning", "chip", "gpu", "semiconductor"},
    "markets": {"market", "stock", "shares", "nasdaq", "dow", "bond", "yield", "investor", "earnings"},
    "geopolitics": {"war", "military", "defense", "sanction", "election", "government", "china", "taiwan", "russia"},
    "energy": {"oil", "gas", "energy", "opec", "crude", "renewable", "power"},
    "climate": {"climate", "emissions", "carbon", "weather", "flood", "heat", "renewable"},
}


def text_hash(text: str) -> str:
    return hashlib.sha256((text or "").strip().lower().encode("utf-8")).hexdigest()


def tokens(text: str) -> list[str]:
    normalized = normalize_title(text or "")
    return [token for token in normalized.split() if len(token) >= 3]


def features(text: str) -> Iterable[tuple[str, float]]:
    items = tokens(text)
    for token in items:
        yield f"tok:{token}", 1.0
    for left, right in zip(items, items[1:]):
        yield f"bi:{left}_{right}", 1.4
    token_set = set(items)
    for label, aliases in SEMANTIC_ALIASES.items():
        overlap = token_set & aliases
        if overlap:
            yield f"topic:{label}", 1.0 + min(len(overlap) * 0.25, 1.0)


def embed_text(text: str, dimensions: int = DIMENSIONS) -> list[float]:
    vector = [0.0] * dimensions
    for feature, weight in features(text):
        digest = hashlib.sha256(feature.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1 if digest[4] % 2 == 0 else -1
        vector[index] += sign * weight
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 6) for value in vector]


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return max(-1.0, min(1.0, sum(float(a) * float(b) for a, b in zip(left, right))))


def article_embedding_text(title: str, preview: str | None = None, source: str | None = None) -> str:
    return " ".join(part for part in [title or "", preview or "", source or ""] if part).strip()


def event_embedding_text(title: str, summary: str | None = None, category: str | None = None, region: str | None = None) -> str:
    return " ".join(part for part in [title or "", summary or "", category or "", region or ""] if part).strip()
