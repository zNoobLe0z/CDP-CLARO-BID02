from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    MetaData,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(schema="cdp")


class Versioned:
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class Membership(Base):
    __tablename__ = "memberships"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))
    __table_args__ = (
        ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),
        CheckConstraint("role IN ('admin', 'editor', 'viewer')", name="membership_role"),
    )


class Floor(Versioned, Base):
    __tablename__ = "floors"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    __table_args__ = (ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),)


class Environment(Versioned, Base):
    __tablename__ = "environments"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    floor_id: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "floor_id"], ["cdp.floors.project_id", "cdp.floors.id"]
        ),
        Index("environment_floor", "project_id", "floor_id"),
    )


class Discipline(Versioned, Base):
    __tablename__ = "disciplines"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    __table_args__ = (ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),)


class Activity(Versioned, Base):
    __tablename__ = "activities"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    discipline_id: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "discipline_id"], ["cdp.disciplines.project_id", "cdp.disciplines.id"]
        ),
        Index("activity_discipline", "project_id", "discipline_id"),
    )


class Element(Versioned, Base):
    __tablename__ = "elements"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    environment_id: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "environment_id"], ["cdp.environments.project_id", "cdp.environments.id"]
        ),
        Index("element_environment", "project_id", "environment_id"),
    )


class Scope(Base):
    __tablename__ = "scope_items"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    element_id: Mapped[str] = mapped_column(String(100))
    activity_id: Mapped[str] = mapped_column(String(100))
    measurement_type: Mapped[str] = mapped_column(String(20))
    unit: Mapped[str] = mapped_column(String(10))
    planned_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    executed_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal(0))
    production_weight: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "element_id"], ["cdp.elements.project_id", "cdp.elements.id"]
        ),
        ForeignKeyConstraint(
            ["project_id", "activity_id"], ["cdp.activities.project_id", "cdp.activities.id"]
        ),
        UniqueConstraint("project_id", "element_id", "activity_id"),
        Index("scope_activity", "project_id", "activity_id"),
        CheckConstraint(
            "planned_quantity > 0 AND executed_quantity >= 0 AND executed_quantity <= planned_quantity",
            name="scope_quantities",
        ),
        CheckConstraint("production_weight > 0 AND version > 0", name="scope_weight_version"),
        CheckConstraint(
            "measurement_type IN ('percentage', 'unit') AND unit IN ('m2', 'm', 'un')",
            name="scope_measurement",
        ),
        CheckConstraint(
            "measurement_type <> 'unit' OR (unit = 'un' AND planned_quantity = 1 AND executed_quantity IN (0,1))",
            name="scope_binary",
        ),
    )


class ProductionRecord(Base):
    __tablename__ = "production_records"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    scope_item_id: Mapped[str] = mapped_column(String(100))
    batch_id: Mapped[UUID] = mapped_column(Uuid)
    execution_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    author_id: Mapped[UUID] = mapped_column(Uuid)
    author_name: Mapped[str] = mapped_column(String(200))
    observation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)
    replaces_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    correction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "scope_item_id"], ["cdp.scope_items.project_id", "cdp.scope_items.id"]
        ),
        ForeignKeyConstraint(
            ["project_id", "replaces_id"],
            ["cdp.production_records.project_id", "cdp.production_records.id"],
        ),
        UniqueConstraint("project_id", "replaces_id"),
        CheckConstraint(
            "quantity >= 0 AND version > 0 AND status IN ('active', 'corrected')",
            name="record_values",
        ),
        Index("record_scope", "project_id", "scope_item_id"),
        Index("record_date", "project_id", "execution_date", "created_at", "id"),
    )


class Idempotency(Base):
    __tablename__ = "idempotency"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    operation: Mapped[str] = mapped_column(String(200), primary_key=True)
    key: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),)


class Company(Versioned, Base):
    __tablename__ = "companies"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    __table_args__ = (ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),)


class Workforce(Base):
    __tablename__ = "workforce"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    company_id: Mapped[str] = mapped_column(String(100))
    execution_date: Mapped[date] = mapped_column(Date)
    headcount: Mapped[int] = mapped_column(Integer)
    observation: Mapped[str] = mapped_column(Text, default="")
    author_name: Mapped[str] = mapped_column(String(200))
    author_id: Mapped[UUID] = mapped_column(Uuid)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "company_id"], ["cdp.companies.project_id", "cdp.companies.id"]
        ),
        UniqueConstraint("project_id", "execution_date", "company_id"),
        Index("workforce_company", "project_id", "company_id"),
        CheckConstraint("headcount BETWEEN 0 AND 100000 AND version > 0", name="workforce_values"),
    )


class WorkforceRevision(Base):
    __tablename__ = "workforce_revisions"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    workforce_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    headcount: Mapped[int] = mapped_column(Integer)
    observation: Mapped[str] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(200))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "workforce_id"], ["cdp.workforce.project_id", "cdp.workforce.id"]
        ),
    )


class CatalogAudit(Base):
    __tablename__ = "catalog_audit"
    project_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(20))
    author_id: Mapped[UUID] = mapped_column(Uuid)
    author_name: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(Text)
    before: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        ForeignKeyConstraint(["project_id"], ["cdp.projects.id"]),
        Index("catalog_audit_entity", "project_id", "entity_type", "entity_id", "created_at"),
    )
