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
    embedding_json: Mapped[list[float]] = mapped_column(JSONB, default=list, nullable=False)
    embedding_model: Mapped[str | None] = mapped_column(String(80))
    embedding_text_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    embedding_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
    embedding_json: Mapped[list[float]] = mapped_column(JSONB, default=list, nullable=False)
    embedding_model: Mapped[str | None] = mapped_column(String(80))
    embedding_text_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    embedding_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    article_links: Mapped[list["EventArticle"]] = relationship(back_populates="event")
    outgoing_relationships: Mapped[list["EventRelationship"]] = relationship(
        foreign_keys="EventRelationship.source_event_id",
        back_populates="source_event",
    )
    incoming_relationships: Mapped[list["EventRelationship"]] = relationship(
        foreign_keys="EventRelationship.target_event_id",
        back_populates="target_event",
    )

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


class EventRelationship(Base, TimestampMixin):
    """AI-validated relationship edge between two event clusters."""

    __tablename__ = "event_relationships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    target_event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(40), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    pair_hash: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)

    source_event: Mapped[Event] = relationship(foreign_keys=[source_event_id], back_populates="outgoing_relationships")
    target_event: Mapped[Event] = relationship(foreign_keys=[target_event_id], back_populates="incoming_relationships")

    __table_args__ = (
        Index("ix_event_relationships_source", "source_event_id"),
        Index("ix_event_relationships_target", "target_event_id"),
        Index("ix_event_relationships_type_confidence", "relationship_type", "confidence"),
    )


class EventRelationshipCheck(Base, TimestampMixin):
    """Pair-level cache for relationship validation, including disconnected pairs."""

    __tablename__ = "event_relationship_checks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pair_hash: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    source_event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    target_event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    candidate_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="checked")
    reason: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_event_relationship_checks_source_target", "source_event_id", "target_event_id"),
    )


class ScenarioRun(Base):
    """Stored AI scenario analysis run. Scenario output is analysis, not prediction."""

    __tablename__ = "scenario_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    base_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"))
    assumptions_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    result_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    provider_used: Mapped[str] = mapped_column(String(120), nullable=False)
    scenario_hash: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    display_name: Mapped[str | None] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    preference: Mapped["Preference | None"] = relationship(back_populates="user", uselist=False)
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user")
    alert_rules: Mapped[list["AlertRule"]] = relationship(back_populates="user")
    daily_digests: Mapped[list["DailyDigest"]] = relationship(back_populates="user")


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
    rule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("alert_rules.id"))
    severity: Mapped[str] = mapped_column(String(30), default="info", nullable=False)
    alert_type: Mapped[str] = mapped_column(String(60), default="event_update", nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    reason_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="unread", nullable=False)
    fingerprint: Mapped[str | None] = mapped_column(String(96), index=True)
    unread: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="alerts")
    rule: Mapped["AlertRule | None"] = relationship(back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_user_unread", "user_id", "unread", "resolved"),
        Index("ix_alerts_event_type", "event_id", "alert_type"),
        Index("ix_alerts_user_status_created", "user_id", "status", "created_at"),
        Index("ix_alerts_fingerprint_created", "fingerprint", "created_at"),
    )


class AlertRule(Base, TimestampMixin):
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    rule_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(60), default="any", nullable=False)
    target_value: Mapped[str] = mapped_column(String(255), default="*", nullable=False)
    threshold: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=360, nullable=False)

    user: Mapped[User] = relationship(back_populates="alert_rules")
    alerts: Mapped[list[Alert]] = relationship(back_populates="rule")

    __table_args__ = (
        Index("ix_alert_rules_user_type", "user_id", "rule_type", "enabled"),
    )


class DailyDigest(Base):
    __tablename__ = "daily_digests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    digest_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    summary_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    provider_used: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="daily_digests")
    delivery_logs: Mapped[list["DigestDeliveryLog"]] = relationship(back_populates="digest")

    __table_args__ = (
        UniqueConstraint("user_id", "digest_date", name="uq_daily_digests_user_date"),
        Index("ix_daily_digests_user_date", "user_id", "digest_date"),
    )


class DigestDeliveryLog(Base):
    __tablename__ = "digest_delivery_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    digest_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_digests.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(40), default="api", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="created", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)

    digest: Mapped[DailyDigest] = relationship(back_populates="delivery_logs")
