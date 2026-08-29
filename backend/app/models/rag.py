"""Retrieval corpus for Ask NewsIntel.

The old `/api/ask` scored stories by counting how many query words appeared in the
title. This replaces that with a real chunked corpus: every signal is split into
overlapping passages, each passage carries a bge-m3 embedding plus a Postgres
tsvector, and retrieval runs both halves (vector + lexical) before a cross-encoder
rerank. Storing chunks rather than whole articles is what makes citations point at
the specific passage that supports a claim.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Computed, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow

CHUNK_EMBED_DIMS = 1024  # @cf/baai/bge-m3


class SignalChunk(Base):
    __tablename__ = "signal_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("signals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    # title | summary | why_it_matters | body
    section: Mapped[str] = mapped_column(String(30), default="body", nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_estimate: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(CHUNK_EMBED_DIMS))
    embedding_model: Mapped[str | None] = mapped_column(String(80))
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Denormalised so retrieval can filter/display without joining signals.
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    source_name: Mapped[str | None] = mapped_column(String(160))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Maintained by Postgres so lexical search never drifts from `content`.
    search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR, Computed("to_tsvector('english', content)", persisted=True)
    )

    __table_args__ = (
        UniqueConstraint("signal_id", "chunk_index", name="uq_signal_chunk_index"),
        Index("ix_signal_chunks_search", "search_vector", postgresql_using="gin"),
        Index("ix_signal_chunks_published", "published_at"),
    )
