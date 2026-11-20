from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import Identity, identity
from app.models import Idempotency, ProductionRecord, Scope
from app.schemas import today
from tests.conftest import VIEWER

PREFIX = "/api/v1/projects/claro-bi02"


def payload(item="wall-east", percentage="25", version=1):
    return {
        "execution_date": today().isoformat(),
        "observation": "Conferência",
        "entries": [
            {
                "scope_item_id": item,
                "expected_version": version,
                "measurement_type": "percentage",
                "daily_percentage": percentage,
            }
        ],
    }


def headers(key=None):
    return {"Idempotency-Key": str(key or uuid4())}


def test_cascade_is_scoped_and_requires_membership(client):
    assert client.get(PREFIX + "/me").json()["role"] == "admin"
    assert len(client.get(PREFIX + "/floors").json()["items"]) == 2
    assert client.get(PREFIX + "/environments", params={"floor_id": "floor-3"}).json() == {
        "items": []
    }
    response = client.get(PREFIX + "/environments", params={"floor_id": "unknown"})
    assert response.status_code == 422
    assert client.get("/api/v1/projects/other-project/floors").status_code == 403
    assert (
        client.get(
            PREFIX + "/scope-items",
            params={"environment_id": "meeting-1", "activity_id": "painting"},
        ).json()["items"][0]["unit"]
        == "m2"
    )
    assert (
        client.get(
            PREFIX + "/scope-catalog", params={"floor_id": "floor-3", "scope_item_id": "wall-east"}
        ).status_code
        == 422
    )


def test_persists_decimal_increment_and_replays_original_response(client, seeded):
    key = headers()
    first = client.post(PREFIX + "/production-batches", json=payload(), headers=key)
    assert first.status_code == 201, first.text
    assert Decimal(first.json()["items"][0]["executed_quantity"]) == Decimal("6.5")
    with Session(seeded) as session:
        assert session.get(Scope, ("claro-bi02", "wall-east")).executed_quantity == Decimal("6.5")
    replay = client.post(PREFIX + "/production-batches", json=payload(), headers=key)
    assert replay.status_code == 200
    assert replay.json() == first.json()
    changed = client.post(
        PREFIX + "/production-batches", json=payload(percentage="20"), headers=key
    )
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


def test_failed_batch_is_fully_rolled_back_and_key_can_be_reused(client, seeded):
    key = headers()
    body = payload("wall-west", "25")
    body["entries"].append(payload(percentage="75")["entries"][0])
    result = client.post(PREFIX + "/production-batches", json=body, headers=key)
    assert result.status_code == 422
    with Session(seeded) as session:
        assert session.get(Scope, ("claro-bi02", "wall-west")).executed_quantity == 0
        assert session.scalar(select(func.count()).select_from(ProductionRecord)) == 2
        assert session.scalar(select(func.count()).select_from(Idempotency)) == 0
    assert (
        client.post(
            PREFIX + "/production-batches", json=payload("wall-west", "25"), headers=key
        ).status_code
        == 201
    )


def test_unit_cannot_be_counted_twice_and_errors_are_normalized(client):
    body = {
        "execution_date": today().isoformat(),
        "entries": [
            {
                "scope_item_id": "door-1",
                "expected_version": 1,
                "measurement_type": "unit",
                "completed": True,
            }
        ],
    }
    assert (
        client.post(PREFIX + "/production-batches", json=body, headers=headers()).status_code == 201
    )
    body["entries"][0]["expected_version"] = 2
    result = client.post(PREFIX + "/production-batches", json=body, headers=headers())
    assert result.status_code == 409
    assert result.json()["error"]["code"] == "ALREADY_COMPLETED"
    body["entries"][0]["completed"] = False
    assert (
        client.post(PREFIX + "/production-batches", json=body, headers=headers()).json()["error"][
            "code"
        ]
        == "VALIDATION_ERROR"
    )


def test_viewer_cannot_write_or_forge_author(client, application):
    application.dependency_overrides[identity] = lambda: Identity(VIEWER)
    assert client.get(PREFIX + "/scope-catalog").status_code == 200
    assert (
        client.post(PREFIX + "/production-batches", json=payload(), headers=headers()).status_code
        == 403
    )
    application.dependency_overrides.pop(identity)


def test_concurrent_distinct_requests_never_overrun_balance(application, seeded):
    def send(_index):
        with TestClient(application, raise_server_exceptions=False) as browser:
            response = browser.post(
                PREFIX + "/production-batches", json=payload(percentage="40"), headers=headers()
            )
            return response.status_code, response.text

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(send, range(2)))
    assert sorted(code for code, _ in results) == [201, 409], results
    with Session(seeded) as session:
        assert session.get(Scope, ("claro-bi02", "wall-east")).executed_quantity == Decimal("8")


def test_simultaneous_replay_is_exactly_once(application, seeded):
    key = headers()

    def send(_index):
        with TestClient(application, raise_server_exceptions=False) as browser:
            response = browser.post(PREFIX + "/production-batches", json=payload(), headers=key)
            return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(send, range(2)))
    assert sorted(code for code, _ in results) == [200, 201], results
    assert results[0][1] == results[1][1]
    with Session(seeded) as session:
        assert session.scalar(select(func.count()).select_from(ProductionRecord)) == 3
