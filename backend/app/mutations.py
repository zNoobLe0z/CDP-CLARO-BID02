import hashlib
import json
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from . import queries
from .errors import DomainError, conflict, invalid, missing
from .models import (
    Company,
    Element,
    Idempotency,
    Membership,
    ProductionRecord,
    Scope,
    Workforce,
    WorkforceRevision,
)
from .schemas import Correction, ProductionBatch, WorkforceInput


def begin_operation(session: Session, member: Membership, operation: str, key: UUID, payload: dict):
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    values = {
        "project_id": member.project_id,
        "user_id": member.user_id,
        "operation": operation,
        "key": key,
    }
    inserted = session.execute(
        insert(Idempotency)
        .values(**values, fingerprint=fingerprint)
        .on_conflict_do_nothing()
        .returning(Idempotency.key)
    ).scalar_one_or_none()
    row = session.get(Idempotency, (member.project_id, member.user_id, operation, key))
    if row.fingerprint != fingerprint:
        raise DomainError(
            409, "IDEMPOTENCY_CONFLICT", "A chave já foi utilizada com outro conteúdo."
        )
    if not inserted:
        if row.response is None:
            raise DomainError(
                409, "OPERATION_IN_PROGRESS", "A operação ainda está em processamento."
            )
        return row, row.response
    return row, None


