from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from .errors import invalid
from .models import Activity, Discipline, Element, Environment, Floor, ProductionRecord, Scope


def amount(value: Decimal):
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def scope_view(item: Scope, element: Element):
    return {
        "id": item.id,
        "element_code": element.code,
        "element_name": element.name,
        "measurement_type": item.measurement_type,
        "unit": item.unit,
        "planned_quantity": amount(item.planned_quantity),
        "executed_quantity": amount(item.executed_quantity),
        "version": item.version,
    }


def catalog_statement(project: str, filters: dict | None = None):
    stmt = (
        select(Scope, Element, Environment, Floor, Activity, Discipline)
        .join(Element, and_(Scope.project_id == Element.project_id, Scope.element_id == Element.id))
        .join(
            Environment,
            and_(
                Element.project_id == Environment.project_id,
                Element.environment_id == Environment.id,
            ),
        )
        .join(
            Floor,
            and_(Environment.project_id == Floor.project_id, Environment.floor_id == Floor.id),
        )
        .join(
            Activity,
            and_(Scope.project_id == Activity.project_id, Scope.activity_id == Activity.id),
        )
        .join(
            Discipline,
            and_(
                Activity.project_id == Discipline.project_id,
                Activity.discipline_id == Discipline.id,
            ),
        )
        .where(Scope.project_id == project)
    )
    columns = {
        "floor_id": Floor.id,
        "environment_id": Environment.id,
        "discipline_id": Discipline.id,
        "activity_id": Activity.id,
        "scope_item_id": Scope.id,
    }
    for key, value in (filters or {}).items():
        if value and key in columns:
            stmt = stmt.where(columns[key] == value)
    return stmt


def validate_filters(session: Session, project: str, filters: dict):
    entities = {
        "floor_id": Floor,
        "environment_id": Environment,
        "discipline_id": Discipline,
        "activity_id": Activity,
        "scope_item_id": Scope,
    }
    selected = {}
    for key, model in entities.items():
        if filters.get(key):
            selected[key] = session.get(model, (project, filters[key]))
            if not selected[key]:
                invalid(
                    "Seleção não pertence a esta obra.",
                    {key: "Escolha um item disponível na obra."},
                )
    env = selected.get("environment_id")
    activity = selected.get("activity_id")
    item = selected.get("scope_item_id")
    if env and filters.get("floor_id") and env.floor_id != filters["floor_id"]:
        invalid("O ambiente não pertence ao andar selecionado.")
    if (
        activity
        and filters.get("discipline_id")
        and activity.discipline_id != filters["discipline_id"]
    ):
        invalid("A atividade não pertence à disciplina selecionada.")
    if item:
        element = session.get(Element, (project, item.element_id))
        item_env = session.get(Environment, (project, element.environment_id))
        item_activity = session.get(Activity, (project, item.activity_id))
        actual = {
            "floor_id": item_env.floor_id,
            "environment_id": item_env.id,
            "discipline_id": item_activity.discipline_id,
            "activity_id": item_activity.id,
        }
        if any(filters.get(key) and filters[key] != value for key, value in actual.items()):
            invalid("O elemento não pertence ao contexto selecionado.")
    if env and (filters.get("activity_id") or filters.get("discipline_id")):
        if session.execute(catalog_statement(project, filters).limit(1)).first() is None:
            invalid("O serviço não está no escopo deste ambiente.")


def catalog(session: Session, project: str, filters: dict | None = None):
    if filters:
        validate_filters(session, project, filters)
    rows = session.execute(
        catalog_statement(project, filters).order_by(
            Floor.name, Environment.name, Activity.name, Element.code
        )
    ).all()
    return [
        scope_view(item, element)
        | {
            "floor_id": floor.id,
            "floor_name": floor.name,
            "environment_id": env.id,
            "environment_name": env.name,
            "discipline_id": discipline.id,
            "discipline_name": discipline.name,
            "activity_id": activity.id,
            "activity_name": activity.name,
            "production_weight": amount(item.production_weight),
        }
        for item, element, env, floor, activity, discipline in rows
    ]


def record_view(record: ProductionRecord, item: dict):
    return {
        "id": str(record.id),
        "scope_item_id": record.scope_item_id,
        "element_code": item["element_code"],
        "element_name": item["element_name"],
        "activity_name": item["activity_name"],
        "environment_name": item["environment_name"],
        "execution_date": record.execution_date.isoformat(),
        "created_at": record.created_at.isoformat(),
        "quantity": amount(record.quantity),
        "unit": item["unit"],
        "measurement_type": item["measurement_type"],
        "author_name": record.author_name,
        "observation": record.observation,
        "status": record.status,
        "version": record.version,
        "scope_version": item["version"],
        "replaces_id": str(record.replaces_id) if record.replaces_id else None,
        "correction_reason": record.correction_reason,
    }


