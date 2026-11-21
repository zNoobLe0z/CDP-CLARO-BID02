"""Create-only scope imports: shared preview/commit planner, no partial writes."""

import csv
import hashlib
import io
import json
from decimal import Decimal

from pydantic import Field, ValidationError, field_validator
from sqlalchemy import select

from .catalog_admin import SPECS, CatalogWrite, audit, lock_project, values_for, view
from .errors import DomainError, invalid
from .models import Scope
from .mutations import begin_operation
from .schemas import Input

COLUMNS = (
    "floor_id",
    "floor_name",
    "environment_id",
    "environment_name",
    "discipline_id",
    "discipline_name",
    "activity_id",
    "activity_name",
    "element_id",
    "element_code",
    "element_name",
    "scope_item_id",
    "measurement_type",
    "unit",
    "planned_quantity",
    "production_weight",
)
# Parent-first order is also the insertion order.
ENTITIES = {
    "floors": {"id": "floor_id", "name": "floor_name"},
    "disciplines": {"id": "discipline_id", "name": "discipline_name"},
    "environments": {"id": "environment_id", "name": "environment_name", "floor_id": "floor_id"},
    "activities": {"id": "activity_id", "name": "activity_name", "discipline_id": "discipline_id"},
    "elements": {
        "id": "element_id",
        "code": "element_code",
        "name": "element_name",
        "environment_id": "environment_id",
    },
    "scope-items": {"id": "scope_item_id", **{field: field for field in SPECS["scope-items"][1]}},
}


class ImportPreview(Input):
    csv_text: str = Field(min_length=1, max_length=1048576)

    @field_validator("csv_text")
    @classmethod
    def byte_limit(cls, value):
        if len(value.encode("utf-8")) > 1048576:
            raise ValueError("O arquivo deve ter no máximo 1 MiB em UTF-8.")
        if "\x00" in value or "\ufffd" in value:
            raise ValueError("Arquivo inválido. Salve o CSV em UTF-8.")
        return value


class ImportCommit(ImportPreview):
    digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    reason: str = Field(min_length=5, max_length=1000)

    @field_validator("reason")
    @classmethod
    def reason_required(cls, value):
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Informe justificativa com ao menos cinco caracteres.")
        return value


def problem(line, field, message):
    return {"line": line, "field": field, "message": message}


def parse(text):
    rows, issues = [], []
    first = text.lstrip("\ufeff").splitlines()[0] if text.lstrip("\ufeff").splitlines() else ""
    delimiter = ";" if first.count(";") > first.count(",") else ","
    reader = csv.reader(
        io.StringIO(text.lstrip("\ufeff"), newline=""), delimiter=delimiter, strict=True
    )
    try:
        header = [value.strip() for value in next(reader, [])]
        if len(header) != len(COLUMNS) or set(header) != set(COLUMNS):
            return [], [
                problem(
                    1,
                    "header",
                    "Cabeçalho inválido: use todas as 16 colunas do modelo, sem duplicatas ou colunas extras.",
                )
            ]
        while True:
            line = reader.line_num + 1
            cells = next(reader, None)
            if cells is None:
                break
            if not cells or not any(value.strip() for value in cells):
                continue
            if len(rows) >= 500:
                return [], [
                    problem(line, "file", "O arquivo deve conter no máximo 500 itens de escopo.")
                ]
            if len(cells) != len(header):
                issues.append(problem(line, "row", "A linha não possui as 16 colunas esperadas."))
                # Count malformed rows toward the limit too.
                rows.append((line, None))
                continue
            row = dict(zip(header, (value.strip() for value in cells), strict=True))
            for field in ("planned_quantity", "production_weight"):
                row[field] = row[field].replace(",", ".")
            rows.append((line, row))
    except csv.Error:
        issues.append(
            problem(
                reader.line_num,
                "file",
                "CSV malformado: confira aspas, delimitadores e tamanho dos campos.",
            )
        )
    if not rows and not issues:
        issues.append(problem(2, "file", "O arquivo não possui itens de escopo."))
    return rows, issues


def canonical(value):
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        default=lambda obj: str(obj) if isinstance(obj, Decimal) else obj,
    )