def production(session: Session, member: Membership, batch: ProductionBatch, key: UUID):
    operation, replay = begin_operation(
        session, member, "production-batch", key, batch.model_dump(mode="json")
    )
    if replay is not None:
        return replay, 200
    ids = [entry.scope_item_id for entry in batch.entries]
    locked = session.scalars(
        select(Scope)
        .where(Scope.project_id == member.project_id, Scope.id.in_(ids))
        .order_by(Scope.id)
        .with_for_update()
    ).all()
    if len(locked) != len(ids):
        missing()
    lookup = {item.id: item for item in locked}
    contexts = set()
    updates = []
    for index, entry in enumerate(batch.entries):
        item = lookup[entry.scope_item_id]
        element = session.get(Element, (member.project_id, item.element_id))
        contexts.add((element.environment_id, item.activity_id))
        if item.version != entry.expected_version:
            conflict()
        if item.measurement_type != entry.measurement_type:
            invalid("Tipo de medição incompatível com o escopo.")
        if item.measurement_type == "unit":
            if item.executed_quantity:
                conflict("ALREADY_COMPLETED")
            increment = Decimal(1)
        else:
            increment = (item.planned_quantity * Decimal(entry.daily_percentage) / 100).quantize(
                Decimal("0.000001"), rounding=ROUND_HALF_UP
            )
        if increment <= 0 or item.executed_quantity + increment > item.planned_quantity:
            invalid(
                "O avanço informado ultrapassa o saldo ou é menor que a precisão de medição.",
                {f"entries.{index}.daily_percentage": "Revise o avanço e o saldo disponível."},
            )
        updates.append((item, element, increment))
    if len(contexts) != 1:
        invalid("Todos os itens devem pertencer à mesma atividade e ambiente.")
    batch_id = uuid4()
    for item, _element, increment in updates:
        item.executed_quantity += increment
        item.version += 1
        session.add(
            ProductionRecord(
                project_id=member.project_id,
                scope_item_id=item.id,
                batch_id=batch_id,
                execution_date=batch.execution_date,
                quantity=increment,
                author_id=member.user_id,
                author_name=member.display_name,
                observation=batch.observation.strip(),
            )
        )
    session.flush()
    result = {
        "batch_id": str(batch_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "items": [queries.scope_view(item, element) for item, element, _ in updates],
    }
    operation.response = result
    return result, 201


def correct(session: Session, member: Membership, record_id: UUID, change: Correction, key: UUID):
    operation, replay = begin_operation(
        session, member, "correction:" + str(record_id), key, change.model_dump(mode="json")
    )
    if replay is not None:
        return replay, 200
    original = session.get(ProductionRecord, (member.project_id, record_id))
    if not original:
        missing()
    item = session.scalars(
        select(Scope)
        .where(Scope.project_id == member.project_id, Scope.id == original.scope_item_id)
        .with_for_update()
    ).one()
    original = session.scalars(
        select(ProductionRecord)
        .where(ProductionRecord.project_id == member.project_id, ProductionRecord.id == record_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).one()
    if (
        original.status != "active"
        or original.version != change.expected_record_version
        or item.version != change.expected_scope_version
    ):
        conflict()
    quantity = Decimal(change.quantity)
    if item.measurement_type == "unit" and quantity not in (0, 1):
        invalid("Item unitário permite somente zero ou uma unidade.")
    if original.quantity == quantity:
        invalid("A correção deve alterar a quantidade.")
    accumulated = item.executed_quantity - original.quantity + quantity
    if accumulated < 0 or accumulated > item.planned_quantity:
        invalid("A correção ultrapassa o saldo do elemento.")
    original.status = "corrected"
    original.version += 1
    item.executed_quantity = accumulated
    item.version += 1
    replacement = ProductionRecord(
        project_id=member.project_id,
        scope_item_id=item.id,
        batch_id=uuid4(),
        execution_date=original.execution_date,
        quantity=quantity,
        author_id=member.user_id,
        author_name=member.display_name,
        observation=original.observation,
        replaces_id=original.id,
        correction_reason=change.reason,
    )
    session.add(replacement)
    session.flush()
    catalog_item = queries.catalog(session, member.project_id, {"scope_item_id": item.id})[0]
    result = queries.record_view(replacement, catalog_item)
    operation.response = result
    return result, 201


def workforce_view(row: Workforce, company: Company):
    return {
        "id": str(row.id),
        "company_id": row.company_id,
        "company_name": company.name,
        "execution_date": row.execution_date.isoformat(),
        "headcount": row.headcount,
        "observation": row.observation,
        "author_name": row.author_name,
        "updated_at": row.updated_at.isoformat(),
        "version": row.version,
    }


def workforce_save(
    session: Session, member: Membership, day, company_id: str, body: WorkforceInput, key: UUID
):
    payload = body.model_dump(mode="json") | {
        "execution_date": day.isoformat(),
        "company_id": company_id,
    }
    operation, replay = begin_operation(session, member, "workforce", key, payload)
    if replay is not None:
        return replay, 200
    company = session.get(Company, (member.project_id, company_id))
    if not company:
        missing()
    # Uma chave estável protege também a criação, quando ainda não há linha para bloquear.
    lock_bytes = hashlib.sha256(f"{member.project_id}:{day}:{company_id}".encode()).digest()[:8]
    lock_id = int.from_bytes(lock_bytes, "big", signed=True)
    from sqlalchemy import func

    session.execute(select(func.pg_advisory_xact_lock(lock_id)))
    row = session.scalars(
        select(Workforce)
        .where(
            Workforce.project_id == member.project_id,
            Workforce.company_id == company_id,
            Workforce.execution_date == day,
        )
        .with_for_update()
    ).one_or_none()
    if (row.version if row else None) != body.expected_version:
        conflict("WORKFORCE_VERSION_CONFLICT")
    status = 200 if row else 201
    if row:
        session.add(
            WorkforceRevision(
                project_id=member.project_id,
                workforce_id=row.id,
                version=row.version,
                headcount=row.headcount,
                observation=row.observation,
                author_name=row.author_name,
                updated_at=row.updated_at,
            )
        )
        row.version += 1
    else:
        row = Workforce(project_id=member.project_id, company_id=company_id, execution_date=day)
        session.add(row)
    row.headcount = body.headcount
    row.observation = body.observation.strip()
    row.author_name = member.display_name
    row.author_id = member.user_id
    row.updated_at = datetime.now(timezone.utc)
    session.flush()
    result = workforce_view(row, company)
    operation.response = result
    return result, status
