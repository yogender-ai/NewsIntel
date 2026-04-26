"""Replace legacy text alerts table with Phase 7 UUID alerts table.

Revision ID: 20260427_0009
Revises: 20260427_0008
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260427_0009"
down_revision = "20260427_0008"
branch_labels = None
depends_on = None


def _column_type(table_name: str, column_name: str):
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return None
    for column in inspector.get_columns(table_name):
        if column["name"] == column_name:
            return column["type"]
    return None


def upgrade() -> None:
    alert_id_type = _column_type("alerts", "id")
    if alert_id_type is not None and not isinstance(alert_id_type, postgresql.UUID):
        op.execute("ALTER INDEX IF EXISTS ix_alerts_event_type RENAME TO ix_legacy_alerts_event_type")
        op.execute("ALTER INDEX IF EXISTS ix_alerts_user_id RENAME TO ix_legacy_alerts_user_id")
        op.execute("ALTER INDEX IF EXISTS ix_alerts_user_unread RENAME TO ix_legacy_alerts_user_unread")
        op.execute("ALTER INDEX IF EXISTS ix_alerts_user_status_created RENAME TO ix_legacy_alerts_user_status_created")
        op.execute("ALTER INDEX IF EXISTS ix_alerts_fingerprint_created RENAME TO ix_legacy_alerts_fingerprint_created")
        op.execute("ALTER TABLE alerts RENAME TO legacy_alerts_20260427")

    if _column_type("alerts", "id") is None:
        op.create_table(
            "alerts",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("severity", sa.String(length=30), nullable=False, server_default="info"),
            sa.Column("alert_type", sa.String(length=60), nullable=False, server_default="event_update"),
            sa.Column("title", sa.Text(), nullable=True),
            sa.Column("message", sa.Text(), nullable=False, server_default=""),
            sa.Column("reason_json", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="unread"),
            sa.Column("fingerprint", sa.String(length=96), nullable=True),
            sa.Column("unread", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
            sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_alerts_event_type", "alerts", ["event_id", "alert_type"])
        op.create_index("ix_alerts_user_id", "alerts", ["user_id"])
        op.create_index("ix_alerts_user_unread", "alerts", ["user_id", "unread", "resolved"])
        op.create_index("ix_alerts_user_status_created", "alerts", ["user_id", "status", "created_at"])
        op.create_index("ix_alerts_fingerprint_created", "alerts", ["fingerprint", "created_at"])


def downgrade() -> None:
    pass
