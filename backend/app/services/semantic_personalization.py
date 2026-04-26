from __future__ import annotations

from typing import Any

from app.services.semantic_embeddings import cosine_similarity, embed_text


def profile_text(user_topics: list[str], user_regions: list[str], phase5: dict[str, Any]) -> str:
    parts = list(user_topics or []) + list(user_regions or [])
    parts.extend(str(item.get("entity_name", "")) for item in phase5.get("tracked_entities", []) if isinstance(item, dict))
    interactions = phase5.get("interactions", []) or []
    for item in interactions[:80]:
        signal_id = str(item.get("signal_id") or "").replace("-", " ")
        interaction = str(item.get("interaction_type") or "")
        if signal_id:
            parts.append(f"{interaction} {signal_id}")
    return " ".join(parts)


def event_text(cluster: dict, articles: list[dict] | None = None) -> str:
    article_ids = {str(item) for item in cluster.get("article_ids", [])}
    parts = [
        cluster.get("thread_title") or "",
        cluster.get("summary") or "",
        cluster.get("impact_line") or "",
        cluster.get("why_it_matters") or "",
        cluster.get("category") or "",
    ]
    for entity in cluster.get("entities") or []:
        if isinstance(entity, dict):
            parts.append(str(entity.get("name") or ""))
    for article in articles or []:
        if not article_ids or str(article.get("id")) in article_ids:
            parts.extend([article.get("title") or "", article.get("text_preview") or "", article.get("source") or ""])
    return " ".join(parts)


def semantic_relevance(cluster: dict, user_topics: list[str], user_regions: list[str], phase5: dict[str, Any], articles: list[dict] | None = None) -> dict[str, Any]:
    profile = profile_text(user_topics, user_regions, phase5)
    event = event_text(cluster, articles)
    if not profile.strip():
        score = 50
        similarity = 0.0
    else:
        similarity = cosine_similarity(embed_text(profile), embed_text(event))
        score = round(max(0.0, min(1.0, (similarity + 1) / 2)) * 100)
    dismissed = {item["signal_id"] for item in phase5.get("dismissed", []) if item.get("signal_id")}
    signal_id = cluster.get("signal_id") or cluster.get("thread_id")
    if signal_id in dismissed:
        score = 0
    return {
        "score": score,
        "similarity": round(similarity, 4),
        "model": "phase6_semantic_profile_event_relevance_v1",
        "factors": [
            {"label": "Semantic profile-event similarity", "points": score, "type": "semantic"},
        ],
    }
