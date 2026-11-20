"""Versioned administrative catalogs and immutable change history."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "6c1b8e185d8b"
down_revision = "a559fc91c3c5"
branch_labels = None
depends_on = None
TABLES = ("floors", "environments", "disciplines", "activities", "elements", "companies")


def upgrade():
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            schema="cdp",
        )
    op.create_table(
        "catalog_audit",
        sa.Column("project_id", sa.String(100), primary_key=True),
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("author_name", sa.String(200), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("before", postgresql.JSONB(), nullable=True),
        sa.Column("after", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),
        schema="cdp",
    )
    op.create_index(
        "catalog_audit_entity",
        "catalog_audit",
        ["project_id", "entity_type", "entity_id", "created_at"],
        schema="cdp",
    )


def downgrade():
    op.drop_table("catalog_audit", schema="cdp")
    for table in reversed(TABLES):
        op.drop_column(table, "version", schema="cdp")