def plan(session, project, text):
    rows, issues = parse(text)
    definitions = {kind: {} for kind in ENTITIES}
    scopes = set()
    preview_rows = []
    for line, row in rows:
        if row is None:
            continue
        if row["scope_item_id"] in scopes:
            issues.append(
                problem(line, "scope_item_id", "Identificador de escopo repetido no arquivo.")
            )
        scopes.add(row["scope_item_id"])
        preview_rows.append({"line": line, **row})
        for kind, mapping in ENTITIES.items():
            data = {field: row[column] for field, column in mapping.items()}
            try:
                body = CatalogWrite.model_validate(data | {"reason": "Importação de escopo"})
                values = values_for(kind, body)
                entity_id = body.id
            except ValidationError as error:
                for detail in error.errors():
                    field = str(detail["loc"][0])
                    issues.append(
                        problem(
                            line, mapping.get(field, field), "Campo obrigatório ou valor inválido."
                        )
                    )
                continue
            except DomainError as error:
                issues.append(problem(line, "scope_item_id", error.message))
                continue
            previous = definitions[kind].get(entity_id)
            if previous and previous[0] != values:
                issues.append(
                    problem(
                        line,
                        mapping["id"],
                        "O mesmo identificador possui dados diferentes no arquivo.",
                    )
                )
            else:
                definitions[kind][entity_id] = (values, line)
    additions, snapshots = {}, {}
    counts = {}
    for kind, entries in definitions.items():
        model = SPECS[kind][0]
        existing = (
            {
                row.id: row
                for row in session.scalars(
                    select(model).where(model.project_id == project, model.id.in_(entries))
                )
            }
            if entries
            else {}
        )
        snapshots[kind] = [view(existing[key]) for key in sorted(existing)]
        additions[kind] = {}
        for entity_id, (data, line) in entries.items():
            current = existing.get(entity_id)
            if current is None:
                additions[kind][entity_id] = data
            elif any(getattr(current, field) != value for field, value in data.items()):
                issues.append(
                    problem(
                        line,
                        ENTITIES[kind]["id"],
                        "Cadastro existente diverge do arquivo. Corrija o CSV ou revise o cadastro individualmente.",
                    )
                )
        counts[kind] = {"create": len(additions[kind]), "reuse": len(existing)}
    # Also detect duplicate element/activity under a different scope identifier.
    elements = {data[0]["element_id"] for data in definitions["scope-items"].values()}
    occupied = (
        {
            (row.element_id, row.activity_id): row.id
            for row in session.scalars(
                select(Scope).where(Scope.project_id == project, Scope.element_id.in_(elements))
            )
        }
        if elements
        else {}
    )
    snapshots["scope-pairs"] = sorted((a, b, entity_id) for (a, b), entity_id in occupied.items())
    for entity_id, (data, line) in definitions["scope-items"].items():
        pair = (data["element_id"], data["activity_id"])
        if pair in occupied and occupied[pair] != entity_id:
            issues.append(
                problem(
                    line,
                    "scope_item_id",
                    "Elemento e atividade já possuem outro identificador de escopo.",
                )
            )
        occupied[pair] = entity_id
    digest = hashlib.sha256(
        canonical({"project": project, "rows": preview_rows, "state": snapshots}).encode()
    ).hexdigest()
    response = {
        "valid": not issues,
        "digest": digest,
        "row_count": len(rows),
        "counts": counts,
        "errors": issues[:100],
        "error_count": len(issues),
        "rows": preview_rows,
    }
    return response, additions


def commit_import(session, member, body, key):
    operation, replay = begin_operation(
        session, member, "scope-csv-import", key, body.model_dump(mode="json")
    )
    if replay is not None:
        return replay, 200
    lock_project(session, member.project_id)
    preview, additions = plan(session, member.project_id, body.csv_text)
    if preview["digest"] != body.digest:
        raise DomainError(
            409,
            "IMPORT_PREVIEW_STALE",
            "O catálogo mudou desde a prévia. Valide o arquivo novamente.",
        )
    if not preview["valid"]:
        invalid("A importação possui erros. Revise a prévia antes de confirmar.")
    for kind, entries in additions.items():
        model = SPECS[kind][0]
        for entity_id, data in entries.items():
            row = model(project_id=member.project_id, id=entity_id, **data)
            session.add(row)
            session.flush()
            audit(session, member, kind, entity_id, "create", body.reason, None, view(row))
    result = {"row_count": preview["row_count"], "counts": preview["counts"], "digest": body.digest}
    operation.response = result
    return result, 201
