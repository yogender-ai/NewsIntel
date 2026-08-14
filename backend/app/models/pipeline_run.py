import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(40), default="queued", nullable=False, index=True)
    trigger: Mapped[str] = mapped_column(String(40), default="schedule", nullable=False)
    stats: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    stages: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)

    signals = relationship("Signal", back_populates="run")
    snapshots = relationship("Snapshot", back_populates="run")
    pulse_samples = relationship("PulseSample", back_populates="run")

    __table_args__ = (Index("ix_pipeline_runs_started", "started_at"),)
