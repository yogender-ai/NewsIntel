import hashlib
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

import hf_client
from app.services.text_fingerprint import normalize_title


LOCAL_EMBEDDING_MODEL = "newsintel-local-hash-embedding-v1"
DEFAULT_HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_MODEL = DEFAULT_HF_EMBEDDING_MODEL
DIMENSIONS = 192

logger = logging.getLogger("news-intel-semantic-embeddings")

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


@dataclass(slots=True)
class EmbeddingResult:
    vector: list[float]
    model: str
    provider: str
    text_hash: str
    created_at: datetime
    cache_hit: bool = False


@dataclass(slots=True)
class EmbeddingMetrics:
    embedding_provider_used: dict[str, int] = field(default_factory=dict)
    embeddings_created_count: int = 0
    cache_hits: int = 0
    provider_failures: dict[str, int] = field(default_factory=dict)

    def provider_used(self, provider: str) -> None:
        self.embedding_provider_used[provider] = self.embedding_provider_used.get(provider, 0) + 1

    def provider_failed(self, provider: str) -> None:
        self.provider_failures[provider] = self.provider_failures.get(provider, 0) + 1

    def snapshot(self) -> dict[str, Any]:
        return {
            "embedding_provider_used": dict(self.embedding_provider_used),
            "embeddings_created_count": self.embeddings_created_count,
            "cache_hits": self.cache_hits,
            "provider_failures": dict(self.provider_failures),
        }


metrics = EmbeddingMetrics()
_embedding_cache: dict[str, EmbeddingResult] = {}


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


def _normalize_vector(values: Iterable[Any]) -> list[float]:
    vector = [float(value) for value in values]
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 8) for value in vector]


def _parse_embedding_payload(data: Any) -> tuple[list[float], str] | None:
    if not data:
        return None
    if isinstance(data, str):
        return None
    if isinstance(data, list) and data and all(isinstance(item, int | float) for item in data):
        return _normalize_vector(data), DEFAULT_HF_EMBEDDING_MODEL
    if not isinstance(data, dict):
        return None

    model = str(data.get("model") or data.get("embedding_model") or DEFAULT_HF_EMBEDDING_MODEL)
    candidate = data.get("embedding") or data.get("vector") or data.get("embeddings")
    if isinstance(candidate, list) and candidate:
        first = candidate[0]
        if isinstance(first, list):
            candidate = first
        if all(isinstance(item, int | float) for item in candidate):
            return _normalize_vector(candidate), model

    nested = data.get("data")
    if isinstance(nested, list) and nested:
        first = nested[0]
        if isinstance(first, dict):
            candidate = first.get("embedding") or first.get("vector")
            if isinstance(candidate, list) and all(isinstance(item, int | float) for item in candidate):
                return _normalize_vector(candidate), model
    return None


async def _hf_embedding(text: str) -> tuple[list[float], str] | None:
    if not getattr(hf_client, "GATEWAY_SECRET", ""):
        return None
    for endpoint in ("embed", "embed_text", "embeddings"):
        data = await hf_client._call_hf(endpoint, text)
        if isinstance(data, dict) and data.get("error"):
            continue
        parsed = _parse_embedding_payload(data)
        if parsed:
            return parsed
    return None


async def _gemini_embedding(text: str) -> tuple[list[float], str] | None:
    if not getattr(hf_client, "GATEWAY_SECRET", ""):
        return None
    data = await hf_client._call_gemini_embedding(text)
    return _parse_embedding_payload(data)


async def embed_text_result(text: str, *, force_refresh: bool = False) -> EmbeddingResult:
    digest = text_hash(text)
    if not force_refresh and digest in _embedding_cache:
        cached = _embedding_cache[digest]
        metrics.cache_hits += 1
        metrics.provider_used(cached.provider)
        return EmbeddingResult(
            vector=cached.vector,
            model=cached.model,
            provider=cached.provider,
            text_hash=cached.text_hash,
            created_at=cached.created_at,
            cache_hit=True,
        )

    created_at = datetime.now(timezone.utc)
    for provider, caller in (("huggingface", _hf_embedding), ("gemini", _gemini_embedding)):
        try:
            parsed = await caller(text)
        except Exception as exc:
            metrics.provider_failed(provider)
            logger.warning("%s embedding provider failed: %s", provider, exc)
            continue
        if parsed:
            vector, model = parsed
            result = EmbeddingResult(vector, model, provider, digest, created_at)
            _embedding_cache[digest] = result
            metrics.embeddings_created_count += 1
            metrics.provider_used(provider)
            return result
        metrics.provider_failed(provider)

    result = EmbeddingResult(embed_text(text), LOCAL_EMBEDDING_MODEL, "local_hash_fallback", digest, created_at)
    _embedding_cache[digest] = result
    metrics.embeddings_created_count += 1
    metrics.provider_used(result.provider)
    return result


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return max(-1.0, min(1.0, sum(float(a) * float(b) for a, b in zip(left, right))))


def article_embedding_text(title: str, preview: str | None = None, source: str | None = None) -> str:
    return " ".join(part for part in [title or "", preview or "", source or ""] if part).strip()


def event_embedding_text(title: str, summary: str | None = None, category: str | None = None, region: str | None = None) -> str:
    return " ".join(part for part in [title or "", summary or "", category or "", region or ""] if part).strip()
