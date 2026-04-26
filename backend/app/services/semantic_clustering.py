import json
import logging
import re
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

import hf_client
from app.models.news import Article, Event
from app.services.event_clustering import entity_like_tokens, numeric_tokens, significant_tokens
from app.services.event_enrichment import clean_json_text
from app.services.semantic_embeddings import (
    article_embedding_text,
    cosine_similarity,
    embed_text_result,
    event_embedding_text,
    metrics as embedding_metrics,
    text_hash,
)
from app.services.text_fingerprint import title_similarity

logger = logging.getLogger("news-intel-semantic-clustering")

MERGE_THRESHOLD = 0.86
AMBIGUOUS_THRESHOLD = 0.72
CANDIDATE_LIMIT = 100

COUNTRY_TERMS = {
    "china", "taiwan", "russia", "ukraine", "israel", "iran", "india", "pakistan",
    "us", "u.s", "usa", "america", "united states", "uk", "britain", "france",
    "germany", "japan", "korea", "north korea", "south korea", "gaza", "syria",
    "yemen", "saudi", "qatar", "turkey",
}
COMPANY_TERMS = {
    "apple", "microsoft", "nvidia", "google", "alphabet", "amazon", "meta", "tesla",
    "openai", "amd", "intel", "qualcomm", "oracle", "salesforce", "boeing",
    "airbus", "samsung", "tsmc", "byd", "toyota", "ford", "gm",
}

clustering_metrics: dict[str, int | list[float]] = {
    "cosine_scores": [],
    "ambiguous_pairs": 0,
    "llm_validations": 0,
    "merges": 0,
    "rejects": 0,
}


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


async def ensure_article_embedding(article: Article) -> list[float]:
    text = article_embedding_text(article.title, article.text_preview, article.source)
    digest = text_hash(text)
    if article.embedding_json and article.embedding_text_hash == digest:
        embedding_metrics.cache_hits += 1
        return article.embedding_json
    result = await embed_text_result(text)
    article.embedding_json = result.vector
    article.embedding_text_hash = digest
    article.embedding_model = result.model
    article.embedding_created_at = result.created_at
    return article.embedding_json


async def event_embedding(event: Event) -> list[float]:
    text = event_embedding_text(event.title, event.summary, event.category, event.region)
    digest = text_hash(text)
    if event.embedding_json and event.embedding_text_hash == digest:
        embedding_metrics.cache_hits += 1
        return event.embedding_json
    result = await embed_text_result(text)
    event.embedding_json = result.vector
    event.embedding_model = result.model
    event.embedding_text_hash = digest
    event.embedding_created_at = result.created_at

    metadata = dict(event.metadata_json or {})
    phase6 = metadata.get("phase6") if isinstance(metadata.get("phase6"), dict) else {}
    phase6["embedding_provider_used"] = result.provider
    metadata["phase6"] = phase6
    event.metadata_json = metadata
    return event.embedding_json


async def create_article_embedding(article: Article, text: str) -> None:
    result = await embed_text_result(text)
    article.embedding_json = result.vector
    article.embedding_model = result.model
    article.embedding_text_hash = result.text_hash
    article.embedding_created_at = result.created_at


def _country_tokens(title: str) -> set[str]:
    normalized = f" {title.lower().replace('.', '')} "
    found = set()
    for term in COUNTRY_TERMS:
        if f" {term.replace('.', '')} " in normalized:
            found.add(term)
    return found


def _date_tokens(title: str) -> set[str]:
    return set(re.findall(r"\b(?:20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b", title.lower()))


def has_hard_conflict(left_title: str, right_title: str) -> bool:
    left_numbers = numeric_tokens(left_title)
    right_numbers = numeric_tokens(right_title)
    if left_numbers and right_numbers and left_numbers.isdisjoint(right_numbers):
        return True
    left_countries = _country_tokens(left_title)
    right_countries = _country_tokens(right_title)
    if left_countries and right_countries and left_countries.isdisjoint(right_countries):
        return True
    left_dates = _date_tokens(left_title)
    right_dates = _date_tokens(right_title)
    if left_dates and right_dates and left_dates.isdisjoint(right_dates):
        return True
    left_entities = entity_like_tokens(left_title)
    right_entities = entity_like_tokens(right_title)
    left_companies = left_entities & COMPANY_TERMS
    right_companies = right_entities & COMPANY_TERMS
    return bool(left_companies and right_companies and left_companies.isdisjoint(right_companies))


