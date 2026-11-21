import csv
import io
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CatalogAudit, Floor, Membership, Scope
from app.scope_import import COLUMNS
from tests.conftest import EDITOR
from tests.test_production import PREFIX, headers

PATH = PREFIX + "/admin/scope-import"
ROW = [
    "csv-floor",
    "Andar CSV",
    "csv-room",
    "Sala CSV",
    "csv-discipline",
    "Acabamento CSV",
    "csv-activity",
    "Pintura CSV",
    "csv-wall",
    "PAR-CSV",
    "Parede CSV",
    "csv-scope",
    "percentage",
    "m2",
    "10.5",
    "2",
]


def csv_text(rows=None, delimiter=",", bom=False):
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=delimiter)
    writer.writerow(COLUMNS)
    writer.writerows(rows if rows is not None else [ROW])
    return ("\ufeff" if bom else "") + output.getvalue()


def preview(client, text=None):
    response = client.post(PATH + "/preview", json={"csv_text": text or csv_text()})
    assert response.status_code == 200, response.text
    return response.json()


def body(client, text=None):
    text = text or csv_text()
    return {
        "csv_text": text,
        "digest": preview(client, text)["digest"],
        "reason": "Carga inicial conferida",
    }


def test_preview_has_no_writes_then_atomic_import_and_replay(client, seeded):
    data = body(client)
    with Session(seeded) as session:
        assert session.get(Floor, ("claro-bi02", "csv-floor")) is None
    key = headers()
    response = client.post(PATH, json=data, headers=key)
    assert response.status_code == 201, response.text
    assert response.json()["counts"]["scope-items"] == {"create": 1, "reuse": 0}
    assert client.post(PATH, json=data, headers=key).json() == response.json()
    with Session(seeded) as session:
        assert session.get(Scope, ("claro-bi02", "csv-scope")).executed_quantity == 0
        assert session.scalar(select(func.count()).select_from(CatalogAudit)) == 6
    again = preview(client)
    assert again["valid"]
    assert all(count["create"] == 0 for count in again["counts"].values())
    assert (
        client.post(PATH, json=data | {"reason": "Outra justificativa"}, headers=key).status_code
        == 409
    )


def test_semicolon_bom_quoted_multiline_and_decimal_comma(client):
    row = ROW.copy()
    row[9] = "00001"
    row[10] = 'Parede; lateral "A"\nface interna'
    row[14] = "10,5"
    text = csv_text([row], delimiter=";", bom=True)
    data = preview(client, text)
    assert data["valid"], data
    assert data["rows"][0]["element_code"] == "00001"
    assert data["rows"][0]["planned_quantity"] == "10.5"
    assert client.post(PATH, json=body(client, text), headers=headers()).status_code == 201


def test_invalid_rows_reject_whole_file(client, seeded):
    bad = ROW.copy()
    bad[11] = "invalid-binary"
    bad[12] = "unit"
    data = preview(client, csv_text([ROW, bad]))
    assert not data["valid"] and data["errors"][0]["line"] == 3
    response = client.post(
        PATH,
        json={
            "csv_text": csv_text([ROW, bad]),
            "digest": data["digest"],
            "reason": "Carga inicial conferida",
        },
        headers=headers(),
    )
    assert response.status_code == 422
    with Session(seeded) as session:
        assert session.get(Floor, ("claro-bi02", "csv-floor")) is None


def test_duplicate_ids_conflicting_shared_parents_and_pairs(client):
    assert not preview(client, csv_text([ROW, ROW]))["valid"]
    changed = ROW.copy()
    changed[1] = "Outro nome para mesmo andar"
    changed[11] = "other-scope"
    result = preview(client, csv_text([ROW, changed]))
    assert not result["valid"]
    assert any(error["field"] == "floor_id" for error in result["errors"])
    changed[1] = ROW[1]
    assert not preview(client, csv_text([ROW, changed]))["valid"]


def test_stale_preview_requires_validation_again(client):
    data = body(client)
    created = client.post(
        PREFIX + "/admin/catalog/floors",
        json={"id": "csv-floor", "name": "Andar CSV", "reason": "Cadastro em outra aba"},
        headers=headers(),
    )
    assert created.status_code == 201
    response = client.post(PATH, json=data, headers=headers())
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IMPORT_PREVIEW_STALE"
    assert client.post(PATH, json=body(client), headers=headers()).status_code == 201
    conflicting = ROW.copy()
    conflicting[1] = "Mudança não autorizada pelo importador"
    assert not preview(client, csv_text([conflicting]))["valid"]


def test_parser_limits_and_corrupt_files(client):
    for text in (
        "a,b\n1,2",
        csv_text([ROW] * 501),
        csv_text() + '"unterminated',
        csv_text().replace("floor_id", "floor_name", 1),
    ):
        assert not preview(client, text)["valid"]
    assert client.post(PATH + "/preview", json={"csv_text": "á" * 524289}).status_code == 422
    assert client.post(PATH + "/preview", json={"csv_text": "bad\x00csv"}).status_code == 422


def test_late_failure_rolls_back_catalog_audit_and_idempotency(client, seeded, monkeypatch):
    from app import scope_import

    data = body(client)
    original = scope_import.audit
    calls = 0

    def fail_after_insert(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("Synthetic late failure")
        return original(*args, **kwargs)

    key = headers()
    monkeypatch.setattr(scope_import, "audit", fail_after_insert)
    assert client.post(PATH, json=data, headers=key).status_code == 500
    with Session(seeded) as session:
        assert session.get(Floor, ("claro-bi02", "csv-floor")) is None
        assert session.scalar(select(func.count()).select_from(CatalogAudit)) == 0
    monkeypatch.setattr(scope_import, "audit", original)
    assert client.post(PATH, json=data, headers=key).status_code == 201


def test_concurrent_identical_import_replays_without_duplicates(client, seeded):
    data = body(client)
    key = headers()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post(PATH, json=data, headers=key), range(2)))
    assert sorted(result.status_code for result in results) == [200, 201]
    assert results[0].json() == results[1].json()
    with Session(seeded) as session:
        assert session.scalar(select(func.count()).select_from(CatalogAudit)) == 6


def test_non_admin_cannot_preview_or_import(client, seeded):
    data = body(client)
    with Session(seeded) as session, session.begin():
        session.get(Membership, ("claro-bi02", EDITOR)).role = "editor"
    assert client.post(PATH + "/preview", json={"csv_text": csv_text()}).status_code == 403
    assert client.post(PATH, json=data, headers=headers()).status_code == 403
    assert (
        client.post(
            "/api/v1/projects/other-project/admin/scope-import/preview",
            json={"csv_text": csv_text()},
        ).status_code
        == 403
    )
