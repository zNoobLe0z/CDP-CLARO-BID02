from sqlalchemy.orm import Session

from app.models import Membership
from tests.conftest import EDITOR
from tests.test_production import PREFIX, headers, payload

ADMIN = PREFIX + "/admin"


def test_create_update_replay_and_audit(client):
    body = {"id": "floor-new", "name": "Novo andar", "reason": "Cadastro inicial"}
    key = headers()
    first = client.post(ADMIN + "/catalog/floors", json=body, headers=key)
    assert first.status_code == 201, first.text
    assert first.json()["version"] == 1
    assert client.post(ADMIN + "/catalog/floors", json=body, headers=key).json() == first.json()
    changed = body | {"name": "Andar revisado", "expected_version": 1}
    response = client.put(ADMIN + "/catalog/floors/floor-new", json=changed, headers=headers())
    assert response.status_code == 200, response.text
    assert response.json()["version"] == 2
    assert (
        client.put(ADMIN + "/catalog/floors/floor-new", json=changed, headers=headers()).status_code
        == 409
    )
    audit = client.get(ADMIN + "/audit", params={"entity_id": "floor-new"}).json()["items"]
    assert len(audit) == 2
    assert audit[0]["before"]["name"] == "Novo andar"
    assert audit[0]["after"]["name"] == "Andar revisado"


def test_editor_cannot_administer_and_cross_project_parent_rejected(client, seeded):
    invalid = {"id": "new", "name": "Sala", "floor_id": "unknown", "reason": "Cadastro inicial"}
    assert (
        client.post(ADMIN + "/catalog/environments", json=invalid, headers=headers()).status_code
        == 422
    )
    with Session(seeded) as session, session.begin():
        session.get(Membership, ("claro-bi02", EDITOR)).role = "editor"
    assert client.get(ADMIN + "/catalog/floors").status_code == 403
    assert (
        client.post(ADMIN + "/catalog/environments", json=invalid, headers=headers()).status_code
        == 403
    )
    assert client.get("/api/v1/projects/other-project/admin/catalog/floors").status_code == 403


def test_production_freezes_scope_and_parent_relationships(client):
    assert (
        client.post(PREFIX + "/production-batches", json=payload(), headers=headers()).status_code
        == 201
    )
    scope = next(
        row
        for row in client.get(ADMIN + "/catalog/scope-items").json()["items"]
        if row["id"] == "wall-east"
    )
    fields = (
        "id",
        "element_id",
        "activity_id",
        "measurement_type",
        "unit",
        "planned_quantity",
        "production_weight",
    )
    body = {key: scope[key] for key in fields} | {
        "expected_version": scope["version"],
        "reason": "Revisão do peso",
    }
    body["production_weight"] = "900"
    response = client.put(ADMIN + "/catalog/scope-items/wall-east", json=body, headers=headers())
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "CATALOG_IN_USE"
    element = next(
        row
        for row in client.get(ADMIN + "/catalog/elements").json()["items"]
        if row["id"] == scope["element_id"]
    )
    body = {key: element[key] for key in ("id", "name", "code", "environment_id")} | {
        "expected_version": element["version"],
        "reason": "Ajuste de nome",
    }
    body["name"] = "Parede conferida"
    assert (
        client.put(
            ADMIN + "/catalog/elements/" + element["id"], json=body, headers=headers()
        ).status_code
        == 200
    )


def test_binary_validation_and_duplicate_scope(client):
    scope = client.get(ADMIN + "/catalog/scope-items").json()["items"][0]
    body = {
        key: scope[key]
        for key in (
            "element_id",
            "activity_id",
            "measurement_type",
            "unit",
            "planned_quantity",
            "production_weight",
        )
    } | {"id": "duplicate", "reason": "Cadastro inicial"}
    assert (
        client.post(ADMIN + "/catalog/scope-items", json=body, headers=headers()).status_code == 409
    )
    body |= {"measurement_type": "unit", "unit": "m2", "planned_quantity": "2"}
    assert (
        client.post(ADMIN + "/catalog/scope-items", json=body, headers=headers()).status_code == 422
    )


def test_initial_catalog_enters_cascade_and_accepts_production(client):
    entities = [
        ("floors", {"id": "initial-floor", "name": "Andar inicial"}),
        (
            "environments",
            {"id": "initial-room", "name": "Sala inicial", "floor_id": "initial-floor"},
        ),
        ("disciplines", {"id": "initial-discipline", "name": "Acabamento inicial"}),
        (
            "activities",
            {
                "id": "initial-activity",
                "name": "Pintura inicial",
                "discipline_id": "initial-discipline",
            },
        ),
        (
            "elements",
            {
                "id": "initial-element",
                "name": "Parede inicial",
                "code": "P-001",
                "environment_id": "initial-room",
            },
        ),
        (
            "scope-items",
            {
                "id": "initial-scope",
                "element_id": "initial-element",
                "activity_id": "initial-activity",
                "measurement_type": "percentage",
                "unit": "m2",
                "planned_quantity": "10",
                "production_weight": "5",
            },
        ),
        ("companies", {"id": "initial-company", "name": "Empresa inicial"}),
    ]
    for kind, data in entities:
        response = client.post(
            ADMIN + "/catalog/" + kind,
            json=data | {"reason": "Carga inicial do escopo"},
            headers=headers(),
        )
        assert response.status_code == 201, response.text
    scope = client.get(
        PREFIX + "/scope-items",
        params={"environment_id": "initial-room", "activity_id": "initial-activity"},
    ).json()["items"]
    assert [item["id"] for item in scope] == ["initial-scope"]
    response = client.post(
        PREFIX + "/production-batches",
        json=payload(item="initial-scope", percentage="25"),
        headers=headers(),
    )
    assert response.status_code == 201, response.text
    assert response.json()["items"][0]["executed_quantity"] == "2.5"
