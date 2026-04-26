"""Repair partially migrated Phase 7 alerts schema.

Revision ID: 20260427_0008
Revises: 20260426_0007
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260427_0008"
down_revision = "20260426_0007"
branch_labels = None
depends_on = None


def _inspector():
    return sa.inspect(op.get_bind())


def _tables() -> set[str]:
    return set(_inspector().get_table_names())


def _columns(table_name: str) -> set[str]:
    if table_name not in _tables():
        return set()
    return {column["name"] for column in _inspector().get_columns(table_name)}


def _foreign_keys(table_name: str) -> set[str]:
    if table_name not in _tables():
        return set()
    return {fk["name"] for fk in _inspector().get_foreign_keys(table_name) if fk.get("name")}


def upgrade() -> None:
    columns = _columns("alerts")
    if "event_id" not in columns:
        op.add_column("alerts", sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True))
    if "rule_id" not in columns:
        op.add_column("alerts", sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True))
    if "severity" not in columns:
        op.add_column("alerts", sa.Column("severity", sa.String(length=30), nullable=False, server_default="info"))
    if "alert_type" not in columns:
        op.add_column("alerts", sa.Column("alert_type", sa.String(length=60), nullable=False, server_default="event_update"))
    if "title" not in columns:
        op.add_column("alerts", sa.Column("title", sa.Text(), nullable=True))
    if "message" not in columns:
        op.add_column("alerts", sa.Column("message", sa.Text(), nullable=False, server_default=""))
    if "reason_json" not in columns:
        op.add_column("alerts", sa.Column("reason_json", postgresql.JSONB(), nullable=False, server_default="{}"))
    if "status" not in columns:
        op.add_column("alerts", sa.Column("status", sa.String(length=30), nullable=False, server_default="unread"))
    if "fingerprint" not in columns:
        op.add_column("alerts", sa.Column("fingerprint", sa.String(length=96), nullable=True))
    if "unread" not in columns:
        op.add_column("alerts", sa.Column("unread", sa.Boolean(), nullable=False, server_default=sa.true()))
    if "resolved" not in columns:
        op.add_column("alerts", sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "delivered_at" not in columns:
        op.add_column("alerts", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    if "read_at" not in columns:
        op.add_column("alerts", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    if "dismissed_at" not in columns:
        op.add_column("alerts", sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True))
    if "created_at" not in columns:
        op.add_column("alerts", sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    if "updated_at" not in columns:
        op.add_column("alerts", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))

    foreign_keys = _foreign_keys("alerts")
    if "fk_alerts_event_id_events" not in foreign_keys:
        op.create_foreign_key("fk_alerts_event_id_events", "alerts", "events", ["event_id"], ["id"])
    if "fk_alerts_rule_id_alert_rules" not in foreign_keys:
        op.create_foreign_key("fk_alerts_rule_id_alert_rules", "alerts", "alert_rules", ["rule_id"], ["id"])

    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_event_type ON alerts (event_id, alert_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_user_unread ON alerts (user_id, unread, resolved)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_user_status_created ON alerts (user_id, status, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_fingerprint_created ON alerts (fingerprint, created_at)")


def downgrade() -> None:
    pass
