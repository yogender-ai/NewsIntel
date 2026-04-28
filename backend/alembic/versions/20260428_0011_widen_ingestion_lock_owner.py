"""Widen ingestion lock owner metadata.

Revision ID: 20260428_0011
Revises: 20260427_0010
Create Date: 2026-04-28
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0011"
down_revision = "20260427_0010"
branch_labels = None
depends_on = None


def _tables():
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str):
    inspector = sa.inspect(op.get_bind())
    if table_name not in _tables():
        return {}
    return {column["name"]: column for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _columns("ingestion_locks")
    if "locked_by" in columns:
        op.alter_column(
            "ingestion_locks",
            "locked_by",
            existing_type=sa.String(length=160),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    columns = _columns("ingestion_locks")
    if "locked_by" in columns:
        op.alter_column(
            "ingestion_locks",
            "locked_by",
            existing_type=sa.Text(),
            type_=sa.String(length=160),
            existing_nullable=True,
        )