def rule_prefilter(left_title: str, right_title: str) -> Literal["reject", "strong", "ambiguous"]:
    if has_hard_conflict(left_title, right_title):
        return "reject"
    similarity = title_similarity(left_title, right_title)
    left_tokens = significant_tokens(left_title)
    right_tokens = significant_tokens(right_title)
    overlap = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
    if similarity >= 0.92 and overlap >= 0.68:
        return "strong"
    return "ambiguous"


def embedding_decision(prefilter: str, similarity: float) -> ClusterDecision:
    if prefilter == "reject":
        return ClusterDecision("reject", 0.98, "rule_prefilter", "hard entity/number conflict or weak lexical match", similarity)
    if prefilter == "strong" and similarity >= AMBIGUOUS_THRESHOLD:
        return ClusterDecision("merge", min(0.96, similarity), "rule_prefilter+embedding", "strong title and embedding agreement", similarity)
    if similarity >= MERGE_THRESHOLD:
        return ClusterDecision("merge", min(0.94, similarity), "embedding", "high embedding similarity", similarity)
    if similarity < AMBIGUOUS_THRESHOLD:
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
    clustering_metrics["llm_validations"] = int(clustering_metrics["llm_validations"]) + 1
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
    incoming_result = await embed_text_result(article_embedding_text(incoming_title, incoming_text, ""))
    incoming_embedding = incoming_result.vector
    candidate_embedding = await ensure_article_embedding(candidate)
    similarity = cosine_similarity(incoming_embedding, candidate_embedding)
    clustering_metrics["cosine_scores"].append(round(similarity, 4))
    decision = embedding_decision(rule_prefilter(incoming_title, candidate.title), similarity)
    if decision.decision != "ambiguous":
        clustering_metrics["merges" if decision.decision == "merge" else "rejects"] = int(clustering_metrics["merges" if decision.decision == "merge" else "rejects"]) + 1
        return decision
    clustering_metrics["ambiguous_pairs"] = int(clustering_metrics["ambiguous_pairs"]) + 1
    llm_decision = await validate_ambiguous_pair(incoming_title, candidate.title, candidate.text_preview)
    llm_decision.embedding_similarity = similarity
    clustering_metrics["merges" if llm_decision.decision == "merge" else "rejects"] = int(clustering_metrics["merges" if llm_decision.decision == "merge" else "rejects"]) + 1
    return llm_decision


async def compare_article_to_event(incoming_title: str, incoming_text: str, event: Event) -> ClusterDecision:
    incoming_result = await embed_text_result(article_embedding_text(incoming_title, incoming_text, ""))
    incoming_embedding = incoming_result.vector
    candidate_embedding = await event_embedding(event)
    similarity = cosine_similarity(incoming_embedding, candidate_embedding)
    clustering_metrics["cosine_scores"].append(round(similarity, 4))
    decision = embedding_decision(rule_prefilter(incoming_title, event.title), similarity)
    if decision.decision != "ambiguous":
        clustering_metrics["merges" if decision.decision == "merge" else "rejects"] = int(clustering_metrics["merges" if decision.decision == "merge" else "rejects"]) + 1
        return decision
    clustering_metrics["ambiguous_pairs"] = int(clustering_metrics["ambiguous_pairs"]) + 1
    llm_decision = await validate_ambiguous_pair(incoming_title, event.title, event.summary)
    llm_decision.embedding_similarity = similarity
    clustering_metrics["merges" if llm_decision.decision == "merge" else "rejects"] = int(clustering_metrics["merges" if llm_decision.decision == "merge" else "rejects"]) + 1
    return llm_decision


def observability_snapshot() -> dict:
    return {
        **embedding_metrics.snapshot(),
        "cosine_scores": list(clustering_metrics["cosine_scores"])[-200:],
        "ambiguous_pairs": clustering_metrics["ambiguous_pairs"],
        "llm_validations": clustering_metrics["llm_validations"],
        "merges": clustering_metrics["merges"],
        "rejects": clustering_metrics["rejects"],
        "thresholds": {
            "merge": MERGE_THRESHOLD,
            "ambiguous_low": AMBIGUOUS_THRESHOLD,
            "active_event_window_hours": "36-72 via ARTICLE_DUPLICATE_WINDOW_HOURS",
            "candidate_limit": CANDIDATE_LIMIT,
        },
    }
