from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Scope
from app.schemas import today
from tests.test_production import PREFIX, headers, payload


def test_correction_keeps_original_updates_dashboard_and_is_idempotent(client, seeded):
    records = client.get(
        PREFIX + "/production-records", params={"scope_item_id": "wall-east"}
    ).json()
    original = records["items"][0]
    body = {
        "quantity": "2.5",
        "reason": "Revisão em campo",
        "expected_record_version": 1,
        "expected_scope_version": 1,
    }
    key = headers()
    result = client.post(
        PREFIX + f"/production-records/{original['id']}/corrections", json=body, headers=key
    )
    assert result.status_code == 201, result.text
    assert result.json()["replaces_id"] == original["id"]
    assert (
        client.post(
            PREFIX + f"/production-records/{original['id']}/corrections", json=body, headers=key
        ).json()
        == result.json()
    )
    updated = client.get(
        PREFIX + "/production-records", params={"scope_item_id": "wall-east"}
    ).json()["items"]
    assert len(updated) == 2
    assert (
        next(record for record in updated if record["id"] == original["id"])["quantity"]
        == original["quantity"]
    )
    assert (
        next(record for record in updated if record["id"] == original["id"])["status"]
        == "corrected"
    )
    dashboard = client.get(
        PREFIX + "/dashboard",
        params={"reference_date": today().isoformat(), "scope_item_id": "wall-east"},
    ).json()
    assert Decimal(dashboard["overall_percentage"]) == 25
    assert dashboard["daily_production"][0]["quantity"] == "2.5"
    with Session(seeded) as session:
        assert session.get(Scope, ("claro-bi02", "wall-east")).executed_quantity == Decimal("2.5")


def test_correction_rejects_stale_balance_and_pagination_filters(client):
    original = client.get(PREFIX + "/production-records", params={"search": "PAR-01"}).json()[
        "items"
    ][0]
    assert (
        client.post(PREFIX + "/production-batches", json=payload(), headers=headers()).status_code
        == 201
    )
    body = {
        "quantity": "3",
        "reason": "Nova medição",
        "expected_record_version": 1,
        "expected_scope_version": 1,
    }
    assert (
        client.post(
            PREFIX + f"/production-records/{original['id']}/corrections",
            json=body,
            headers=headers(),
        ).status_code
        == 409
    )
    assert client.get(PREFIX + "/production-records", params={"page_size": 1}).json()["total"] == 3
    assert (
        len(client.get(PREFIX + "/production-records", params={"page_size": 1}).json()["items"])
        == 1
    )
    assert (
        client.get(PREFIX + "/production-records", params={"floor_id": "floor-3"}).json()["total"]
        == 0
    )


def test_workforce_zero_revisions_and_concurrent_version(client):
    day = today().isoformat()
    path = PREFIX + f"/workforce/{day}/company-a"
    body = {"headcount": 0, "observation": "", "expected_version": None}
    key = headers()
    first = client.put(path, json=body, headers=key)
    assert first.status_code == 201, first.text
    assert client.put(path, json=body, headers=key).json() == first.json()
    second = client.put(
        path,
        json={"headcount": 5, "observation": "Contagem revista", "expected_version": 1},
        headers=headers(),
    )
    assert second.status_code == 200, second.text
    revisions = client.get(PREFIX + f"/workforce-records/{first.json()['id']}/revisions").json()[
        "items"
    ]
    assert revisions[0]["headcount"] == 0
    assert revisions[0]["version"] == 1
    assert client.put(path, json=body, headers=headers()).status_code == 409
    listing = client.get(PREFIX + "/workforce", params={"start_date": day, "end_date": day}).json()[
        "items"
    ]
    assert len(listing) == 1 and listing[0]["headcount"] == 5
    assert (
        client.put(
            path, json={"headcount": -1, "expected_version": 2}, headers=headers()
        ).status_code
        == 422
    )


def test_dashboard_uses_weights_and_keeps_units_separate(client):
    dashboard = client.get(
        PREFIX + "/dashboard", params={"reference_date": today().isoformat()}
    ).json()
    assert Decimal(dashboard["overall_percentage"]) == 32
    assert {record["unit"] for record in dashboard["daily_production"]} == {"m2", "un"}
    empty = client.get(
        PREFIX + "/dashboard", params={"reference_date": today().isoformat(), "floor_id": "floor-3"}
    ).json()
    assert empty["overall_percentage"] is None
    assert (
        client.get(
            PREFIX + "/scope-catalog", params={"activity_id": "doors", "scope_item_id": "wall-east"}
        ).status_code
        == 422
    )
