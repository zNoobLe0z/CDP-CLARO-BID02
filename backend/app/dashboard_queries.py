"""Read-only engineering analytics; quantities remain separate from financial data."""

from datetime import date, timedelta
from decimal import Decimal
from math import ceil

from sqlalchemy import select

from .errors import invalid
from .models import ProductionRecord
from .queries import amount, catalog


def context(session, project, filters, end, start=None):
    if start and start > end:
        invalid("A data inicial deve ser anterior ou igual à referência.")
    items = catalog(session, project, filters)
    records = session.scalars(
        select(ProductionRecord)
        .where(
            ProductionRecord.project_id == project,
            ProductionRecord.scope_item_id.in_([item["id"] for item in items]),
            ProductionRecord.status == "active",
            ProductionRecord.execution_date <= end,
        )
        .order_by(ProductionRecord.execution_date, ProductionRecord.id)
    ).all()
    return items, records


def timeline(session, project, filters, end, start=None):
    items, records = context(session, project, filters, end, start)
    start = start or (records[0].execution_date if records else end)
    weight = sum((Decimal(item["production_weight"]) for item in items), Decimal(0))
    lookup = {item["id"]: item for item in items}
    changes = {}
    for record in records:
        item = lookup[record.scope_item_id]
        delta = (
            record.quantity / Decimal(item["planned_quantity"]) * Decimal(item["production_weight"])
        )
        changes[record.execution_date] = changes.get(record.execution_date, Decimal(0)) + delta

    def percent(value):
        return amount((value / weight * 100).quantize(Decimal("0.0001"))) if weight else None

    baseline = sum((value for day, value in changes.items() if day < start), Decimal(0))
    # Bound transport and rendering cost while preserving the exact closing point.
    step = max(1, ceil((end - start).days / 59))
    dates = {start, end}
    dates.update(
        start + timedelta(days=offset) for offset in range(0, (end - start).days + 1, step)
    )
    points = []
    if start > date.min:
        points.append(
            {
                "date": (start - timedelta(days=1)).isoformat(),
                "executed_percentage": percent(baseline),
                "planned_percentage": None,
            }
        )
    running = Decimal(0)
    ordered = iter(sorted(changes.items()))
    current = next(ordered, None)
    for day in sorted(dates):
        while current and current[0] <= day:
            running += current[1]
            current = next(ordered, None)
        points.append(
            {
                "date": day.isoformat(),
                "executed_percentage": percent(running),
                "planned_percentage": None,
            }
        )
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "baseline_percentage": percent(baseline),
        "delta_percentage_points": percent(running - baseline),
        "record_count": sum(record.execution_date >= start for record in records),
        "planned_available": False,
        "points": points if items else [],
    }


def stages(session, project, filters, end):
    items, records = context(session, project, filters, end)
    quantities, last = {}, {}
    for record in records:
        quantities[record.scope_item_id] = (
            quantities.get(record.scope_item_id, Decimal(0)) + record.quantity
        )
        last[record.scope_item_id] = record.execution_date.isoformat()
    groups = {}
    for item in items:
        key = (item["environment_id"], item["activity_id"])
        groups.setdefault(key, []).append(item)
    result = []
    for (environment, activity), subset in groups.items():
        weight = sum((Decimal(item["production_weight"]) for item in subset), Decimal(0))
        done = sum(
            (
                quantities.get(item["id"], Decimal(0))
                / Decimal(item["planned_quantity"])
                * Decimal(item["production_weight"])
                for item in subset
            ),
            Decimal(0),
        )
        percentage = done / weight * 100
        first = subset[0]
        result.append(
            {
                "environment_id": environment,
                "activity_id": activity,
                "floor_id": first["floor_id"],
                "discipline_id": first["discipline_id"],
                "environment_name": first["environment_name"],
                "floor_name": first["floor_name"],
                "activity_name": first["activity_name"],
                "discipline_name": first["discipline_name"],
                "percentage": amount(percentage.quantize(Decimal("0.0001"))),
                "total_items": len(subset),
                "completed_items": sum(
                    quantities.get(item["id"], Decimal(0)) >= Decimal(item["planned_quantity"])
                    for item in subset
                ),
                "status": "completed"
                if percentage >= 100
                else "in_progress"
                if percentage > 0
                else "not_started",
                "last_execution_date": max(
                    (last[item["id"]] for item in subset if item["id"] in last), default=None
                ),
                "budget": None,
                "schedule_deviation": None,
            }
        )
    return {
        "reference_date": end.isoformat(),
        "items": sorted(
            result,
            key=lambda row: (row["floor_name"], row["environment_name"], row["activity_name"]),
        ),
    }
