import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utcnow


class RawArticle(Base, TimestampMixin):
    """Immutable-ish source snapshot captured before normalization or dedupe."""

    __tablename__ = "raw_articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    requested_url: Mapped[str | None] = mapped_column(Text)
    canonical_url: Mapped[str | None] = mapped_column(Text, index=True)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_title: Mapped[str] = mapped_column(Text, nullable=False)
    title_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    raw_html: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    parser_version: Mapped[str] = mapped_column(String(64), default="rss-v1", nullable=False)

    article_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("articles.id"))
    article: Mapped["Article | None"] = relationship(back_populates="raw_snapshots")

    __table_args__ = (
        Index("ix_raw_articles_source_url_hash", "source", "url_hash"),
        Index("ix_raw_articles_title_time", "title_hash", "published_at"),
    )


class Article(Base, TimestampMixin):
    """Canonical article row. One row per deduplicated article URL/story."""

    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_title: Mapped[str] = mapped_column(Text, nullable=False)
    title_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    author: Mapped[str | None] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    text_preview: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("articles.id"))
    dedupe_reason: Mapped[str | None] = mapped_column(String(120))

    raw_snapshots: Mapped[list[RawArticle]] = relationship(back_populates="article")
    event_links: Mapped[list["EventArticle"]] = relationship(back_populates="article")

    __table_args__ = (
        Index("ix_articles_title_published", "title_hash", "published_at"),
        Index("ix_articles_source_published", "source", "published_at"),
    )


class Event(Base, TimestampMixin):
    """Cluster of articles describing the same real-world event."""

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    region: Mapped[str | None] = mapped_column(String(80), index=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_meaningful_update_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entities: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    article_links: Mapped[list["EventArticle"]] = relationship(back_populates="event")

    __table_args__ = (
        Index("ix_events_category_updated", "category", "last_seen_at"),
        Index("ix_events_region_updated", "region", "last_seen_at"),
    )


class EventArticle(Base, TimestampMixin):
    """Many-to-many edge between canonical articles and events."""

    __tablename__ = "event_articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    article_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("articles.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(40), default="supporting", nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    event: Mapped[Event] = relationship(back_populates="article_links")
    article: Mapped[Article] = relationship(back_populates="event_links")

    __table_args__ = (
        UniqueConstraint("event_id", "article_id", name="uq_event_articles_event_article"),
        Index("ix_event_articles_article", "article_id"),
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    display_name: Mapped[str | None] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    preference: Mapped["Preference | None"] = relationship(back_populates="user", uselist=False)
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user")


class Preference(Base, TimestampMixin):
    __tablename__ = "preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    categories: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    regions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    tracked_entities: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    refresh_policy: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="preference")


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"))
    severity: Mapped[str] = mapped_column(String(30), default="info", nullable=False)
    alert_type: Mapped[str] = mapped_column(String(60), default="event_update", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    unread: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_user_unread", "user_id", "unread", "resolved"),
        Index("ix_alerts_event_type", "event_id", "alert_type"),
    )

