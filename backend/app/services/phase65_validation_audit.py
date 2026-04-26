from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.news import Article, Event, EventArticle
from app.services.dashboard_read_model import build_dashboard_payload
from app.services.semantic_clustering import has_hard_conflict, observability_snapshot
from app.services.semantic_embeddings import cosine_similarity
from app.services.text_fingerprint import title_similarity


def _event_id_for_article(article: Article) -> str | None:
    if not article.event_links:
        return None
    return str(article.event_links[0].event_id)


def _embedding(event_or_article: Any) -> list[float]:
    value = getattr(event_or_article, "embedding_json", None)
    return value if isinstance(value, list) else []


async def run_phase65_validation_audit(session: AsyncSession, *, limit: int = 100) -> dict[str, Any]:
    article_stmt = (
        select(Article)
        .options(selectinload(Article.event_links))
        .order_by(Article.first_seen_at.desc())
        .limit(limit)
    )
    articles = (await session.scalars(article_stmt)).unique().all()

    event_ids = {link.event_id for article in articles for link in article.event_links}
    event_stmt = (
        select(Event)
        .options(selectinload(Event.article_links).selectinload(EventArticle.article))
        .where(Event.id.in_(event_ids))
    )
    events = (await session.scalars(event_stmt)).unique().all() if event_ids else []

    duplicate_pairs = 0
    false_merges = 0
    false_splits = 0
    ambiguous_pairs_seen = int(observability_snapshot().get("ambiguous_pairs", 0))
    llm_validations = int(observability_snapshot().get("llm_validations", 0))

    for event in events:
        linked = [link.article for link in event.article_links if link.article]
        for index, left in enumerate(linked):
            for right in linked[index + 1:]:
                if title_similarity(left.title, right.title) >= 0.78 or cosine_similarity(_embedding(left), _embedding(right)) >= 0.86:
                    duplicate_pairs += 1
                if has_hard_conflict(left.title, right.title):
                    false_merges += 1

    by_event = {_event_id_for_article(article): article for article in articles}
    for index, left in enumerate(articles):
        for right in articles[index + 1:]:
            if _event_id_for_article(left) == _event_id_for_article(right):
                continue
            if title_similarity(left.title, right.title) >= 0.88 or cosine_similarity(_embedding(left), _embedding(right)) >= 0.90:
                false_splits += 1

    embeddings_on_articles = sum(1 for article in articles if article.embedding_json and article.embedding_text_hash)
    embeddings_on_events = sum(1 for event in events if event.embedding_json and event.embedding_text_hash)

    dashboard = await build_dashboard_payload(session, topics=[], regions=[], limit=30)
    personalized = await build_dashboard_payload(session, topics=["ai", "markets"], regions=["global"], limit=30)
    generic_titles = [cluster.get("thread_title") for cluster in dashboard.get("clusters", [])[:10]]
    personalized_titles = [cluster.get("thread_title") for cluster in personalized.get("clusters", [])[:10]]
    pulse_scores = [cluster.get("pulse_score", 0) for cluster in dashboard.get("clusters", [])]
    deltas = dashboard.get("daily_delta", []) or []

    event_article_counts = defaultdict(int)
    for article in articles:
        event_article_counts[_event_id_for_article(article)] += 1

    wrongly_ranked = [
        cluster.get("thread_title")
        for cluster in dashboard.get("clusters", [])
        if cluster.get("signal_tier") == "NOISE" and cluster.get("pulse_score", 0) >= 70
    ][:5]

    return {
        "status": "success",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sample": {"articles_checked": len(articles), "events_checked": len(events)},
        "clustering_quality": {
            "duplicate_articles_merged_correctly": duplicate_pairs,
            "false_merges": false_merges,
            "false_splits": false_splits,
            "events_with_embeddings": embeddings_on_events,
            "articles_with_embeddings": embeddings_on_articles,
            "ambiguous_pairs_needing_llm_validation": ambiguous_pairs_seen,
            "llm_validations_failed_or_skipped": max(0, ambiguous_pairs_seen - llm_validations),
        },
        "pulse_quality": {
            "scores_changing": len(set(pulse_scores)) > 1,
            "score_range": [min(pulse_scores), max(pulse_scores)] if pulse_scores else [0, 0],
        },
        "delta_quality": {
            "still_establishing_baseline": any(not item.get("has_baseline") for item in deltas),
            "delta_count": len(deltas),
        },
        "personalization_quality": {
            "rankings_differ_from_generic": personalized_titles != generic_titles,
            "generic_top_10": generic_titles,
            "profile_top_10": personalized_titles,
        },
        "wrongly_ranked_events": wrongly_ranked,
        "observability": observability_snapshot(),
        "top_5_remaining_backend_weaknesses": [
            "Live audit labels false splits/merges heuristically; add reviewer-confirmed labels for precision.",
            "Gemini embedding gateway shape depends on Cloud Command route support.",
            "Event embeddings are refreshed on compare, not by a background backfill job.",
            "Hard-conflict company/country detection is conservative and should move to NER-backed entity typing.",
            "Dashboard personalization still rebuilds profile embeddings per request until a user-profile embedding cache is added.",
        ],
        "exact_files_functions_to_fix": [
            "backend/app/services/semantic_embeddings.py::embed_text_result",
            "backend/app/services/semantic_clustering.py::has_hard_conflict",
            "backend/app/repositories/ingestion.py::_find_similar_event",
            "backend/app/services/semantic_personalization.py::semantic_relevance_async",
            "backend/app/services/phase65_validation_audit.py::run_phase65_validation_audit",
        ],
    }
