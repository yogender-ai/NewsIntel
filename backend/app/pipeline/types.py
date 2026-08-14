from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class ImageCandidate:
    url: str
    origin: str
    width: int | None = None
    height: int | None = None
    mime: str | None = None


@dataclass(slots=True)
class RawItem:
    source_id: str
    source_name: str
    category: str
    title: str
    url: str
    summary: str
    published_at: datetime | None
    image_candidates: list[ImageCandidate] = field(default_factory=list)


@dataclass(slots=True)
class Entity:
    name: str
    type: str
    score: float = 0.0


@dataclass(slots=True)
class RelHint:
    target_index: int
    type: str
    reason: str = ""


@dataclass(slots=True)
class CleanArticle:
    canonical_url: str
    url_hash: str
    title: str
    title_hash: str
    source_id: str
    source_name: str
    category: str
    summary: str
    image_url: str
    published_at: datetime | None


@dataclass(slots=True)
class EnrichedArticle:
    article: CleanArticle
    article_id: UUID | None = None
    entities: list[Entity] = field(default_factory=list)
    sentiment_label: str = "neutral"
    sentiment_score: float = 0.0
    all_scores: list[dict] = field(default_factory=list)
    hf_status: str = "pending"
    llm_summary: str = ""
    why_it_matters: str = ""
    llm_importance: int = 50
    llm_importance_reason: str = ""
    relationships: list[RelHint] = field(default_factory=list)
    llm_status: str = "pending"
    display_title: str = ""


@dataclass(slots=True)
class StageStat:
    name: str
    started_at: str
    finished_at: str | None = None
    elapsed_ms: int = 0
    counts: dict = field(default_factory=dict)
    error: str | None = None
