import json
import logging
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

import hf_client
from app.models.news import Article, Event
from app.services.event_clustering import entity_like_tokens, numeric_tokens, significant_tokens
from app.services.event_enrichment import clean_json_text
from app.services.semantic_embeddings import (
    EMBEDDING_MODEL,
    article_embedding_text,
    cosine_similarity,
    embed_text,
    event_embedding_text,
    text_hash,
)
from app.services.text_fingerprint import title_similarity

logger = logging.getLogger("news-intel-semantic-clustering")


class ClusterValidation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    same_event: bool
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str


@dataclass(slots=True)
class ClusterDecision:
    decision: Literal["merge", "reject", "ambiguous"]
    confidence: float
    method: str
    reason: str
    embedding_similarity: float


def ensure_article_embedding(article: Article) -> list[float]:
    text = article_embedding_text(article.title, article.text_preview, article.source)
    digest = text_hash(text)
    if article.embedding_json and article.embedding_text_hash == digest:
        return article.embedding_json
    article.embedding_json = embed_text(text)
    article.embedding_text_hash = digest
    article.embedding_model = EMBEDDING_MODEL
    return article.embedding_json


def event_embedding(event: Event) -> list[float]:
    metadata = dict(event.metadata_json or {})
    phase6 = metadata.get("phase6") if isinstance(metadata.get("phase6"), dict) else {}
    embedding = phase6.get("embedding")
    text = event_embedding_text(event.title, event.summary, event.category, event.region)
    digest = text_hash(text)
    if isinstance(embedding, list) and phase6.get("embedding_text_hash") == digest:
        return embedding
    embedding = embed_text(text)
    phase6["embedding"] = embedding
    phase6["embedding_model"] = EMBEDDING_MODEL
    phase6["embedding_text_hash"] = digest
    metadata["phase6"] = phase6
    event.metadata_json = metadata
    return embedding


def has_hard_conflict(left_title: str, right_title: str) -> bool:
    left_numbers = numeric_tokens(left_title)
    right_numbers = numeric_tokens(right_title)
    if left_numbers and right_numbers and left_numbers.isdisjoint(right_numbers):
        return True
    left_entities = entity_like_tokens(left_title)
    right_entities = entity_like_tokens(right_title)
    return bool(left_entities and right_entities and left_entities.isdisjoint(right_entities))


def rule_prefilter(left_title: str, right_title: str) -> Literal["reject", "strong", "ambiguous"]:
    if has_hard_conflict(left_title, right_title):
        return "reject"
    similarity = title_similarity(left_title, right_title)
    left_tokens = significant_tokens(left_title)
    right_tokens = significant_tokens(right_title)
    overlap = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
    if similarity >= 0.92 and overlap >= 0.68:
        return "strong"
    if similarity < 0.42 and overlap < 0.20:
        return "reject"
    return "ambiguous"


def embedding_decision(prefilter: str, similarity: float) -> ClusterDecision:
    if prefilter == "reject":
        return ClusterDecision("reject", 0.98, "rule_prefilter", "hard entity/number conflict or weak lexical match", similarity)
    if prefilter == "strong" and similarity >= 0.78:
        return ClusterDecision("merge", min(0.96, similarity), "rule_prefilter+embedding", "strong title and embedding agreement", similarity)
    if similarity >= 0.82:
        return ClusterDecision("merge", min(0.94, similarity), "embedding", "high embedding similarity", similarity)
    if similarity < 0.35:
        return ClusterDecision("reject", 1 - similarity, "embedding", "low embedding similarity", similarity)
    return ClusterDecision("ambiguous", similarity, "embedding", "ambiguous embedding band requires LLM validation", similarity)


def parse_validation(raw: str) -> ClusterValidation:
    return ClusterValidation.model_validate(json.loads(clean_json_text(raw)))


def validation_prompt(incoming_title: str, candidate_title: str, candidate_summary: str | None = None) -> str:
    return f"""You are NewsIntel's event clustering validator.

Question: Do these two article/event titles describe the same real-world event?

Return ONLY strict JSON:
{{
  "same_event": true,
  "confidence": 0.0,
  "reason": "short evidence-grounded explanation"
}}

Incoming: {incoming_title}
Candidate: {candidate_title}
Candidate context: {candidate_summary or ""}

Rules:
- same_event=true only when both refer to the same occurrence/update, not just same topic.
- Reject if they share a company/sector but describe different actions, forecasts, or time periods.
- Do not invent facts.
"""


async def validate_ambiguous_pair(incoming_title: str, candidate_title: str, candidate_summary: str | None = None) -> ClusterDecision:
    raw = await hf_client._call_openrouter(validation_prompt(incoming_title, candidate_title, candidate_summary), model="openrouter/auto")
    if not raw:
        raw = await hf_client._call_gemini(validation_prompt(incoming_title, candidate_title, candidate_summary))
    if not raw:
        return ClusterDecision("reject", 0.5, "llm_unavailable", "ambiguous pair rejected because LLM validation was unavailable", 0.0)
    try:
        validated = parse_validation(raw)
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        logger.warning("invalid clustering validation JSON: %s", exc)
        return ClusterDecision("reject", 0.5, "llm_invalid", "ambiguous pair rejected because LLM validation returned invalid JSON", 0.0)
    return ClusterDecision(
        "merge" if validated.same_event and validated.confidence >= 0.62 else "reject",
        validated.confidence,
        "llm_validation",
        validated.reason,
        0.0,
    )


async def compare_article_to_article(incoming_title: str, incoming_text: str, candidate: Article) -> ClusterDecision:
    incoming_embedding = embed_text(article_embedding_text(incoming_title, incoming_text, ""))
    candidate_embedding = ensure_article_embedding(candidate)
    similarity = cosine_similarity(incoming_embedding, candidate_embedding)
    decision = embedding_decision(rule_prefilter(incoming_title, candidate.title), similarity)
    if decision.decision != "ambiguous":
        return decision
    llm_decision = await validate_ambiguous_pair(incoming_title, candidate.title, candidate.text_preview)
    llm_decision.embedding_similarity = similarity
    return llm_decision


async def compare_article_to_event(incoming_title: str, incoming_text: str, event: Event) -> ClusterDecision:
    incoming_embedding = embed_text(article_embedding_text(incoming_title, incoming_text, ""))
    candidate_embedding = event_embedding(event)
    similarity = cosine_similarity(incoming_embedding, candidate_embedding)
    decision = embedding_decision(rule_prefilter(incoming_title, event.title), similarity)
    if decision.decision != "ambiguous":
        return decision
    llm_decision = await validate_ambiguous_pair(incoming_title, event.title, event.summary)
    llm_decision.embedding_similarity = similarity
    return llm_decision
