from __future__ import annotations

from uuid import UUID

from app.models.signal import SignalRelationship
from app.pipeline.types import EnrichedArticle


def build_edges(batch: list[EnrichedArticle], id_by_index: dict[int, UUID]) -> list[SignalRelationship]:
    edges: list[SignalRelationship] = []
    seen: set[tuple[UUID, UUID, str]] = set()
    for index, item in enumerate(batch):
        source_id = id_by_index.get(index)
        if not source_id:
            continue
        for hint in item.relationships:
            target_id = id_by_index.get(hint.target_index)
            if not target_id or target_id == source_id:
                continue
            key = (source_id, target_id, hint.type[:40])
            if key in seen:
                continue
            seen.add(key)
            edges.append(
                SignalRelationship(
                    source_id=source_id,
                    target_id=target_id,
                    rel_type=hint.type[:40],
                    confidence=0.7,
                    reason=hint.reason[:500],
                )
            )
        source_names = {entity.name.lower() for entity in item.entities}
        if not source_names:
            continue
        for other_index, other in enumerate(batch):
            if other_index == index:
                continue
            target_id = id_by_index.get(other_index)
            if not target_id:
                continue
            overlap = source_names & {entity.name.lower() for entity in other.entities}
            if len(overlap) < 2:
                continue
            key = (source_id, target_id, "shared_entities")
            if key in seen:
                continue
            seen.add(key)
            edges.append(
                SignalRelationship(
                    source_id=source_id,
                    target_id=target_id,
                    rel_type="shared_entities",
                    confidence=min(0.9, 0.4 + 0.15 * len(overlap)),
                    reason=", ".join(sorted(overlap)[:4]),
                )
            )
    return edges
