from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Header, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import Field, StrictInt, field_validator
from sqlalchemy import select

from .auth import administrator, db
from .errors import DomainError, invalid, missing
from .models import (
    Activity,
    CatalogAudit,
    Company,
    Discipline,
    Element,
    Environment,
    Floor,
    ProductionRecord,
    Project,
    Scope,
)
from .mutations import begin_operation
from .queries import amount, catalog
from .schemas import Input, decimal_text

Kind = Literal[
    "floors", "environments", "disciplines", "activities", "elements", "scope-items", "companies"
]
SPECS = {
    "floors": (Floor, ("name",)),
    "environments": (Environment, ("name", "floor_id")),
    "disciplines": (Discipline, ("name",)),
    "activities": (Activity, ("name", "discipline_id")),
    "elements": (Element, ("name", "code", "environment_id")),
    "scope-items": (
        Scope,
        (
            "element_id",
            "activity_id",
            "measurement_type",
            "unit",
            "planned_quantity",
            "production_weight",
        ),
    ),
    "companies": (Company, ("name",)),
}
PARENTS = {
    "floor_id": Floor,
    "environment_id": Environment,
    "discipline_id": Discipline,
    "element_id": Element,
    "activity_id": Activity,
}


class CatalogWrite(Input):
    id: str = Field(min_length=1, max_length=100)
    expected_version: StrictInt | None = Field(default=None, ge=1)
    reason: str = Field(min_length=5, max_length=1000)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, min_length=1, max_length=100)
    floor_id: str | None = Field(default=None, min_length=1, max_length=100)
    environment_id: str | None = Field(default=None, min_length=1, max_length=100)
    discipline_id: str | None = Field(default=None, min_length=1, max_length=100)
    element_id: str | None = Field(default=None, min_length=1, max_length=100)
    activity_id: str | None = Field(default=None, min_length=1, max_length=100)
    measurement_type: Literal["percentage", "unit"] | None = None
    unit: Literal["m2", "m", "un"] | None = None
    planned_quantity: str | None = None
    production_weight: str | None = None

    @field_validator(
        "id",
        "reason",
        "name",
        "code",
        "floor_id",
        "environment_id",
        "discipline_id",
        "element_id",
        "activity_id",
    )
    @classmethod
    def nonblank(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Não deixe o campo em branco.")
        return value.strip() if value is not None else value

    @field_validator("reason")
    @classmethod
    def reason_length(cls, value):
        if len(value) < 5:
            raise ValueError("Informe justificativa com ao menos cinco caracteres.")
        return value


def view(row):
    return jsonable_encoder(
        {
            column.name: getattr(row, column.name)
            for column in row.__table__.columns
            if column.name != "project_id"
        },
        custom_encoder={Decimal: amount},
    )


def lock_project(session, project):
    session.scalars(select(Project).where(Project.id == project).with_for_update()).one()


def values_for(kind, body):
    fields = SPECS[kind][1]
    values = body.model_dump(exclude_unset=True)
    extra = set(values) - set(fields) - {"id", "expected_version", "reason"}
    if extra or any(values.get(field) is None for field in fields):
        invalid("Preencha somente os campos obrigatórios deste cadastro.")
    data = {field: values[field] for field in fields}
    if kind == "scope-items":
        try:
            data["planned_quantity"] = Decimal(decimal_text(data["planned_quantity"]))
            data["production_weight"] = Decimal(decimal_text(data["production_weight"]))
        except ValueError as error:
            invalid(str(error))
        if data["planned_quantity"] <= 0 or data["production_weight"] <= 0:
            invalid("Quantidade e peso devem ser maiores que zero.")
        if data["measurement_type"] == "unit" and (
            data["unit"] != "un" or data["planned_quantity"] != 1
        ):
            invalid("Item unitário exige unidade un e quantidade prevista igual a um.")
    return data


def check_parents(session, project, data):
    for field, model in PARENTS.items():
        if field in data and session.get(model, (project, data[field])) is None:
            invalid(
                "O vínculo selecionado não existe nesta obra.",
                {field: "Selecione um cadastro da mesma obra."},
            )


def history_freeze(session, project, kind, row, data):
    protected = {
        "environments": ("floor_id",),
        "activities": ("discipline_id",),
        "elements": ("environment_id",),
        "scope-items": SPECS["scope-items"][1],
    }.get(kind, ())
    if not any(getattr(row, key) != data[key] for key in protected):
        return
    if kind == "scope-items":
        ids = [row.id]
    else:
        field = {"environments": "environment_id", "activities": "activity_id", "elements": None}[
            kind
        ]
        if kind == "elements":
            ids = list(
                session.scalars(
                    select(Scope.id).where(Scope.project_id == project, Scope.element_id == row.id)
                )
            )
        else:
            ids = [item["id"] for item in catalog(session, project, {field: row.id})]
    if ids:
        locked = session.scalars(
            select(Scope)
            .where(Scope.project_id == project, Scope.id.in_(ids))
            .order_by(Scope.id)
            .with_for_update()
        ).all()
        used = session.scalar(
            select(ProductionRecord.id)
            .where(ProductionRecord.project_id == project, ProductionRecord.scope_item_id.in_(ids))
            .limit(1)
        )
        if used or any(item.executed_quantity != 0 for item in locked):
            raise DomainError(
                409,
                "CATALOG_IN_USE",
                "O escopo já possui apontamentos. Quantidades, pesos e vínculos não podem ser alterados nesta etapa.",
            )


def audit(session, member, kind, entity_id, action, reason, before, after):
    session.add(
        CatalogAudit(
            project_id=member.project_id,
            entity_type=kind,
            entity_id=entity_id,
            action=action,
            reason=reason,
            before=before,
            after=after,
            author_id=member.user_id,
            author_name=member.display_name,
        )
    )


def save_entity(session, member, kind, body, key, updating=False):
    operation, replay = begin_operation(
        session,
        member,
        "catalog:" + kind,
        key,
        body.model_dump(mode="json") | {"updating": updating},
    )
    if replay is not None:
        return replay, 200
    lock_project(session, member.project_id)
    model, _fields = SPECS[kind]
    row = session.scalars(
        select(model)
        .where(model.project_id == member.project_id, model.id == body.id)
        .with_for_update()
    ).one_or_none()
    if updating and row is None:
        missing()
    if (
        (row is not None) != updating
        or (updating and row.version != body.expected_version)
        or (not updating and body.expected_version is not None)
    ):
        raise DomainError(
            409,
            "CATALOG_VERSION_CONFLICT",
            "Cadastro já existe ou foi alterado. Atualize os dados antes de salvar.",
        )
    data = values_for(kind, body)
    check_parents(session, member.project_id, data)
    if row:
        history_freeze(session, member.project_id, kind, row, data)
    if kind == "scope-items":
        duplicate = session.scalar(
            select(Scope.id).where(
                Scope.project_id == member.project_id,
                Scope.element_id == data["element_id"],
                Scope.activity_id == data["activity_id"],
                Scope.id != body.id,
            )
        )
        if duplicate:
            raise DomainError(
                409, "SCOPE_ALREADY_EXISTS", "Este elemento já possui escopo para esta atividade."
            )
    before = view(row) if row else None
    if row is None:
        row = model(project_id=member.project_id, id=body.id, **data)
        session.add(row)
    else:
        for field, value in data.items():
            setattr(row, field, value)
        row.version += 1
    session.flush()
    result = view(row)
    audit(
        session,
        member,
        kind,
        row.id,
        "update" if updating else "create",
        body.reason,
        before,
        result,
    )
    operation.response = result
    return result, 200 if updating else 201


def router():
    from typing import Annotated
    from uuid import UUID

    from sqlalchemy.orm import Session

    from .models import Membership

    api = APIRouter(prefix="/api/v1/projects/{project_id}/admin", tags=["Administration"])
    Db = Annotated[Session, Depends(db, scope="function")]
    Admin = Annotated[Membership, Depends(administrator, scope="function")]
    Key = Annotated[UUID, Header(alias="Idempotency-Key")]

    @api.get("/catalog/{kind}")
    def listing(project_id: str, kind: Kind, session: Db, _member: Admin):
        model = SPECS[kind][0]
        return {
            "items": [
                view(row)
                for row in session.scalars(
                    select(model).where(model.project_id == project_id).order_by(model.id)
                )
            ]
        }

    @api.post("/catalog/{kind}")
    def create(kind: Kind, body: CatalogWrite, key: Key, session: Db, member: Admin):
        result, status = save_entity(session, member, kind, body, key)
        return JSONResponse(result, status_code=status)

    @api.put("/catalog/{kind}/{entity_id}")
    def update(
        kind: Kind, entity_id: str, body: CatalogWrite, key: Key, session: Db, member: Admin
    ):
        if entity_id != body.id:
            invalid("O identificador não pode ser alterado.")
        result, status = save_entity(session, member, kind, body, key, updating=True)
        return JSONResponse(result, status_code=status)

    @api.get("/audit")
    def revisions(
        project_id: str,
        session: Db,
        _member: Admin,
        page: int = Query(1, ge=1),
        entity_type: str = "",
        entity_id: str = "",
    ):
        stmt = select(CatalogAudit).where(CatalogAudit.project_id == project_id)
        if entity_type:
            stmt = stmt.where(CatalogAudit.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(CatalogAudit.entity_id == entity_id)
        rows = session.scalars(
            stmt.order_by(CatalogAudit.created_at.desc(), CatalogAudit.id.desc())
            .offset((page - 1) * 20)
            .limit(20)
        ).all()
        return {"items": [view(row) for row in rows], "page": page}

    from .scope_import import ImportCommit, ImportPreview, commit_import, plan

    @api.post("/scope-import/preview")
    def import_preview(body: ImportPreview, session: Db, member: Admin):
        lock_project(session, member.project_id)
        return plan(session, member.project_id, body.csv_text)[0]

    @api.post("/scope-import")
    def import_scope(body: ImportCommit, key: Key, session: Db, member: Admin):
        result, status = commit_import(session, member, body, key)
        return JSONResponse(result, status_code=status)

    return api
