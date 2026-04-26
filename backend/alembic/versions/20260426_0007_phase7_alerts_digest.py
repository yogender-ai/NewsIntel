"""Add Phase 7 alert rules and daily digests.

Revision ID: 20260426_0007
Revises: 20260426_0006
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260426_0007"
down_revision = "20260426_0006"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_type", sa.String(length=60), nullable=False),
        sa.Column("target_type", sa.String(length=60), nullable=False, server_default="any"),
        sa.Column("target_value", sa.String(length=255), nullable=False, server_default="*"),
        sa.Column("threshold", sa.Float(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="360"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_rules_user_id", "alert_rules", ["user_id"])
    op.create_index("ix_alert_rules_rule_type", "alert_rules", ["rule_type"])
    op.create_index("ix_alert_rules_user_type", "alert_rules", ["user_id", "rule_type", "enabled"])

    alert_columns = _columns("alerts")
    if "rule_id" not in alert_columns:
        op.add_column("alerts", sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key("fk_alerts_rule_id_alert_rules", "alerts", "alert_rules", ["rule_id"], ["id"])
    if "title" not in alert_columns:
        op.add_column("alerts", sa.Column("title", sa.Text(), nullable=True))
    if "reason_json" not in alert_columns:
        op.add_column("alerts", sa.Column("reason_json", postgresql.JSONB(), nullable=False, server_default="{}"))
    if "status" not in alert_columns:
        op.add_column("alerts", sa.Column("status", sa.String(length=30), nullable=False, server_default="unread"))
    if "fingerprint" not in alert_columns:
        op.add_column("alerts", sa.Column("fingerprint", sa.String(length=96), nullable=True))
    if "read_at" not in alert_columns:
        op.add_column("alerts", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    if "dismissed_at" not in alert_columns:
        op.add_column("alerts", sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_fingerprint_created ON alerts (fingerprint, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_user_status_created ON alerts (user_id, status, created_at)")

    op.create_table(
        "daily_digests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("digest_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("summary_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("provider_used", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "digest_date", name="uq_daily_digests_user_date"),
    )
    op.create_index("ix_daily_digests_user_id", "daily_digests", ["user_id"])
    op.create_index("ix_daily_digests_digest_date", "daily_digests", ["digest_date"])
    op.create_index("ix_daily_digests_user_date", "daily_digests", ["user_id", "digest_date"])

    op.create_table(
        "digest_delivery_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("digest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.String(length=40), nullable=False, server_default="api"),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="created"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["digest_id"], ["daily_digests.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_digest_delivery_logs_digest_id", "digest_delivery_logs", ["digest_id"])
    op.create_index("ix_digest_delivery_logs_user_id", "digest_delivery_logs", ["user_id"])


def downgrade() -> None:
    op.drop_table("digest_delivery_logs")
    op.drop_table("daily_digests")
    op.drop_index("ix_alerts_user_status_created", table_name="alerts")
    op.drop_index("ix_alerts_fingerprint_created", table_name="alerts")
    alert_columns = _columns("alerts")
    for column in ("dismissed_at", "read_at", "fingerprint", "status", "reason_json", "title"):
        if column in alert_columns:
            op.drop_column("alerts", column)
    if "rule_id" in alert_columns:
        op.drop_constraint("fk_alerts_rule_id_alert_rules", "alerts", type_="foreignkey")
        op.drop_column("alerts", "rule_id")
    op.drop_table("alert_rules")
