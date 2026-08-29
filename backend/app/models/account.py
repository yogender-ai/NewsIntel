"""Account, profile and session models for NewsIntel's own JWT auth.

These replace the Firebase-backed `users`/`preferences` tables. The important
addition over the old schema is `AccountProfile`: it stores who the reader actually
is — occupation, industry, seniority, employer, location — plus an embedding of that
profile. The profile embedding is what lets the pipeline answer "how does this story
affect *you*" instead of printing a generic impact line.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utcnow

PROFILE_EMBED_DIMS = 1024  # @cf/baai/bge-m3


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    # Null for OAuth-only accounts that never set a password.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(160))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    auth_provider: Mapped[str] = mapped_column(String(30), default="password", nullable=False)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profile: Mapped["AccountProfile | None"] = relationship(
        back_populates="account", uselist=False, cascade="all, delete-orphan"
    )
    sessions: Mapped[list["RefreshSession"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class AccountProfile(Base, TimestampMixin):
    """What the reader cares about, and who they are professionally."""

    __tablename__ = "account_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # ── Step 1: interests ──
    topics: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    regions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    muted_keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    # ── Step 2: who you are (drives the personal-impact layer) ──
    occupation: Mapped[str | None] = mapped_column(String(120))
    role_title: Mapped[str | None] = mapped_column(String(160))
    industry: Mapped[str | None] = mapped_column(String(120))
    seniority: Mapped[str | None] = mapped_column(String(60))
    employer: Mapped[str | None] = mapped_column(String(160))
    country: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(120))
    # Free text the reader writes about themselves; the strongest personalization signal.
    self_description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    goals: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    # ── Derived ──
    # Embedding of the composed profile text, matched against signal embeddings.
    profile_embedding: Mapped[list[float] | None] = mapped_column(Vector(PROFILE_EMBED_DIMS))
    profile_embedding_hash: Mapped[str | None] = mapped_column(String(64))
    profile_embedded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    digest_frequency: Mapped[str] = mapped_column(String(20), default="daily", nullable=False)
    reading_level: Mapped[str] = mapped_column(String(20), default="balanced", nullable=False)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_step: Mapped[int] = mapped_column(default=0, nullable=False)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    account: Mapped[Account] = relationship(back_populates="profile")

    def profile_text(self) -> str:
        """Compose the text that gets embedded for personal-impact matching."""
        parts = [
            f"Occupation: {self.occupation}" if self.occupation else "",
            f"Role: {self.role_title}" if self.role_title else "",
            f"Industry: {self.industry}" if self.industry else "",
            f"Seniority: {self.seniority}" if self.seniority else "",
            f"Employer: {self.employer}" if self.employer else "",
            f"Location: {', '.join(filter(None, [self.city, self.country]))}"
            if (self.city or self.country)
            else "",
            f"Goals: {', '.join(self.goals)}" if self.goals else "",
            f"Topics of interest: {', '.join(self.topics)}" if self.topics else "",
            f"Regions of interest: {', '.join(self.regions)}" if self.regions else "",
            f"Watching: {', '.join(self.keywords)}" if self.keywords else "",
            self.self_description or "",
        ]
        return "\n".join(part for part in parts if part).strip()


class RefreshSession(Base):
    """One long-lived refresh token per device/login.

    Only the SHA-256 of the token is stored, so a database leak cannot be replayed
    as a valid session.
    """

    __tablename__ = "refresh_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(300))
    ip_address: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    account: Mapped[Account] = relationship(back_populates="sessions")

    __table_args__ = (Index("ix_refresh_sessions_account_active", "account_id", "revoked_at"),)


class SignalFeedback(Base):
    """Explicit reader feedback, used to tune ranking over time."""

    __tablename__ = "signal_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    signal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("signals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # saved | dismissed | opened | more_like_this | less_like_this
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    dwell_seconds: Mapped[float] = mapped_column(default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (Index("ix_signal_feedback_account_action", "account_id", "action"),)