def history(
    session: Session,
    project: str,
    filters: dict,
    page: int,
    page_size: int,
    start_date: date | None,
    end_date: date | None,
    search: str,
    status: str,
):
    if start_date and end_date and start_date > end_date:
        invalid("A data inicial deve ser anterior ou igual à final.")
    items = catalog(session, project, filters)
    lookup = {item["id"]: item for item in items}
    stmt = select(ProductionRecord).where(
        ProductionRecord.project_id == project, ProductionRecord.scope_item_id.in_(lookup)
    )
    if start_date:
        stmt = stmt.where(ProductionRecord.execution_date >= start_date)
    if end_date:
        stmt = stmt.where(ProductionRecord.execution_date <= end_date)
    if status:
        stmt = stmt.where(ProductionRecord.status == status)
    if search.strip():
        term = search.strip().casefold()
        ids = [
            key
            for key, item in lookup.items()
            if term
            in " ".join(
                item[name]
                for name in ("element_code", "element_name", "activity_name", "environment_name")
            ).casefold()
        ]
        try:
            record_id = UUID(search.strip())
        except ValueError:
            record_id = None
        stmt = stmt.where(
            (ProductionRecord.scope_item_id.in_(ids)) | (ProductionRecord.id == record_id)
            if record_id
            else ProductionRecord.scope_item_id.in_(ids)
        )
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    records = session.scalars(
        stmt.order_by(
            ProductionRecord.execution_date.desc(),
            ProductionRecord.created_at.desc(),
            ProductionRecord.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [record_view(record, lookup[record.scope_item_id]) for record in records],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def dashboard(session: Session, project: str, filters: dict, reference: date):
    items = catalog(session, project, filters)
    rows = session.scalars(
        select(ProductionRecord).where(
            ProductionRecord.project_id == project,
            ProductionRecord.scope_item_id.in_([item["id"] for item in items]),
            ProductionRecord.status == "active",
            ProductionRecord.execution_date <= reference,
        )
    ).all()
    quantities = {}
    daily = {}
    lookup = {item["id"]: item for item in items}
    for row in rows:
        quantities[row.scope_item_id] = quantities.get(row.scope_item_id, Decimal(0)) + row.quantity
        item = lookup[row.scope_item_id]
        key = (row.execution_date.isoformat(), item["activity_id"], item["unit"])
        daily[key] = daily.get(key, Decimal(0)) + row.quantity

    def progress(item):
        return quantities.get(item["id"], Decimal(0)) / Decimal(item["planned_quantity"])

    def percent(subset):
        weight = sum((Decimal(item["production_weight"]) for item in subset), Decimal(0))
        if not weight:
            return None
        value = (
            sum(
                (progress(item) * Decimal(item["production_weight"]) for item in subset), Decimal(0)
            )
            / weight
            * 100
        )
        return amount(value.quantize(Decimal("0.0001")))

    groups = []
    for discipline in sorted({item["discipline_id"] for item in items}):
        subset = [item for item in items if item["discipline_id"] == discipline]
        groups.append(
            {
                "id": discipline,
                "name": subset[0]["discipline_name"],
                "percentage": percent(subset),
                "total_items": len(subset),
                "completed_items": sum(progress(item) >= 1 for item in subset),
            }
        )
    activities = {item["activity_id"]: item["activity_name"] for item in items}
    return {
        "reference_date": reference.isoformat(),
        "overall_percentage": percent(items),
        "total_items": len(items),
        "not_started_items": sum(progress(item) == 0 for item in items),
        "in_progress_items": sum(0 < progress(item) < 1 for item in items),
        "completed_items": sum(progress(item) >= 1 for item in items),
        "disciplines": groups,
        "daily_production": [
            {
                "date": key[0],
                "activity_name": activities[key[1]],
                "unit": key[2],
                "quantity": amount(value),
            }
            for key, value in sorted(daily.items(), reverse=True)
            if value > 0
        ],
    }


def options(session: Session, project: str, kind: str, filters: dict):
    validate_filters(session, project, filters)
    if kind == "floors":
        return [
            {"id": row.id, "name": row.name}
            for row in session.scalars(
                select(Floor).where(Floor.project_id == project).order_by(Floor.name)
            )
        ]
    if kind == "environments":
        return [
            {"id": row.id, "name": row.name}
            for row in session.scalars(
                select(Environment)
                .where(
                    Environment.project_id == project, Environment.floor_id == filters["floor_id"]
                )
                .order_by(Environment.name)
            )
        ]
    items = catalog(session, project, filters)
    if kind == "scope-items":
        return items
    prefix = "discipline" if kind == "disciplines" else "activity"
    unique = {item[prefix + "_id"]: item[prefix + "_name"] for item in items}
    return [
        {"id": key, "name": value}
        for key, value in sorted(unique.items(), key=lambda pair: pair[1])
    ]
