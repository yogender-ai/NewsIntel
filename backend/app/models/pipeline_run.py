import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(40), default="queued", nullable=False, index=True)
    trigger: Mapped[str] = mapped_column(String(40), default="schedule", nullable=False)
    stats: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSONB), default=dict, nullable=False)
    # MutableList so `run.stages.append(...)` is actually detected. With a plain
    # JSONB column SQLAlchemy never sees the in-place mutation, so every stage the
    # pipeline recorded was silently dropped on commit and the Pipeline page
    # rendered an empty rail.
    stages: Mapped[list] = mapped_column(MutableList.as_mutable(JSONB), default=list, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)

    signals = relationship("Signal", back_populates="run")
    snapshots = relationship("Snapshot", back_populates="run")
    pulse_samples = relationship("PulseSample", back_populates="run")

    __table_args__ = (Index("ix_pipeline_runs_started", "started_at"),)
